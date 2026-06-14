package main

import (
	"bytes"
	"encoding/binary"
	"strings"
	"testing"
	"time"
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

func opusPacket(pts uint64, payload []byte) []byte {
	out := make([]byte, 12+len(payload))
	binary.BigEndian.PutUint64(out, pts)
	binary.BigEndian.PutUint32(out[8:], uint32(len(payload)))
	copy(out[12:], payload)
	return out
}

func TestReadOpusPacket(t *testing.T) {
	payload := []byte{0x11, 0x22, 0x33}
	packet, pts, err := readOpusPacket(bytes.NewReader(opusPacket(42_000, payload)))
	if err != nil {
		t.Fatalf("expected opus packet, got error: %v", err)
	}
	if pts != 42_000 {
		t.Fatalf("expected pts 42000, got %d", pts)
	}
	if !bytes.Equal(packet, payload) {
		t.Fatalf("expected payload %x, got %x", payload, packet)
	}
}

func TestReadOpusPacketRejectsInvalidLength(t *testing.T) {
	header := make([]byte, 12)
	binary.BigEndian.PutUint32(header[8:], 0)
	if _, _, err := readOpusPacket(bytes.NewReader(header)); err == nil || !strings.Contains(err.Error(), "invalid opus packet length") {
		t.Fatalf("expected invalid length error, got %v", err)
	}
}

func TestOpusDurationUsesPTS(t *testing.T) {
	if got := opusDuration(10_000, 30_000); got != 20*time.Millisecond {
		t.Fatalf("expected 20ms, got %s", got)
	}
	if got := opusDuration(30_000, 10_000); got != defaultOpusDuration {
		t.Fatalf("expected default duration for negative pts delta, got %s", got)
	}
	if got := opusDuration(0, 2_000_000); got != defaultOpusDuration {
		t.Fatalf("expected default duration for large pts delta, got %s", got)
	}
}
