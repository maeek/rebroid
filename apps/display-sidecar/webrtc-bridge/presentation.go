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
	if len(payload) > 256 || json.Unmarshal(payload, &message) != nil || message.Timestamp == nil {
		return true
	}
	recovery.requestMu.Lock()
	defer recovery.requestMu.Unlock()
	presentation := &recovery.presentation
	if presentation.valid && presentation.timestamp == *message.Timestamp && presentation.presentedAt.IsZero() {
		presentation.presentedAt = now
	}
	return true
}

func (recovery *videoRecovery) requestPLI(now time.Time) (requested bool, idle bool) {
	recovery.requestMu.Lock()
	defer recovery.requestMu.Unlock()
	presentation := recovery.presentation
	ackAge := now.Sub(presentation.presentedAt)
	if presentation.valid && !presentation.writtenAt.IsZero() && !presentation.presentedAt.IsZero() &&
		now.Sub(presentation.writtenAt) >= idleVideoQuietPeriod && ackAge >= 0 && ackAge <= presentationEvidenceLifetime {
		return false, true
	}
	return recovery.requestLocked(now), false
}
