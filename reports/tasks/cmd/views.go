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
	"os"
	"path"
	"path/filepath"
	"sync"
	"text/template"
	"time"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/nethesis/nethvoice-report/api/configuration"
	"github.com/nethesis/nethvoice-report/api/source"
	"github.com/nethesis/nethvoice-report/api/utils"
	"github.com/nethesis/nethvoice-report/tasks/helper"
)

// Define command handled by cobra
var viewsCmd = &cobra.Command{
	Use:   "views",
	Short: "Calculate query views to combine data and columns",
	Args:  cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		executeReportViews()
	},
}

// Register "views" command to root command
func init() {
	RootCmd.AddCommand(viewsCmd)
}

// Entry point for "views" command
func executeReportViews() {
	// define views path
	viewsPath := configuration.Config.ViewsPath

	// collect all .sql files
	var viewFiles []string
	errWalk := filepath.Walk(viewsPath, func(pathS string, info os.FileInfo, err error) error {
		if filepath.Ext(pathS) == ".sql" {
			viewFiles = append(viewFiles, pathS)
		}
		return nil
	})
	if errWalk != nil {
		helper.FatalError(errors.Wrap(errWalk, "Error reading views directory"))
	}

	// execute views in parallel with bounded concurrency
	var wg sync.WaitGroup
	sem := make(chan struct{}, 4)
	var mu sync.Mutex
	var firstErr error

	for _, viewFile := range viewFiles {
		wg.Add(1)
		sem <- struct{}{}
		go func(pathS string) {
			defer wg.Done()
			defer func() { <-sem }()

			value := filepath.Base(pathS)
			helper.LogDebug("\nExecuting query %s", pathS)

			// parse template
			queryFile := viewsPath + "/" + value
			q := template.Must(template.New(path.Base(queryFile)).Funcs(template.FuncMap{"ExtractSettings": utils.ExtractSettings}).ParseFiles(queryFile))

			// compile query with filter object
			var queryString bytes.Buffer
			errTpl := q.Execute(&queryString, nil)
			if errTpl != nil {
				mu.Lock()
				if firstErr == nil {
					firstErr = errors.Wrap(errTpl, "Error in query template compiling")
				}
				mu.Unlock()
				return
			}

			// execute query
			db := source.CDRInstance()
			start := time.Now()
			rows, errQuery := db.Query(queryString.String())
			if errQuery != nil {
				mu.Lock()
				if firstErr == nil {
					firstErr = errors.Wrap(errQuery, "Error in query execution: "+viewsPath+"/"+value)
				}
				mu.Unlock()
				return
			}

			// drain remaining result sets so the connection returns to the pool
			// in a clean state. Without this, the next goroutine that reuses the
			// connection sees pending result-sets from the previous multi-statement
			// query and the driver fails with "invalid connection".
			for rows.NextResultSet() {
			}
			rows.Close()

			duration := time.Since(start)
			helper.LogDebug("%s completed in %s", value, duration)
		}(viewFile)
	}

	wg.Wait()

	if firstErr != nil {
		helper.FatalError(firstErr)
	}
}
