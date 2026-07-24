package main

import (
	"bufio"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
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
	H264FmtpLine string   `json:"h264FmtpLine"`
	H264Profile  string   `json:"h264ProfileLevelId"`
}

type stdinMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type stdoutMessage struct {
	Type    string             `json:"type"`
	SDP     string             `json:"sdp,omitempty"`
	State   string             `json:"state,omitempty"`
	Message string             `json:"message,omitempty"`
	Payload json.RawMessage    `json:"payload,omitempty"`
	Metrics map[string]float64 `json:"metrics,omitempty"`
}

const (
	mediaHeaderBytes = 24
	mediaVersion     = 1
	mediaKindVideo   = 1
	mediaKindAudio   = 2
	mediaFlagConfig  = 1 << 0
	mediaFlagKey     = 1 << 1
	mediaFlagGap     = 1 << 2
	maxMediaBytes    = 16 * 1024 * 1024
)

var mediaMagic = [4]byte{'R', 'B', 'D', '1'}

type mediaFrame struct {
	kind          uint8
	sequence      uint32
	timestampUs   uint64
	config        bool
	keyFrame      bool
	discontinuity bool
	data          []byte
}

func readMediaFrame(reader io.Reader, expectedKind uint8) (mediaFrame, error) {
	header := make([]byte, mediaHeaderBytes)
	if _, err := io.ReadFull(reader, header); err != nil {
		return mediaFrame{}, err
	}
	if string(header[:4]) != string(mediaMagic[:]) || header[4] != mediaVersion {
		return mediaFrame{}, errors.New("invalid RBD1 media header")
	}
	kind := header[5]
	if kind != expectedKind {
		return mediaFrame{}, errors.New("unexpected RBD1 media kind")
	}
	flags := binary.BigEndian.Uint16(header[6:8])
	size := binary.BigEndian.Uint32(header[20:24])
	if size == 0 || size > maxMediaBytes {
		return mediaFrame{}, errors.New("invalid RBD1 media payload length")
	}
	data := make([]byte, size)
	if _, err := io.ReadFull(reader, data); err != nil {
		return mediaFrame{}, err
	}
	return mediaFrame{
		kind:          kind,
		sequence:      binary.BigEndian.Uint32(header[8:12]),
		timestampUs:   binary.BigEndian.Uint64(header[12:20]),
		config:        flags&mediaFlagConfig != 0,
		keyFrame:      flags&mediaFlagKey != 0,
		discontinuity: flags&mediaFlagGap != 0,
		data:          data,
	}, nil
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
