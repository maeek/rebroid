package main

import (
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v4"
)

type bridgeMetrics struct {
	videoInputFrames     atomic.Uint64
	videoFrames          atomic.Uint64
	videoDropped         atomic.Uint64
	audioFrames          atomic.Uint64
	rtpPackets           atomic.Uint64
	rtpBytes             atomic.Uint64
	rtpSendErrors        atomic.Uint64
	nacks                atomic.Uint64
	plis                 atomic.Uint64
	packetsLost          atomic.Uint64
	jitter               atomic.Uint64
	packetizationLatency latencySamples
	rtpWriteLatency      latencySamples
}

type latencySamples struct {
	mu     sync.Mutex
	values []float64
}

func (samples *latencySamples) observe(duration time.Duration) {
	samples.mu.Lock()
	samples.values = append(samples.values, float64(duration.Microseconds())/1000)
	if len(samples.values) > 600 {
		samples.values = samples.values[len(samples.values)-600:]
	}
	samples.mu.Unlock()
}

func (samples *latencySamples) takeP95() float64 {
	samples.mu.Lock()
	values := append([]float64(nil), samples.values...)
	samples.values = samples.values[:0]
	samples.mu.Unlock()
	if len(values) == 0 {
		return 0
	}
	sort.Float64s(values)
	index := (len(values)*95 + 99) / 100
	if index < 1 {
		index = 1
	}
	return values[index-1]
}

type videoRecovery struct {
	generation  atomic.Uint64
	requestedAt atomic.Int64
}

func (recovery *videoRecovery) request() bool {
	now := time.Now().UnixNano()
	for {
		previous := recovery.requestedAt.Load()
		if previous != 0 && now-previous < int64(time.Second) {
			return false
		}
		if recovery.requestedAt.CompareAndSwap(previous, now) {
			recovery.generation.Add(1)
			return true
		}
	}
}

func (recovery *videoRecovery) snapshot() (uint64, time.Time) {
	generation := recovery.generation.Load()
	requestedAt := recovery.requestedAt.Load()
	if requestedAt == 0 {
		return generation, time.Time{}
	}
	return generation, time.Unix(0, requestedAt)
}

func drainRTCP(sender *webrtc.RTPSender, metrics *bridgeMetrics, recovery *videoRecovery) {
	for {
		packets, _, err := sender.ReadRTCP()
		if err != nil {
			return
		}
		for _, packet := range packets {
			handleRTCPPacket(packet, metrics, recovery)
		}
	}
}

func handleRTCPPacket(packet rtcp.Packet, metrics *bridgeMetrics, recovery *videoRecovery) {
	switch value := packet.(type) {
	case *rtcp.TransportLayerNack:
		var requested uint64
		for _, pair := range value.Nacks {
			requested += uint64(len(pair.PacketList()))
		}
		metrics.nacks.Add(requested)
	case *rtcp.PictureLossIndication:
		metrics.plis.Add(1)
		if recovery != nil && recovery.request() {
			write(stdoutMessage{Type: "video-resync-request", Message: "pli"})
		}
	case *rtcp.FullIntraRequest:
		if recovery != nil && recovery.request() {
			write(stdoutMessage{Type: "video-resync-request", Message: "fir"})
		}
	case *rtcp.ReceiverReport:
		for _, report := range value.Reports {
			metrics.packetsLost.Store(uint64(report.TotalLost))
			metrics.jitter.Store(uint64(report.Jitter))
		}
	}
}

func metricSnapshot(metrics *bridgeMetrics, peer *webrtc.PeerConnection) map[string]float64 {
	snapshot := map[string]float64{
		"videoInputFrames":   float64(metrics.videoInputFrames.Load()),
		"videoFrames":        float64(metrics.videoFrames.Load()),
		"videoDropped":       float64(metrics.videoDropped.Load()),
		"audioFrames":        float64(metrics.audioFrames.Load()),
		"rtpPackets":         float64(metrics.rtpPackets.Load()),
		"rtpBytes":           float64(metrics.rtpBytes.Load()),
		"rtpSendErrors":      float64(metrics.rtpSendErrors.Load()),
		"nacks":              float64(metrics.nacks.Load()),
		"plis":               float64(metrics.plis.Load()),
		"packetsLost":        float64(metrics.packetsLost.Load()),
		"jitterRtp":          float64(metrics.jitter.Load()),
		"packetizationP95Ms": metrics.packetizationLatency.takeP95(),
		"rtpWriteP95Ms":      metrics.rtpWriteLatency.takeP95(),
	}
	for _, entry := range peer.GetStats() {
		switch stat := entry.(type) {
		case webrtc.OutboundRTPStreamStats:
			if stat.Kind != "video" {
				continue
			}
			snapshot["retransmittedPackets"] = float64(stat.RetransmittedPacketsSent)
			snapshot["retransmittedBytes"] = float64(stat.RetransmittedBytesSent)
			snapshot["packetsDiscardedOnSend"] = float64(stat.PacketsDiscardedOnSend)
			snapshot["packetsSent"] = float64(stat.PacketsSent)
			snapshot["rtpSendDelayTotalMs"] = stat.TotalPacketSendDelay * 1_000
		case webrtc.RemoteInboundRTPStreamStats:
			if stat.Kind != "video" {
				continue
			}
			if stat.PacketsLost >= 0 {
				snapshot["packetsLost"] = float64(stat.PacketsLost)
			}
			snapshot["jitterMs"] = stat.Jitter * 1_000
			snapshot["roundTripTimeMs"] = stat.RoundTripTime * 1_000
		}
	}
	return snapshot
}

func reportBridgeMetrics(metrics *bridgeMetrics, peer *webrtc.PeerConnection, stop <-chan struct{}) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	previous := map[string]float64{}
	previousAt := time.Now()
	for {
		select {
		case <-ticker.C:
			now := time.Now()
			snapshot := metricSnapshot(metrics, peer)
			elapsed := now.Sub(previousAt).Seconds()
			if elapsed <= 0 {
				elapsed = 1
			}
			snapshot["bridgeInputFps"] = (snapshot["videoInputFrames"] - previous["videoInputFrames"]) / elapsed
			snapshot["rtpSentFps"] = (snapshot["videoFrames"] - previous["videoFrames"]) / elapsed
			packetDelta := snapshot["packetsSent"] - previous["packetsSent"]
			if packetDelta > 0 {
				snapshot["rtpSendDelayMs"] =
					(snapshot["rtpSendDelayTotalMs"] - previous["rtpSendDelayTotalMs"]) / packetDelta
			}
			write(stdoutMessage{
				Type:    "metrics",
				Metrics: snapshot,
			})
			previous = snapshot
			previousAt = now
		case <-stop:
			return
		}
	}
}
