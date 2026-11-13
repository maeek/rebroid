package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"sync"

	"github.com/pion/interceptor"
	"github.com/pion/webrtc/v4"
)

func run(parent context.Context, commands, video, audio io.ReadCloser, emit func(stdoutMessage)) error {
	return runPeer(parent, commands, video, audio, emit, webrtc.SettingEngine{})
}

func runPeer(parent context.Context, commands, video, audio io.ReadCloser, emit func(stdoutMessage), setting webrtc.SettingEngine) error {
	ctx, stop := context.WithCancelCause(parent)
	closeAudio := sync.OnceFunc(func() {
		if audio != nil {
			_ = audio.Close()
		}
	})
	closeInputs := sync.OnceFunc(func() {
		_ = commands.Close()
		if video != nil {
			_ = video.Close()
		}
		closeAudio()
	})
	stopInputs := context.AfterFunc(ctx, closeInputs)
	var workers sync.WaitGroup
	startWorker := func(work func()) {
		workers.Add(1)
		go func() {
			defer workers.Done()
			work()
		}()
	}
	defer func() {
		stop(nil)
		stopInputs()
		closeInputs()
		workers.Wait()
	}()

	reader := bufio.NewScanner(commands)
	reader.Buffer(make([]byte, 4096), 1<<20)
	if !reader.Scan() {
		if ctx.Err() != nil {
			return attemptError(ctx)
		}
		if err := reader.Err(); err != nil {
			return err
		}
		return errors.New("missing WebRTC offer")
	}

	var cfg configMessage
	if err := json.Unmarshal(reader.Bytes(), &cfg); err != nil {
		return err
	}
	if cfg.Type != "offer" || strings.TrimSpace(cfg.SDP) == "" {
		return errors.New("missing WebRTC offer")
	}

	if cfg.ICEHost != "" {
		setting.SetNAT1To1IPs([]string{cfg.ICEHost}, webrtc.ICECandidateTypeHost)
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
	defer func() {
		stop(nil)
		_ = peer.Close()
	}()

	metrics := &bridgeMetrics{}
	recovery := &videoRecovery{}
	timeline := &sourceTimeline{}

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
	startWorker(func() { drainRTCP(videoSender, metrics, &metrics.videoFeedback, recovery, emit) })

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
		startWorker(func() { drainRTCP(audioSender, metrics, &metrics.audioFeedback, nil, emit) })
		emit(stdoutMessage{Type: "log", Message: "audio track negotiated"})
	}

	control := bindControlRelay(peer, recovery, emit)
	startWorker(func() {
		if err := relayDataChannel(ctx, control.opened, control.closed, control.messages); err != nil {
			stop(withPeerFailure("reliable_control_relay_failed", err))
		}
	})
	peer.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		emit(stdoutMessage{Type: "state", State: state.String()})
		switch state {
		case webrtc.PeerConnectionStateFailed:
			stop(withPeerFailure("peer_connection_failed", errors.New("WebRTC peer failed")))
		case webrtc.PeerConnectionStateClosed:
			stop(nil)
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
	startWorker(func() {
		stop(withPeerFailure("bridge_command_read_failed", readCommands(reader, func(payload []byte) error {
			return control.messages.put(payload, dataChannelReplaceKey(payload))
		})))
	})

	select {
	case <-ctx.Done():
		return attemptError(ctx)
	case <-gatherComplete:
	}
	if ctx.Err() != nil {
		return attemptError(ctx)
	}
	emit(stdoutMessage{Type: "answer", SDP: peer.LocalDescription().SDP})

	metricsDone := make(chan struct{})
	go func() {
		defer close(metricsDone)
		reportBridgeMetrics(metrics, peer, ctx.Done(), emit)
	}()
	defer func() {
		// Pion's GetStats reads peer state that Close modifies.
		stop(nil)
		<-metricsDone
	}()

	if video == nil {
		return errors.New("missing video fd")
	}
	if audioTrack == nil {
		closeAudio()
	} else if audio == nil {
		emit(stdoutMessage{Type: "audio-disabled", Message: "Audio input is unavailable."})
	} else {
		startWorker(func() {
			defer closeAudio()
			err := streamOpus(audio, audioTrack, metrics, timeline, emit)
			if ctx.Err() != nil {
				return
			}
			if errors.Is(err, errSourceTimestampRegressed) {
				stop(withPeerFailure("audio_relay_failed", err))
				return
			}
			message := "Audio input ended."
			if err != nil {
				message = "Audio relay stopped: " + err.Error()
			}
			emit(stdoutMessage{Type: "audio-disabled", Message: message})
		})
	}

	startWorker(func() {
		err := streamH264(video, videoTrack, metrics, recovery, timeline, emit)
		stop(withPeerFailure("video_relay_failed", err))
	})
	<-ctx.Done()
	return attemptError(ctx)
}

// The code is safe to put in an operator log. The wrapped error remains available
// internally for errors.Is without logging Pion, IPC, or browser input verbatim.
type peerFailure struct {
	code  string
	cause error
}

func (failure *peerFailure) Error() string { return failure.cause.Error() }
func (failure *peerFailure) Unwrap() error { return failure.cause }

func withPeerFailure(code string, err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, errSourceTimestampRegressed) {
		code = "source_timestamp_regressed"
	}
	if errors.Is(err, errRelayQueueFull) {
		code = "reliable_relay_queue_full"
	}
	return &peerFailure{code, err}
}

func attemptError(ctx context.Context) error {
	err := context.Cause(ctx)
	if errors.Is(err, context.Canceled) {
		return nil
	}
	return err
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
