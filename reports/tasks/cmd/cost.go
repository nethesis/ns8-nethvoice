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
	"bytes"
	"encoding/json"
	"fmt"
	"path"
	"text/template"
	"time"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"github.com/thoas/go-funk"

	"github.com/nethesis/nethvoice-report/api/cache"
	"github.com/nethesis/nethvoice-report/api/configuration"
	"github.com/nethesis/nethvoice-report/api/models"
	"github.com/nethesis/nethvoice-report/api/source"
	"github.com/nethesis/nethvoice-report/tasks/helper"
)

var (
	from        string
	to          string
	cost        string
	destination string
	trunk       string
)

// Define command handled by cobra
var costCmd = &cobra.Command{
	Use:   "cost",
	Short: "Calculate cost for each record based on cost configuration",
	Run: func(cmd *cobra.Command, args []string) {
		flagsN := cmd.Flags().NFlag()
		if flagsN > 0 { // at least one flag is set
			// check flags
			if !cmd.Flags().Changed("from") {
				helper.FatalError(errors.New("Missing <from> flag"))
			}
			if !cmd.Flags().Changed("to") {
				helper.FatalError(errors.New("Missing <to> flag"))
			}
			if !cmd.Flags().Changed("cost") {
				helper.FatalError(errors.New("Missing <from> flag"))
			}
			if !cmd.Flags().Changed("destination") {
				helper.FatalError(errors.New("Missing <destination> flag"))
			}
			if !cmd.Flags().Changed("trunk") {
				helper.FatalError(errors.New("Missing <trunk> flag"))
			}

			// execute command with flags
			executeReportCost(true)
		} else {
			// execute command without flags
			executeReportCost(false)
		}
	},
}

// Register "cost" command to root command
func init() {
	RootCmd.AddCommand(costCmd)

	// add flags
	costCmd.Flags().StringVarP(&from, "from", "f", "", "Date interval <from> to update costs")
	costCmd.Flags().StringVarP(&to, "to", "t", "", "Date interval <to> to update costs")
	costCmd.Flags().StringVarP(&cost, "cost", "c", "", "Cost value to update")
	costCmd.Flags().StringVarP(&destination, "destination", "d", "", "Type of call to update: national, international, cell etc...")
	costCmd.Flags().StringVarP(&trunk, "trunk", "u", "", "Trunk used with specific destination to update")
}

type CostObj struct {
	Table       string
	Cost        string
	Destination string
	Trunk       string
}

// Entry point for "cost" command
func executeReportCost(flags bool) {
	// init cache connection
	cacheConnection := cache.Instance()

	// define db instance
	db := source.CDRInstance()

	// check if settings is locally cached
	settingsString, errCache := cacheConnection.Get("admin_settings").Result()

	// delete cost details
	_, errDelete := db.Exec("DELETE FROM cost_details")
	if errDelete != nil {
		helper.FatalError(errors.Wrap(errDelete, "Error deleting cost details"))
	}

	// save cost details to tables
	if errCache == nil {
		// convert to struct
		var settingsCache map[string]models.Settings

		errJson := json.Unmarshal([]byte(settingsString), &settingsCache)
		if errJson != nil {
			helper.FatalError(errors.Wrap(errJson, "Error parsing settings from cache"))
		}
		settings := settingsCache["settings"]

		for _, c := range settings.Costs {
			// create cost query
			_, errInsert := db.Exec("INSERT INTO cost_details VALUES (NULL, ?, ?, ?)", c.ChannelId, c.Destination, c.Cost)
			if errInsert != nil {
				helper.FatalError(errors.Wrap(errInsert, "Error insert cost details"))
			}
		}
	}

	// check if args is passed
	if flags {
		// define cost object
		var objTemplate CostObj
		objTemplate.Cost = cost
		objTemplate.Destination = destination
		objTemplate.Trunk = trunk

		// get date
		tFrom, errFrom := time.Parse("2006-01-02", from)
		if errFrom != nil {
			helper.FatalError(errors.Wrap(errFrom, "Error parsing <from> date. Format date: YYYY-MM-DD"))
		}

		tTo, errTo := time.Parse("2006-01-02", to)
		if errTo != nil {
			helper.FatalError(errors.Wrap(errTo, "Error parsing <to> date. Format date: YYYY-MM-DD"))
		}

		// iterate over dates
		var tables []string
		for f := tFrom; f.After(tTo) == false; f = f.AddDate(0, 0, 1) {
			y := int(f.Year())
			m := int(f.Month())

			table := fmt.Sprintf("cdr_%d", y)
			tables = append(tables, table)
			table = fmt.Sprintf("cdr_%d-%02d", y, m)
			tables = append(tables, table)
		}

		// remove duplicates from tables
		tables = funk.UniqString(tables)

		// loop tables
		for _, t := range tables {
			// compile query
			objTemplate.Table = t

			// define template cost update
			templateCost := configuration.Config.TemplatePath + "/cdr_cost_update.sql"

			// define query
			var query bytes.Buffer

			tpl := template.Must(template.New(path.Base(templateCost)).ParseFiles(templateCost))
			errTpl := tpl.Execute(&query, &objTemplate)
			if errTpl != nil {
				helper.FatalError(errors.Wrap(errTpl, "invalid query template compiling"))
			}

			helper.LogDebug("\nExecuting query %s for [%s]:\n%s", templateCost, t, query.String())

			// execute query
			rows, errQueryCost := db.Query(query.String())
			if errQueryCost != nil {
				helper.LogDebug(errQueryCost.Error() + ". Skipping...")
				continue
			}

			// close results
			rows.Close()
		}
	} else {
		// define cost object
		var objTemplate CostObj

		// define template cost
		templateCost := configuration.Config.TemplatePath + "/cdr_cost.sql"

		// get all cdr tables
		cdrTables, errQuery := db.Query("SHOW TABLES LIKE 'cdr_2%'")
		if errQuery != nil {
			helper.FatalError(errors.Wrap(errQuery, "Error getting cdr tables"))
		}

		// loop cdr tables
		for cdrTables.Next() {
			// define record
			var table string

			// handle scan error
			errScan := cdrTables.Scan(&table)
			if errScan != nil {
				helper.FatalError(errors.Wrap(errScan, "Error in query scan field"))
			}
			objTemplate.Table = table

			// define query
			var query bytes.Buffer

			// compile template
			tpl := template.Must(template.New(path.Base(templateCost)).ParseFiles(templateCost))
			errTpl := tpl.Execute(&query, &objTemplate)
			if errTpl != nil {
				helper.FatalError(errors.Wrap(errTpl, "invalid query template compiling"))
			}

			helper.LogDebug("\nExecuting query %s for [%s]:\n%s", templateCost, table, query.String())

			// execute query
			rows, errQueryCost := db.Query(query.String())
			if errQueryCost != nil {
				helper.LogError(errors.Wrap(errQueryCost, "Error in query [cdr] execution:\n"+query.String()))
			} else {
				// close results
				rows.Close()
			}
		}
	}
}
