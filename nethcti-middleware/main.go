/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package main

import (
	"fmt"
	"io"
	"regexp"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/robfig/cron/v3"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/db"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/methods"
	"github.com/nethesis/nethcti-middleware/middleware"
	"github.com/nethesis/nethcti-middleware/mqtt"
	"github.com/nethesis/nethcti-middleware/socket"
	"github.com/nethesis/nethcti-middleware/store"
	"github.com/nethesis/nethcti-middleware/summary"
)

func main() {
	// Init logger first
	logs.Init("nethcti-middleware")

	// Init configuration
	configuration.Init()

	// Init database
	err := db.Init()
	if err != nil {
		logs.Log("[CRITICAL][DB] Failed to initialize database: " + err.Error())
	}
	defer db.Close()

	// Init CDR database
	err = db.InitCDR()
	if err != nil {
		logs.Log("[CRITICAL][CDR-DB] Failed to initialize CDR database: " + err.Error())
	}
	defer db.CloseCDR()

	// Init satellite database
	err = db.InitSatellite()
	if err != nil {
		logs.Log("[CRITICAL][DB] Failed to initialize satellite database: " + err.Error())
	}
	defer db.CloseSatellite()

	// Init store
	store.UserSessionInit()

	// Init profiles and users
	store.InitProfiles(configuration.Config.ProfilesConfigPath, configuration.Config.UsersConfigPath)

	store.InitPersistence(configuration.Config.SecretsDir)
	if err := store.LoadSessions(); err != nil {
		logs.Log("[WARNING][PERSISTENCE] Failed to load sessions: " + err.Error())
	}

	// Init MQTT and setup transcription subscription
	mqttCh := mqtt.Init()
	if mqttCh != nil {
		socket.SetMQTTChannel(mqttCh)
		err := mqtt.InitTranscriptionSubscription()
		if err != nil {
			logs.Log("[WARNING][MQTT] Failed to subscribe to transcription topic: " + err.Error())
		}
	}

	// Register summary notifier to broadcast over WebSocket
	summary.SetSummaryNotifier(func(msg summary.SummaryMessage) {
		socket.BroadcastSummaryMessage(msg)
	})

	// Create router
	router := createRouter()

	// Create cron to run daily
	c := cron.New()
	c.AddFunc("@daily", methods.DeleteExpiredTokens)
	c.Start()

	// Run server
	router.Run(configuration.Config.ListenAddress)
}

