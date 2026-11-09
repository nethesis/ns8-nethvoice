/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package socket

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/mqtt"
)

// UserConnection represents a WebSocket connection with user data
type UserConnection struct {
	Conn                  *websocket.Conn
	Username              string
	DisplayName           string
	PhoneNumbers          []string
	AccessKeyId           string
	TranscriptionEnabled  bool
	TranscriptionUniqueID string
	writeMutex            sync.Mutex
}

// ConnectionManager manages all active WebSocket connections
type ConnectionManager struct {
	connections map[*websocket.Conn]*UserConnection
	mutex       sync.RWMutex
}

var connManager = &ConnectionManager{
	connections: make(map[*websocket.Conn]*UserConnection),
}

// AddConnection adds a new connection to the manager
func (cm *ConnectionManager) AddConnection(conn *websocket.Conn, user *UserConnection) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	user.Conn = conn
	cm.connections[conn] = user
}

// RemoveConnection removes a connection from the manager
func (cm *ConnectionManager) RemoveConnection(conn *websocket.Conn) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	delete(cm.connections, conn)
}

// GetConnection gets connection data for a specific connection
func (cm *ConnectionManager) GetConnection(conn *websocket.Conn) (*UserConnection, bool) {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	user, exists := cm.connections[conn]
	return user, exists
}

// GetAllConnections returns all active connections
func (cm *ConnectionManager) GetAllConnections() map[*websocket.Conn]*UserConnection {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	result := make(map[*websocket.Conn]*UserConnection)
	for conn, user := range cm.connections {
		result[conn] = user
	}
	return result
}

// IsAuthorizedForTranscription checks if a user is authorized to receive a transcription
func (cm *ConnectionManager) IsAuthorizedForTranscription(conn *websocket.Conn, speakerName, speakerNumber, counterpartName, counterpartNumber string) bool {
	user, exists := cm.GetConnection(conn)
	if !exists {
		return false
	}

	// Check if the user matches the speaker
	if user.DisplayName == speakerName {
		return true
	}

	for _, number := range user.PhoneNumbers {
		if number == speakerNumber {
			return true
		}
	}

	// Check if the user matches the counterpart
	if user.DisplayName == counterpartName {
		return true
	}

	for _, number := range user.PhoneNumbers {
		if number == counterpartNumber {
			return true
		}
	}

	return false
}

