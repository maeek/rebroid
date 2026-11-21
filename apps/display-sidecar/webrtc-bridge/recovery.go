package main

import (
	"errors"
	"sync"
	"time"
)

const keyFrameRecoveryPTSUs = uint64(1_500_000)

type videoRecovery struct {
	mu                sync.Mutex
	lastRequest       time.Time
	generation        uint64
	presentation      videoPresentation
	lastPLITrace      time.Time
	ackReceived       uint64
	ackMatched        uint64
	config            []byte
	ready             bool
	episode           keyFrameRecovery
	lastConsumedReset uint64
}

type keyFrameRecovery struct {
	dropped         bool
	firstDroppedPTS uint64
	lastDroppedPTS  uint64
	resetDeadlineMs int64
}

type videoAccessUnit struct {
	data       []byte
	config     []byte
	generation uint64
	resumes    bool
}

func (recovery *videoRecovery) request(now time.Time) bool {
	recovery.mu.Lock()
	defer recovery.mu.Unlock()
	return recovery.requestLocked(now)
}

func (recovery *videoRecovery) requestLocked(now time.Time) bool {
	if !recovery.lastRequest.IsZero() && now.Sub(recovery.lastRequest) < time.Second {
		return false
	}
	recovery.lastRequest = now
	recovery.presentation = videoPresentation{}
	recovery.generation++
	recovery.ready = false
	return true
}

func (recovery *videoRecovery) accept(frame mediaFrame, reset sourceVideoReset, now time.Time) (videoAccessUnit, error) {
	recovery.mu.Lock()
	defer recovery.mu.Unlock()
	if frame.config || frame.discontinuity {
		recovery.presentation = videoPresentation{}
		recovery.ready = false
	}
	if frame.config {
		recovery.config = frame.data
		return videoAccessUnit{}, nil
	}
	if !recovery.ready {
		episode := &recovery.episode
		if reset.generation > recovery.lastConsumedReset {
			recovery.lastConsumedReset = reset.generation
			if episode.resetDeadlineMs == 0 && now.UnixMilli() < reset.deadlineMs {
				episode.resetDeadlineMs = reset.deadlineMs
			}
		}
		if !frame.keyFrame || len(recovery.config) == 0 {
			return videoAccessUnit{}, episode.drop(frame.timestampUs, now)
		}
	}

	unit := videoAccessUnit{data: frame.data, generation: recovery.generation, resumes: !recovery.ready}
	if frame.keyFrame {
		unit.config = recovery.config
	}
	return unit, nil
}

func (recovery *videoRecovery) rejectUnwrittenFrame(pts uint64, now time.Time) error {
	recovery.mu.Lock()
	defer recovery.mu.Unlock()
	if recovery.ready {
		return nil
	}
	return recovery.episode.drop(pts, now)
}

func (episode *keyFrameRecovery) drop(pts uint64, now time.Time) error {
	if !episode.dropped {
		episode.firstDroppedPTS = pts
		episode.dropped = true
	}
	advancing := pts > episode.lastDroppedPTS
	episode.lastDroppedPTS = pts
	deadline := episode.resetDeadlineMs
	if advancing && recoveryExpiredPTS(episode.firstDroppedPTS, pts) &&
		(deadline == 0 || now.UnixMilli() >= deadline) {
		return errors.New("RBD1 video PTS advanced without a recovery keyframe")
	}
	return nil
}

func recoveryExpiredPTS(startPTS uint64, currentPTS uint64) bool {
	return currentPTS >= startPTS && currentPTS-startPTS > keyFrameRecoveryPTSUs
}
