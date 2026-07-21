package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"io"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/pion/webrtc/v4"
)

func run() error {
	reader := bufio.NewReader(os.Stdin)
	line, err := reader.ReadString('\n')
	if err != nil {
		return err
	}

	var cfg configMessage
	if err := json.Unmarshal([]byte(line), &cfg); err != nil {
		return err
	}
	if cfg.Type != "offer" || strings.TrimSpace(cfg.SDP) == "" {
		return errors.New("missing WebRTC offer")
	}

	setting := webrtc.SettingEngine{}
	if cfg.ICEHost != "" {
		setting.SetNAT1To1IPs([]string{cfg.ICEHost}, webrtc.ICECandidateTypeHost)
	}
	if minPort, maxPort, ok := parsePortRange(cfg.UDPPortRange); ok {
		if err := setting.SetEphemeralUDPPortRange(uint16(minPort), uint16(maxPort)); err != nil {
			return err
		}
	}

	mediaEngine := &webrtc.MediaEngine{}
	if err := mediaEngine.RegisterDefaultCodecs(); err != nil {
		return err
	}
	api := webrtc.NewAPI(webrtc.WithSettingEngine(setting), webrtc.WithMediaEngine(mediaEngine))
	peer, err := api.NewPeerConnection(webrtc.Configuration{ICEServers: iceServers(cfg.STUNUrls)})
	if err != nil {
		return err
	}
	defer peer.Close()

	videoTrack, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264, ClockRate: 90000},
		"video",
		"rebroid",
	)
	if err != nil {
		return err
	}
	if _, err := peer.AddTrack(videoTrack); err != nil {
		return err
	}

	var audioTrack *webrtc.TrackLocalStaticSample
	if cfg.Audio {
		audioTrack, err = webrtc.NewTrackLocalStaticSample(
			webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 2},
			"audio",
			"rebroid",
		)
		if err != nil {
			return err
		}
		if _, err := peer.AddTrack(audioTrack); err != nil {
			return err
		}
		write(stdoutMessage{Type: "log", Message: "audio track negotiated"})
	}

	var dataChannel *webrtc.DataChannel
	var dataMu sync.Mutex
	peer.OnDataChannel(func(channel *webrtc.DataChannel) {
		dataMu.Lock()
		dataChannel = channel
		dataMu.Unlock()
		channel.OnMessage(func(message webrtc.DataChannelMessage) {
			write(stdoutMessage{Type: "control", Payload: json.RawMessage(message.Data)})
		})
	})
	peer.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		write(stdoutMessage{Type: "state", State: state.String()})
		if state == webrtc.PeerConnectionStateFailed || state == webrtc.PeerConnectionStateClosed {
			os.Exit(0)
		}
	})

	if err := peer.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: cfg.SDP}); err != nil {
		return err
	}
	answer, err := peer.CreateAnswer(nil)
	if err != nil {
		return err
	}
	gatherComplete := webrtc.GatheringCompletePromise(peer)
	if err := peer.SetLocalDescription(answer); err != nil {
		return err
	}
	<-gatherComplete
	write(stdoutMessage{Type: "answer", SDP: peer.LocalDescription().SDP})

	go readCommands(reader, func(payload []byte) {
		dataMu.Lock()
		channel := dataChannel
		dataMu.Unlock()
		if channel != nil && channel.ReadyState() == webrtc.DataChannelStateOpen {
			_ = channel.Send(payload)
		}
	})

	video := os.NewFile(uintptr(3), "video")
	if video == nil {
		return errors.New("missing video fd")
	}
	defer video.Close()

	if audioTrack != nil {
		audio := os.NewFile(uintptr(4), "audio")
		if audio == nil {
			return errors.New("missing audio fd")
		}
		defer audio.Close()
		go func() {
			if err := streamOpus(audio, audioTrack); err != nil && !errors.Is(err, io.EOF) {
				write(stdoutMessage{Type: "log", Message: "audio disabled: " + err.Error()})
			}
		}()
	}

	fps := cfg.MaxFPS
	if fps <= 0 {
		fps = 30
	}
	return streamAnnexB(video, videoTrack, time.Second/time.Duration(fps))
}
