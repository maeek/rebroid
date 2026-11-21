package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"sync"
	"time"

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

type dataChannelMessage struct {
	text       string
	deadlineMs int64
}

// Recovery notices keep the host deadline until SCTP can accept the write.
// The browser starts its own monotonic countdown from the remaining duration.
func (message dataChannelMessage) textAt(now time.Time) string {
	if message.deadlineMs == 0 {
		return message.text
	}
	remaining := message.deadlineMs - now.UnixMilli()
	if remaining <= 0 {
		return ""
	}
	return `{"type":"webrtc-video-reset","remainingMs":` + strconv.FormatInt(remaining, 10) + `}`
}

type controlRelay struct {
	messages *relayMailbox[dataChannelMessage]
	opened   chan dataChannelWriter
	closed   chan struct{}
	reliable sync.Once
}

func bindControlRelay(peer *webrtc.PeerConnection, recovery *videoRecovery, emit func(stdoutMessage)) *controlRelay {
	relay := &controlRelay{
		messages: newRelayMailbox[dataChannelMessage](),
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
					if recovery.consumePresentation(message.Data, time.Now()) {
						return
					}
					if json.Valid(message.Data) {
						event := stdoutMessage{Type: "control", Payload: json.RawMessage(message.Data)}
						phase, key := pointerEvent(message.Data)
						switch phase {
						case "down", "up", "cancel":
							event.discardKey = key
						}
						emit(event)
					}
				})
			})
		case "rebroid-pointer":
			channel.OnMessage(func(message webrtc.DataChannelMessage) {
				if phase, key := pointerEvent(message.Data); phase == "move" {
					emit(stdoutMessage{Type: "pointer-move", Payload: json.RawMessage(message.Data), replaceKey: key})
				}
			})
		}
	})
	return relay
}

func relayDataChannel(ctx context.Context, opened <-chan dataChannelWriter, closed <-chan struct{}, queue *relayMailbox[dataChannelMessage], now func() time.Time) error {
	var channel dataChannelWriter
	for ctx.Err() == nil {
		if channel != nil && channel.BufferedAmount() < dataChannelBufferLimit {
			if message, ok := queue.next(); ok {
				if payload := message.textAt(now()); payload != "" {
					if err := channel.SendText(payload); err != nil {
						return fmt.Errorf("send WebRTC data channel message: %w", err)
					}
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

func (relay *controlRelay) enqueue(payload []byte) error {
	var envelope struct {
		Type       string
		ID         json.RawMessage
		DeadlineMs json.RawMessage
	}
	if json.Unmarshal(payload, &envelope) == nil && len(envelope.ID) == 0 {
		switch envelope.Type {
		case "relay-metrics", "webrtc-bridge-metrics", "heartbeat":
			return relay.messages.put(dataChannelMessage{text: string(payload)}, envelope.Type)
		case "webrtc-video-reset":
			var deadlineMs int64
			if json.Unmarshal(envelope.DeadlineMs, &deadlineMs) != nil || deadlineMs <= 0 {
				return nil
			}
			return relay.messages.put(dataChannelMessage{deadlineMs: deadlineMs}, "")
		}
	}
	return relay.messages.put(dataChannelMessage{text: string(payload)}, "")
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
