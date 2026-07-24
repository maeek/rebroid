package main

import (
	"errors"
	"sync"
)

const mediaRTPOrigin = uint32(1 << 31)

var errSourceTimestampRegressed = errors.New("RBD1 source timestamp regressed")

type sourceTrackTimeline struct {
	lastPTS uint64
	started bool
}

// sourceTimeline gives audio and video the same scrcpy PTS origin. Each codec
// converts the resulting delta with its own RTP clock rate. A source timestamp
// regression invalidates the whole timeline so tracks cannot rebase independently.
type sourceTimeline struct {
	mu         sync.Mutex
	originPTS  uint64
	started    bool
	invalid    bool
	videoTrack sourceTrackTimeline
	audioTrack sourceTrackTimeline
}

func (timeline *sourceTimeline) rtpTimestamp(kind uint8, pts uint64, clockRate uint64) (uint32, error) {
	timeline.mu.Lock()
	defer timeline.mu.Unlock()
	if timeline.invalid {
		return 0, errSourceTimestampRegressed
	}

	track, err := timeline.track(kind)
	if err != nil {
		return 0, err
	}
	if track.started && pts < track.lastPTS {
		timeline.invalid = true
		return 0, errSourceTimestampRegressed
	}
	if !timeline.started {
		timeline.originPTS = pts
		timeline.started = true
	}
	track.lastPTS = pts
	track.started = true
	return rtpTimestampForSharedPTS(
		timeline.originPTS,
		mediaRTPOrigin,
		pts,
		clockRate,
	), nil
}

func (timeline *sourceTimeline) track(kind uint8) (*sourceTrackTimeline, error) {
	switch kind {
	case mediaKindVideo:
		return &timeline.videoTrack, nil
	case mediaKindAudio:
		return &timeline.audioTrack, nil
	default:
		return nil, errors.New("unsupported RBD1 timeline media kind")
	}
}

func rtpTimestampForSharedPTS(originPTS uint64, originRTP uint32, pts uint64, clockRate uint64) uint32 {
	if pts >= originPTS {
		return originRTP + uint32(ptsDeltaTicks(pts-originPTS, clockRate))
	}
	return originRTP - uint32(ptsDeltaTicks(originPTS-pts, clockRate))
}

func ptsDeltaTicks(deltaUs uint64, clockRate uint64) uint64 {
	return (deltaUs/1_000_000)*clockRate + ((deltaUs%1_000_000)*clockRate)/1_000_000
}
