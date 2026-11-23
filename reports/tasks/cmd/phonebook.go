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
	"io/ioutil"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/nethesis/nethvoice-report/api/cache"
	"github.com/nethesis/nethvoice-report/api/configuration"
	"github.com/nethesis/nethvoice-report/api/source"
	"github.com/nethesis/nethvoice-report/tasks/helper"
)

// define phonebook entry
type Entry struct {
	Homephones []string `json:"homephones"`
	Workphones []string `json:"workphones"`
	Cellphones []string `json:"cellphones"`
}

// define phonebook map
var phonebookMap map[string]Entry

// Define command handled by cobra
var phonebookCmd = &cobra.Command{
	Use:   "phonebook",
	Short: "Find all numbers in phonebook and save to cache",
	Args:  cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		executeReportPhonebook()
	},
}

// Register "values" command to root command
func init() {
	RootCmd.AddCommand(phonebookCmd)
}

// Entry point for "phonebook" command
func executeReportPhonebook() {
	// read value content
	queryString, errRead := ioutil.ReadFile(configuration.Config.PhonebookPath)

	// handle reading error
	if errRead != nil {
		helper.FatalError(errors.Wrap(errRead, "Error reading phonebook query"))
	}

	// execute query
	db := source.PhonebookInstance()
	rows, errQuery := db.Query(string(queryString))
	if errQuery != nil {
		helper.FatalError(errors.Wrap(errQuery, "Error in query execution"))
	}

	// init phonebook map
	phonebookMap = make(map[string]Entry)
	counter := 0

	// loop rows
	for rows.Next() {
		// define fields
		var name string
		var company string
		var homephone string
		var workphone string
		var cellphone string

		// handle scan error
		errScan := rows.Scan(&name, &company, &homephone, &workphone, &cellphone)
		if errScan != nil {
			helper.FatalError(errors.Wrap(errScan, "Error in query scan fields"))
		}

		if name != "" && company != "" {
			name = name + " | " + company
		}

		if name == "" && company != "" {
			name = company
		}

		// handle phone numbers
		currentHomephones := phonebookMap[name].Homephones
		newHomephones := append(currentHomephones, homephone)

		currentWorkphones := phonebookMap[name].Workphones
		newWorkphones := append(currentWorkphones, workphone)

		currentCellphones := phonebookMap[name].Cellphones
		newCellphones := append(currentCellphones, cellphone)

		// assign values to struct
		phonebookMap[name] = Entry{
			Homephones: newHomephones,
			Workphones: newWorkphones,
			Cellphones: newCellphones,
		}

		// convert settings to string
		phonebookString, errConvert := json.Marshal(phonebookMap)
		if errConvert != nil {
			helper.FatalError(errors.Wrap(errConvert, "Error in filter conversion to string"))
		}

		// init cache connection
		cacheConnection := cache.Instance()

		// set custom search to cache
		errCache := cacheConnection.Set("phonebook_numbers", phonebookString, 0).Err()

		// handle cache error
		if errCache != nil {
			helper.FatalError(errors.Wrap(errCache, "error on saving to cache"))
		}

		counter++
		if counter%1000 == 0 {
			helper.LogDebug("Processed %d contacts", counter)
		}
	}
	helper.LogDebug("Done. Processed %d contacts", counter)
}
