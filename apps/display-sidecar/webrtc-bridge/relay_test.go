package main

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

type stalledChannel struct {
	backlog uint64
	failure error
}

func (channel stalledChannel) BufferedAmount() uint64 { return channel.backlog }
func (channel stalledChannel) SendText(string) error  { return channel.failure }

type observedChannel struct {
	backlog  atomic.Uint64
	observed chan struct{}
	sent     chan string
}

func (channel *observedChannel) BufferedAmount() uint64 {
	amount := channel.backlog.Load()
	select {
	case channel.observed <- struct{}{}:
	default:
	}
	return amount
}

func (channel *observedChannel) SendText(message string) error {
	channel.sent <- message
	return nil
}

func TestSlowDataChannelCannotEvictCorrelatedReplies(t *testing.T) {
	queue := newRelayMailbox[dataChannelMessage]()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan error, 1)
	opened := make(chan dataChannelWriter, 1)
	channel := &observedChannel{observed: make(chan struct{}, 1), sent: make(chan string, relayQueueCapacity+1)}
	channel.backlog.Store(dataChannelBufferLimit)
	opened <- channel
	go func() { result <- relayDataChannel(ctx, opened, nil, queue, time.Now) }()
	receive(t, channel.observed)

	for index := 0; index < relayQueueCapacity; index++ {
		if err := queue.put(dataChannelMessage{text: string([]byte{byte(index)})}, ""); err != nil {
			t.Fatal(err)
		}
		if err := queue.put(dataChannelMessage{text: string([]byte{byte(index)})}, "metrics"); err != nil {
			t.Fatal(err)
		}
	}
	if err := queue.put(dataChannelMessage{text: "excess reply"}, ""); !errors.Is(err, errRelayQueueFull) {
		t.Fatalf("expected explicit overflow: %v", err)
	}
	channel.backlog.Store(0)
	queue.wake()
	for index := 0; index < relayQueueCapacity; index++ {
		if payload := receive(t, channel.sent); payload != string([]byte{byte(index)}) {
			t.Fatalf("missing reply %d", index)
		}
	}
	if payload := receive(t, channel.sent); payload != string([]byte{relayQueueCapacity - 1}) {
		t.Fatal("expected latest telemetry")
	}
	cancel()
	if err := receive(t, result); err != nil {
		t.Fatal(err)
	}
	if _, ok := queue.next(); ok {
		t.Fatal("stale telemetry remained queued")
	}
}

func TestDataChannelSendFailureEndsRelay(t *testing.T) {
	queue := newRelayMailbox[dataChannelMessage]()
	if err := queue.put(dataChannelMessage{text: "reply"}, ""); err != nil {
		t.Fatal(err)
	}
	opened := make(chan dataChannelWriter, 1)
	failure := errors.New("channel closed")
	opened <- stalledChannel{failure: failure}
	if err := relayDataChannel(context.Background(), opened, nil, queue, time.Now); !errors.Is(err, failure) {
		t.Fatalf("expected send failure, got %v", err)
	}
}

func TestResetNoticeExpiresOrUsesRemainingTimeAfterBackpressure(t *testing.T) {
	relay := controlRelay{messages: newRelayMailbox[dataChannelMessage]()}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan error, 1)
	opened := make(chan dataChannelWriter, 1)
	channel := &observedChannel{observed: make(chan struct{}, 1), sent: make(chan string, 3)}
	channel.backlog.Store(dataChannelBufferLimit)
	opened <- channel
	var timeMs atomic.Int64
	timeMs.Store(10_000)
	go func() {
		result <- relayDataChannel(ctx, opened, nil, relay.messages, func() time.Time {
			return time.UnixMilli(timeMs.Load())
		})
	}()
	receive(t, channel.observed)
	for _, payload := range []string{
		`{"type":"webrtc-video-reset","deadlineMs":12900}`,
		`{"type":"webrtc-video-reset","deadlineMs":13000}`,
		`{"id":"reply","ok":true}`,
	} {
		if err := relay.enqueue([]byte(payload)); err != nil {
			t.Fatal(err)
		}
	}

	timeMs.Store(12_900)
	channel.backlog.Store(0)
	relay.messages.wake()
	if got := receive(t, channel.sent); got != `{"type":"webrtc-video-reset","remainingMs":100}` {
		t.Fatalf("expected only the unexpired reset notice with 100ms remaining, got %s", got)
	}
	if got := receive(t, channel.sent); got != `{"id":"reply","ok":true}` {
		t.Fatalf("expected the reliable reply after the notice, got %s", got)
	}
	cancel()
	if err := receive(t, result); err != nil {
		t.Fatal(err)
	}
}

func TestClosedDataChannelUnblocksCongestedRelay(t *testing.T) {
	queue := newRelayMailbox[dataChannelMessage]()
	closed := make(chan struct{})
	opened := make(chan dataChannelWriter, 1)
	channel := &observedChannel{observed: make(chan struct{}, 1), sent: make(chan string, 1)}
	channel.backlog.Store(dataChannelBufferLimit)
	opened <- channel
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan error, 1)
	go func() { result <- relayDataChannel(ctx, opened, closed, queue, time.Now) }()
	receive(t, channel.observed)
	close(closed)
	if err := receive(t, result); err == nil {
		t.Fatal("expected explicit closed-channel outcome")
	}
}
