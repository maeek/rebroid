package main

import (
	"encoding/binary"
	"errors"
	"io"
	"time"

	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
)

const defaultOpusDuration = 20 * time.Millisecond
const maxOpusPacketBytes = 1024 * 1024

func streamOpus(input io.Reader, track *webrtc.TrackLocalStaticSample) error {
	var pending []byte
	var pendingPTS int64
	sawPacket := false
	wroteSample := false

	for {
		packet, pts, err := readOpusPacket(input)
		if err != nil {
			if errors.Is(err, io.EOF) && pending != nil {
				if err := track.WriteSample(media.Sample{Data: pending, Duration: defaultOpusDuration}); err != nil {
					return err
				}
				if !wroteSample {
					write(stdoutMessage{Type: "log", Message: "first audio sample written"})
				}
				return nil
			}
			return err
		}
		if !sawPacket {
			sawPacket = true
			write(stdoutMessage{Type: "log", Message: "first audio packet received"})
		}
		if pending != nil {
			if err := track.WriteSample(media.Sample{Data: pending, Duration: opusDuration(pendingPTS, pts)}); err != nil {
				return err
			}
			if !wroteSample {
				wroteSample = true
				write(stdoutMessage{Type: "log", Message: "first audio sample written"})
			}
		}
		pending = packet
		pendingPTS = pts
	}
}

func readOpusPacket(input io.Reader) ([]byte, int64, error) {
	header := make([]byte, 12)
	if _, err := io.ReadFull(input, header); err != nil {
		return nil, 0, err
	}
	pts := int64(binary.BigEndian.Uint64(header))
	size := binary.BigEndian.Uint32(header[8:])
	if size == 0 || size > maxOpusPacketBytes {
		return nil, 0, errors.New("invalid opus packet length")
	}
	packet := make([]byte, size)
	if _, err := io.ReadFull(input, packet); err != nil {
		return nil, 0, err
	}
	return packet, pts, nil
}

func opusDuration(previousPTS int64, nextPTS int64) time.Duration {
	duration := time.Duration(nextPTS-previousPTS) * time.Microsecond
	if duration <= 0 || duration > time.Second {
		return defaultOpusDuration
	}
	return duration
}
