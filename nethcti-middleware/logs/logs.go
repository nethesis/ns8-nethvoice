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
	logger := log.New(os.Stderr, name+" ", log.Ldate|log.Ltime|log.Lshortfile)

	// assign writer to Logs var
	Logs = logger
}

func Log(message string) {
	if Logs == nil {
		return
	}
	Logs.Println(message)
}
