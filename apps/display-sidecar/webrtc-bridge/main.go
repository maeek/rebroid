package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	if err := runProcess(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func runProcess() error {
	signals, stopSignals := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stopSignals()
	ctx, stop := context.WithCancelCause(signals)
	defer stop(nil)

	commands, err := openBridgePipe(0, "commands")
	if err != nil {
		return err
	}
	defer commands.Close()
	output, err := openBridgePipe(1, "events")
	if err != nil {
		return err
	}
	defer output.Close()
	video, err := openBridgePipe(3, "video")
	if err != nil {
		return err
	}
	var audio io.ReadCloser
	if pipe, err := openBridgePipe(4, "audio"); err == nil {
		audio = pipe
	}

	events := newRelayMailbox[stdoutMessage]()
	done := make(chan struct{})
	go func() {
		defer close(done)
		if err := relayOutput(ctx, output, events); err != nil {
			stop(err)
		}
	}()
	err = run(ctx, commands, video, audio, func(message stdoutMessage) {
		if ctx.Err() != nil {
			return
		}
		key := message.replaceKey
		if message.Type == "metrics" {
			key = "metrics"
		}
		if err := events.put(message, key, message.discardKey); err != nil {
			stop(err)
		}
	})
	stop(nil)
	_ = output.Close()
	<-done
	return err
}

// Nonblocking descriptors let Close interrupt a blocked pipe read or write.
func openBridgePipe(fd int, name string) (*os.File, error) {
	if err := syscall.SetNonblock(fd, true); err != nil {
		return nil, fmt.Errorf("open bridge %s pipe: %w", name, err)
	}
	return os.NewFile(uintptr(fd), name), nil
}
