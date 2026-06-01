/**
 * This Go program implements a WebRTC bridge that reads video data from a file descriptor and sends it to a remote peer over a WebRTC connection.
 * It also handles control messages received over a data channel and sends state updates back to the remote peer.
 * The program is designed to be used as a display sidecar for streaming video content from a host machine to a client application.
 */

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
	"sync"
	"time"

	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
)

const videoQueueSize = 2

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

func main() {
	if err := run(); err != nil {
		write(stdoutMessage{Type: "error", Message: err.Error()})
		os.Exit(1)
	}
}

func run() error {
	reader := bufio.NewReader(os.Stdin)
	line, err := reader.ReadString('\n')

	if err != nil {
		return err
	}

	var cfg configMessage

	// The initial configuration is expected to be a single line JSON message. If the message is malformed, we return an error and exit.
	if err := json.Unmarshal([]byte(line), &cfg); err != nil {
		return err
	}

	// We require the configuration to contain a WebRTC offer (SDP) of type "offer". If the type is not "offer" or the SDP is empty, we return an error and exit.
	if cfg.Type != "offer" || strings.TrimSpace(cfg.SDP) == "" {
		return errors.New("missing WebRTC offer")
	}

	setting := webrtc.SettingEngine{}

	// If an ICE host is specified in the configuration, we set it as a NAT1To1 IP in the WebRTC setting engine.
	// This allows the peer connection to use the specified ICE host for connectivity checks.
	if cfg.ICEHost != "" {
		setting.SetNAT1To1IPs([]string{cfg.ICEHost}, webrtc.ICECandidateTypeHost)
	}

	// If a UDP port range is specified in the configuration, we parse it and set it as the ephemeral UDP port range in the WebRTC setting engine.
	if minPort, maxPort, ok := parsePortRange(cfg.UDPPortRange); ok {
		if err := setting.SetEphemeralUDPPortRange(uint16(minPort), uint16(maxPort)); err != nil {
			return err
		}
	}

	mediaEngine := &webrtc.MediaEngine{}
	// We register the default codecs in the media engine. This allows the peer connection to negotiate and use the standard codecs for audio and video.
	if err := mediaEngine.RegisterDefaultCodecs(); err != nil {
		return err
	}

	api := webrtc.NewAPI(webrtc.WithSettingEngine(setting), webrtc.WithMediaEngine(mediaEngine))
	pc, err := api.NewPeerConnection(webrtc.Configuration{ICEServers: iceServers(cfg.STUNUrls)})

	if err != nil {
		return err
	}

	// We set up a deferred call to close the peer connection when the function returns.
	// This ensures that the peer connection is properly cleaned up and resources are released when we are done.
	defer pc.Close()

	// We create a new local video track with H264 codec and add it to the peer connection. This track will be used to send video samples to the remote peer.
	videoTrack, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264, ClockRate: 90000},
		"video",
		"rebroid",
	)

	if err != nil {
		return err
	}

	if _, err := pc.AddTrack(videoTrack); err != nil {
		return err
	}

	var audioTrack *webrtc.TrackLocalStaticSample

	if cfg.Audio {
		audioTrack, err = webrtc.NewTrackLocalStaticSample(
			webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 2},
			"audio",
			"rebroid",
		)

		if err != nil {
			return err
		}

		if _, err := pc.AddTrack(audioTrack); err != nil {
			return err
		}
	}

	var dataChannel *webrtc.DataChannel
	var dataMu sync.Mutex

	pc.OnDataChannel(func(dc *webrtc.DataChannel) {
		dataMu.Lock()
		dataChannel = dc
		dataMu.Unlock()
		dc.OnMessage(func(message webrtc.DataChannelMessage) {
			payload := json.RawMessage(message.Data)
			write(stdoutMessage{Type: "control", Payload: payload})
		})
	})

	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		write(stdoutMessage{Type: "state", State: state.String()})
		if state == webrtc.PeerConnectionStateFailed || state == webrtc.PeerConnectionStateClosed {
			os.Exit(0)
		}
	})

	// We set the remote description of the peer connection to the received offer.
	// This allows the peer connection to understand the capabilities and parameters of the remote peer and prepare for the WebRTC handshake.
	offer := webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: cfg.SDP}
	if err := pc.SetRemoteDescription(offer); err != nil {
		return err
	}

	// We create an answer to the received offer. This generates the local SDP that will be sent back to the remote peer to complete the WebRTC handshake.
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		return err
	}

	gatherComplete := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(answer); err != nil {
		return err
	}
	<-gatherComplete
	write(stdoutMessage{Type: "answer", SDP: pc.LocalDescription().SDP})

	go readCommands(reader, func(payload []byte) {
		dataMu.Lock()
		dc := dataChannel
		dataMu.Unlock()
		if dc != nil && dc.ReadyState() == webrtc.DataChannelStateOpen {
			_ = dc.Send(payload)
		}
	})

	video := os.NewFile(uintptr(3), "video")
	if video == nil {
		return errors.New("missing video fd")
	}

	defer video.Close()

	if audioTrack != nil {
		audio := os.NewFile(uintptr(4), "audio")
		if audio == nil {
			return errors.New("missing audio fd")
		}
		defer audio.Close()
		go func() {
			if err := streamOpus(audio, audioTrack); err != nil && !errors.Is(err, io.EOF) {
				write(stdoutMessage{Type: "log", Message: "audio stream stopped: " + err.Error()})
			}
		}()
	}

	fps := cfg.MaxFPS

	if fps <= 0 {
		fps = 30
	}

	return streamAnnexB(video, videoTrack, time.Second/time.Duration(fps))
}

