package main

import (
	"errors"
	"sync"
	"sync/atomic"
	"time"
)

const keyFrameRecoveryPTSUs = uint64(1_500_000)

type videoRecovery struct {
	requestMu    sync.Mutex
	lastRequest  time.Time
	generation   atomic.Uint64
	presentation videoPresentation
	lastPLITrace time.Time
	ackReceived  uint64
	ackMatched   uint64

	// Only the video worker touches the recovery episode and cached configuration.
	seenGeneration  uint64
	config          []byte
	ready           bool
	dropped         bool
	firstDroppedPTS uint64
}

func (recovery *videoRecovery) request(now time.Time) bool {
	recovery.requestMu.Lock()
	defer recovery.requestMu.Unlock()
	return recovery.requestLocked(now)
}

func (recovery *videoRecovery) requestLocked(now time.Time) bool {
	if !recovery.lastRequest.IsZero() && now.Sub(recovery.lastRequest) < time.Second {
		return false
	}
	recovery.lastRequest = now
	recovery.presentation = videoPresentation{}
	recovery.generation.Add(1)
	return true
}

func (recovery *videoRecovery) accept(frame mediaFrame) ([]byte, error) {
	if generation := recovery.generation.Load(); generation != recovery.seenGeneration {
		recovery.seenGeneration = generation
		recovery.ready = false
	}
	if frame.config {
		recovery.forgetPresentation()
		recovery.config = frame.data
		recovery.ready = false
		return nil, nil
	}
	if frame.discontinuity {
		recovery.forgetPresentation()
		recovery.ready = false
	}
	if !recovery.ready && (!frame.keyFrame || len(recovery.config) == 0) {
		if !recovery.dropped {
			recovery.firstDroppedPTS = frame.timestampUs
			recovery.dropped = true
		}
		if recoveryExpiredPTS(recovery.firstDroppedPTS, frame.timestampUs) {
			return nil, errors.New("RBD1 video PTS advanced without a recovery keyframe")
		}
		return nil, nil
	}

	recovery.ready = true
	recovery.dropped = false
	if !frame.keyFrame {
		return frame.data, nil
	}
	payload := make([]byte, 0, len(recovery.config)+len(frame.data))
	payload = append(payload, recovery.config...)
	return append(payload, frame.data...), nil
}

func recoveryExpiredPTS(startPTS uint64, currentPTS uint64) bool {
	return currentPTS >= startPTS && currentPTS-startPTS > keyFrameRecoveryPTSUs
}
