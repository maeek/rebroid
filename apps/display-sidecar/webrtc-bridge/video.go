package main

import (
	"io"
	"time"

	"github.com/pion/rtp"
	"github.com/pion/rtp/codecs"
)

const (
	videoClockRate = uint64(90_000)
	videoRTPMTU    = uint16(1_200)
)

func streamH264(
	input io.Reader,
	track rtpWriter,
	metrics *bridgeMetrics,
	recovery *videoRecovery,
	timeline *sourceTimeline,
	emit func(stdoutMessage),
) error {
	packetizer := rtp.NewPacketizer(
		videoRTPMTU,
		96,
		1,
		&codecs.H264Payloader{},
		rtp.NewRandomSequencer(),
		uint32(videoClockRate),
	)
	var wroteFrame bool

	for {
		frame, err := readMediaFrame(input, mediaKindVideo)
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		var rtpTimestamp uint32
		if !frame.config {
			metrics.videoInputFrames.Add(1)
			rtpTimestamp, err = timeline.rtpTimestamp(mediaKindVideo, frame.timestampUs, videoClockRate)
			if err != nil {
				return err
			}
		}
		payload, err := recovery.accept(frame)
		if err != nil {
			return err
		}
		if payload == nil {
			if !frame.config {
				metrics.videoDropped.Add(1)
			}
			continue
		}
		packetizationStarted := time.Now()
		packets := packetizer.Packetize(payload, 0)
		metrics.packetizationLatency.observe(time.Since(packetizationStarted))
		writeStarted := time.Now()
		for _, packet := range packets {
			packet.Timestamp = rtpTimestamp
			if err := metrics.writeRTP(track, packet); err != nil {
				return err
			}
		}
		metrics.rtpWriteLatency.observe(time.Since(writeStarted))
		metrics.videoFrames.Add(1)
		if !wroteFrame {
			wroteFrame = true
			emit(stdoutMessage{Type: "log", Message: "first timestamped video access unit written"})
		}
	}
}

func rtpTimestampForPTS(originPTS uint64, originRTP uint32, pts uint64) uint32 {
	return rtpTimestampForSharedPTS(originPTS, originRTP, pts, videoClockRate)
}