func streamOpus(input io.Reader, track *webrtc.TrackLocalStaticSample) error {
	header := make([]byte, 12)
	var pending []byte
	var pendingPTS int64

	for {
		if _, err := io.ReadFull(input, header); err != nil {
			if errors.Is(err, io.EOF) && pending != nil {
				return track.WriteSample(media.Sample{Data: pending, Duration: 20 * time.Millisecond})
			}
			return err
		}
		pts := int64(binary.BigEndian.Uint64(header))
		size := binary.BigEndian.Uint32(header[8:])
		if size == 0 || size > 1024*1024 {
			return errors.New("invalid opus packet length")
		}
		packet := make([]byte, size)
		if _, err := io.ReadFull(input, packet); err != nil {
			return err
		}
		if pending != nil {
			duration := time.Duration(pts-pendingPTS) * time.Microsecond
			if duration <= 0 || duration > time.Second {
				duration = 20 * time.Millisecond
			}
			if err := track.WriteSample(media.Sample{Data: pending, Duration: duration}); err != nil {
				return err
			}
		}
		pending = packet
		pendingPTS = pts
	}
}

/**
 * The readCommands function continuously reads lines from the provided bufio.Reader, expecting each line to be a JSON message.
 * For each line read, it attempts to unmarshal the JSON into a stdinMessage struct. If the message type is "datachannel", it calls the provided send function with the payload of the message.
 * The function runs indefinitely until an error occurs while reading from the reader (e.g., EOF), at which point it returns and stops processing further commands.
 */
func readCommands(reader *bufio.Reader, send func([]byte)) {
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return
		}
		var msg stdinMessage
		if json.Unmarshal([]byte(line), &msg) == nil && msg.Type == "datachannel" {
			send(msg.Payload)
		}
	}
}

/**
 * The streamAnnexB function reads video data in Annex B format from the input reader, processes it to extract complete samples, and writes those samples to the provided WebRTC track.
 * It uses a channel to receive complete samples extracted from the input stream and handles any errors that occur during reading or writing.
 * The function returns an error if there is an issue with reading from the input or writing to the track, or nil if the streaming completes successfully (e.g., when reaching EOF).
 */
func streamAnnexB(input io.Reader, track *webrtc.TrackLocalStaticSample, duration time.Duration) error {
	samples := make(chan []byte, videoQueueSize)
	errs := make(chan error, 1)

	go func() {
		errs <- readAnnexBSamples(input, samples)
		close(samples)
	}()

	for sample := range samples {
		if err := track.WriteSample(media.Sample{Data: sample, Duration: duration}); err != nil {
			return err
		}
	}

	err := <-errs
	if errors.Is(err, io.EOF) {
		return nil
	}

	return err
}

