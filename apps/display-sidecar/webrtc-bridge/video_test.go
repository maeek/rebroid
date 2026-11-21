package main

import (
	"bytes"
	"encoding/binary"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/pion/rtp"
)

type captureRTP struct {
	timestamps []uint32
	failure    error
}

func (capture *captureRTP) WriteRTP(packet *rtp.Packet) error {
	capture.timestamps = append(capture.timestamps, packet.Timestamp)
	return capture.failure
}

func TestRepeatedFeedbackKeepsFirstDroppedPTS(t *testing.T) {
	var recovery videoRecovery
	feedback := time.Unix(10, 0)
	recovery.request(feedback)
	for _, pts := range []uint64{0, 1_000_000} {
		if unit, err := recovery.accept(mediaFrame{timestampUs: pts, data: []byte{1}}, sourceVideoReset{}, feedback); unit.data != nil || err != nil {
			t.Fatalf("expected a dropped delta at %d, got %v %v", pts, unit.data, err)
		}
	}
	if !recovery.request(feedback.Add(time.Second)) {
		t.Fatal("expected second feedback admission")
	}
	if _, err := recovery.accept(mediaFrame{timestampUs: 1_500_001, discontinuity: true}, sourceVideoReset{}, feedback.Add(time.Second)); err == nil || !strings.Contains(err.Error(), "without a recovery keyframe") {
		t.Fatalf("expected original PTS deadline, got %v", err)
	}
}

func TestH264RelayWaitsForConfigAndIDRAfterGap(t *testing.T) {
	var media bytes.Buffer
	put := func(pts uint64, flags uint16, payload []byte) {
		media.Write(encodedMediaFrame(mediaKindVideo, 1, pts, flags, payload))
	}
	config := []byte{0, 0, 0, 1, 0x67, 0x42, 0xe0, 0x1f, 0, 0, 0, 1, 0x68, 0xce, 0x06, 0xe2}
	key := []byte{0, 0, 0, 1, 0x65, 1}
	delta := []byte{0, 0, 0, 1, 0x41, 1}
	put(0, mediaFlagConfig, config)
	put(10, mediaFlagKey, key)
	put(500_010, mediaFlagGap, delta)
	put(750_010, 0, delta)
	put(1_000_010, mediaFlagKey, key)
	var metrics bridgeMetrics
	var output captureRTP
	if err := streamH264(&media, &output, &metrics, &videoRecovery{}, &sourceTimeline{}, func(stdoutMessage) {}); err != nil {
		t.Fatal(err)
	}
	if metrics.videoDropped.Load() != 2 || metrics.videoFrames.Load() != 2 || len(output.timestamps) < 2 {
		t.Fatalf("unexpected relay output: %v", output.timestamps)
	}
	if gap := output.timestamps[len(output.timestamps)-1] - output.timestamps[0]; gap != 90_000 {
		t.Fatalf("expected 90000 ticks of source time, got %d", gap)
	}
}

func encodedVideoReset(reset sourceVideoReset) []byte {
	header := make([]byte, mediaHeaderBytes)
	copy(header, "RBR1")
	binary.BigEndian.PutUint64(header[8:16], reset.generation)
	binary.BigEndian.PutUint64(header[16:24], uint64(reset.deadlineMs))
	return header
}

