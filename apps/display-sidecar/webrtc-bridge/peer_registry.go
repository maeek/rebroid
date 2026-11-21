package main

import (
	"context"
	"encoding/hex"
	"log"
	"net"
	"strings"
	"sync"
	"time"
)

type peerRegistry struct {
	mu       sync.Mutex
	peers    map[peerID]*localPeer
	maxPeers int
	released func(peerID)
}

func parsePeerID(value string) (peerID, bool) {
	var id peerID
	value = strings.ReplaceAll(value, "-", "")
	if len(value) != hex.EncodedLen(len(id)) {
		return id, false
	}
	_, err := hex.Decode(id[:], []byte(value))
	return id, err == nil
}

func (registry *peerRegistry) register(parent context.Context, id peerID) bool {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	if parent.Err() != nil || registry.peers[id] != nil || len(registry.peers) >= registry.maxPeers {
		return false
	}
	ctx, cancel := context.WithCancel(parent)
	peer := &localPeer{ctx: ctx, cancel: cancel}
	registry.peers[id] = peer
	peer.timer = time.AfterFunc(peerAssemblyTimeout, func() {
		if registry.retirePeer(id, peer) {
			log.Printf("[webrtc-attempt:%s] bridge peer rejected reason=bridge_assembly_timeout", id)
		}
	})
	return true
}

// A complete assembly hands the peer to exactly one worker.
func (registry *peerRegistry) attach(id peerID, index int, stream net.Conn) (*localPeer, bool) {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	peer := registry.peers[id]
	if peer == nil || peer.retiring || peer.ctx.Err() != nil || peer.streams[index] != nil {
		return nil, false
	}
	peer.streams[index] = stream
	for _, input := range peer.streams {
		if input == nil {
			return nil, true
		}
	}
	peer.timer.Stop()
	peer.running = true
	return peer, true
}

func (registry *peerRegistry) retire(id peerID) {
	registry.retirePeer(id, nil)
}

func (registry *peerRegistry) retirePeer(id peerID, incomplete *localPeer) bool {
	registry.mu.Lock()
	peer := registry.peers[id]
	if peer == nil || peer.retiring || (incomplete != nil && (peer != incomplete || peer.running)) {
		registry.mu.Unlock()
		return false
	}
	peer.retiring = true
	peer.timer.Stop()
	peer.cancel()
	running := peer.running
	registry.mu.Unlock()
	if !running {
		peer.close()
		registry.release(id, peer)
	}
	return true
}

func (registry *peerRegistry) release(id peerID, peer *localPeer) {
	peer.cancel()
	registry.mu.Lock()
	delete(registry.peers, id)
	registry.mu.Unlock()
	registry.released(id)
}

func (registry *peerRegistry) shutdown() {
	registry.mu.Lock()
	ids := make([]peerID, 0, len(registry.peers))
	for id := range registry.peers {
		ids = append(ids, id)
	}
	registry.mu.Unlock()
	for _, id := range ids {
		registry.retire(id)
	}
}
