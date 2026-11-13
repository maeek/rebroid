package main

import (
	"context"
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

type localPeer struct {
	streams [3]net.Conn // commands/events, video, audio
	timer   *time.Timer
}

func (peer *localPeer) close() {
	for _, stream := range peer.streams {
		if stream != nil {
			_ = stream.Close()
		}
	}
}

func servePeers(parent context.Context, listener net.Listener, maxPeers int, setting webrtc.SettingEngine) error {
	ctx, stop := context.WithCancel(parent)
	defer stop()
	closeListener := context.AfterFunc(ctx, func() { _ = listener.Close() })
	defer closeListener()

	var workers sync.WaitGroup
	var mu sync.Mutex
	peers := make(map[peerID]*localPeer)
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

		mu.Lock()
		if ctx.Err() != nil {
			mu.Unlock()
			_ = stream.Close()
			return
		}
		peer := peers[id]
		if peer == nil {
			if len(peers) >= maxPeers {
				mu.Unlock()
				_ = stream.Close()
				return
			}
			peer = &localPeer{}
			peers[id] = peer
			peer.timer = time.AfterFunc(peerAssemblyTimeout, func() {
				mu.Lock()
				defer mu.Unlock()
				if peers[id] == peer && peer.timer != nil {
					delete(peers, id)
					peer.close()
				}
			})
		}
		if peer.streams[index] != nil {
			mu.Unlock()
			_ = stream.Close()
			return
		}
		peer.streams[index] = stream
		if peer.streams[0] == nil || peer.streams[1] == nil || peer.streams[2] == nil {
			mu.Unlock()
			return
		}
		peer.timer.Stop()
		peer.timer = nil
		mu.Unlock()

		runLocalPeer(ctx, peer, setting)
		mu.Lock()
		delete(peers, id)
		mu.Unlock()
	}

	defer func() {
		stop()
		_ = listener.Close()
		mu.Lock()
		for _, peer := range peers {
			if peer.timer != nil {
				peer.timer.Stop()
				peer.timer = nil
				peer.close()
			}
		}
		mu.Unlock()
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

func runLocalPeer(parent context.Context, peer *localPeer, setting webrtc.SettingEngine) {
	ctx, stop := context.WithCancelCause(parent)
	defer stop(nil)
	defer peer.close()
	commands := peer.streams[0]
	events := newRelayMailbox[stdoutMessage]()
	done := make(chan struct{})
	go func() {
		defer close(done)
		if err := relayOutput(ctx, commands, events); err != nil {
			stop(err)
		}
	}()
	err := runPeer(ctx, commands, peer.streams[1], peer.streams[2], func(message stdoutMessage) {
		if ctx.Err() != nil {
			return
		}
		key := message.replaceKey
		if message.Type == "metrics" {
			key = "metrics"
		}
		if err := events.put(message, key, message.discardKey); err != nil {
			stop(err)
		}
	}, setting)
	if err != nil && ctx.Err() == nil {
		log.Printf("WebRTC peer closed: %v", err)
	}
	stop(nil)
	_ = commands.Close()
	<-done
}
