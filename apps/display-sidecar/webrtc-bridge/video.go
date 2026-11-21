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
	video := videoInput{reader: input}

	for {
		frame, reset, err := video.next()
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
		unit, err := recovery.accept(frame, reset, time.Now())
		if err != nil {
			return err
		}
		if unit.data == nil {
			if !frame.config {
				metrics.videoDropped.Add(1)
			}
			continue
		}
		packetizationStarted := time.Now()
		payload := unit.data
		if len(unit.config) != 0 {
			payload = make([]byte, 0, len(unit.config)+len(unit.data))
			payload = append(payload, unit.config...)
			payload = append(payload, unit.data...)
		}
		packets := packetizer.Packetize(payload, 0)
		metrics.packetizationLatency.observe(time.Since(packetizationStarted))
		if len(packets) == 0 {
			metrics.videoDropped.Add(1)
			if err := recovery.rejectUnwrittenFrame(frame.timestampUs, time.Now()); err != nil {
				return err
			}
			continue
		}
		writeStarted := time.Now()
		recovery.beginFrame(rtpTimestamp, unit)
		for _, packet := range packets {
			packet.Timestamp = rtpTimestamp
			if err := metrics.writeRTP(track, packet); err != nil {
				return err
			}
		}
		metrics.rtpWriteLatency.observe(time.Since(writeStarted))
		recovery.finishFrame(unit, time.Now())
		metrics.videoFrames.Add(1)
		if !wroteFrame {
			wroteFrame = true
			emit(stdoutMessage{Type: "log", Message: "first timestamped video access unit written"})
		}
	}
}
