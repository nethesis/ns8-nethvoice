/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package mqtt

import (
	"encoding/json"

	"github.com/nethesis/nethcti-middleware/logs"
)

// TranscriptionMessage represents the JSON payload from satellite/transcription topic
type TranscriptionMessage struct {
	UniqueID                 string  `json:"uniqueid"`
	Transcription            string  `json:"transcription"`
	Timestamp                float64 `json:"timestamp"`
	SpeakerName              string  `json:"speaker_name"`
	SpeakerNumber            string  `json:"speaker_number"`
	SpeakerCounterpartName   string  `json:"speaker_counterpart_name"`
	SpeakerCounterpartNumber string  `json:"speaker_counterpart_number"`
	IsFinal                  bool    `json:"is_final"`
}

// InitTranscriptionSubscription sets up subscription for satellite/transcription topic
func InitTranscriptionSubscription() error {
	return SubscribeToTopic("satellite/transcription", handleTranscriptionMessage)
}

// handleTranscriptionMessage processes transcription messages
func handleTranscriptionMessage(topic string, payload []byte) interface{} {
	var transcription TranscriptionMessage
	if err := json.Unmarshal(payload, &transcription); err != nil {
		logs.Log("[ERROR][MQTT] Failed to parse transcription message: " + err.Error())
		return nil
	}

	// You can add filtering logic here
	// For example, only forward final transcriptions:
	// if !transcription.IsFinal {
	//     return nil
	// }

	// You can add enrichment/processing here
	// For example, add metadata, transform data, etc.

	return transcription
}