func TestH264RelayRecoversAfterTwoPointEightFiveSeconds(t *testing.T) {
	var media bytes.Buffer
	put := func(pts uint64, flags uint16, payload []byte) {
		media.Write(encodedMediaFrame(mediaKindVideo, 1, pts, flags, payload))
	}
	config := []byte{0, 0, 0, 1, 0x67, 0x42, 0xe0, 0x1f, 0, 0, 0, 1, 0x68, 0xce, 0x06, 0xe2}
	key := []byte{0, 0, 0, 1, 0x65, 1}
	delta := []byte{0, 0, 0, 1, 0x41, 1}
	put(0, mediaFlagConfig, config)
	put(1, mediaFlagKey, key)
	media.Write(encodedVideoReset(sourceVideoReset{1, time.Now().Add(3 * time.Second).UnixMilli()}))
	put(50_000, 0, delta)
	put(1_600_001, 0, delta)
	put(2_800_000, 0, delta)
	media.Write(encodedVideoReset(sourceVideoReset{}))
	put(2_850_000, mediaFlagConfig, config)
	put(2_850_000, mediaFlagKey, key)
	put(2_900_000, 0, delta)

	var metrics bridgeMetrics
	var track captureRTP
	var recovery videoRecovery
	err := streamH264(&media, &track, &metrics, &recovery, &sourceTimeline{}, func(event stdoutMessage) {
		if event.Message == "first timestamped video access unit written" {
			now := time.Now()
			if !recovery.requestPLI(now).requested {
				t.Fatal("expected recovery after picture loss")
			}
		}
	})
	if err != nil || metrics.videoDropped.Load() != 3 || metrics.videoFrames.Load() != 3 {
		t.Fatalf("expected IDR and next delta on the same relay, got dropped=%d relayed=%d err=%v",
			metrics.videoDropped.Load(), metrics.videoFrames.Load(), err)
	}
}

func TestH264RecoveryExpiresWithAdvancingKeyFlagsThatProduceNoRTP(t *testing.T) {
	var media bytes.Buffer
	config := []byte{0, 0, 0, 1, 0x67, 0x42, 0xe0, 0x1f, 0, 0, 0, 1, 0x68, 0xce, 0x06, 0xe2}
	media.Write(encodedMediaFrame(mediaKindVideo, 0, 0, mediaFlagConfig, config))
	for sequence, pts := range []uint64{1_000_000, 2_000_000, 2_500_000, 2_500_001} {
		// Pion discards access unit delimiters, even when the RBD1 key flag is set.
		media.Write(encodedMediaFrame(mediaKindVideo, uint32(sequence+1), pts, mediaFlagKey, []byte{0, 0, 0, 1, 0x09, 0xf0}))
	}
	var metrics bridgeMetrics
	err := streamH264(&media, &captureRTP{}, &metrics, &videoRecovery{}, &sourceTimeline{}, func(stdoutMessage) {})
	if err == nil || !strings.Contains(err.Error(), "without a recovery keyframe") ||
		metrics.videoFrames.Load() != 0 || metrics.videoDropped.Load() != 4 {
		t.Fatalf("expected recovery expiry on the fourth unwritten key, got sent=%d dropped=%d err=%v",
			metrics.videoFrames.Load(), metrics.videoDropped.Load(), err)
	}
}

func TestRecoveryUsesTheOriginalDeadlineWhenAnotherResetIsConfirmed(t *testing.T) {
	start := time.Unix(10, 0)
	original := sourceVideoReset{1, start.Add(3 * time.Second).UnixMilli()}
	later := sourceVideoReset{2, start.Add(5 * time.Second).UnixMilli()}
	var recovery videoRecovery
	_, _ = recovery.accept(mediaFrame{timestampUs: 1}, original, start)
	recovery.request(start.Add(time.Second))
	if _, err := recovery.accept(mediaFrame{timestampUs: 2_000_001}, later, start.Add(2*time.Second)); err != nil {
		t.Fatalf("expected the original allowance to remain active: %v", err)
	}
	if _, err := recovery.accept(mediaFrame{timestampUs: 2_000_001}, later, start.Add(3*time.Second)); err != nil {
		t.Fatalf("a duplicate timestamp did not advance recovery: %v", err)
	}
	if _, err := recovery.accept(mediaFrame{timestampUs: 3_000_001}, later, start.Add(3*time.Second)); err == nil {
		t.Fatal("the later confirmation extended the original deadline")
	}
}

