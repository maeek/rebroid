package main

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
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
	queue := newRelayMailbox[[]byte]()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan error, 1)
	opened := make(chan dataChannelWriter, 1)
	channel := &observedChannel{observed: make(chan struct{}, 1), sent: make(chan string, relayQueueCapacity+1)}
	channel.backlog.Store(dataChannelBufferLimit)
	opened <- channel
	go func() { result <- relayDataChannel(ctx, opened, nil, queue) }()
	receive(t, channel.observed)

	for index := 0; index < relayQueueCapacity; index++ {
		if err := queue.put([]byte{byte(index)}, ""); err != nil {
			t.Fatal(err)
		}
		if err := queue.put([]byte{byte(index)}, "metrics"); err != nil {
			t.Fatal(err)
		}
	}
	if err := queue.put([]byte("excess reply"), ""); !errors.Is(err, errRelayQueueFull) {
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
	queue := newRelayMailbox[[]byte]()
	if err := queue.put([]byte("reply"), ""); err != nil {
		t.Fatal(err)
	}
	opened := make(chan dataChannelWriter, 1)
	failure := errors.New("channel closed")
	opened <- stalledChannel{failure: failure}
	if err := relayDataChannel(context.Background(), opened, nil, queue); !errors.Is(err, failure) {
		t.Fatalf("expected send failure, got %v", err)
	}
}

func TestClosedDataChannelUnblocksCongestedRelay(t *testing.T) {
	queue := newRelayMailbox[[]byte]()
	closed := make(chan struct{})
	opened := make(chan dataChannelWriter, 1)
	channel := &observedChannel{observed: make(chan struct{}, 1), sent: make(chan string, 1)}
	channel.backlog.Store(dataChannelBufferLimit)
	opened <- channel
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan error, 1)
	go func() { result <- relayDataChannel(ctx, opened, closed, queue) }()
	receive(t, channel.observed)
	close(closed)
	if err := receive(t, result); err == nil {
		t.Fatal("expected explicit closed-channel outcome")
	}
}
