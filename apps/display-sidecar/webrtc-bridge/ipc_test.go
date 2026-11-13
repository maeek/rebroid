package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"log"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/pion/webrtc/v4"
)

func TestConcurrentViewersShareOneUDPPort(t *testing.T) {
	udp, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatal(err)
	}
	mux := webrtc.NewICEUDPMux(nil, udp)
	defer mux.Close()
	setting := loopbackICE()
	setting.SetICEUDPMux(mux)
	// macOS temporary directories can exceed the Unix socket path limit.
	directory, err := os.MkdirTemp("/tmp", "rbd-rtc-test-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(directory) })
	path := filepath.Join(directory, "bridge.sock")
	listener, err := net.Listen("unix", path)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- servePeers(ctx, listener, 3, setting) }()
	defer func() {
		cancel()
		if err := receive(t, done); err != nil {
			t.Error(err)
		}
	}()

	port := udp.LocalAddr().(*net.UDPAddr).Port
	first := connectSharedPeer(t, path, port)
	second := connectSharedPeer(t, path, port)
	first.sendControl(t, "first")
	second.sendControl(t, "second")
	_ = first.stream.Close()
	_ = first.browser.Close()
	replacement := connectSharedPeer(t, path, port)
	replacement.sendControl(t, "replacement")
	second.sendControl(t, "second still connected")
	second.sendVideo(t)
}

type sharedPeerFixture struct {
	browser *webrtc.PeerConnection
	control *webrtc.DataChannel
	stream  net.Conn
	video   net.Conn
	events  *json.Decoder
	packets <-chan struct{}
}

func connectSharedPeer(t *testing.T, path string, port int) sharedPeerFixture {
	t.Helper()
	browser, err := webrtc.NewAPI(webrtc.WithSettingEngine(loopbackICE())).NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = browser.Close() })
	if _, err := browser.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo,
		webrtc.RTPTransceiverInit{Direction: webrtc.RTPTransceiverDirectionRecvonly}); err != nil {
		t.Fatal(err)
	}
	packets := make(chan struct{}, 1)
	browser.OnTrack(func(track *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		if _, _, err := track.ReadRTP(); err == nil {
			packets <- struct{}{}
		}
	})
	control, err := browser.CreateDataChannel("rebroid-control", nil)
	if err != nil {
		t.Fatal(err)
	}
	opened := make(chan struct{})
	control.OnOpen(func() { close(opened) })
	offer, err := browser.CreateOffer(nil)
	if err != nil {
		t.Fatal(err)
	}
	gathered := webrtc.GatheringCompletePromise(browser)
	if err := browser.SetLocalDescription(offer); err != nil {
		t.Fatal(err)
	}
	receive(t, gathered)

	var header [17]byte
	if _, err := rand.Read(header[:16]); err != nil {
		t.Fatal(err)
	}
	var streams [3]net.Conn
	for i := range streams {
		stream, err := net.Dial("unix", path)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = stream.Close() })
		header[16] = byte(i)
		if _, err := stream.Write(header[:]); err != nil {
			t.Fatal(err)
		}
		streams[i] = stream
	}
	stream := streams[0]
	offerMessage := configMessage{Type: "offer", SDP: browser.LocalDescription().SDP, ICEHost: "127.0.0.1"}
	if err := json.NewEncoder(stream).Encode(offerMessage); err != nil {
		t.Fatal(err)
	}
	peer := sharedPeerFixture{browser, control, stream, streams[1], json.NewDecoder(stream), packets}
	answer := peer.waitEvent(t, "answer").SDP
	count := 0
	lines := bufio.NewScanner(strings.NewReader(answer))
	for lines.Scan() {
		if strings.HasPrefix(lines.Text(), "a=candidate:") {
			count++
			fields := strings.Fields(lines.Text())
			if fields[2] != "udp" || fields[5] != strconv.Itoa(port) {
				t.Fatalf("unexpected candidate outside shared UDP port: %s", lines.Text())
			}
		}
	}
	if count == 0 {
		t.Fatal("answer has no UDP candidates")
	}
	if err := browser.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: answer}); err != nil {
		t.Fatal(err)
	}
	receive(t, opened)
	return peer
}

func (peer sharedPeerFixture) waitEvent(t *testing.T, kind string) stdoutMessage {
	t.Helper()
	_ = peer.stream.SetReadDeadline(time.Now().Add(5 * time.Second))
	for {
		var event stdoutMessage
		if err := peer.events.Decode(&event); err != nil {
			t.Fatalf("waiting for %s: %v", kind, err)
		}
		if event.Type == kind {
			return event
		}
	}
}

func (peer sharedPeerFixture) sendControl(t *testing.T, id string) {
	t.Helper()
	payload, err := json.Marshal(map[string]string{"id": id})
	if err != nil {
		t.Fatal(err)
	}
	if err := peer.control.SendText(string(payload)); err != nil {
		t.Fatal(err)
	}
	if event := peer.waitEvent(t, "control"); string(event.Payload) != string(payload) {
		t.Fatalf("received wrong peer control: %s", event.Payload)
	}
}

func (peer sharedPeerFixture) sendVideo(t *testing.T) {
	t.Helper()
	config := []byte{0, 0, 0, 1, 0x67, 0x42, 0xe0, 0x1f, 0, 0, 0, 1, 0x68, 0xce, 0x06, 0xe2}
	for _, frame := range [][]byte{
		encodedMediaFrame(mediaKindVideo, 0, 0, mediaFlagConfig, config),
		encodedMediaFrame(mediaKindVideo, 1, 100, mediaFlagKey, []byte{0, 0, 0, 1, 0x65, 1}),
	} {
		if _, err := peer.video.Write(frame); err != nil {
			t.Fatal(err)
		}
	}
	receive(t, peer.packets)
}

func TestBridgeTerminalLogCorrelatesAttemptAndOmitsOffer(t *testing.T) {
	id := peerID{0x83, 0xbf, 0x15, 0xbb, 0x6f, 0x93, 0x4d, 0xf3, 0xad, 0xd6, 0x98, 0xa1, 0x7b, 0xf1, 0x20, 0x00}
	commands, client := net.Pipe()
	defer client.Close()
	_ = client.SetDeadline(time.Now().Add(5 * time.Second))
	var output bytes.Buffer
	original := log.Writer()
	log.SetOutput(&output)
	defer log.SetOutput(original)
	done := make(chan struct{})
	go func() {
		defer close(done)
		runLocalPeer(context.Background(), id, &localPeer{streams: [3]net.Conn{commands}}, loopbackICE())
	}()
	if _, err := client.Write([]byte("secret-offer-content\n")); err != nil {
		t.Fatal(err)
	}
	receive(t, done)
	if got := output.String(); strings.Contains(got, "secret-offer-content") ||
		!strings.Contains(got, "[webrtc-attempt:83bf15bb-6f93-4df3-add6-98a17bf12000] bridge peer ended reason=bridge_signaling_failed") {
		t.Fatalf("unexpected terminal diagnostic: %q", got)
	}
}
