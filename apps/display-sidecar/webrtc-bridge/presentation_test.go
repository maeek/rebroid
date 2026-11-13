package main

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/pion/rtcp"
)

func acknowledgeFrame(recovery *videoRecovery, timestamp uint32, now time.Time) {
	recovery.consumePresentation([]byte(fmt.Sprintf(`{"type":"video-frame-presented","rtpTimestamp":%d}`, timestamp)), now)
}

func TestIdlePictureLossReplayDoesNotRestartEncoder(t *testing.T) {
	// Local browser replay of Android's short repeat burst: all 11 frames
	// decoded, zero loss/NACKs, then a PLI ~4.2s after the burst began.
	start := time.Unix(1_794_563_310, 0)
	recovery := &videoRecovery{}
	recovery.accept(mediaFrame{config: true, data: []byte{7}})
	for i := 0; i <= 10; i++ {
		frame := mediaFrame{timestampUs: uint64(i * 100_000), keyFrame: i == 0, data: []byte{1}}
		if payload, err := recovery.accept(frame); err != nil || len(payload) == 0 {
			t.Fatalf("repeat frame %d rejected: %v", i, err)
		}
		recovery.beginFrame(uint32(i * 9_000))
		recovery.finishFrame(start.Add(time.Duration(i) * 100 * time.Millisecond))
	}
	acknowledgeFrame(recovery, 90_000, start.Add(2*time.Second))
	decision := recovery.requestPLI(start.Add(4_200 * time.Millisecond))
	if decision.requested || !decision.idle() || recovery.generation.Load() != 0 {
		t.Fatalf("idle PLI restarted recovery: %+v", decision)
	}
	// The next changed screen must remain decodable without a reset/IDR.
	if payload, err := recovery.accept(mediaFrame{timestampUs: 10_000_000, data: []byte{1}}); err != nil || len(payload) == 0 {
		t.Fatalf("idle PLI discarded the resumed delta frame: %v", err)
	}
	recovery.beginFrame(900_000)
	recovery.finishFrame(start.Add(10 * time.Second))
	if decision = recovery.requestPLI(start.Add(13 * time.Second)); !decision.requested || decision.idle() {
		t.Fatal("a new unacknowledged frame must still request recovery")
	}
}

func TestHostPictureLossResetLoopReplay(t *testing.T) {
	// PLI offsets from the host trace. The trace did not include the browser's
	// acknowledgements, so replay it with each plausible acknowledgement outcome.
	offsetsMs := []int{
		0, 4214, 8396, 12591, 16793, 20985, 25211, 29396, 33592, 37787,
		41980, 46174, 50376, 54566, 60000, 64201, 68401, 72597, 76785,
		80981, 85174, 89373, 93576, 97763, 101952, 106149, 110330, 114521,
		120001, 124196, 128392, 132591, 136795, 140994, 145190, 149393, 153581, 157772,
	}
	start := time.Unix(1_794_578_464, 0)
	for _, test := range []struct {
		name     string
		ack      func(recovery *videoRecovery, timestamp uint32, pliAt time.Time)
		resets   uint64
		evidence string
	}{
		{"no acknowledgement", func(*videoRecovery, uint32, time.Time) {}, 38, "missing-ack"},
		{"previous frame", func(r *videoRecovery, timestamp uint32, pliAt time.Time) {
			acknowledgeFrame(r, timestamp-1, pliAt.Add(-time.Second))
		}, 38, "mismatched-ack"},
		{"expired acknowledgement", func(r *videoRecovery, timestamp uint32, pliAt time.Time) {
			acknowledgeFrame(r, timestamp, pliAt.Add(-3100*time.Millisecond))
		}, 38, "expired-ack"},
		{"fresh exact acknowledgement", func(r *videoRecovery, timestamp uint32, pliAt time.Time) {
			acknowledgeFrame(r, timestamp, pliAt.Add(-time.Second))
		}, 0, "acknowledged-idle"},
	} {
		t.Run(test.name, func(t *testing.T) {
			recovery := &videoRecovery{}
			for i, offsetMs := range offsetsMs {
				pliAt := start.Add(time.Duration(offsetMs) * time.Millisecond)
				timestamp := uint32((i + 1) * 90_000)
				recovery.beginFrame(timestamp)
				recovery.finishFrame(pliAt.Add(-4 * time.Second))
				test.ack(recovery, timestamp, pliAt)
				decision := recovery.requestPLI(pliAt)
				if decision.evidence != test.evidence || !decision.trace {
					t.Fatalf("at offset %d ms got %+v, want trace with evidence %s", offsetMs, decision, test.evidence)
				}
			}
			if resets := recovery.generation.Load(); resets != test.resets {
				t.Fatalf("got %d resets, want %d", resets, test.resets)
			}
		})
	}
}

