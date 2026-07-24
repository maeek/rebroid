package main

import (
	"errors"
	"io"
	"time"

	"github.com/pion/rtp"
	"github.com/pion/rtp/codecs"
	"github.com/pion/webrtc/v4"
)

const (
	videoClockRate        = uint64(90_000)
	videoRTPMTU           = uint16(1_200)
	keyFrameRecoveryPTSUs = uint64(1_500_000)
)

func streamH264(
	input io.Reader,
	track *webrtc.TrackLocalStaticRTP,
	metrics *bridgeMetrics,
	recovery *videoRecovery,
	timeline *sourceTimeline,
) error {
	packetizer := rtp.NewPacketizer(
		videoRTPMTU,
		96,
		1,
		&codecs.H264Payloader{},
		rtp.NewRandomSequencer(),
		uint32(videoClockRate),
	)
	var config []byte
	var awaitingKeyFrame = true
	var recoveryStartPTS uint64
	var recoveryGeneration uint64
	var wroteFrame bool

	for {
		frame, err := readMediaFrame(input, mediaKindVideo)
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		if frame.discontinuity {
			awaitingKeyFrame = true
			recoveryStartPTS = frame.timestampUs
		}
		if frame.config {
			config = append(config[:0], frame.data...)
			continue
		}
		metrics.videoInputFrames.Add(1)
		requestedGeneration, _ := recovery.snapshot()
		if requestedGeneration != recoveryGeneration {
			recoveryGeneration = requestedGeneration
			awaitingKeyFrame = true
			recoveryStartPTS = 0
		}
		if awaitingKeyFrame && !frame.keyFrame {
			metrics.videoDropped.Add(1)
			if recoveryStartPTS == 0 || frame.timestampUs < recoveryStartPTS {
				recoveryStartPTS = frame.timestampUs
			}
			if recoveryExpiredPTS(recoveryStartPTS, frame.timestampUs) {
				return errors.New("RBD1 video PTS advanced without a recovery keyframe")
			}
			continue
		}

		payload := frame.data
		if frame.keyFrame && len(config) > 0 {
			payload = make([]byte, 0, len(config)+len(frame.data))
			payload = append(payload, config...)
			payload = append(payload, frame.data...)
		}
		rtpTimestamp, err := timeline.rtpTimestamp(
			mediaKindVideo,
			frame.timestampUs,
			videoClockRate,
		)
		if err != nil {
			return err
		}
		packetizationStarted := time.Now()
		packets := packetizer.Packetize(payload, 0)
		metrics.packetizationLatency.observe(time.Since(packetizationStarted))
		writeStarted := time.Now()
		for _, packet := range packets {
			packet.Timestamp = rtpTimestamp
			if err := track.WriteRTP(packet); err != nil {
				metrics.rtpSendErrors.Add(1)
				return err
			}
			metrics.rtpPackets.Add(1)
			metrics.rtpBytes.Add(uint64(len(packet.Payload)))
		}
		metrics.rtpWriteLatency.observe(time.Since(writeStarted))
		metrics.videoFrames.Add(1)
		awaitingKeyFrame = false
		recoveryStartPTS = 0
		if !wroteFrame {
			wroteFrame = true
			write(stdoutMessage{Type: "log", Message: "first timestamped video access unit written"})
		}
	}
}

func rtpTimestampForPTS(originPTS uint64, originRTP uint32, pts uint64) uint32 {
	return rtpTimestampForSharedPTS(originPTS, originRTP, pts, videoClockRate)
}

func recoveryExpiredPTS(startPTS uint64, currentPTS uint64) bool {
	return currentPTS >= startPTS && currentPTS-startPTS > keyFrameRecoveryPTSUs
}
