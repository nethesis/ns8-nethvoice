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
	"strings"
	"github.com/pkg/errors"

	"github.com/gin-gonic/gin"
	guuid "github.com/google/uuid"

	"github.com/nethesis/nethvoice-report/api/cache"
	"github.com/nethesis/nethvoice-report/api/models"
	"github.com/nethesis/nethvoice-report/api/utils"
)

func GetSearches(c *gin.Context) {
	// get current user
	user := GetClaims(c)["id"].(string)

	// get report param
	report := c.Param("report")

	// init cache connection
	cacheConnection := cache.Instance()

	// get saved searches for this section and view
	results, errCache := cacheConnection.HGetAll(user).Result()

	// check error
	if errCache != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "no custom searches found"})
		return
	}

	// iterate over results
	searches := []models.Search{}
	for k, v := range results {
		// define model
		var search models.Search
		var filter models.Filter

		// search key is: search_REPORT_SECTION_VIEW_NAME
		s := strings.Split(k, "_")
		idl := len(s)

		// set view with backward compatibility
		var view string
		if idl == 6 {
			view = s[idl-3] + "_" + s[idl-2]
		} else if idl == 5 {
			view = s[idl-2]
		} else {
			utils.LogError(errors.New("error reading saved search data for: " + s[idl-1]))
			continue
		}

		search.Report = s[1]
		search.Section = s[2]
		search.View = view
		search.Name = s[idl-1]

		// consider only searches matching request report
		if report != search.Report {
			continue
		}

		// convert filter string to struct
		errJson := json.Unmarshal([]byte(v), &filter)
		if errJson != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid filter unmarshal", "status": errJson.Error()})
			return
		}

		// assign filter
		search.Filter = filter

		// add object to array
		searches = append(searches, search)
	}

	// return saved searches
	c.JSON(http.StatusOK, gin.H{"searches": searches})
}

func SetSearches(c *gin.Context) {
	// get current user
	user := GetClaims(c)["id"].(string)

	// get report param
	report := c.Param("report")

	// bind json body
	var jsonSearch models.Search
	if err := c.BindJSON(&jsonSearch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "request fields malformed", "status": err.Error()})
		return
	}

	// extract name
	name := jsonSearch.Name

	// handle empty name
	if len(name) == 0 {
		name = guuid.New().String()
	}

	// extract report, section, view, filter
	section := jsonSearch.Section
	view := jsonSearch.View
	filter := jsonSearch.Filter

	// convert filter to string
	filterString, errConvert := json.Marshal(filter)
	if errConvert != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "error in filter conversion to string", "status": errConvert.Error()})
		return
	}

	// init cache connection
	cacheConnection := cache.Instance()

	// set custom search to cache, search key is: search_REPORT_SECTION_VIEW_NAME
	errCache := cacheConnection.HSet(user, "search_"+report+"_"+section+"_"+view+"_"+name, filterString).Err()

	// handle cache error
	if errCache != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "error saving to cache", "status": errCache.Error()})
		return
	}

	// return status created
	c.JSON(http.StatusCreated, gin.H{"message": "search saved successfully"})
}

func DeleteSearches(c *gin.Context) {
	// get current user
	user := GetClaims(c)["id"].(string)

	// extract search id
	searchID := c.Param("search_id")

	// init cache connection
	cacheConnection := cache.Instance()

	// set custom search to cache
	errCache := cacheConnection.HDel(user, searchID).Err()

	// handle cache error
	if errCache != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "error on deleting search in cache", "status": errCache.Error()})
		return
	}

	// return status created
	c.JSON(http.StatusOK, gin.H{"message": "search deleted successfully"})

}
