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
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/nethesis/nethvoice-report/api/configuration"
)

// Return the list of queries for the report, organized by section and view
func GetQueryTree(c *gin.Context) {
	report := c.Param("report")
	queryMap := make(map[string]map[string][]string)
	queryPath := configuration.Config.QueryPath + "/" + report

	// get all .sql files inside query path, including subdirectories
	err := filepath.Walk(queryPath, func(path string, info os.FileInfo, err error) error {
		if filepath.Ext(path) != ".sql" && filepath.Ext(path) != ".rrd" {
			return nil
		}

		// get query, view and section names
		queryName := filepath.Base(path)
		viewPath := filepath.Dir(path)
		viewName := filepath.Base(viewPath)
		sectionName := filepath.Base(filepath.Dir(viewPath))

		// initialize map if needed
		if queryMap[sectionName] == nil {
			queryMap[sectionName] = make(map[string][]string)
		}

		// add query name to the section/view it belongs
		queryMap[sectionName][viewName] = append(queryMap[sectionName][viewName], queryName)
		return nil
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "error retrieving views", "status": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"query_tree": queryMap})
}