func createRouter() *gin.Engine {
	// Disable log to stdout when running in release mode
	if gin.Mode() == gin.ReleaseMode {
		gin.DefaultWriter = io.Discard
	}

	// Init routers
	router := gin.New()
	router.RedirectTrailingSlash = false
	router.Use(
		gin.LoggerWithFormatter(func(params gin.LogFormatterParams) string {
			proxyFlag := ""
			if _, proxied := params.Keys["proxied"]; proxied {
				proxyFlag = " [proxied]"
			}
			return fmt.Sprintf("[GIN] %v | %3d | %13v | %15s | %-7s %#v%s\n",
				params.TimeStamp.Format("2006/01/02 - 15:04:05"),
				params.StatusCode,
				params.Latency,
				params.ClientIP,
				params.Method,
				params.Path,
				proxyFlag,
			)
		}),
		gin.Recovery(),
	)

	// Add default compression
	router.Use(gzip.Gzip(gzip.DefaultCompression))

	// Cors configuration only in debug mode GIN_MODE=debug
	if gin.Mode() == gin.DebugMode {
		// gin gonic cors conf
		corsConf := cors.DefaultConfig()
		corsConf.AllowHeaders = []string{"Authorization", "Content-Type", "Accept"}
		corsConf.AllowAllOrigins = true
		router.Use(cors.New(corsConf))
	} else {
		// This should not be strictly required:
		// when deployed inside NethServer, Traefik already take care to avoid header forgery
		router.SetTrustedProxies([]string{configuration.Config.TrustedProxy})
	}

	// Super admin endpoints (no JWT required) - must be registered on router, not api group
	router.POST("/admin/phonebook/import", middleware.RequireSuperAdmin(), methods.AdminImportPhonebookCSV)
	router.POST("/admin/reload/profiles", middleware.RequireSuperAdmin(), methods.AdminReloadProfiles)

	// Define api group
	api := router.Group("")

	// Define public endpoints
	api.POST("/login", middleware.InstanceJWT().LoginHandler)
	api.GET("/ws/", socket.WsProxyHandler)

	// Authentication required endpoints
	api.Use(middleware.InstanceJWT().MiddlewareFunc())
	{
		// Transcription
		api.GET("/transcripts/:uniqueid", middleware.RequireCapabilities("nethvoice_cti.satellite_stt"), methods.GetTranscriptionByUniqueID)

		// Summary
		api.GET("/summary/:uniqueid", middleware.RequireCapabilities("nethvoice_cti.satellite_stt"), methods.GetSummaryByUniqueID)
		api.HEAD("/summary/:uniqueid", middleware.RequireCapabilities("nethvoice_cti.satellite_stt"), methods.CheckSummaryByUniqueID)
		api.PUT("/summary/:uniqueid", middleware.RequireCapabilities("nethvoice_cti.satellite_stt"), methods.UpdateSummaryByUniqueID)
		api.POST("/summary/watch", middleware.RequireCapabilities("nethvoice_cti.satellite_stt"), methods.WatchCallSummary)

		// 2FA
		api.POST("/2fa/disable", methods.Disable2FA)
		api.POST("/2fa/verify-otp", methods.VerifyOTP)
		api.GET("/2fa/status", methods.Get2FAStatus)
		api.POST("/2fa/recovery-codes", methods.Get2FARecoveryCodes)
		api.GET("/2fa/qr-code", methods.QRCode)

		// Token
		// @migration-replaces: POST /authentication/phone_island_token_login
		// @migration-note: Replaced by the new persistent token API. The old path is kept as a compatibility shim.
		api.POST("/tokens/persistent/:audience", methods.CreatePersistentToken)
		// @migration-replaces: GET /authentication/phone_island_token_check/:subtype
		// @migration-note: Replaced by the new persistent token API. The old path is kept as a compatibility shim.
		api.GET("/tokens/persistent/:audience", methods.CheckPersistentToken)
		// @migration-replaces: POST /authentication/persistent_token_remove
		// @migration-note: Replaced by the new persistent token API. The old path is kept as a compatibility shim.
		api.DELETE("/tokens/persistent/:audience", methods.RemovePersistentToken)

		// LEGACY COMPATIBILITY (to be removed in a future cleanup):
		// keep old /authentication/* token endpoints for older clients.
		api.POST("/authentication/phone_island_token_login", methods.PhoneIslandTokenLogin)
		api.POST("/authentication/persistent_token_remove", methods.PhoneIslandTokenRemove)
		api.GET("/authentication/phone_island_token_check/:subtype", methods.PhoneIslandTokenCheck)

		// Phonebook
		api.GET("/phonebook/search", middleware.RequireCapabilities("phonebook"), methods.SearchLegacyPhonebook)
		api.GET("/phonebook/search/", middleware.RequireCapabilities("phonebook"), methods.SearchLegacyPhonebook)
		api.GET("/phonebook/search/:term", middleware.RequireCapabilities("phonebook"), methods.SearchLegacyPhonebook)
		api.GET("/phonebook/search/:term/", middleware.RequireCapabilities("phonebook"), methods.SearchLegacyPhonebook)
		api.GET("/phonebook/getall", middleware.RequireCapabilities("phonebook"), methods.ListLegacyPhonebook)
		api.GET("/phonebook/getall/", middleware.RequireCapabilities("phonebook"), methods.ListLegacyPhonebook)
		api.GET("/phonebook/getall/:term", middleware.RequireCapabilities("phonebook"), methods.ListLegacyPhonebook)
		api.GET("/phonebook/getall/:term/", middleware.RequireCapabilities("phonebook"), methods.ListLegacyPhonebook)
		api.GET("/phonebook/contact/:id", middleware.RequireCapabilities("phonebook"), methods.GetCentralizedPhonebookContact)
		api.GET("/phonebook/cticontact/:id", middleware.RequireCapabilities("phonebook"), methods.GetLegacyCTIPhonebookContact)
		api.POST("/phonebook/create", middleware.RequireCapabilities("phonebook"), methods.CreateLegacyCTIPhonebookContact)
		api.POST("/phonebook/delete_cticontact", middleware.RequireCapabilities("phonebook"), methods.DeleteLegacyCTIPhonebookContact)
		api.POST("/phonebook/modify_cticontact", middleware.RequireCapabilities("phonebook"), methods.UpdateLegacyCTIPhonebookContact)
		api.POST("/phonebook/import", middleware.RequireCapabilities("phonebook.ad_phonebook"), methods.ImportPhonebookCSV)

		// History
		api.GET("/history/calls", methods.GetFilteredHistory)
		api.POST("/history/statuses", middleware.RequireCapabilities("nethvoice_cti.satellite_stt"), methods.ListSummaryStatus)

		// Voicemail
		api.GET("/voicemail/list/:id", methods.ListVoicemailByID)

		// Logout
		api.POST("/logout", middleware.InstanceJWT().LogoutHandler)
	}

	// Handle missing endpoint
	router.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// Serve static assets through legacy V1 without enforcing JWT auth
		if strings.HasPrefix(path, "/static/") {
			methods.ProxyV1Request(c, path, true)
			return
		}

		// Check if this is a FreePBX admin transparent API call
		userHeader := c.GetHeader("User")
		secretKeyHeader := c.GetHeader("Secretkey")
		isFreePBXAdmin := userHeader == "admin" && secretKeyHeader != ""

		// Check if the API is in the FreePBX API list (prefix match with validation)
		isFreePBXAPI := false
		for _, freepbxPath := range configuration.Config.FreePBXAPIs {
			if path == freepbxPath {
				// Exact match
				isFreePBXAPI = true
				break
			} else if strings.HasPrefix(path, freepbxPath+"/") {
				// Prefix match - validate the remainder contains only numeric ID or safe paths
				remainder := path[len(freepbxPath)+1:]
				// Allow only numeric IDs (extensions/trunks) - no path traversal or additional paths
				matched, _ := regexp.MatchString(`^\d+$`, remainder)
				if matched {
					isFreePBXAPI = true
					break
				}
			}
		}

		if isFreePBXAdmin && isFreePBXAPI {
			// Handle FreePBX API call - add authorization_user header and forward directly
			c.Request.Header.Set("Authorization-User", "admin")
			methods.ProxyV1Request(c, path, false)
		} else {
			// Apply JWT middleware for regular APIs
			middleware.InstanceJWT().MiddlewareFunc()(c)
			if c.IsAborted() {
				return
			}
			// Fallback to proxy logic for legacy V1 API
			methods.ProxyV1Request(c, path, false)
		}
	})

	return router
}
