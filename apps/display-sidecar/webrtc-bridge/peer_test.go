package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"testing"
	"time"

	"github.com/pion/ice/v4"
	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v4"
)

func receive[T any](t *testing.T, messages <-chan T) T {
	t.Helper()
	select {
	case message := <-messages:
		return message
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for bridge")
		var zero T
		return zero
	}
}

type attemptFixture struct {
	cancel   context.CancelFunc
	video    *io.PipeWriter
	audio    *io.PipeWriter
	events   chan stdoutMessage
	result   chan error
	client   *webrtc.PeerConnection
	control  *webrtc.DataChannel
	movement *webrtc.DataChannel
	commands *json.Encoder
	answer   string
}

func loopbackICE() webrtc.SettingEngine {
	setting := webrtc.SettingEngine{}
	setting.SetIncludeLoopbackCandidate(true)
	setting.SetIPFilter(net.IP.IsLoopback)
	setting.SetNetworkTypes([]webrtc.NetworkType{webrtc.NetworkTypeUDP4})
	setting.SetICEMulticastDNSMode(ice.MulticastDNSModeDisabled)
	return setting
}

func startAttempt(t *testing.T) *attemptFixture {
	t.Helper()
	return startAttemptWithAudioInput(t, true)
}

func startAttemptWithAudioInput(t *testing.T, hasAudioInput bool) *attemptFixture {
	t.Helper()
	client, err := webrtc.NewAPI(webrtc.WithSettingEngine(loopbackICE())).NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Close() })
	for _, kind := range []webrtc.RTPCodecType{webrtc.RTPCodecTypeVideo, webrtc.RTPCodecTypeAudio} {
		if _, err := client.AddTransceiverFromKind(kind, webrtc.RTPTransceiverInit{Direction: webrtc.RTPTransceiverDirectionRecvonly}); err != nil {
			t.Fatal(err)
		}
	}
	zero := uint16(0)
	if _, err := client.CreateDataChannel("rebroid-control", &webrtc.DataChannelInit{MaxRetransmits: &zero}); err != nil {
		t.Fatal(err)
	}
	control, err := client.CreateDataChannel("rebroid-control", nil)
	if err != nil {
		t.Fatal(err)
	}
	ordered := false
	movement, err := client.CreateDataChannel("rebroid-pointer", &webrtc.DataChannelInit{Ordered: &ordered, MaxRetransmits: &zero})
	if err != nil {
		t.Fatal(err)
	}
	offer, err := client.CreateOffer(nil)
	if err != nil {
		t.Fatal(err)
	}
	gathered := webrtc.GatheringCompletePromise(client)
	if err := client.SetLocalDescription(offer); err != nil {
		t.Fatal(err)
	}
	receive(t, gathered)
	commandIn, commands := io.Pipe()
	videoIn, video := io.Pipe()
	audioIn, audio := io.Pipe()
	ctx, cancel := context.WithCancel(context.Background())
	fixture := &attemptFixture{
		cancel: cancel, video: video, audio: audio, events: make(chan stdoutMessage, 64),
		result: make(chan error, 1), client: client, control: control, movement: movement, commands: json.NewEncoder(commands),
	}
	t.Cleanup(func() {
		cancel()
		_ = commands.Close()
		_ = video.Close()
		_ = audio.Close()
	})
	go func() {
		var input io.ReadCloser
		if hasAudioInput {
			input = audioIn
		} else {
			_ = audioIn.Close()
		}
		fixture.result <- runPeer(ctx, commandIn, videoIn, input, func(event stdoutMessage) { fixture.events <- event }, loopbackICE())
	}()
	if err := fixture.commands.Encode(configMessage{Type: "offer", SDP: client.LocalDescription().SDP, Audio: true}); err != nil {
		t.Fatal(err)
	}
	fixture.answer = fixture.waitEvent(t, "answer").SDP
	return fixture
}

func (fixture *attemptFixture) waitEvent(t *testing.T, kind string) stdoutMessage {
	t.Helper()
	deadline := time.After(5 * time.Second)
	for {
		select {
		case event := <-fixture.events:
			if event.Type == kind {
				return event
			}
		case err := <-fixture.result:
			t.Fatalf("bridge exited while waiting for %s: %v", kind, err)
		case <-deadline:
			t.Fatalf("timed out waiting for %s", kind)
		}
	}
}

