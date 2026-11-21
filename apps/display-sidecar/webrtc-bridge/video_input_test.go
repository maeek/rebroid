package main

import (
	"bytes"
	"encoding/hex"
	"os"
	"strings"
	"testing"

	"github.com/pion/rtp/codecs"
)

func TestVideoInputReadsSharedResetAndClearRecords(t *testing.T) {
	fixture, err := os.ReadFile("testdata/rbr1-video-reset.hex")
	if err != nil {
		t.Fatal(err)
	}
	records := strings.Fields(string(fixture))
	if len(records) != 2 {
		t.Fatalf("expected reset and clear records, got %d", len(records))
	}
	frame := encodedMediaFrame(mediaKindVideo, 1, 1, mediaFlagKey, []byte{0, 0, 0, 1, 0x65})
	var wire bytes.Buffer
	for _, record := range records {
		metadata, err := hex.DecodeString(record)
		if err != nil {
			t.Fatal(err)
		}
		wire.Write(metadata)
		wire.Write(frame)
	}
	input := videoInput{reader: &wire}
	for _, expected := range []sourceVideoReset{{generation: 3, deadlineMs: 13_000}, {}} {
		got, reset, err := input.next()
		if err != nil || reset != expected || !got.keyFrame || got.timestampUs != 1 {
			t.Fatalf("expected an unchanged keyframe with reset %+v, got %+v, %+v, %v", expected, got, reset, err)
		}
	}
}

func TestReusedVideoInputPreservesInBandParameterSets(t *testing.T) {
	sps := []byte{0x67, 0x42, 0x12, 0x1e}
	pps := []byte{0x68, 0xce, 0x06, 0xe2}
	var wire bytes.Buffer
	messages := [][]byte{
		sps,
		append([]byte{0, 0, 0, 1}, pps...),
		{0, 0, 1, 0x41, 0x11},
	}
	for sequence, payload := range messages {
		wire.Write(encodedMediaFrame(mediaKindVideo, uint32(sequence), uint64(sequence), 0, payload))
	}
	input := videoInput{reader: &wire}
	var payloader codecs.H264Payloader
	for i := range messages {
		frame, _, err := input.next()
		if err != nil {
			t.Fatal(err)
		}
		packets := payloader.Payload(videoRTPMTU, frame.data)
		if i < 2 {
			if len(packets) != 0 {
				t.Fatal("Pion should retain standalone parameter sets")
			}
			continue
		}
		want := []byte{0x78, 0, 4, 0x67, 0x42, 0x12, 0x1e, 0, 4, 0x68, 0xce, 0x06, 0xe2}
		if len(packets) != 2 || !bytes.Equal(packets[0], want) {
			t.Fatalf("retained SPS/PPS were overwritten: %x", packets)
		}
	}
}

func TestVideoScratchKeepsOnlyBoundedDeltaStorage(t *testing.T) {
	small := []byte{0, 0, 1, 0x41, 0x44}
	large := make([]byte, maxVideoScratchBytes+1)
	key := []byte{0, 0, 1, 0x65, 0x77}
	var wire bytes.Buffer
	wire.Write(encodedMediaFrame(mediaKindVideo, 0, 0, 0, small))
	wire.Write(encodedMediaFrame(mediaKindVideo, 1, 1, mediaFlagKey, key))
	wire.Write(encodedMediaFrame(mediaKindVideo, 2, 2, 0, large))
	wire.Write(encodedMediaFrame(mediaKindVideo, 3, 3, 0, small))
	input := videoInput{reader: &wire}
	first, _, err := input.next()
	if err != nil {
		t.Fatal(err)
	}
	keyFrame, _, err := input.next()
	if err != nil {
		t.Fatal(err)
	}
	last := first
	for range 2 {
		last, _, err = input.next()
		if err != nil {
			t.Fatal(err)
		}
	}
	if cap(input.scratch) != len(small) || &first.data[0] != &last.data[0] {
		t.Fatal("an oversized frame changed the retained delta storage")
	}
	if !bytes.Equal(keyFrame.data, key) {
		t.Fatal("the keyframe changed after reading another delta")
	}
}
