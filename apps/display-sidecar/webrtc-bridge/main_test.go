package main

import (
	"bytes"
	"testing"
)

func annexBNal(nal []byte) []byte {
	out := []byte{0, 0, 0, 1}
	return append(out, nal...)
}

func TestAnnexBParserEmitsSamples(t *testing.T) {
	parser := newAnnexBParser()
	stream := bytes.Join([][]byte{
		annexBNal([]byte{0x67, 0x01}),
		annexBNal([]byte{0x68, 0x02}),
		annexBNal([]byte{0x65, 0x03}),
		annexBNal([]byte{0x41, 0x04}),
		annexBNal([]byte{0x41, 0x05}),
		annexBNal([]byte{0x41, 0x06}),
	}, nil)

	samples := parser.push(stream)
	if len(samples) != 2 {
		t.Fatalf("expected 2 samples, got %d", len(samples))
	}
	if !bytes.Contains(samples[0], []byte{0x67, 0x01}) ||
		!bytes.Contains(samples[0], []byte{0x68, 0x02}) ||
		!bytes.Contains(samples[0], []byte{0x65, 0x03}) {
		t.Fatalf("expected first sample to include SPS, PPS, and IDR: %x", samples[0])
	}
	if !bytes.Contains(samples[1], []byte{0x41, 0x04}) {
		t.Fatalf("expected second sample to include first delta slice: %x", samples[1])
	}
}

func TestAnnexBParserPrependsSPSPPSBeforeIDR(t *testing.T) {
	parser := newAnnexBParser()
	stream := bytes.Join([][]byte{
		annexBNal([]byte{0x67, 0xaa}),
		annexBNal([]byte{0x68, 0xbb}),
		annexBNal([]byte{0x65, 0xcc}),
		annexBNal([]byte{0x41, 0xdd}),
		annexBNal([]byte{0x41, 0xee}),
	}, nil)

	samples := parser.push(stream)
	if len(samples) != 1 {
		t.Fatalf("expected 1 sample, got %d", len(samples))
	}
	expectedPrefix := bytes.Join([][]byte{
		annexBNal([]byte{0x67, 0xaa}),
		annexBNal([]byte{0x68, 0xbb}),
		annexBNal([]byte{0x65, 0xcc}),
	}, nil)
	if !bytes.HasPrefix(samples[0], expectedPrefix) {
		t.Fatalf("expected SPS/PPS before IDR, got %x", samples[0])
	}
}

func TestOfferLatestSampleDropsStaleFrames(t *testing.T) {
	samples := make(chan []byte, 2)
	offerLatestSample(samples, []byte{1})
	offerLatestSample(samples, []byte{2})
	offerLatestSample(samples, []byte{3})

	if len(samples) != 2 {
		t.Fatalf("expected queue size 2, got %d", len(samples))
	}
	first := <-samples
	second := <-samples
	if !bytes.Equal(first, []byte{2}) || !bytes.Equal(second, []byte{3}) {
		t.Fatalf("expected queue to keep latest samples [2, 3], got [%x, %x]", first, second)
	}
}
