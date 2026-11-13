package main

import (
	"encoding/json"
	"time"
)

// libwebrtc may send a PLI after three seconds without a decodable frame,
// including when Android has stopped producing frames for an unchanged screen.
// Only a recent acknowledgement of the exact last frame can distinguish this
// from a lost frame. Unsupported clients retain normal recovery.
const idleVideoQuietPeriod = 2 * time.Second
const presentationEvidenceLifetime = 3 * time.Second

type videoPresentation struct {
	timestamp   uint32
	valid       bool
	writtenAt   time.Time
	presentedAt time.Time
	ackRejected string
}

type pictureLossDecision struct {
	requested   bool
	evidence    string
	frameAge    time.Duration
	ackAge      time.Duration
	ackReceived uint64
	ackMatched  uint64
	trace       bool
}

func (recovery *videoRecovery) beginFrame(timestamp uint32) {
	recovery.requestMu.Lock()
	defer recovery.requestMu.Unlock()
	recovery.presentation = videoPresentation{timestamp: timestamp, valid: true}
}

func (recovery *videoRecovery) finishFrame(now time.Time) {
	recovery.requestMu.Lock()
	defer recovery.requestMu.Unlock()
	recovery.presentation.writtenAt = now
}

func (recovery *videoRecovery) forgetPresentation() {
	recovery.requestMu.Lock()
	defer recovery.requestMu.Unlock()
	recovery.presentation = videoPresentation{}
}

// These messages terminate at this peer; they are never Android controls.
func (recovery *videoRecovery) consumePresentation(payload []byte, now time.Time) bool {
	var envelope struct {
		Type string `json:"type"`
	}
	if json.Unmarshal(payload, &envelope) != nil || envelope.Type != "video-frame-presented" {
		return false
	}
	var message struct {
		Timestamp *uint32 `json:"rtpTimestamp"`
	}
	valid := len(payload) <= 256 && json.Unmarshal(payload, &message) == nil && message.Timestamp != nil
	recovery.requestMu.Lock()
	defer recovery.requestMu.Unlock()
	recovery.ackReceived++
	presentation := &recovery.presentation
	if presentation.valid && presentation.presentedAt.IsZero() {
		switch {
		case !valid:
			presentation.ackRejected = "invalid-ack"
		case presentation.timestamp != *message.Timestamp:
			presentation.ackRejected = "mismatched-ack"
		default:
			presentation.presentedAt = now
			recovery.ackMatched++
		}
	}
	return true
}

func (recovery *videoRecovery) requestPLI(now time.Time) pictureLossDecision {
	recovery.requestMu.Lock()
	defer recovery.requestMu.Unlock()
	presentation := recovery.presentation
	decision := pictureLossDecision{
		frameAge: -time.Millisecond, ackAge: -time.Millisecond,
		ackReceived: recovery.ackReceived, ackMatched: recovery.ackMatched,
	}
	if presentation.valid && !presentation.writtenAt.IsZero() {
		decision.frameAge = now.Sub(presentation.writtenAt)
	}
	if !presentation.presentedAt.IsZero() {
		decision.ackAge = now.Sub(presentation.presentedAt)
	}
	switch {
	case !presentation.valid || presentation.writtenAt.IsZero():
		decision.evidence = "no-written-frame"
	case presentation.presentedAt.IsZero() && presentation.ackRejected != "":
		decision.evidence = presentation.ackRejected
	case presentation.presentedAt.IsZero():
		decision.evidence = "missing-ack"
	case decision.frameAge < idleVideoQuietPeriod:
		decision.evidence = "active-frame"
	case decision.ackAge < 0 || decision.ackAge > presentationEvidenceLifetime:
		decision.evidence = "expired-ack"
	default:
		decision.evidence = "acknowledged-idle"
	}
	if !decision.idle() {
		decision.requested = recovery.requestLocked(now)
	}
	if recovery.lastPLITrace.IsZero() || now.Sub(recovery.lastPLITrace) >= time.Second {
		recovery.lastPLITrace = now
		decision.trace = true
	}
	return decision
}

func (decision pictureLossDecision) idle() bool {
	return decision.evidence == "acknowledged-idle"
}