// BroadcastMQTTMessage sends an MQTT message to all authorized connections
func (cm *ConnectionManager) BroadcastMQTTMessage(messageType string, data interface{}) {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	for conn, user := range cm.connections {
		// Check authorization for transcription messages
		if messageType == "satellite/transcription" {
			// Skip if transcription is not enabled for this user
			if !user.TranscriptionEnabled {
				continue
			}

			// Try to parse as different types
			if transcriptionMsg, ok := data.(mqtt.TranscriptionMessage); ok {
				speakerName := transcriptionMsg.SpeakerName
				speakerNumber := transcriptionMsg.SpeakerNumber
				counterpartName := transcriptionMsg.SpeakerCounterpartName
				counterpartNumber := transcriptionMsg.SpeakerCounterpartNumber

				// Apply authorization - check if user is involved in the conversation
				if speakerName != "" || speakerNumber != "" || counterpartName != "" || counterpartNumber != "" {
					// Skip if user is not authorized for this transcription
					if !cm.IsAuthorizedForTranscription(conn, speakerName, speakerNumber, counterpartName, counterpartNumber) {
						continue
					}
				}
			} else if transcriptionData, ok := data.(map[string]interface{}); ok {
				speakerName, speakerNameOk := transcriptionData["speaker_name"].(string)
				speakerNumber, speakerNumberOk := transcriptionData["speaker_number"].(string)
				counterpartName, counterpartNameOk := transcriptionData["speaker_counterpart_name"].(string)
				counterpartNumber, counterpartNumberOk := transcriptionData["speaker_counterpart_number"].(string)

				// Only apply authorization if we have conversation info
				if speakerNameOk || speakerNumberOk || counterpartNameOk || counterpartNumberOk {
					// Skip if user is not authorized for this transcription
					if !cm.IsAuthorizedForTranscription(conn, speakerName, speakerNumber, counterpartName, counterpartNumber) {
						continue
					}
				}
			} else if jsonData, ok := data.(string); ok {
				// Try to parse JSON string
				var transcriptionData map[string]interface{}
				if err := json.Unmarshal([]byte(jsonData), &transcriptionData); err == nil {
					speakerName, speakerNameOk := transcriptionData["speaker_name"].(string)
					speakerNumber, speakerNumberOk := transcriptionData["speaker_number"].(string)
					counterpartName, counterpartNameOk := transcriptionData["speaker_counterpart_name"].(string)
					counterpartNumber, counterpartNumberOk := transcriptionData["speaker_counterpart_number"].(string)

					// Only apply authorization if we have conversation info
					if speakerNameOk || speakerNumberOk || counterpartNameOk || counterpartNumberOk {
						// Skip if user is not authorized for this transcription
						if !cm.IsAuthorizedForTranscription(conn, speakerName, speakerNumber, counterpartName, counterpartNumber) {
							continue
						}
					}
				} else {
					logs.Log(fmt.Sprintf("[ERROR][BROADCAST] Failed to parse JSON string: %v", err))
				}
			}
		}

		// Send message to this connection
		go func(conn *websocket.Conn, user *UserConnection) {
			// Convert to socket.io format: 42["transcription", {...}]
			socketIOPayload, err := json.Marshal([]interface{}{messageType, data})
			if err != nil {
				logs.Log(fmt.Sprintf("[ERROR][BROADCAST] Failed to marshal message: %v", err))
				return
			}

			finalMsg := append([]byte("42"), socketIOPayload...)

			// Send message (ignore errors, connection will be cleaned up elsewhere)
			if err := cm.WriteMessage(conn, websocket.TextMessage, finalMsg); err != nil {
				logs.Log(fmt.Sprintf("[ERROR][BROADCAST] Failed to write websocket message: %v", err))
			}
		}(conn, user)
	}
}

// WriteMessage serializes websocket writes for a connection to avoid concurrent writes.
func (cm *ConnectionManager) WriteMessage(conn *websocket.Conn, messageType int, data []byte) error {
	if user, exists := cm.GetConnection(conn); exists {
		user.writeMutex.Lock()
		defer user.writeMutex.Unlock()
	}
	return conn.WriteMessage(messageType, data)
}

// BroadcastSummaryMessage sends a summary update to all connected clients.
func BroadcastSummaryMessage(message interface{}) {
	if summaryMsg, ok := message.(map[string]interface{}); ok {
		username, _ := summaryMsg["username"].(string)
		if username != "" {
			connManager.BroadcastSummaryMessageToUser(username, sanitizeSummaryPayload(summaryMsg))
			return
		}
	}
	if summaryMsg, ok := message.(SummaryTarget); ok {
		connManager.BroadcastSummaryMessageToUser(summaryMsg.TargetUsername(), message)
		return
	}
	connManager.BroadcastMQTTMessage("satellite/summary", message)
}

func sanitizeSummaryPayload(payload map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{}, len(payload))
	for key, value := range payload {
		if key == "username" {
			continue
		}
		result[key] = value
	}
	return result
}

type SummaryTarget interface {
	TargetUsername() string
}

// BroadcastSummaryMessageToUser sends a summary update only to the target user's connections.
func (cm *ConnectionManager) BroadcastSummaryMessageToUser(username string, data interface{}) {
	cleanUsername := username
	if cleanUsername == "" {
		return
	}

	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	for conn, user := range cm.connections {
		if user.Username != cleanUsername {
			continue
		}

		go func(conn *websocket.Conn) {
			socketIOPayload, err := json.Marshal([]interface{}{"satellite/summary", data})
			if err != nil {
				logs.Log(fmt.Sprintf("[ERROR][BROADCAST] Failed to marshal summary message: %v", err))
				return
			}

			finalMsg := append([]byte("42"), socketIOPayload...)
			if err := cm.WriteMessage(conn, websocket.TextMessage, finalMsg); err != nil {
				logs.Log(fmt.Sprintf("[ERROR][BROADCAST] Failed to write summary websocket message: %v", err))
			}
		}(conn)
	}
}
