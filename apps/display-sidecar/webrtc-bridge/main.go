package main

import "os"

func main() {
	if err := run(); err != nil {
		write(stdoutMessage{Type: "error", Message: err.Error()})
		os.Exit(1)
	}
}
