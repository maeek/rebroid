package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"sync"
	"time"

	"github.com/pion/webrtc/v4"
)

const peerAssemblyTimeout = 5 * time.Second

// Each local connection starts with a random 16-byte peer ID and a stream
// index. Separate sockets keep media backpressure out of commands and audio.
type peerID [16]byte

func (id peerID) String() string {
	return fmt.Sprintf("%x-%x-%x-%x-%x", id[:4], id[4:6], id[6:8], id[8:10], id[10:])
}

type localPeer struct {
	streams  [3]net.Conn // commands/events, video, audio
	timer    *time.Timer
	ctx      context.Context
	cancel   context.CancelFunc
	running  bool
	retiring bool
}

func (peer *localPeer) close() {
	for _, stream := range peer.streams {
		if stream != nil {
			_ = stream.Close()
		}
	}
}

type peerControlMessage struct {
	Type      string `json:"type"`
	AttemptID string `json:"attemptId"`
}

func servePeers(parent context.Context, listener net.Listener, maxPeers int, setting webrtc.SettingEngine, commands io.Reader, events io.Writer) error {
	ctx, stop := context.WithCancel(parent)
	defer stop()
	closeListener := context.AfterFunc(ctx, func() { _ = listener.Close() })
	defer closeListener()

	var workers sync.WaitGroup
	var outputMu sync.Mutex
	output := json.NewEncoder(events)
	emit := func(event, id string) {
		outputMu.Lock()
		defer outputMu.Unlock()
		if err := output.Encode(peerControlMessage{Type: event, AttemptID: id}); err != nil {
			stop()
		}
	}
	peers := peerRegistry{
		peers:    make(map[peerID]*localPeer),
		maxPeers: maxPeers,
		released: func(id peerID) { emit("released", id.String()) },
	}
	go func() {
		defer stop()
		scanner := bufio.NewScanner(commands)
		scanner.Buffer(make([]byte, 256), 1024)
		for scanner.Scan() && ctx.Err() == nil {
			var message peerControlMessage
			if json.Unmarshal(scanner.Bytes(), &message) != nil {
				continue
			}
			id, valid := parsePeerID(message.AttemptID)
			if !valid {
				continue
			}
			switch message.Type {
			case "register":
				if peers.register(ctx, id) {
					emit("registered", id.String())
				} else {
					emit("rejected", id.String())
				}
			case "retire":
				peers.retire(id)
			}
		}
	}()
	headers := make(chan struct{}, maxPeers*3)

	handleStream := func(stream net.Conn) {
		var id peerID
		var header [17]byte
		_ = stream.SetReadDeadline(time.Now().Add(peerAssemblyTimeout))
		_, err := io.ReadFull(stream, header[:])
		<-headers
		index := int(header[16])
		if err != nil || index >= 3 {
			_ = stream.Close()
			return
		}
		copy(id[:], header[:16])
		_ = stream.SetReadDeadline(time.Time{})

		peer, accepted := peers.attach(id, index, stream)
		if !accepted {
			_ = stream.Close()
			return
		}
		if peer != nil {
			runLocalPeer(peer.ctx, id, peer, setting)
			peers.release(id, peer)
		}
	}

	defer func() {
		stop()
		_ = listener.Close()
		peers.shutdown()
		workers.Wait()
	}()

	for {
		stream, err := listener.Accept()
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			return err
		}
		select {
		case headers <- struct{}{}:
			workers.Add(1)
			go func() {
				defer workers.Done()
				cancel := context.AfterFunc(ctx, func() { _ = stream.Close() })
				defer cancel()
				handleStream(stream)
			}()
		default:
			_ = stream.Close()
		}
	}
}

func runLocalPeer(parent context.Context, id peerID, peer *localPeer, setting webrtc.SettingEngine) {
	commands := peer.streams[0]
	attempt := newPeerLifetime(parent, commands, peer.streams[1], peer.streams[2])
	defer attempt.shutdown()
	events := newRelayMailbox[stdoutMessage]()
	attempt.startWorker(func() {
		if err := relayOutput(attempt.ctx, commands, events); err != nil {
			attempt.stop(withPeerFailure("bridge_event_write_failed", err))
		}
	})
	err := servePeer(attempt, func(message stdoutMessage) {
		if attempt.ctx.Err() != nil {
			return
		}
		key := message.replaceKey
		if message.Type == "metrics" {
			key = "metrics"
		}
		if err := events.put(message, key, message.discardKey); err != nil {
			attempt.stop(withPeerFailure("bridge_event_queue_failed", err))
		}
	}, setting)
	if err != nil {
		reason := "bridge_signaling_failed"
		var failure *peerFailure
		if errors.As(err, &failure) {
			reason = failure.code
		}
		log.Printf("[webrtc-attempt:%s] bridge peer ended reason=%s", id, reason)
	}
}
