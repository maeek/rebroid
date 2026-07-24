package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"io"
	"os"
	"strings"
	"sync"

	"github.com/pion/interceptor"
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
	if err := registerMediaCodecs(mediaEngine, cfg); err != nil {
		return err
	}
	interceptorRegistry := &interceptor.Registry{}
	if err := webrtc.RegisterDefaultInterceptors(mediaEngine, interceptorRegistry); err != nil {
		return err
	}
	if err := webrtc.ConfigureTWCCHeaderExtensionSender(mediaEngine, interceptorRegistry); err != nil {
		return err
	}
	api := webrtc.NewAPI(
		webrtc.WithSettingEngine(setting),
		webrtc.WithMediaEngine(mediaEngine),
		webrtc.WithInterceptorRegistry(interceptorRegistry),
	)
	peer, err := api.NewPeerConnection(webrtc.Configuration{ICEServers: iceServers(cfg.STUNUrls)})
	if err != nil {
		return err
	}
	defer peer.Close()

	metrics := &bridgeMetrics{}
	recovery := &videoRecovery{}
	timeline := &sourceTimeline{}
	metricsStop := make(chan struct{})
	defer close(metricsStop)
	go reportBridgeMetrics(metrics, peer, metricsStop)

	videoTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{
			MimeType:     webrtc.MimeTypeH264,
			ClockRate:    90000,
			SDPFmtpLine:  cfg.H264FmtpLine,
			RTCPFeedback: h264RTCPFeedback(),
		},
		"video",
		"rebroid",
	)
	if err != nil {
		return err
	}
	videoSender, err := peer.AddTrack(videoTrack)
	if err != nil {
		return err
	}
	go drainRTCP(videoSender, metrics, recovery)

	var audioTrack *webrtc.TrackLocalStaticRTP
	if cfg.Audio {
		audioTrack, err = webrtc.NewTrackLocalStaticRTP(
			webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 2},
			"audio",
			"rebroid",
		)
		if err != nil {
			return err
		}
		audioSender, err := peer.AddTrack(audioTrack)
		if err != nil {
			return err
		}
		go drainRTCP(audioSender, metrics, nil)
		write(stdoutMessage{Type: "log", Message: "audio track negotiated"})
	}

	var dataChannel *webrtc.DataChannel
	var dataMu sync.Mutex
	var pendingDataMessages [][]byte
	peer.OnDataChannel(func(channel *webrtc.DataChannel) {
		if channel.Label() == "rebroid-control" {
			dataMu.Lock()
			dataChannel = channel
			dataMu.Unlock()
			channel.OnOpen(func() {
				dataMu.Lock()
				pending := pendingDataMessages
				pendingDataMessages = nil
				dataMu.Unlock()
				for _, payload := range pending {
					_ = channel.Send(payload)
				}
			})
		}
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
		if channel != nil && channel.ReadyState() == webrtc.DataChannelStateOpen {
			dataMu.Unlock()
			_ = channel.Send(payload)
			return
		}
		if len(pendingDataMessages) >= 32 {
			pendingDataMessages = pendingDataMessages[1:]
		}
		pendingDataMessages = append(pendingDataMessages, append([]byte(nil), payload...))
		dataMu.Unlock()
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
			if err := streamOpus(audio, audioTrack, metrics, timeline); err != nil && !errors.Is(err, io.EOF) {
				write(stdoutMessage{Type: "log", Message: "audio disabled: " + err.Error()})
			}
		}()
	}

	return streamH264(video, videoTrack, metrics, recovery, timeline)
}

func h264RTCPFeedback() []webrtc.RTCPFeedback {
	return []webrtc.RTCPFeedback{
		{Type: "goog-remb"},
		{Type: "ccm", Parameter: "fir"},
		{Type: "nack"},
		{Type: "nack", Parameter: "pli"},
		{Type: "transport-cc"},
	}
}

func registerMediaCodecs(mediaEngine *webrtc.MediaEngine, cfg configMessage) error {
	if err := mediaEngine.RegisterCodec(
		configuredH264Codec(cfg),
		webrtc.RTPCodecTypeVideo,
	); err != nil {
		return err
	}
	if !cfg.Audio {
		return nil
	}
	return mediaEngine.RegisterCodec(
		webrtc.RTPCodecParameters{
			RTPCodecCapability: webrtc.RTPCodecCapability{
				MimeType:    webrtc.MimeTypeOpus,
				ClockRate:   48000,
				Channels:    2,
				SDPFmtpLine: "minptime=10;useinbandfec=1",
			},
			PayloadType: 111,
		},
		webrtc.RTPCodecTypeAudio,
	)
}

func configuredH264Codec(cfg configMessage) webrtc.RTPCodecParameters {
	fmtp := cfg.H264FmtpLine
	if fmtp == "" {
		fmtp = "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f"
	}
	return webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{
			MimeType:     webrtc.MimeTypeH264,
			ClockRate:    90000,
			SDPFmtpLine:  fmtp,
			RTCPFeedback: h264RTCPFeedback(),
		},
		PayloadType: 96,
	}
}