func (fixture *attemptFixture) assertVideoActive(t *testing.T) {
	t.Helper()
	config := []byte{0, 0, 0, 1, 0x67, 0x42, 0xe0, 0x1f, 0, 0, 0, 1, 0x68, 0xce, 0x06, 0xe2}
	if _, err := fixture.video.Write(encodedMediaFrame(mediaKindVideo, 0, 0, mediaFlagConfig, config)); err != nil {
		t.Fatal(err)
	}
	if _, err := fixture.video.Write(encodedMediaFrame(mediaKindVideo, 1, 100, mediaFlagKey, []byte{0, 0, 0, 1, 0x65, 1})); err != nil {
		t.Fatal(err)
	}
	if message := fixture.waitEvent(t, "log").Message; message != "first timestamped video access unit written" {
		t.Fatal(message)
	}
}
func TestAudioFailureReleasesOnlyAudioInput(t *testing.T) {
	fixture := startAttempt(t)
	if _, err := fixture.audio.Write(make([]byte, mediaHeaderBytes)); err != nil {
		t.Fatal(err)
	}
	fixture.waitEvent(t, "audio-disabled")
	if _, err := fixture.audio.Write([]byte{1}); !errors.Is(err, io.ErrClosedPipe) {
		t.Fatalf("audio pipe should be closed: %v", err)
	}
	fixture.assertVideoActive(t)
	_ = fixture.video.Close()
	if err := receive(t, fixture.result); err != nil {
		t.Fatal(err)
	}
}

func TestMissingAudioInputLeavesVideoActive(t *testing.T) {
	fixture := startAttemptWithAudioInput(t, false)
	fixture.waitEvent(t, "audio-disabled")
	fixture.assertVideoActive(t)
	_ = fixture.video.Close()
	if err := receive(t, fixture.result); err != nil {
		t.Fatal(err)
	}
}

func TestAudioTimestampRegressionStopsIdleVideo(t *testing.T) {
	fixture := startAttempt(t)
	for sequence, pts := range []uint64{200, 100} {
		if _, err := fixture.audio.Write(encodedMediaFrame(mediaKindAudio, uint32(sequence), pts, 0, []byte{0xf8, 0xff, 0xfe})); err != nil {
			t.Fatal(err)
		}
	}
	err := receive(t, fixture.result)
	if !errors.Is(err, errSourceTimestampRegressed) {
		t.Fatalf("expected shared timestamp failure: %v", err)
	}
	var failure *peerFailure
	if !errors.As(err, &failure) || failure.code != "source_timestamp_regressed" {
		t.Fatalf("timestamp regression must retain its first terminal reason: %v", err)
	}
	if _, err := fixture.video.Write([]byte{1}); !errors.Is(err, io.ErrClosedPipe) {
		t.Fatalf("video pipe should be closed: %v", err)
	}
}

func TestCancelClosesBlockedMediaReads(t *testing.T) {
	fixture := startAttempt(t)
	fixture.cancel()
	if err := receive(t, fixture.result); err != nil {
		t.Fatal(err)
	}
	for _, pipe := range []*io.PipeWriter{fixture.video, fixture.audio} {
		if _, err := pipe.Write([]byte{1}); !errors.Is(err, io.ErrClosedPipe) {
			t.Fatalf("media pipe should be closed: %v", err)
		}
	}
}

func TestCancelClosesBlockedOfferRead(t *testing.T) {
	commands, writer := io.Pipe()
	defer writer.Close()
	ctx, cancel := context.WithCancel(context.Background())
	result := make(chan error, 1)
	go func() { result <- run(ctx, commands, nil, nil, func(stdoutMessage) {}) }()
	cancel()
	if err := receive(t, result); err != nil {
		t.Fatal(err)
	}
}

func (fixture *attemptFixture) connect(t *testing.T) {
	t.Helper()
	if err := fixture.client.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: fixture.answer}); err != nil {
		t.Fatal(err)
	}
	for fixture.waitEvent(t, "state").State != "connected" {
	}
}

func TestControlRepliesCrossLoopbackAsOrderedText(t *testing.T) {
	fixture := startAttempt(t)
	messages := make(chan webrtc.DataChannelMessage, 3)
	fixture.control.OnMessage(func(message webrtc.DataChannelMessage) { messages <- message })
	send := func(id string) {
		t.Helper()
		if err := fixture.commands.Encode(stdinMessage{Type: "datachannel", Payload: json.RawMessage(`{"id":"` + id + `","ok":true}`)}); err != nil {
			t.Fatal(err)
		}
	}
	send("before-1")
	send("before-2")
	fixture.connect(t)
	send("after")
	for _, id := range []string{"before-1", "before-2", "after"} {
		message := receive(t, messages)
		var reply struct{ ID string }
		if !message.IsString || json.Unmarshal(message.Data, &reply) != nil || reply.ID != id {
			t.Fatalf("expected text reply %s, got %+v", id, message)
		}
	}
	fixture.cancel()
	if err := receive(t, fixture.result); err != nil {
		t.Fatal(err)
	}
}

func TestPointerMovementUsesBestEffortBridgeEvent(t *testing.T) {
	fixture := startAttempt(t)
	opened := make(chan struct{})
	fixture.movement.OnOpen(func() { close(opened) })
	fixture.connect(t)
	receive(t, opened)
	const move = `{"id":"move","type":"touch","action":"pointer","eventType":"move"}`
	if err := fixture.movement.SendText(move); err != nil {
		t.Fatal(err)
	}
	event := fixture.waitEvent(t, "pointer-move")
	if string(event.Payload) != move {
		t.Fatalf("unexpected movement payload: %s", event.Payload)
	}
	fixture.cancel()
	if err := receive(t, fixture.result); err != nil {
		t.Fatal(err)
	}
}

