/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package logs

import (
	"log"
	"os"
)

var Logs *log.Logger

func Init(name string) {
	// init syslog writer
	//
	// The date and time are left out: the service runs under systemd and
	// journald already stamps every entry, so printing them again only
	// duplicates the information, with the container timezone instead of the
	// host one.
	logger := log.New(os.Stderr, name+" ", log.Lshortfile)

	// assign writer to Logs var
	Logs = logger
}

func Log(message string) {
	if Logs == nil {
		return
	}
	// Output with a call depth of 2 so that Lshortfile reports the caller of
	// Log instead of this file: Println would resolve the frame of this
	// wrapper and label every single entry as logs.go.
	Logs.Output(2, message)
}
