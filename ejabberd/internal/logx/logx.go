// Package logx: errors always reach the journal, everything else only with CHAT_DEBUG=1.
package logx

import (
	"log"
	"os"
)

var debug = os.Getenv("CHAT_DEBUG") == "1"

// Debugf logs what went fine: a delivery, a connection, an account retired.
func Debugf(format string, args ...any) {
	if debug {
		log.Printf(format, args...)
	}
}
