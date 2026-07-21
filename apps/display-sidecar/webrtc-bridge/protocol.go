package main

import (
	"bufio"
	"encoding/json"
	"os"
	"strconv"
	"strings"

	"github.com/pion/webrtc/v4"
)

type configMessage struct {
	Type         string   `json:"type"`
	SDP          string   `json:"sdp"`
	ICEHost      string   `json:"iceHost"`
	UDPPortRange string   `json:"udpPortRange"`
	STUNUrls     []string `json:"stunUrls"`
	MaxFPS       int      `json:"maxFps"`
	Audio        bool     `json:"audio"`
}

type stdinMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type stdoutMessage struct {
	Type    string          `json:"type"`
	SDP     string          `json:"sdp,omitempty"`
	State   string          `json:"state,omitempty"`
	Message string          `json:"message,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

func readCommands(reader *bufio.Reader, send func([]byte)) {
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return
		}
		var message stdinMessage
		if json.Unmarshal([]byte(line), &message) == nil && message.Type == "datachannel" {
			send(message.Payload)
		}
	}
}

func parsePortRange(value string) (int, int, bool) {
	parts := strings.Split(strings.TrimSpace(value), "-")
	if len(parts) != 2 {
		return 0, 0, false
	}
	minPort, minErr := strconv.Atoi(parts[0])
	maxPort, maxErr := strconv.Atoi(parts[1])
	valid := minErr == nil && maxErr == nil && minPort > 0 && maxPort >= minPort && maxPort <= 65535
	return minPort, maxPort, valid
}

func iceServers(urls []string) []webrtc.ICEServer {
	if len(urls) == 0 {
		return nil
	}
	return []webrtc.ICEServer{{URLs: urls}}
}

func write(message stdoutMessage) {
	data, err := json.Marshal(message)
	if err == nil {
		_, _ = os.Stdout.Write(append(data, '\n'))
	}
}
