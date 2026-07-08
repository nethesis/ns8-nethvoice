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

package main

import (
	"flag"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethvoice-report/api/configuration"
	"github.com/nethesis/nethvoice-report/api/methods"
	"github.com/nethesis/nethvoice-report/api/middleware"
)

func main() {
	// read and init configuration
	ConfigFilePtr := flag.String("c", "/opt/nethvoice-report/api/conf.json", "Path to configuration file")
	flag.Parse()
	configuration.Init(ConfigFilePtr)

	// init routers
	router := gin.Default()

	// add default compression
	router.Use(gzip.Gzip(gzip.DefaultCompression))

	// cors configuration only in debug mode GIN_MODE=debug (default)
	if gin.Mode() == gin.DebugMode {
		corsConf := cors.DefaultConfig()
		corsConf.AllowHeaders = []string{"Authorization", "Content-Type"}
		corsConf.AllowAllOrigins = true
		router.Use(cors.New(corsConf))
	}

	// define API
	api := router

	// define login endpoint
	api.POST("/login", middleware.InstanceJWT().LoginHandler)
	api.POST("/logout", middleware.InstanceJWT().LogoutHandler)

	// define refresh endpoint
	api.GET("/refresh_token", middleware.InstanceJWT().RefreshHandler)

	// define JWT middleware
	api.Use(middleware.InstanceJWT().MiddlewareFunc())
	{

		filters := api.Group("/filters")
		{
			filters.GET("", methods.GetDefaultFilter)
			filters.GET("/:field", methods.GetDefaultFilter)
		}

		details := api.Group("/details/:linkedid")
		{
			details.GET("", methods.GetCallDetails)
		}

		phonebook := api.Group("/phonebook")
		{
			phonebook.GET("", methods.GetPhonebook)
		}

		queryTree := api.Group("/query_tree/:report")
		{
			queryTree.GET("", methods.GetQueryTree)
		}

		graph := api.Group("/graph/:report/:section/:view")
		{
			graph.GET("", methods.GetGraphData)
		}

		searches := api.Group("/searches/:report")
		{
			searches.GET("", methods.GetSearches)
			searches.POST("", methods.SetSearches)
			searches.DELETE("/:search_id", methods.DeleteSearches)
		}

		settings := api.Group("/settings")
		{
			settings.GET("", methods.GetSettings)
			settings.PUT("", methods.SetSettings)
			settings.DELETE("", methods.DeleteSettings)
		}

		authorizations := api.Group("/authorizations")
		{
			authorizations.GET("/stats", methods.GetAuthFileStats)
			authorizations.GET("/map", methods.GetAuthMap)
		}
	}

	// handle missing endpoint
	router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"message": "API not found"})
	})

	var listenAddress string
	port := os.Getenv("PORT")

	if port != "" {
		listenAddress = "0.0.0.0:" + port
	} else {
		listenAddress = configuration.Config.ListenAddress
	}

	router.Run(listenAddress)
}
