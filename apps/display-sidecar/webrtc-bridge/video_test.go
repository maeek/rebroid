package main

import (
	"bytes"
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
	feedback := time.Now()
	recovery.waitForVideoReset(feedback.Add(-time.Millisecond).UnixMilli())
	recovery.request(feedback)
	for _, pts := range []uint64{0, 1_000_000} {
		if payload, err := recovery.accept(mediaFrame{timestampUs: pts, data: []byte{1}}); payload != nil || err != nil {
			t.Fatalf("expected a dropped delta at %d, got %v %v", pts, payload, err)
		}
	}
	if !recovery.request(feedback.Add(time.Second)) {
		t.Fatal("expected second feedback admission")
	}
	if _, err := recovery.accept(mediaFrame{timestampUs: 1_500_001, discontinuity: true}); err == nil || !strings.Contains(err.Error(), "without a recovery keyframe") {
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
	put(50_000, 0, delta)
	put(1_600_001, 0, delta)
	put(2_800_000, 0, delta)
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
			recovery.waitForVideoReset(now.Add(3 * time.Second).UnixMilli())
		}
	})
	if err != nil || metrics.videoDropped.Load() != 3 || metrics.videoFrames.Load() != 3 {
		t.Fatalf("expected IDR and next delta on the same relay, got dropped=%d relayed=%d err=%v",
			metrics.videoDropped.Load(), metrics.videoFrames.Load(), err)
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