func readAnnexBSamples(input io.Reader, samples chan []byte) error {
	// The size of the buffer is set to 32KB, which is a common size for reading video data.
	// This allows us to read chunks of data from the input stream and process them to extract complete NAL units.
	parser := newAnnexBParser()
	buf := make([]byte, 32*1024)

	for {
		n, err := input.Read(buf)

		// If we read some bytes successfully, we push them to the parser to extract complete NAL units and offer the latest sample to the samples channel.
		if n > 0 {
			for _, sample := range parser.push(buf[:n]) {
				offerLatestSample(samples, sample)
			}
		}

		if err != nil {
			return err
		}
	}
}

func offerLatestSample(samples chan []byte, sample []byte) {
	select {
	case samples <- sample:
		return
	default:
	}

	select {
	case <-samples:
	default:
	}

	select {
	case samples <- sample:
	default:
	}
}

type annexBParser struct {
	// The buffer field is used to accumulate incoming bytes from the video stream until complete NAL units can be extracted
	buffer []byte
	// The sps and pps fields store the most recent Sequence Parameter Set and Picture Parameter Set NAL units, which are necessary for decoding the video stream
	sps []byte
	pps []byte
	// The unit field is used to accumulate NAL units that belong to the same video frame. When a complete frame is detected, the accumulated NAL units are joined together and returned as a sample.
	unit [][]byte
}

func newAnnexBParser() *annexBParser {
	return &annexBParser{}
}

/**
 * The push function takes a chunk of bytes as input and processes it to extract complete NAL units (Network Abstraction Layer units) from an H264 video stream.
 * It maintains an internal buffer to accumulate incoming data and looks for start codes that indicate the beginning of NAL units.
 * When a complete NAL unit is found, it is passed to the handleNal function for further processing, which may result in a complete sample being returned.
 * The function returns a slice of byte slices, where each byte slice represents a complete sample that is ready to be sent to the remote peer.
 */
func (p *annexBParser) push(chunk []byte) [][]byte {
	p.buffer = append(p.buffer, chunk...)
	var samples [][]byte

	for {
		start, startLen := findStart(p.buffer, 0)

		// If no start code is found, we keep the remaining buffer for the next push and return the samples we have extracted so far.
		if start < 0 {
			if len(p.buffer) > 4 {
				p.buffer = p.buffer[len(p.buffer)-4:]
			}
			return samples
		}

		next, _ := findStart(p.buffer, start+startLen)
		// If no next start code is found, we keep the remaining buffer for the next push and return the samples we have extracted so far.
		if next < 0 {
			p.buffer = p.buffer[start:]
			return samples
		}

		// We create a copy of the NAL unit data to ensure that it is not modified by subsequent reads into the buffer.
		// This is important because the buffer is reused for incoming data, and we want to preserve the integrity of the NAL unit data for processing and sending to the remote peer.
		nal := append([]byte(nil), p.buffer[start+startLen:next]...)
		p.buffer = p.buffer[next:]

		//
		if sample := p.handleNal(nal); len(sample) > 0 {
			samples = append(samples, sample)
		}
	}
}

/**
 * The handleNal function processes a single NAL unit (Network Abstraction Layer unit) from an H264 video stream.
 * It checks the type of the NAL unit and updates the internal state of the parser accordingly.
 * If the NAL unit is an SPS (Sequence Parameter Set) or PPS (Picture Parameter Set), it stores them for later use.
 * If the NAL unit is a slice (NAL type 1 or 5), it checks if there are any pending NAL units in the current unit buffer and joins them into a sample to be returned.
 * If the NAL unit is an IDR slice (NAL type 5) and both SPS and PPS are available, it starts a new unit with the SPS and PPS before adding the current NAL unit.
 * The function returns a complete sample if one is ready to be sent, or nil if no sample is ready yet.
 */
