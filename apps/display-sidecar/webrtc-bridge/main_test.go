package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"errors"
	"strings"
	"testing"

	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v4"
)

func encodedMediaFrame(kind uint8, sequence uint32, pts uint64, flags uint16, payload []byte) []byte {
	out := make([]byte, mediaHeaderBytes+len(payload))
	copy(out[:4], mediaMagic[:])
	out[4] = mediaVersion
	out[5] = kind
	binary.BigEndian.PutUint16(out[6:8], flags)
	binary.BigEndian.PutUint32(out[8:12], sequence)
	binary.BigEndian.PutUint64(out[12:20], pts)
	binary.BigEndian.PutUint32(out[20:24], uint32(len(payload)))
	copy(out[24:], payload)
	return out
}

func TestReadMediaFrame(t *testing.T) {
	payload := []byte{0x00, 0x00, 0x00, 0x01, 0x65}
	frame, err := readMediaFrame(
		bytes.NewReader(encodedMediaFrame(mediaKindVideo, 7, 42_000, mediaFlagKey|mediaFlagGap, payload)),
		mediaKindVideo,
	)
	if err != nil {
		t.Fatalf("expected RBD1 frame, got %v", err)
	}
	if frame.sequence != 7 || frame.timestampUs != 42_000 || !frame.keyFrame || !frame.discontinuity {
		t.Fatalf("unexpected frame metadata: %+v", frame)
	}
	if !bytes.Equal(frame.data, payload) {
		t.Fatalf("expected payload %x, got %x", payload, frame.data)
	}
}

func TestReadMediaFrameRejectsKindAndLength(t *testing.T) {
	if _, err := readMediaFrame(
		bytes.NewReader(encodedMediaFrame(mediaKindAudio, 1, 0, 0, []byte{1})),
		mediaKindVideo,
	); err == nil || !strings.Contains(err.Error(), "kind") {
		t.Fatalf("expected kind error, got %v", err)
	}
	header := encodedMediaFrame(mediaKindVideo, 1, 0, 0, []byte{1})[:mediaHeaderBytes]
	binary.BigEndian.PutUint32(header[20:24], 0)
	if _, err := readMediaFrame(bytes.NewReader(header), mediaKindVideo); err == nil || !strings.Contains(err.Error(), "length") {
		t.Fatalf("expected length error, got %v", err)
	}
}

func TestReadCommandsForwardsOnlyValidDataChannelMessages(t *testing.T) {
	reader := bufio.NewReader(strings.NewReader(
		"not-json\n" +
			`{"type":"ignored","payload":{"type":"action"}}` + "\n" +
			`{"type":"datachannel","payload":{"type":"action"}}` + "\n",
	))
	var messages [][]byte
	readCommands(reader, func(payload []byte) {
		messages = append(messages, append([]byte(nil), payload...))
	})
	if len(messages) != 1 || string(messages[0]) != `{"type":"action"}` {
		t.Fatalf("expected one bounded data-channel payload, got %q", messages)
	}
}

func TestProtocolBoundsPortRange(t *testing.T) {
	if _, _, ok := parsePortRange("40000-40100"); !ok {
		t.Fatal("expected valid port range")
	}
	if _, _, ok := parsePortRange("60000-70000"); ok {
		t.Fatal("expected out-of-range port to fail")
	}
}

func TestRegistersOnlyConfiguredH264Profile(t *testing.T) {
	mediaEngine := &webrtc.MediaEngine{}
	const fmtp = "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42c033"
	if err := registerMediaCodecs(mediaEngine, configMessage{H264FmtpLine: fmtp}); err != nil {
		t.Fatalf("register codecs: %v", err)
	}
	codec := configuredH264Codec(configMessage{H264FmtpLine: fmtp})
	if codec.MimeType != webrtc.MimeTypeH264 || codec.SDPFmtpLine != fmtp {
		t.Fatalf("unexpected H.264 codec: %+v", codec)
	}
	if codec.PayloadType != 96 || codec.ClockRate != 90_000 {
		t.Fatalf("unexpected H.264 RTP parameters: %+v", codec)
	}
}

func TestRTPTimestampUsesPTSAndWraps(t *testing.T) {
	if got := rtpTimestampForPTS(1_000_000, 10, 1_016_667); got != 1510 {
		t.Fatalf("expected exact 90kHz timestamp delta, got %d", got)
	}
	if got := rtpTimestampForPTS(0, ^uint32(0)-10, 1_000_000); got != 89_989 {
		t.Fatalf("expected uint32 RTP wrap, got %d", got)
	}
}

