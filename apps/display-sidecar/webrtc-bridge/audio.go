package main

import (
	"errors"
	"io"

	"github.com/pion/rtp"
	"github.com/pion/rtp/codecs"
	"github.com/pion/webrtc/v4"
)

const audioClockRate = uint64(48_000)

func streamOpus(
	input io.Reader,
	track *webrtc.TrackLocalStaticRTP,
	metrics *bridgeMetrics,
	timeline *sourceTimeline,
) error {
	packetizer := rtp.NewPacketizer(
		videoRTPMTU,
		111,
		2,
		&codecs.OpusPayloader{},
		rtp.NewRandomSequencer(),
		uint32(audioClockRate),
	)
	var wroteFrame bool

	for {
		frame, err := readMediaFrame(input, mediaKindAudio)
		if err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}
		if frame.config {
			continue
		}
		rtpTimestamp, err := timeline.rtpTimestamp(
			mediaKindAudio,
			frame.timestampUs,
			audioClockRate,
		)
		if err != nil {
			return err
		}
		packets := packetizer.Packetize(frame.data, 0)
		for _, packet := range packets {
			packet.Timestamp = rtpTimestamp
			if err := track.WriteRTP(packet); err != nil {
				return err
			}
			metrics.rtpPackets.Add(1)
			metrics.rtpBytes.Add(uint64(len(packet.Payload)))
		}
		metrics.audioFrames.Add(1)
		if !wroteFrame {
			wroteFrame = true
			write(stdoutMessage{Type: "log", Message: "first timestamped audio packet written"})
		}
	}
}
