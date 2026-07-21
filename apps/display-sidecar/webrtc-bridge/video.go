package main

import (
	"errors"
	"io"
	"time"

	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
)

const videoQueueSize = 2

func streamAnnexB(input io.Reader, track *webrtc.TrackLocalStaticSample, duration time.Duration) error {
	samples := make(chan []byte, videoQueueSize)
	errs := make(chan error, 1)

	go func() {
		errs <- readAnnexBSamples(input, samples)
		close(samples)
	}()

	for sample := range samples {
		if err := track.WriteSample(media.Sample{Data: sample, Duration: duration}); err != nil {
			return err
		}
	}

	err := <-errs
	if errors.Is(err, io.EOF) {
		return nil
	}
	return err
}

func readAnnexBSamples(input io.Reader, samples chan []byte) error {
	parser := newAnnexBParser()
	buffer := make([]byte, 32*1024)
	for {
		n, err := input.Read(buffer)
		if n > 0 {
			for _, sample := range parser.push(buffer[:n]) {
				offerLatestSample(samples, sample)
			}
		}
		if err != nil {
			return err
		}
	}
}

func offerLatestSample(samples chan []byte, sample []byte) {
	select {
	case samples <- sample:
		return
	default:
	}
	select {
	case <-samples:
	default:
	}
	select {
	case samples <- sample:
	default:
	}
}

type annexBParser struct {
	buffer []byte
	sps    []byte
	pps    []byte
	unit   [][]byte
}

func newAnnexBParser() *annexBParser {
	return &annexBParser{}
}

func (p *annexBParser) push(chunk []byte) [][]byte {
	p.buffer = append(p.buffer, chunk...)
	var samples [][]byte
	for {
		start, startLen := findStart(p.buffer, 0)
		if start < 0 {
			if len(p.buffer) > 4 {
				p.buffer = p.buffer[len(p.buffer)-4:]
			}
			return samples
		}
		next, _ := findStart(p.buffer, start+startLen)
		if next < 0 {
			p.buffer = p.buffer[start:]
			return samples
		}
		nal := append([]byte(nil), p.buffer[start+startLen:next]...)
		p.buffer = p.buffer[next:]
		if sample := p.handleNal(nal); len(sample) > 0 {
			samples = append(samples, sample)
		}
	}
}

func (p *annexBParser) handleNal(nal []byte) []byte {
	if len(nal) == 0 {
		return nil
	}
	nalType := nal[0] & 0x1f
	if nalType == 7 {
		p.sps = append([]byte(nil), nal...)
		return nil
	}
	if nalType == 8 {
		p.pps = append([]byte(nil), nal...)
		return nil
	}
	isSlice := nalType == 1 || nalType == 5
	var sample []byte
	if isSlice && hasSlice(p.unit) {
		sample = joinNals(p.unit)
		p.unit = nil
	}
	if nalType == 5 && len(p.sps) > 0 && len(p.pps) > 0 {
		p.unit = append(p.unit, p.sps, p.pps)
	}
	p.unit = append(p.unit, nal)
	return sample
}

func findStart(data []byte, offset int) (int, int) {
	for i := offset; i+2 < len(data); i++ {
		if data[i] == 0 && data[i+1] == 0 && data[i+2] == 1 {
			return i, 3
		}
		if i+3 < len(data) && data[i] == 0 && data[i+1] == 0 && data[i+2] == 0 && data[i+3] == 1 {
			return i, 4
		}
	}
	return -1, 0
}

func hasSlice(nals [][]byte) bool {
	for _, nal := range nals {
		if len(nal) > 0 {
			nalType := nal[0] & 0x1f
			if nalType == 1 || nalType == 5 {
				return true
			}
		}
	}
	return false
}

func joinNals(nals [][]byte) []byte {
	var output []byte
	for _, nal := range nals {
		output = append(output, 0, 0, 0, 1)
		output = append(output, nal...)
	}
	return output
}
