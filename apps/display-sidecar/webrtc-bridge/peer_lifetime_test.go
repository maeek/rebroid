package main

import (
	"context"
	"net"
	"testing"
)

func TestPeerShutdownUnblocksSocketsAndJoinsWorkersInOrder(t *testing.T) {
	commands, client := net.Pipe()
	defer client.Close()
	attempt := newPeerLifetime(context.Background(), commands, nil, nil)
	writing := make(chan struct{})
	writerError := make(chan error, 1)
	attempt.startWorker(func() {
		close(writing)
		_, err := commands.Write([]byte("blocked event"))
		writerError <- err
	})
	statsStopped := make(chan struct{})
	attempt.startStats(func() {
		<-attempt.ctx.Done()
		close(statsStopped)
	})
	peerClosed := make(chan struct{})
	attempt.closePeer = func() error {
		select {
		case <-statsStopped:
		default:
			t.Error("Pion closed before stats stopped")
		}
		close(peerClosed)
		return nil
	}
	rtcpStopped := make(chan struct{})
	attempt.startWorker(func() {
		<-peerClosed
		close(rtcpStopped)
	})
	receive(t, writing)
	done := make(chan struct{})
	go func() {
		defer close(done)
		attempt.shutdown()
	}()
	receive(t, done)
	if err := receive(t, writerError); err == nil {
		t.Error("the blocked event writer did not report its closed socket")
	}
	select {
	case <-rtcpStopped:
	default:
		t.Error("shutdown returned before RTCP stopped")
	}
}
