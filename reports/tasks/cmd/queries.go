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
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/nethesis/nethvoice-report/api/cache"
	"github.com/nethesis/nethvoice-report/api/configuration"
	"github.com/nethesis/nethvoice-report/api/methods"
	"github.com/nethesis/nethvoice-report/api/models"
	"github.com/nethesis/nethvoice-report/tasks/helper"
)

// Define command handled by cobra
var queriesCmd = &cobra.Command{
	Use:   "queries",
	Short: "Execute all report queries applying all saved filters",
	Args:  cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		executeReportQueries()
	},
}

// Register "queries" command to root command
func init() {
	RootCmd.AddCommand(queriesCmd)
}

// Get saved searches from redis cache.
func getSearchesFromCache(report string) ([]models.Search, error) {
	// get users list from authorizations file
	userAuthorizationsList, err := methods.ParseUserAuthorizationsFile()
	if err != nil {
		return nil, errors.Wrap(err, "Error parsing auth file")
	}

	searches := []models.Search{}
	// init cache connection
	cacheConnection := cache.Instance()

	for _, userAuthorizations := range userAuthorizationsList {
		username := userAuthorizations.Username

		// get saved searches for this section and view
		results, errCache := cacheConnection.HGetAll(username).Result()
		if errCache != nil {
			return nil, errors.Wrap(errCache, "Error reading cache")
		}

		// iterate over results
		for k, v := range results {
			// define model
			var search models.Search
			var filter models.Filter

			// search key is: search_REPORT_SECTION_VIEW_NAME
			s := strings.Split(k, "_")
			search.Report = s[1]
			search.Section = s[2]
			search.View = s[3]
			search.Name = s[4]

			// consider only searches matching request report
			if report != search.Report {
				continue
			}

			// convert filter string to struct
			errJson := json.Unmarshal([]byte(v), &filter)
			if errJson != nil {
				return nil, errors.Wrap(err, "Error unmarshalling filter")
			}

			// assign filter
			search.Filter = filter

			// add object to array
			searches = append(searches, search)
		}
	}
	return searches, nil
}

// Retrieve the list of queries for the report, organized by section and view
func getQueryTree(report string, jwtToken string) (map[string]map[string][]string, error) {
	// create request
	client := &http.Client{}
	requestUrl := configuration.Config.APIEndpoint + "/query_tree/" + report
	req, err := http.NewRequest("GET", requestUrl, nil)
	if err != nil {
		return nil, errors.Wrap(err, "Error creating request")
	}

	// add authorization header
	req.Header.Add("Authorization", "Bearer "+jwtToken)

	// perform request
	resp, err := client.Do(req)
	if err != nil {
		return nil, errors.Wrap(err, "Error retrieving query tree")
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, errors.Errorf("Error retrieving query tree [STATUS]: %d", resp.StatusCode)
	}

	// decode response
	var result map[string]map[string]map[string][]string
	json.NewDecoder(resp.Body).Decode(&result)
	queryTree := result["query_tree"]
	return queryTree, nil
}

// Request the execution of a report query specifying an input filter
func executeQuery(queryName string, filter models.Filter, report string, section string, view string, jwtToken string) (string, error) {
	client := &http.Client{}

	// encode filter for request URL
	filterString, err := json.Marshal(filter)
	if err != nil {
		return "", errors.Wrap(err, "Error marshalling filter")
	}
	filterEncoded := url.QueryEscape(string(filterString))

	// get query type
	tokens := strings.Split(queryName, ".")
	queryName = tokens[0]
	queryType := tokens[1]

	requestUrl := fmt.Sprintf("%s/graph/%s/%s/%s?filter=%s&graph=%s&type=%s", configuration.Config.APIEndpoint, report, section, view, filterEncoded, queryName, queryType)

	// create request
	req, err := http.NewRequest("GET", requestUrl, nil)
	if err != nil {
		return "", errors.Wrap(err, "Error creating request")
	}

	// add authorization header
	req.Header.Add("Authorization", "Bearer "+jwtToken)

	// perform request
	resp, err := client.Do(req)
	if err != nil {
		return "", errors.Wrap(err, "Error executing query")
	}
	defer resp.Body.Close()

	// decode response
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", errors.Wrap(err, "Error reading response body")
	}

	if resp.StatusCode != 200 {
		return "", errors.Errorf("Error executing query [BODY]: %s [STATUS]: %d", string(body), resp.StatusCode)
	}
	return string(body), nil
}

// Entry point for "queries" command
func executeReportQueries() {
	// login
	jwtToken, err := login()
	if err != nil {
		helper.FatalError(err)
	}

	for _, report := range []string{"queue", "cdr"} {
		// get query tree
		queryTree, err := getQueryTree(report, jwtToken)
		if err != nil {
			helper.FatalError(err)
		}

		// get saved searches
		searches, err := getSearchesFromCache(report)
		if err != nil {
			helper.FatalError(err)
		}
		helper.LogDebug("\n\nExecuting queries for %s report (%d saved searches)", strings.ToUpper(report), len(searches))

		for _, search := range searches {
			// get section, view, and query names for current search
			section := search.Section
			view := search.View
			queryNames := queryTree[section][view]

			// exectue queries of section/view
			for _, queryName := range queryNames {
				helper.LogDebug("\n    [QUERY]: %s [SEARCH]: %#v", queryName, search)
				start := time.Now()
				_, err := executeQuery(queryName, search.Filter, report, section, view, jwtToken)

				if err != nil {
					helper.LogError(errors.Wrap(err, fmt.Sprintf("[QUERY]: %s [SEARCH]: %#v", queryName, search)))
					continue
				}

				duration := time.Since(start)
				helper.LogDebug("    %s completed in %s", queryName, duration)
			}
		}
	}
}

// Perform login and retrieve JWT token
func login() (string, error) {
	username := "X"
	password := configuration.Config.APIKey
	loginURL := configuration.Config.APIEndpoint + "/login"

	// login request
	http.DefaultTransport.(*http.Transport).TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	resp, err := http.PostForm(loginURL, url.Values{"username": {username}, "password": {password}})
	if err != nil {
		return "", errors.Wrap(err, "Login error")
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", errors.Errorf("Login error, [STATUS]: %d", resp.StatusCode)
	}

	// decode response
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	// get JWT token
	jwtToken := result["token"]
	if jwtToken == nil {
		return "", errors.New("Error retrieving JWT token")
	}
	return jwtToken.(string), nil
}
