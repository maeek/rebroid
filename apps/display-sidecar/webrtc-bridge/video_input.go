package main

import (
	"bytes"
	"encoding/binary"
	"errors"
	"io"
)

const maxVideoScratchBytes = 256 * 1024

type sourceVideoReset struct {
	generation uint64
	deadlineMs int64
}

// Reset metadata applies to the RBD1 frames that follow it on this peer's
// private video socket. A zero record ends the source's reset interval.
type videoInput struct {
	reader  io.Reader
	reset   sourceVideoReset
	header  [mediaHeaderBytes]byte
	scratch []byte
}

func (input *videoInput) next() (mediaFrame, sourceVideoReset, error) {
	header := input.header[:]
	for {
		if _, err := io.ReadFull(input.reader, header); err != nil {
			return mediaFrame{}, sourceVideoReset{}, err
		}
		if string(header[:4]) != "RBR1" {
			frame, err := readMediaPayload(input.reader, mediaKindVideo, header, &input.scratch)
			return frame, input.reset, err
		}
		reset := sourceVideoReset{
			generation: binary.BigEndian.Uint64(header[8:16]),
			deadlineMs: int64(binary.BigEndian.Uint64(header[16:24])),
		}
		if binary.BigEndian.Uint32(header[4:8]) != 0 ||
			reset.deadlineMs < 0 || (reset.generation == 0) != (reset.deadlineMs == 0) {
			return mediaFrame{}, sourceVideoReset{}, errors.New("invalid video reset metadata")
		}
		input.reset = reset
	}
}

func hasH264ParameterSets(payload []byte) bool {
	startCode := []byte{0, 0, 1}
	// Like Pion, accept both Annex-B start code lengths and a single bare NAL.
	start := bytes.Index(payload, startCode)
	if start < 0 {
		return isH264ParameterSet(payload[0])
	}
	for start >= 0 {
		payload = payload[start+len(startCode):]
		if len(payload) > 0 && isH264ParameterSet(payload[0]) {
			return true
		}
		start = bytes.Index(payload, startCode)
	}
	return false
}

func isH264ParameterSet(nalHeader byte) bool {
	nalType := nalHeader & 0x1f
	return nalType == 7 || nalType == 8
}
