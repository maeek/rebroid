package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sync"

	"github.com/pion/webrtc/v4"
)

const (
	relayQueueCapacity     = 64
	dataChannelBufferLimit = 128 * 1024
)

var errRelayQueueFull = errors.New("WebRTC bridge reliable relay queue is full")

// A single writer drains reliable messages in order. Replaceable messages are
// held separately, so telemetry cannot evict a correlated control message.
type relayMailbox[T any] struct {
	mu       sync.Mutex
	reliable []T
	latest   map[string]T
	changed  chan struct{}
}

func newRelayMailbox[T any]() *relayMailbox[T] {
	return &relayMailbox[T]{latest: make(map[string]T), changed: make(chan struct{}, 1)}
}

func (mailbox *relayMailbox[T]) wake() {
	select {
	case mailbox.changed <- struct{}{}:
	default:
	}
}

func (mailbox *relayMailbox[T]) put(value T, replaceKey string, discardKeys ...string) error {
	mailbox.mu.Lock()
	defer mailbox.mu.Unlock()
	for _, key := range discardKeys {
		delete(mailbox.latest, key)
	}
	if replaceKey != "" {
		mailbox.latest[replaceKey] = value
	} else {
		if len(mailbox.reliable) >= relayQueueCapacity {
			return errRelayQueueFull
		}
		mailbox.reliable = append(mailbox.reliable, value)
	}
	mailbox.wake()
	return nil
}

func (mailbox *relayMailbox[T]) next() (T, bool) {
	mailbox.mu.Lock()
	defer mailbox.mu.Unlock()
	var zero T
	if len(mailbox.reliable) > 0 {
		message := mailbox.reliable[0]
		mailbox.reliable[0] = zero
		mailbox.reliable = mailbox.reliable[1:]
		return message, true
	}
	for key, message := range mailbox.latest {
		delete(mailbox.latest, key)
		return message, true
	}
	return zero, false
}

type dataChannelWriter interface {
	BufferedAmount() uint64
	SendText(string) error
}

type controlRelay struct {
	messages *relayMailbox[[]byte]
	opened   chan dataChannelWriter
	closed   chan struct{}
	reliable sync.Once
}

func bindControlRelay(peer *webrtc.PeerConnection, emit func(stdoutMessage)) *controlRelay {
	relay := &controlRelay{
		messages: newRelayMailbox[[]byte](),
		opened:   make(chan dataChannelWriter, 1),
		closed:   make(chan struct{}),
	}
	peer.OnDataChannel(func(channel *webrtc.DataChannel) {
		switch channel.Label() {
		case "rebroid-control":
			if !channel.Ordered() || channel.MaxRetransmits() != nil || channel.MaxPacketLifeTime() != nil {
				return
			}
			relay.reliable.Do(func() {
				channel.SetBufferedAmountLowThreshold(dataChannelBufferLimit / 2)
				channel.OnBufferedAmountLow(relay.messages.wake)
				channel.OnOpen(func() { relay.opened <- channel })
				channel.OnClose(func() { close(relay.closed) })
				channel.OnMessage(func(message webrtc.DataChannelMessage) {
					if json.Valid(message.Data) {
						event := stdoutMessage{Type: "control", Payload: json.RawMessage(message.Data)}
						switch pointerEvent(message.Data) {
						case "down", "up", "cancel":
							event.discardKey = "pointer-move"
						}
						emit(event)
					}
				})
			})
		case "rebroid-pointer":
			channel.OnMessage(func(message webrtc.DataChannelMessage) {
				if pointerEvent(message.Data) == "move" {
					emit(stdoutMessage{Type: "pointer-move", Payload: json.RawMessage(message.Data), replaceKey: "pointer-move"})
				}
			})
		}
	})
	return relay
}

func relayDataChannel(ctx context.Context, opened <-chan dataChannelWriter, closed <-chan struct{}, queue *relayMailbox[[]byte]) error {
	var channel dataChannelWriter
	for ctx.Err() == nil {
		if channel != nil && channel.BufferedAmount() < dataChannelBufferLimit {
			if message, ok := queue.next(); ok {
				if err := channel.SendText(string(message)); err != nil {
					return fmt.Errorf("send WebRTC data channel message: %w", err)
				}
				continue
			}
		}
		select {
		case <-ctx.Done():
		case channel = <-opened:
		case <-closed:
			return errors.New("WebRTC reliable control channel closed")
		case <-queue.changed:
		}
	}
	return nil
}

func dataChannelReplaceKey(payload []byte) string {
	var message struct{ Type string }
	if json.Unmarshal(payload, &message) == nil {
		switch message.Type {
		case "relay-metrics", "webrtc-bridge-metrics", "heartbeat":
			return message.Type
		}
	}
	return ""
}

func relayOutput(ctx context.Context, output io.Writer, queue *relayMailbox[stdoutMessage]) error {
	encoder := json.NewEncoder(output)
	for ctx.Err() == nil {
		if message, ok := queue.next(); ok {
			if err := encoder.Encode(message); err != nil {
				return fmt.Errorf("write bridge event: %w", err)
			}
			continue
		}
		select {
		case <-ctx.Done():
		case <-queue.changed:
		}
	}
	return nil
}