func TestPictureLossNeedsFreshExactIdlePresentation(t *testing.T) {
	now := time.Now()
	for _, test := range []struct {
		name       string
		payload    string
		writtenAgo time.Duration
		ackAgo     time.Duration
		idle       bool
	}{
		{"idle", `{"type":"video-frame-presented","rtpTimestamp":42}`, 3 * time.Second, time.Second, true},
		{"active", `{"type":"video-frame-presented","rtpTimestamp":42}`, time.Second, 0, false},
		{"no acknowledgement", `{}`, 3 * time.Second, time.Second, false},
		{"wrong frame", `{"type":"video-frame-presented","rtpTimestamp":41}`, 3 * time.Second, time.Second, false},
		{"expired", `{"type":"video-frame-presented","rtpTimestamp":42}`, 8 * time.Second, 4 * time.Second, false},
		{"missing timestamp", `{"type":"video-frame-presented"}`, 3 * time.Second, time.Second, false},
		{"null timestamp", `{"type":"video-frame-presented","rtpTimestamp":null}`, 3 * time.Second, time.Second, false},
		{"negative timestamp", `{"type":"video-frame-presented","rtpTimestamp":-1}`, 3 * time.Second, time.Second, false},
		{"overflow timestamp", `{"type":"video-frame-presented","rtpTimestamp":4294967296}`, 3 * time.Second, time.Second, false},
		{"fractional timestamp", `{"type":"video-frame-presented","rtpTimestamp":42.5}`, 3 * time.Second, time.Second, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			recovery := &videoRecovery{}
			recovery.beginFrame(42)
			recovery.finishFrame(now.Add(-test.writtenAgo))
			recovery.consumePresentation([]byte(test.payload), now.Add(-test.ackAgo))
			decision := recovery.requestPLI(now)
			if decision.idle() != test.idle || decision.requested == test.idle {
				t.Fatalf("got %+v, expected idle=%v", decision, test.idle)
			}
		})
	}
}

func TestPresentationEvidenceInvalidation(t *testing.T) {
	now := time.Now()
	for _, test := range []struct {
		name       string
		invalidate func(*videoRecovery)
	}{
		{"reset", func(r *videoRecovery) { r.request(now.Add(-2 * time.Second)) }},
		{"new frame", func(r *videoRecovery) { r.beginFrame(43); r.finishFrame(now.Add(-3 * time.Second)) }},
		{"configuration", func(r *videoRecovery) { r.accept(mediaFrame{config: true}) }},
		{"discontinuity", func(r *videoRecovery) { r.accept(mediaFrame{discontinuity: true}) }},
	} {
		t.Run(test.name, func(t *testing.T) {
			r := &videoRecovery{}
			r.beginFrame(42)
			r.finishFrame(now.Add(-4 * time.Second))
			acknowledgeFrame(r, 42, now.Add(-time.Second))
			test.invalidate(r)
			acknowledgeFrame(r, 42, now) // Late messages cannot restore invalidated evidence.
			if decision := r.requestPLI(now); !decision.requested || decision.idle() {
				t.Fatal("stale evidence suppressed recovery")
			}
		})
	}
}

func TestIdlePLIMetricsAndFIRRecovery(t *testing.T) {
	now := time.Now()
	r := &videoRecovery{}
	r.beginFrame(0xffffffff)
	r.finishFrame(now.Add(-3 * time.Second))
	acknowledgeFrame(r, 0xffffffff, now.Add(-time.Second))
	metrics := &bridgeMetrics{}
	var events []stdoutMessage
	emit := func(message stdoutMessage) { events = append(events, message) }
	handleRTCPPacket(&rtcp.PictureLossIndication{MediaSSRC: 11}, 11, metrics, &metrics.videoFeedback, r, emit)
	if len(events) != 1 || events[0].Type != "log" ||
		!strings.Contains(events[0].Message, "evidence=acknowledged-idle resetRequested=false") ||
		!strings.Contains(events[0].Message, "ackReceived=1 ackMatched=1") ||
		metrics.idlePlisIgnored.Load() != 1 || metrics.plis.Load() != 1 {
		t.Fatal("idle PLI should be counted without a reset")
	}
	handleRTCPPacket(&rtcp.PictureLossIndication{MediaSSRC: 11}, 11, metrics, &metrics.videoFeedback, r, emit)
	if len(events) != 1 || metrics.idlePlisIgnored.Load() != 2 {
		t.Fatal("burst of PLIs should count each request but rate-limit traces")
	}
	handleRTCPPacket(&rtcp.FullIntraRequest{FIR: []rtcp.FIREntry{{SSRC: 11}}}, 11, metrics, &metrics.videoFeedback, r, emit)
	if len(events) != 2 || events[1].Message != "fir" {
		t.Fatal("FIR must retain explicit recovery")
	}
}

func TestRepeatedAcknowledgementDoesNotExtendEvidence(t *testing.T) {
	now := time.Now()
	r := &videoRecovery{}
	r.beginFrame(0)
	r.finishFrame(now.Add(-5 * time.Second))
	acknowledgeFrame(r, 0, now.Add(-4*time.Second))
	acknowledgeFrame(r, 0, now)
	if decision := r.requestPLI(now); !decision.requested || decision.idle() {
		t.Fatal("replayed acknowledgement extended evidence lifetime")
	}
}
