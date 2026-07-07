/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package mqtt

import (
	"encoding/json"
	"fmt"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
)

// MessageHandler represents a generic handler for MQTT messages
type MessageHandler func(topic string, payload []byte) interface{}

// WebSocketMessage represents the generic message sent to WebSocket clients
type WebSocketMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

var (
	client           mqtt.Client
	websocketChannel chan WebSocketMessage
	handlers         map[string]MessageHandler
)

// Init initializes the MQTT client with basic connection
func Init() chan WebSocketMessage {
	if !configuration.Config.MQTTEnabled {
		logs.Log("[INFO][MQTT] MQTT disabled - missing credentials")
		return nil
	}

	websocketChannel = make(chan WebSocketMessage, 100)
	handlers = make(map[string]MessageHandler)

	// MQTT client options
	opts := mqtt.NewClientOptions()
	opts.AddBroker(fmt.Sprintf("tcp://%s:%s", configuration.Config.MQTTHost, configuration.Config.MQTTPort))
	opts.SetClientID("nethcti-middleware")
	opts.SetUsername(configuration.Config.MQTTUsername)
	opts.SetPassword(configuration.Config.MQTTPassword)
	opts.SetAutoReconnect(true)
	opts.SetConnectRetry(true)
	opts.SetConnectRetryInterval(5 * time.Second)

	// Connection lost handler
	opts.SetConnectionLostHandler(func(client mqtt.Client, err error) {
		logs.Log(fmt.Sprintf("[WARNING][MQTT] Connection lost: %v", err))
	})

	// On connect handler
	opts.SetOnConnectHandler(func(client mqtt.Client) {
		logs.Log("[INFO][MQTT] Connected to MQTT broker")

		// Re-subscribe to all registered topics after reconnection
		for topic := range handlers {
			subscribeToTopic(topic)
		}
	})

	// Create and start client
	client = mqtt.NewClient(opts)

	// Start connection in non-blocking mode
	// The client will retry automatically in background thanks to SetAutoReconnect and SetConnectRetry
	token := client.Connect()

	// Don't wait for connection to complete - let it happen in background
	// This prevents blocking the main thread if MQTT broker is unavailable
	go func() {
		if token.Wait() && token.Error() != nil {
			logs.Log(fmt.Sprintf("[ERROR][MQTT] Failed to connect to MQTT broker: %v", token.Error()))
			logs.Log("[INFO][MQTT] Will retry connection in background...")
		}
	}()

	logs.Log("[INFO][MQTT] MQTT client initialized - connecting in background")
	return websocketChannel
}

// SubscribeToTopic subscribes to a topic with a custom handler
func SubscribeToTopic(topic string, handler MessageHandler) error {
	if client == nil || !client.IsConnected() {
		return fmt.Errorf("MQTT client not connected")
	}

	// Store handler for reconnection scenarios
	handlers[topic] = handler

	return subscribeToTopic(topic)
}

// subscribeToTopic performs the actual subscription
func subscribeToTopic(topic string) error {
	token := client.Subscribe(topic, 0, func(client mqtt.Client, msg mqtt.Message) {
		handleMessage(msg.Topic(), msg.Payload())
	})

	if token.Wait() && token.Error() != nil {
		logs.Log(fmt.Sprintf("[ERROR][MQTT] Failed to subscribe to %s: %v", topic, token.Error()))
		return token.Error()
	}

	logs.Log(fmt.Sprintf("[INFO][MQTT] Subscribed to topic: %s", topic))
	return nil
}

// handleMessage routes messages to appropriate handlers
func handleMessage(topic string, payload []byte) {
	handler, exists := handlers[topic]
	if !exists {
		logs.Log(fmt.Sprintf("[WARNING][MQTT] No handler found for topic: %s", topic))
		return
	}

	// Process message with handler
	processedData := handler(topic, payload)
	if processedData == nil {
		return // Handler decided not to forward this message
	}

	// Create WebSocket message
	wsMessage := WebSocketMessage{
		Type: topic,
		Data: processedData,
	}

	// Send to WebSocket channel
	select {
	case websocketChannel <- wsMessage:
		// Message forwarded successfully
	default:
		logs.Log(fmt.Sprintf("[ERROR][MQTT] WebSocket channel full, dropping message from topic: %s", topic))
	}
}

// Close closes the MQTT client
func Close() {
	if client != nil && client.IsConnected() {
		client.Disconnect(250)
		logs.Log("[INFO][MQTT] MQTT client disconnected")
	}
	if websocketChannel != nil {
		close(websocketChannel)
	}
}

// Publish sends a message to an MQTT topic.
func Publish(topic string, payload interface{}) error {
	if client == nil || !client.IsConnected() {
		return fmt.Errorf("MQTT client not connected")
	}

	data := []byte{}
	switch v := payload.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		encoded, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		data = encoded
	}

	token := client.Publish(topic, 0, false, data)
	if token.Wait() && token.Error() != nil {
		return token.Error()
	}

	return nil
}
