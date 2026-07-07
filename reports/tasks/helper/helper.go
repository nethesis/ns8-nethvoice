/*
 * Copyright (C) 2020 Nethesis S.r.l.
 * http://www.nethesis.it - info@nethesis.it
 *
 * This file is part of NethVoice Report project.
 *
 * NethVoice Report is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License,
 * or any later version.
 *
 * NethVoice Report is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with NethVoice Report.  If not, see COPYING.
 *
 * author: Edoardo Spadoni <edoardo.spadoni@nethesis.it>
 */

package helper

import (
	"fmt"
	"os"

	"github.com/fatih/color"
	"github.com/pkg/errors"
)

var (
	SuccessLog  = color.New(color.FgHiGreen).PrintfFunc()
	ErrorLog    = color.New(color.FgHiRed).PrintfFunc()
	GreenString = color.HiGreenString
	RedString   = color.HiRedString
	CyanString  = color.HiCyanString
)

// Print to stdout a formatted debug message, only if environment variable "DEBUG" is set to "1".
func LogDebug(format string, v ...interface{}) {
	debug := os.Getenv("DEBUG") == "1"

	if debug {
		// message is rendered in green
		fmt.Println(GreenString(format, v...))
	}
}

// Print an error message to stderr
func LogError(err error) {
	errorMsg := "[ERROR]: " + err.Error()
	debug := os.Getenv("DEBUG") == "1"

	if debug {
		// message is rendered in red
		os.Stderr.WriteString(RedString(errorMsg) + "\n")
	} else {
		os.Stderr.WriteString(errorMsg + "\n")
	}
}

// Print an error message to stderr and exit with non-zero status code
func FatalError(err error) {
	LogError(errors.Wrap(err, "FATAL"))
	os.Exit(1)
}