func TestSharedTimelinePreservesAudioVideoStartupSkew(t *testing.T) {
	timeline := &sourceTimeline{}
	video, videoErr := timeline.rtpTimestamp(mediaKindVideo, 1_010_000, videoClockRate)
	audio, audioErr := timeline.rtpTimestamp(mediaKindAudio, 990_000, audioClockRate)
	if videoErr != nil || audioErr != nil {
		t.Fatalf("expected shared timeline, got video=%v audio=%v", videoErr, audioErr)
	}
	if video != mediaRTPOrigin {
		t.Fatalf("expected first video timestamp at RTP origin, got %d", video)
	}
	if mediaRTPOrigin-audio != 960 {
		t.Fatalf("expected -20ms audio offset, got %d", mediaRTPOrigin-audio)
	}
}

func TestSharedTimelinePreservesDroppedVideoGap(t *testing.T) {
	timeline := &sourceTimeline{}
	first, firstErr := timeline.rtpTimestamp(mediaKindVideo, 1_000_000, videoClockRate)
	resumed, resumedErr := timeline.rtpTimestamp(mediaKindVideo, 2_000_000, videoClockRate)
	if firstErr != nil || resumedErr != nil {
		t.Fatalf("expected shared timeline, got first=%v resumed=%v", firstErr, resumedErr)
	}
	if resumed-first != 90_000 {
		t.Fatalf("expected one-second RTP gap, got %d ticks", resumed-first)
	}
}

func TestSharedTimelineRejectsTrackLocalRebase(t *testing.T) {
	timeline := &sourceTimeline{}
	if _, err := timeline.rtpTimestamp(mediaKindVideo, 2_000_000, videoClockRate); err != nil {
		t.Fatalf("expected initial video timestamp, got %v", err)
	}
	if _, err := timeline.rtpTimestamp(mediaKindAudio, 2_000_000, audioClockRate); err != nil {
		t.Fatalf("expected initial audio timestamp, got %v", err)
	}
	if _, err := timeline.rtpTimestamp(mediaKindVideo, 1_000_000, videoClockRate); !errors.Is(err, errSourceTimestampRegressed) {
		t.Fatalf("expected regression error, got %v", err)
	}
	if _, err := timeline.rtpTimestamp(mediaKindAudio, 2_020_000, audioClockRate); !errors.Is(err, errSourceTimestampRegressed) {
		t.Fatalf("expected shared timeline failure, got %v", err)
	}
}

func TestSharedTimelineAcceptsUnsigned64BitPTS(t *testing.T) {
	origin := ^uint64(0) - 20_000
	got := rtpTimestampForSharedPTS(origin, mediaRTPOrigin, origin+10_000, videoClockRate)
	if got-mediaRTPOrigin != 900 {
		t.Fatalf("expected unsigned timestamp delta, got %d", got-mediaRTPOrigin)
	}
}

func TestRTCPFeedbackRequestsGOPRecoveryAndCountsLoss(t *testing.T) {
	metrics := &bridgeMetrics{}
	recovery := &videoRecovery{}
	handleRTCPPacket(&rtcp.TransportLayerNack{
		Nacks: rtcp.NackPairsFromSequenceNumbers([]uint16{10, 11, 14}),
	}, metrics, recovery)
	handleRTCPPacket(&rtcp.PictureLossIndication{}, metrics, recovery)
	handleRTCPPacket(&rtcp.PictureLossIndication{}, metrics, recovery)
	handleRTCPPacket(&rtcp.FullIntraRequest{}, metrics, recovery)
	handleRTCPPacket(&rtcp.ReceiverReport{Reports: []rtcp.ReceptionReport{{
		TotalLost: 7,
		Jitter:    90,
	}}}, metrics, recovery)

	generation, requestedAt := recovery.snapshot()
	if metrics.nacks.Load() != 3 || metrics.plis.Load() != 2 {
		t.Fatalf("unexpected NACK/PLI metrics: %d/%d", metrics.nacks.Load(), metrics.plis.Load())
	}
	if metrics.packetsLost.Load() != 7 || metrics.jitter.Load() != 90 {
		t.Fatalf("unexpected receiver report metrics")
	}
	if generation != 1 || requestedAt.IsZero() {
		t.Fatalf("PLI/FIR recovery requests were not rate limited")
	}
}

func TestVideoRecoveryExpiresAfterOneAndAHalfSecondsOfPTS(t *testing.T) {
	startedAt := uint64(10_000_000)
	if recoveryExpiredPTS(startedAt, startedAt+1_500_000) {
		t.Fatal("recovery expired at the boundary")
	}
	if !recoveryExpiredPTS(startedAt, startedAt+1_500_001) {
		t.Fatal("recovery did not expire after the boundary")
	}
}