func TestRecoveryAllowanceIsConsumedByOneWrittenIDR(t *testing.T) {
	start := time.Unix(10, 0)
	for _, test := range []struct {
		name            string
		resetGeneration uint64
		wantError       bool
	}{
		{"stale source reset", 1, true},
		{"new source reset", 2, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			var recovery videoRecovery
			reset := sourceVideoReset{1, start.Add(3 * time.Second).UnixMilli()}
			_, _ = recovery.accept(mediaFrame{timestampUs: 1}, reset, start)
			_, _ = recovery.accept(mediaFrame{config: true, data: []byte{7}}, sourceVideoReset{}, start)
			// The capture completed before the IDR reached the peer. The zero
			// record on the media socket cannot undo the episode's allowance.
			if _, err := recovery.accept(mediaFrame{timestampUs: 1_600_001}, sourceVideoReset{}, start.Add(time.Second)); err != nil {
				t.Fatalf("source completion arrived before the recovery IDR: %v", err)
			}
			unit, err := recovery.accept(mediaFrame{timestampUs: 1_700_001, keyFrame: true, data: []byte{1}}, sourceVideoReset{}, start.Add(time.Second))
			if err != nil || !unit.resumes {
				t.Fatalf("expected a usable IDR: %v", err)
			}
			recovery.finishFrame(unit, start.Add(time.Second))

			next := sourceVideoReset{test.resetGeneration, reset.deadlineMs}
			_, _ = recovery.accept(mediaFrame{timestampUs: 1_800_001, discontinuity: true}, next, start.Add(time.Second))
			_, err = recovery.accept(mediaFrame{timestampUs: 3_400_001}, next, start.Add(2*time.Second))
			if (err != nil) != test.wantError {
				t.Fatalf("recovery with generation %d: %v", test.resetGeneration, err)
			}
		})
	}
}

func TestUsableIDRAfterDeadlineCanStillRecover(t *testing.T) {
	start := time.Unix(10, 0)
	reset := sourceVideoReset{1, start.Add(3 * time.Second).UnixMilli()}
	var recovery videoRecovery
	_, _ = recovery.accept(mediaFrame{config: true, data: []byte{7}}, reset, start)
	_, _ = recovery.accept(mediaFrame{timestampUs: 1}, reset, start)
	now := start.Add(4 * time.Second)
	unit, err := recovery.accept(mediaFrame{timestampUs: 4_000_001, keyFrame: true, data: []byte{1}}, sourceVideoReset{}, now)
	if err != nil || !unit.resumes {
		t.Fatalf("an idle gap must allow the next usable IDR: %v", err)
	}
	recovery.finishFrame(unit, now)
	if delta, err := recovery.accept(mediaFrame{timestampUs: 4_100_001, data: []byte{1}}, sourceVideoReset{}, now); err != nil || len(delta.data) == 0 {
		t.Fatalf("the IDR did not restore delta delivery: %v", err)
	}
}

func TestAudioWriteErrorsCountInAggregate(t *testing.T) {
	input := bytes.NewReader(encodedMediaFrame(mediaKindAudio, 1, 0, 0, []byte{0xf8, 0xff, 0xfe}))
	var metrics bridgeMetrics
	failure := errors.New("audio write failed")
	if err := streamOpus(input, &captureRTP{failure: failure}, &metrics, &sourceTimeline{}, func(stdoutMessage) {}); !errors.Is(err, failure) {
		t.Fatalf("expected audio write failure, got %v", err)
	}
	if metrics.rtpSendErrors.Load() != 1 || metrics.rtpPackets.Load() != 0 {
		t.Fatal("failed audio write should count as one send error")
	}
}

func TestDroppedVideoRegressionInvalidatesSharedTimeline(t *testing.T) {
	var media bytes.Buffer
	for sequence, pts := range []uint64{100, 300, 200} {
		media.Write(encodedMediaFrame(mediaKindVideo, uint32(sequence), pts, 0, []byte{0, 0, 0, 1, 0x41, 1}))
	}
	timeline := &sourceTimeline{}
	err := streamH264(&media, &captureRTP{}, &bridgeMetrics{}, &videoRecovery{}, timeline, func(stdoutMessage) {})
	if !errors.Is(err, errSourceTimestampRegressed) {
		t.Fatalf("expected timestamp regression while dropping deltas, got %v", err)
	}
	if _, err := timeline.rtpTimestamp(mediaKindAudio, 400, audioClockRate); !errors.Is(err, errSourceTimestampRegressed) {
		t.Fatalf("expected the shared timeline to be invalid, got %v", err)
	}
}
