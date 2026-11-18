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

package methods

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethvoice-report/api/cache"
	"github.com/nethesis/nethvoice-report/api/configuration"
	"github.com/nethesis/nethvoice-report/api/models"
	"github.com/nethesis/nethvoice-report/api/utils"
)

func GetDefaultFilter(c *gin.Context) {
	// get current user
	user := GetClaims(c)["id"].(string)

	// extract optional field
	filterField := c.Param("field")

	// define return filter
	var defaultFilter models.Filter

	// init cache connection
	cacheConnection := cache.Instance()

	// read default filter from cache
	valuesFilterString, errCache := cacheConnection.Get("values_filter").Result()

	// check error for default filter
	if errCache != nil {
		errCacheMessage := errCache.Error()

		if errCacheMessage == "redis: nil" {
			// filter values not present in cache
			c.JSON(http.StatusNotFound, gin.H{"message": "filter values not present in cache", "status": errCacheMessage})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "error reading values for filter from cache", "status": errCacheMessage})
		}
		return
	}

	// convert to struct
	var valuesFilter models.Filter
	errJson := json.Unmarshal([]byte(valuesFilterString), &valuesFilter)
	if errJson != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid default filter unmarshal", "status": errJson.Error()})
		return
	}

	// read default filter from configuration
	filterFromConfig := configuration.Config.DefaultFilter
	defaultFilter.Time.Group = filterFromConfig.Time.Group
	defaultFilter.Time.Division = filterFromConfig.Time.Division
	defaultFilter.Time.Range = filterFromConfig.Time.Range
	defaultFilter.Time.CdrDashboardRange = filterFromConfig.Time.CdrDashboardRange
	defaultFilter.GeoGroup = filterFromConfig.GeoGroup

	// read user authorizations
	auths, _ := GetUserAuthorizations(user)

	// assign default filter intersection
	defaultFilter.Agents = valuesFilter.Agents
	defaultFilter.IVRs = valuesFilter.IVRs
	defaultFilter.Phones = valuesFilter.Phones
	defaultFilter.Reasons = valuesFilter.Reasons
	defaultFilter.Results = valuesFilter.Results
	defaultFilter.Choices = valuesFilter.Choices
	defaultFilter.Destinations = valuesFilter.Destinations
	defaultFilter.Origins = valuesFilter.Origins
	defaultFilter.Trunks = valuesFilter.Trunks
	defaultFilter.DIDs = valuesFilter.DIDs
	defaultFilter.Devices = valuesFilter.Devices
	defaultFilter.QueueAgents = valuesFilter.QueueAgents

	if user == "X" || user == "admin" {
		defaultFilter.Queues = valuesFilter.Queues
		defaultFilter.Groups = valuesFilter.Groups
		defaultFilter.Users = valuesFilter.Users
	} else {
		defaultFilter.Queues = utils.Intersect(valuesFilter.Queues, auths.Queues, "queues")
		defaultFilter.Groups = utils.Intersect(valuesFilter.Groups, auths.Groups, "groups")
		defaultFilter.Users = utils.Intersect(valuesFilter.Users, auths.Users, "extensions")
	}

	if filterField != "" {
		// return only requested field

		var jsonMap map[string]interface{}
		filterBytes, _ := json.Marshal(defaultFilter)
		json.Unmarshal(filterBytes, &jsonMap)

		// return in JSON format
		c.JSON(http.StatusOK, gin.H{"filter": jsonMap[filterField]})
		return
	}

	// return in JSON format
	c.JSON(http.StatusOK, gin.H{"filter": defaultFilter})
	return
}
