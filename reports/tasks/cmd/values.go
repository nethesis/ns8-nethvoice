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

package cmd

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"time"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/nethesis/nethvoice-report/api/cache"
	"github.com/nethesis/nethvoice-report/api/configuration"
	"github.com/nethesis/nethvoice-report/api/models"
	"github.com/nethesis/nethvoice-report/api/source"
	"github.com/nethesis/nethvoice-report/tasks/helper"
)

// Define command handled by cobra
var valuesCmd = &cobra.Command{
	Use:   "values",
	Short: "Calculate all possible values to show in filters",
	Args:  cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		executeReportValues()
	},
}

// Register "values" command to root command
func init() {
	RootCmd.AddCommand(valuesCmd)
}

// Entry point for "values" command
func executeReportValues() {
	// define values path
	valuesPath := configuration.Config.ValuesPath

	// define filter
	var valuesFilter models.Filter

	// get all .sql files inside values path
	errWalk := filepath.Walk(valuesPath, func(path string, info os.FileInfo, err error) error {
		// handle file different from sql
		if filepath.Ext(path) != ".sql" {
			return nil
		}
		helper.LogDebug("\nExecuting query %s", path)

		// get value name
		value := filepath.Base(path)

		// read value content
		queryString, errRead := ioutil.ReadFile(valuesPath + "/" + value)

		// handle reading error
		if errRead != nil {
			return errors.Wrap(errRead, "Error reading values content")
		}

		// execute query
		db := source.CDRInstance()
		start := time.Now()
		rows, errQuery := db.Query(string(queryString))
		if errQuery != nil {
			return errors.Wrap(errQuery, "Error in query execution")
		}

		duration := time.Since(start)
		helper.LogDebug("%s completed in %s", value, duration)

		// define results
		var results []string

		// loop rows
		for rows.Next() {
			// define field
			var field string

			// handle scan error
			if errScan := rows.Scan(&field); err != nil {
				return errors.Wrap(errScan, "Error in query scan field")
			}

			// append to results
			results = append(results, field)
		}

		// extract prop name
		prop := value[0 : len(value)-4]

		// create json string
		valuesArray, _ := json.Marshal(results)
		var valuesJSON = fmt.Sprintf("{\"%s\": %s}", prop, valuesArray)

		// set values to filter object
		errJson := json.Unmarshal([]byte(valuesJSON), &valuesFilter)
		if errJson != nil {
			return errors.Wrap(errJson, "Error in values json unmarshal")
		}

		// close results
		defer rows.Close()

		return nil

	})

	// handle read errors
	if errWalk != nil {
		helper.FatalError(errors.Wrap(errWalk, "Error reading values directory"))
	}

	// convert to string
	valuesString, errConvert := json.Marshal(valuesFilter)
	if errConvert != nil {
		helper.FatalError(errors.Wrap(errConvert, "Error in values conversion to string"))
	}

	// init cache connection
	cacheConnection := cache.Instance()

	// set custom search to cache
	errCache := cacheConnection.Set("values_filter", valuesString, 0).Err()

	// handle cache error
	if errCache != nil {
		helper.FatalError(errors.Wrap(errCache, "Error on saving to cache"))
	}
}