func (p *annexBParser) handleNal(nal []byte) []byte {
	if len(nal) == 0 {
		return nil
	}

	nalType := nal[0] & 0x1f

	// NAL type 7 corresponds to SPS (Sequence Parameter Set)
	if nalType == 7 {
		p.sps = append([]byte(nil), nal...)
		return nil
	}
	// NAL type 8 corresponds to PPS (Picture Parameter Set)
	if nalType == 8 {
		p.pps = append([]byte(nil), nal...)
		return nil
	}

	// NAL types 1 and 5 correspond to slice units (non-IDR and IDR slices, respectively)
	isSlice := nalType == 1 || nalType == 5
	var sample []byte

	// If the current NAL unit is a slice and there are pending NAL units in the unit buffer, we join them into a complete sample to be sent.
	if isSlice && hasSlice(p.unit) {
		sample = joinNals(p.unit)
		p.unit = nil
	}
	// If the current NAL unit is an IDR slice (NAL type 5) and both SPS and PPS are available, we start a new unit with the SPS and PPS before adding the current NAL unit.
	if nalType == 5 && len(p.sps) > 0 && len(p.pps) > 0 {
		p.unit = append(p.unit, p.sps, p.pps)
	}

	p.unit = append(p.unit, nal)
	return sample
}

/**
 * The findStart function searches for the start code of an H264 NAL unit in the given byte slice starting from the specified offset.
 * It looks for either the 3-byte start code (0x000001) or the 4-byte start code (0x00000001) and returns the index of the start code and its length.
 * If no start code is found, it returns -1 and 0.
 */
func findStart(data []byte, offset int) (int, int) {
	for i := offset; i+3 < len(data); i++ {
		// The 3-byte start code (0x000001) is the most common start code for H264 NAL units. We check for it first.
		if data[i] == 0 && data[i+1] == 0 && data[i+2] == 1 {
			return i, 3
		}

		// The 4-byte start code (0x00000001) is less common but also valid. We check for it as well.
		if i+4 < len(data) && data[i] == 0 && data[i+1] == 0 && data[i+2] == 0 && data[i+3] == 1 {
			return i, 4
		}
	}
	return -1, 0
}

/**
 * The hasSlice function checks if a slice of NAL units contains at least one slice unit (NAL type 1 or 5).
 * It iterates over the input NAL units, checks their types, and returns true if it finds a slice unit. Otherwise, it returns false.
 */
func hasSlice(nals [][]byte) bool {
	for _, nal := range nals {
		if len(nal) > 0 {
			t := nal[0] & 0x1f
			if t == 1 || t == 5 {
				return true
			}
		}
	}
	return false
}

/**
 * The joinNals function takes a slice of NAL units (Network Abstraction Layer units) and concatenates them into a single byte slice with the appropriate start codes.
 * Each NAL unit is prefixed with a start code (0x00000001) to indicate the beginning of a new unit in the H264 video stream.
 * The function iterates over the input NAL units, appends the start code and the NAL unit data to the output slice, and returns the concatenated result.
 */
func joinNals(nals [][]byte) []byte {
	var out []byte
	for _, nal := range nals {
		out = append(out, 0, 0, 0, 1)
		out = append(out, nal...)
	}
	return out
}

/**
 * The parsePortRange function takes a string value representing a port range in the format "min-max" and parses it into two integers representing the minimum and maximum ports.
 * It returns the minimum port, maximum port, and a boolean indicating whether the parsing was successful and the values are valid.
 * The function checks that the input string is properly formatted, that both parts can be converted to integers,
 * and that the minimum port is greater than 0 and less than or equal to the maximum port.
 */
func parsePortRange(value string) (int, int, bool) {
	parts := strings.Split(strings.TrimSpace(value), "-")
	if len(parts) != 2 {
		return 0, 0, false
	}
	minPort, minErr := strconv.Atoi(parts[0])
	maxPort, maxErr := strconv.Atoi(parts[1])
	return minPort, maxPort, minErr == nil && maxErr == nil && minPort > 0 && maxPort >= minPort
}

/**
 * The iceServers function takes a slice of STUN server URLs and returns a slice of webrtc.ICEServer structs that can be used in the WebRTC configuration.
 * If the input slice is empty, it returns nil, indicating that no ICE servers will be used.
 */
func iceServers(urls []string) []webrtc.ICEServer {
	if len(urls) == 0 {
		return nil
	}
	return []webrtc.ICEServer{{URLs: urls}}
}

/**
 * The write function takes a stdoutMessage struct, marshals it into JSON, and writes it to standard output followed by a newline character.
 * This function is used to send messages back to the remote peer or to report errors and state changes.
 */
func write(message stdoutMessage) {
	data, _ := json.Marshal(message)
	os.Stdout.Write(append(data, '\n'))
}
