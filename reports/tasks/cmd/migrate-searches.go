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
	"strings"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/nethesis/nethvoice-report/api/cache"
	"github.com/nethesis/nethvoice-report/api/methods"
	"github.com/nethesis/nethvoice-report/tasks/helper"
)

// Define command handled by cobra
var migrateSearchesCmd = &cobra.Command{
	Use:   "migrate-searches",
	Short: "Migrate saved searches to new version",
	Args:  cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		executeSearchesMigration()
	},
}

// Register "migrate-searches" command to root command
func init() {
	RootCmd.AddCommand(migrateSearchesCmd)
}

// Entry point for "migrate-searches" command
func executeSearchesMigration() {
	// get users list from authorizations file
	userAuthorizationsList, err := methods.ParseUserAuthorizationsFile()
	if err != nil {
		helper.FatalError(errors.Wrap(err, "error parsing auth file"))
	}

	// init cache connection
	cacheConnection := cache.Instance()

	// migrate searches of every user
	for _, userAuthorizations := range userAuthorizationsList {
		username := userAuthorizations.Username

		// get saved searches for this section and view
		results, errCache := cacheConnection.HGetAll(username).Result()

		// check error
		if errCache != nil {
			helper.FatalError(errors.Wrap(errCache, "error reading cache"))
		}

		helper.LogDebug("Processing searches of user %s (%d found)", username, len(results))

		// iterate over results
		for k, v := range results {
			// extract name, section, view
			s := strings.Split(k, "_")

			if len(s) == 3 {
				searchName := s[0]
				searchSection := s[1]
				searchView := s[2]
				newKey := "search_queue_" + searchSection + "_" + searchView + "_" + searchName
				helper.LogDebug("    Migrating search '%s'", k)

				errCache := cacheConnection.HSet(username, newKey, v).Err()
				// handle cache error
				if errCache != nil {
					helper.FatalError(errors.Wrap(errCache, "error saving migrated search to cache"))
				}

				// delete old search from cache
				helper.LogDebug("    Deleting old entry '%s'", k)
				errCache = cacheConnection.HDel(username, k).Err()
				if errCache != nil {
					helper.FatalError(errors.Wrap(errCache, "error deleting old search from cache"))
				}
			}
		}
	}
	helper.LogDebug("Done")
}
