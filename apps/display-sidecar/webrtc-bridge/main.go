package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/pion/webrtc/v4"
)

func main() {
	if err := runProcess(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func runProcess() error {
	if len(os.Args) != 4 {
		return fmt.Errorf("usage: rebroid-webrtc-bridge <socket path> <UDP port> <max peers>")
	}
	port, err := strconv.Atoi(os.Args[2])
	if err != nil || port < 1 || port > 65535 {
		return fmt.Errorf("invalid WebRTC UDP port")
	}
	maxPeers, err := strconv.Atoi(os.Args[3])
	if err != nil || maxPeers < 1 || maxPeers > 20000 {
		return fmt.Errorf("invalid WebRTC peer limit")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	// The parent holds stdin open. EOF also shuts down the bridge if the
	// sidecar exits without running its shutdown hooks.
	go func() {
		var unused [1]byte
		_, _ = os.Stdin.Read(unused[:])
		stop()
	}()

	udp, err := net.ListenUDP("udp", &net.UDPAddr{Port: port})
	if err != nil {
		return fmt.Errorf("bind WebRTC UDP port %d: %w", port, err)
	}
	mux := webrtc.NewICEUDPMux(nil, udp)
	defer mux.Close()
	setting := webrtc.SettingEngine{}
	setting.SetICEUDPMux(mux)

	listener, err := net.Listen("unix", os.Args[1])
	if err != nil {
		return fmt.Errorf("listen for sidecar bridge connections: %w", err)
	}
	fmt.Fprintln(os.Stdout, "ready")
	return servePeers(ctx, listener, maxPeers, setting)
}
