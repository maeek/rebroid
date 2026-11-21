package main

import (
	"context"
	"io"
	"sync"
)

type peerLifetime struct {
	ctx         context.Context
	stop        context.CancelCauseFunc
	commands    io.ReadCloser
	video       io.ReadCloser
	audio       io.ReadCloser
	closeAudio  func()
	closeInputs func()
	stopClosing func() bool
	workers     sync.WaitGroup
	statsDone   <-chan struct{}
	closePeer   func() error
}

func newPeerLifetime(parent context.Context, commands, video, audio io.ReadCloser) *peerLifetime {
	ctx, stop := context.WithCancelCause(parent)
	closeAudio := sync.OnceFunc(func() {
		if audio != nil {
			_ = audio.Close()
		}
	})
	closeInputs := sync.OnceFunc(func() {
		_ = commands.Close()
		if video != nil {
			_ = video.Close()
		}
		closeAudio()
	})
	return &peerLifetime{
		ctx: ctx, stop: stop,
		commands: commands, video: video, audio: audio,
		closeAudio: closeAudio, closeInputs: closeInputs,
		// A peer can be cancelled while the caller is blocked reading its offer.
		stopClosing: context.AfterFunc(ctx, closeInputs),
	}
}

func (attempt *peerLifetime) startWorker(work func()) {
	attempt.workers.Add(1)
	go func() {
		defer attempt.workers.Done()
		work()
	}()
}

func (attempt *peerLifetime) startStats(report func()) {
	done := make(chan struct{})
	attempt.statsDone = done
	go func() {
		defer close(done)
		report()
	}()
}

func (attempt *peerLifetime) shutdown() {
	attempt.stop(nil)
	attempt.stopClosing()
	attempt.closeInputs()
	// Pion's GetStats reads state that PeerConnection.Close modifies.
	if attempt.statsDone != nil {
		<-attempt.statsDone
	}
	if attempt.closePeer != nil {
		_ = attempt.closePeer()
	}
	attempt.workers.Wait()
}
