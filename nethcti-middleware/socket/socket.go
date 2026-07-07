package socket

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/mqtt"
	"github.com/nethesis/nethcti-middleware/store"
	"github.com/nethesis/nethcti-middleware/utils"
)

var mqttChannel chan mqtt.WebSocketMessage

// SetMQTTChannel sets the MQTT channel for forwarding messages to WebSocket clients
func SetMQTTChannel(ch chan mqtt.WebSocketMessage) {
	mqttChannel = ch
	// Start global MQTT message handler
	go handleMQTTMessages()
}

// handleMQTTMessages processes MQTT messages and broadcasts them to authorized connections
func handleMQTTMessages() {
	for mqttMsg := range mqttChannel {
		connManager.BroadcastMQTTMessage(mqttMsg.Type, mqttMsg.Data)
	}
}

func WsProxyHandler(c *gin.Context) {
	protocol := "wss"
	if configuration.Config.V1Protocol == "http" {
		protocol = "ws"
	}

	// Upgrade client connection
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	clientConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.String(http.StatusInternalServerError, "WebSocket upgrade failed: %v", err)
		return
	}
	defer clientConn.Close()
	defer connManager.RemoveConnection(clientConn)

	// Connect to backend
	backendURL := url.URL{
		Scheme:   protocol,
		Host:     configuration.Config.V1WsEndpoint,
		Path:     configuration.Config.V1WsPath + "/",
		RawQuery: c.Request.URL.RawQuery,
	}
	backendConn, _, err := websocket.DefaultDialer.Dial(backendURL.String(), nil)
	if err != nil {
		c.String(http.StatusBadGateway, "Failed to connect to backend WebSocket: %v", err)
		return
	}
	defer backendConn.Close()

	errc := make(chan error, 3)

	// Client → Backend
	go func() {
		for {
			msgType, msg, err := clientConn.ReadMessage()
			if err != nil {
				errc <- err
				return
			}

			// Intercept transcription control messages
			if msgType == websocket.TextMessage {
				eventName, payload, isSocketIOEvent := parseSocketIOEvent(msg)
				if isSocketIOEvent && eventName == "start_transcription" {
					if user, exists := connManager.GetConnection(clientConn); exists {
						callid, _ := payload["linkedid"].(string)
						if callid == "" {
							callid, _ = payload["uniqueid"].(string)
						}
						if callid == "" {
							continue
						}

						shouldPublish := !user.TranscriptionEnabled || user.TranscriptionUniqueID != callid
						if !user.TranscriptionEnabled {
							user.TranscriptionEnabled = true
							logs.Log(fmt.Sprintf("[INFO][WS] Transcription enabled for user %s", user.Username))
						}
						user.TranscriptionUniqueID = callid

						if shouldPublish {
							err := mqtt.Publish("satellite/transcription/control", map[string]interface{}{
								"action":   "start",
								"linkedid": callid,
								"username": user.Username,
							})
							if err != nil {
								logs.Log(fmt.Sprintf("[ERROR][MQTT] Failed to publish start transcription control: %v", err))
							}
						}
					}
					continue // Don't forward to backend
				}

				if isSocketIOEvent && eventName == "stop_transcription" {
					if user, exists := connManager.GetConnection(clientConn); exists {
						callid, _ := payload["linkedid"].(string)
						if callid == "" {
							callid, _ = payload["uniqueid"].(string)
						}
						if callid == "" {
							callid = user.TranscriptionUniqueID
						}
						if callid == "" {
							continue
						}

						shouldPublish := user.TranscriptionEnabled && (user.TranscriptionUniqueID == "" || user.TranscriptionUniqueID == callid)
						if user.TranscriptionEnabled {
							user.TranscriptionEnabled = false
							logs.Log(fmt.Sprintf("[INFO][WS] Transcription disabled for user %s", user.Username))
						}
						if user.TranscriptionUniqueID == callid {
							user.TranscriptionUniqueID = ""
						}

						if shouldPublish {
							err := mqtt.Publish("satellite/transcription/control", map[string]interface{}{
								"action":   "stop",
								"linkedid": callid,
								"username": user.Username,
							})
							if err != nil {
								logs.Log(fmt.Sprintf("[ERROR][MQTT] Failed to publish stop transcription control: %v", err))
							}
						}
					}
					continue // Don't forward to backend
				}
			}

			// Intercept socket.io login message type: 42["login", {...}]
			if msgType == websocket.TextMessage && strings.HasPrefix(string(msg), "42[\"login\"") {
				var payload []interface{}
				if err := json.Unmarshal(msg[2:], &payload); err == nil && len(payload) > 1 {
					// payload[0] should be "login", payload[1] the JSON
					if loginData, ok := payload[1].(map[string]interface{}); ok {
						// Check if accessKeyId exists and is valid
						accessKeyId, ok := loginData["accessKeyId"].(string)
						if ok {
							session, sessionExists := store.UserSessions[accessKeyId]
							clientJWTToken, hasToken := loginData["token"].(string)

							if sessionExists && hasToken {
								if !utils.Contains(clientJWTToken, session.JWTTokens) {
									logs.Log(fmt.Sprintf("[ERROR][WS] Invalid JWT token for websocket login user=%s", accessKeyId))
									continue
								}

								tokenPartsRaw := strings.SplitN(session.NethCTIToken, ":", 2)
								if len(tokenPartsRaw) < 2 || tokenPartsRaw[1] == "" {
									logs.Log(fmt.Sprintf("[ERROR][WS] Invalid session token format for user=%s", accessKeyId))
									continue
								}

								// Extract only the token from the string "username:token"
								loginData["token"] = tokenPartsRaw[1]

								displayName := session.Username
								phoneNumbers := []string{}

								displayNameFromStore, phoneNumbersFromStore, err := store.GetUserDisplayInfo(session.Username)
								if err == nil {
									displayName = displayNameFromStore
									phoneNumbers = phoneNumbersFromStore
								} else {
									logs.Log(fmt.Sprintf("[WARNING][WS] Failed to get in-memory user info for %s: %v", session.Username, err))
								}

								// Register the connection with user data
								user := &UserConnection{
									Username:             session.Username,
									AccessKeyId:          accessKeyId,
									DisplayName:          displayName,
									PhoneNumbers:         phoneNumbers,
									TranscriptionEnabled: false,
								}
								connManager.AddConnection(clientConn, user)

								// Re-encode the message
								newPayload, _ := json.Marshal([]interface{}{payload[0], loginData})
								msg = append([]byte("42"), newPayload...)
							}
						}
					}
				}
			}

			err = backendConn.WriteMessage(msgType, msg)
			if err != nil {
				errc <- err
				return
			}
		}
	}()

	// Backend → Client
	go func() {
		for {
			msgType, msg, err := backendConn.ReadMessage()
			if err != nil {
				errc <- err
				return
			}

			err = connManager.WriteMessage(clientConn, msgType, msg)
			if err != nil {
				errc <- err
				return
			}
		}
	}()

	<-errc
}

func parseSocketIOEvent(msg []byte) (string, map[string]interface{}, bool) {
	if !bytes.HasPrefix(msg, []byte("42[")) {
		return "", nil, false
	}

	var payload []json.RawMessage
	if err := json.Unmarshal(msg[2:], &payload); err != nil || len(payload) == 0 {
		return "", nil, false
	}

	var eventName string
	if err := json.Unmarshal(payload[0], &eventName); err != nil || eventName == "" {
		return "", nil, false
	}

	eventPayload := map[string]interface{}{}
	if len(payload) > 1 {
		_ = json.Unmarshal(payload[1], &eventPayload)
	}

	return eventName, eventPayload, true
}