func TestPresentationAcknowledgementsStayInsideTheirPeer(t *testing.T) {
	fixture := startAttempt(t)
	opened := make(chan struct{})
	fixture.control.OnOpen(func() { close(opened) })
	fixture.connect(t)
	receive(t, opened)
	for _, message := range []string{
		`{"type":"video-frame-presented","rtpTimestamp":42}`,
		`{"type":"video-frame-presented","rtpTimestamp":null}`,
		`{"type":"key","key":"HOME"}`,
	} {
		if err := fixture.control.SendText(message); err != nil {
			t.Fatal(err)
		}
	}
	event := fixture.waitEvent(t, "control")
	if string(event.Payload) != `{"type":"key","key":"HOME"}` {
		t.Fatalf("presentation evidence escaped into Android controls: %s", event.Payload)
	}
	fixture.cancel()
	if err := receive(t, fixture.result); err != nil {
		t.Fatal(err)
	}
}

func TestReceiverObservesSourcePTSAndSenderReports(t *testing.T) {
	fixture := startAttempt(t)
	type receivedTrack struct {
		track    *webrtc.TrackRemote
		receiver *webrtc.RTPReceiver
	}
	audioTrack, videoTrack := make(chan receivedTrack, 1), make(chan receivedTrack, 1)
	fixture.client.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		if track.Kind() == webrtc.RTPCodecTypeAudio {
			audioTrack <- receivedTrack{track, receiver}
		} else {
			videoTrack <- receivedTrack{track, receiver}
		}
	})
	fixture.connect(t)
	writeFrame := func(pipe *io.PipeWriter, kind uint8, seq uint32, pts uint64, flags uint16, data []byte) {
		t.Helper()
		if _, err := pipe.Write(encodedMediaFrame(kind, seq, pts, flags, data)); err != nil {
			t.Fatal(err)
		}
	}
	config := []byte{0, 0, 0, 1, 0x67, 0x42, 0xe0, 0x1f, 0, 0, 0, 1, 0x68, 0xce, 0x06, 0xe2}
	idr := []byte{0, 0, 0, 1, 0x65, 1}
	writeFrame(fixture.video, mediaKindVideo, 0, 0, mediaFlagConfig, config)
	writeFrame(fixture.video, mediaKindVideo, 1, 1_020_000, mediaFlagKey, idr)
	video := receive(t, videoTrack)
	time.Sleep(80 * time.Millisecond)
	writeFrame(fixture.audio, mediaKindAudio, 1, 1_000_000, 0, []byte{0xf8, 0xff, 0xfe})
	audio := receive(t, audioTrack)

	readPTS := func(track *webrtc.TrackRemote) uint32 {
		t.Helper()
		if err := track.SetReadDeadline(time.Now().Add(5 * time.Second)); err != nil {
			t.Fatal(err)
		}
		packet, _, err := track.ReadRTP()
		if err != nil {
			t.Fatal(err)
		}
		return packet.Timestamp
	}
	videoStart, audioStart := readPTS(video.track), readPTS(audio.track)
	sourceSkewUs := int64(int32(videoStart-mediaRTPOrigin))*1_000_000/int64(videoClockRate) -
		int64(int32(audioStart-mediaRTPOrigin))*1_000_000/int64(audioClockRate)
	if sourceSkewUs != 20_000 {
		t.Fatalf("receiver source skew = %d us", sourceSkewUs)
	}

	// Skip a full GOP while preserving source time at the receiver.
	writeFrame(fixture.video, mediaKindVideo, 2, 2_020_000, mediaFlagKey|mediaFlagGap, idr)
	var resumed uint32
	for resumed = readPTS(video.track); resumed == videoStart; resumed = readPTS(video.track) {
	}
	if resumed-videoStart != 90_000 {
		t.Fatalf("unexpected RTP gap: %d", resumed-videoStart)
	}

	reportOrigin := func(track receivedTrack, initial uint32, clock uint64) float64 {
		t.Helper()
		if err := track.receiver.SetReadDeadline(time.Now().Add(5 * time.Second)); err != nil {
			t.Fatal(err)
		}
		for {
			packets, _, err := track.receiver.ReadRTCP()
			if err != nil {
				t.Fatal(err)
			}
			for _, packet := range packets {
				report, ok := packet.(*rtcp.SenderReport)
				if ok && report.SSRC == uint32(track.track.SSRC()) && report.PacketCount > 0 {
					return float64(report.NTPTime)/float64(uint64(1)<<32) -
						float64(int32(report.RTPTime-initial))/float64(clock)
				}
			}
		}
	}
	videoAnchor := reportOrigin(video, videoStart, videoClockRate)
	audioAnchor := reportOrigin(audio, audioStart, audioClockRate)
	t.Logf("receiver sender-report mapping places first video %.1f ms from first audio; source PTS skew is %.1f ms",
		(videoAnchor-audioAnchor)*1000, float64(sourceSkewUs)/1000)
	fixture.cancel()
	if err := receive(t, fixture.result); err != nil {
		t.Fatal(err)
	}
}
