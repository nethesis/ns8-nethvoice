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
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"regexp"
	"strings"
	"text/template"
	"time"

	"github.com/nleeper/goment"

	"github.com/gin-gonic/gin"
	_ "github.com/jinzhu/gorm/dialects/mysql"
	"github.com/pkg/errors"

	"github.com/nethesis/nethvoice-report/api/cache"
	"github.com/nethesis/nethvoice-report/api/configuration"
	"github.com/nethesis/nethvoice-report/api/models"
	"github.com/nethesis/nethvoice-report/api/source"
	"github.com/nethesis/nethvoice-report/api/utils"
)

func GetCallDetails(c *gin.Context) {
	// extract info
	linkedid := c.Param("linkedid")

	// get user and check privacy settings
	user := GetClaims(c)["id"].(string)
	var privacy bool
	var userExtensions []string

	if user != "admin" && user != "X" {
		auths, err := GetUserAuthorizations(user)
		if err == nil && auths.Privacy {
			privacy = true
			extensionsString := utils.ExtractUserExtensions(user)
			if extensionsString != "" {
				userExtensions = strings.Split(extensionsString, ",")
			}
		}
	}

	// build cache key including privacy settings
	cacheKey := fmt.Sprintf("call_details_%s_%s_%v", linkedid, user, privacy)

	// init cache connection
	cacheConnection := cache.Instance()

	// check if call detail is locally cached
	data, errCache := cacheConnection.Get(cacheKey).Result()

	// data is cached, return immediately
	if errCache == nil {
		c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(data))
		return
	}

	// call detail is not cached, execute query
	// build src and dst expressions based on privacy settings
	srcExpr := utils.MaskSrcSQL(privacy, userExtensions)
	dstExpr := utils.MaskDstSQL(privacy, userExtensions)

	query := fmt.Sprintf(`
	select
		DATE_FORMAT(calldate, '%%Y-%%m-%%d %%H:%%i:%%s') AS time£hourDate,
		%s AS src£phoneNumber,
		%s AS dst£phoneNumber,
		disposition AS result£label,
		duration AS totalDuration£seconds,
		billsec AS billsec£seconds,
		accountcode,
		peeraccount
	FROM cdr
	WHERE linkedid = ?
	ORDER BY calldate
	`, srcExpr, dstExpr)

	db := source.CDRInstance()
	results, errQuery := db.Query(query, linkedid)
	if errQuery != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "error executing SQL query", "status": errQuery.Error()})
		return
	}

	// close results
	defer results.Close()

	// parse results
	callDetails := utils.ParseSqlResults(results)

	// save call details to cache
	errCache = cacheConnection.Set(cacheKey, callDetails, 0).Err()
	if errCache != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "cannot save call details to cache", "status": errCache.Error()})
		return
	}

	// return data
	c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(callDetails))
}

func GetGraphData(c *gin.Context) {
	// extract report, section, view and graph
	report := c.Param("report")
	section := c.Param("section")
	view := c.Param("view")
	graph := c.Query("graph")
	queryType := c.Query("type")

	// extract filter
	filterParam := c.Query("filter")

	// convert to struct
	var filter models.Filter
	errJson := json.Unmarshal([]byte(filterParam), &filter)
	if errJson != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid filter params", "status": errJson.Error()})
		return
	}

	// set current user inside filter
	user := GetClaims(c)["id"].(string)
	filter.CurrentUser = user

	// check authorizations for not admin users and set privacy settings
	if user != "admin" && user != "X" {
		// initialize authorizations
		auths, err := GetUserAuthorizations(user)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "error executing SQL query", "status": "cannot retrieve user's authorizations"})
			return
		}

		// set privacy and user extensions in filter for CDR outbound queries
		if report == "cdr" && auths.Privacy {
			filter.Privacy = true
			// get user extensions to exclude from masking
			extensionsString := utils.ExtractUserExtensions(user)
			if extensionsString != "" {
				filter.UserExtensions = strings.Split(extensionsString, ",")
			}
		}
	}

	// convert struct to json to preserve item orders
	filterString, errConvert := json.Marshal(filter)
	if errConvert != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "error in filter conversion to string", "status": errConvert.Error()})
		return
	}

	// calculate hash
	h := sha256.New()
	h.Write([]byte(section + view + graph + queryType + string(filterString)))
	hash := fmt.Sprintf("%x", h.Sum(nil))

	// init cache connection
	cacheConnection := cache.Instance()

	// check if hash is locally cached
	data, errCache := cacheConnection.Get(hash).Result()

	if errCache == nil {
		// data is cached
		// get cached data ttl
		ttl,_ := cacheConnection.TTL(hash).Result()
		// parse authorizations file stats
		stats,_ := ParseAuthFileStats()
		// check cached data authorizations validity
		if CacheHasValidAuth(ttl, stats.ModTime) == true {
			// return data from cache
			c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(data))
			return
		}
	}

	// query result is not cached, execute query
	// check additional authorizations for not admin users
	if user != "admin" && user != "X" {

		// initialize authorizations (already retrieved above, but we need them again for queue/cdr checks)
		auths, err := GetUserAuthorizations(user)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "error executing SQL query", "status": "cannot retrieve user's authorizations"})
			return
		}

		// differ between queue report and cdr report
		if report == "queue" {

			// check authorized queues list
			if len(auths.Queues) == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"message": "error executing SQL query", "status": "no allowed queues found"})
				return
			}

			// check which queried queues are in authorized queues
			mixedQueues := utils.Intersect(filter.Queues, auths.Queues, "")
			if len(mixedQueues) == 0 {
				filter.Queues = auths.Queues
			} else {
				filter.Queues = mixedQueues
			}

		} else if report == "cdr" {

			// differ cdr authorizations by section and view
			// skip permissins when cdr authorization is global
			if section == "pbx" && auths.Cdr != "global" {
				// manage authorizations by views
				if view == "inbound" {

					// check which queried destinations are in authorized users
					mixedDest := utils.Intersect(filter.Destinations, auths.Users, "")
					if len(mixedDest) == 0 {
						c.Data(http.StatusOK, "application/json; charset=utf-8", []byte("[]"))
						return
						} else {
						filter.Destinations = mixedDest
					}

				} else if view == "outbound" {

					// check which queried sources are in authorized users
					mixedSrc := utils.Intersect(filter.Sources, auths.Users, "")
					if len(mixedSrc) == 0 {
						c.Data(http.StatusOK, "application/json; charset=utf-8", []byte("[]"))
						return
					} else {
						filter.Sources = mixedSrc
					}

				} else if view == "local" {

					// check which queried sources or destinations are in authorized users
					// check authorized sources
					mixedSrc := utils.Intersect(filter.Sources, auths.Users, "")
					if len(mixedSrc) == 0 {

						// check authorized destinations
						mixedDest := utils.Intersect(filter.Destinations, auths.Users, "")
						if len(mixedDest) == 0 {
							c.Data(http.StatusOK, "application/json; charset=utf-8", []byte("[]"))
							return
						} else {
							filter.Destinations = mixedDest
						}

					} else {
						filter.Sources = mixedSrc
					}

				}
			}
		}
	}

	var err error
	var queryResult string

	switch queryType {
	case "sql":
		queryResult, err = executeSqlQuery(filter, report, section, view, graph, c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "error executing SQL query", "status": err.Error()})
			return
		}
	default:
		queryResult, err = executeRrdQuery(filter, report, section, view, graph)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "error executing RRD query", "status": err.Error()})
			return
		}
	}

	// save calculated query result to cache
	errCache = cacheConnection.Set(hash, queryResult, 0).Err()
	cacheConnection.Expire(hash, time.Duration(configuration.Config.TTLCache)*time.Minute)
	if errCache != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "error on saving to cache", "status": errCache.Error()})
		return
	}

	// return data
	c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(queryResult))
}

func executeSqlQuery(filter models.Filter, report string, section string, view string, graph string, c *gin.Context) (string, error) {
	if report != "queue" && report != "cdr" {
		return "", errors.Errorf("unknown report: %s", report)
	}

	queryFile := configuration.Config.QueryPath + "/" + report + "/" + section + "/" + view + "/" + graph + ".sql"

	// check if query file exists
	if _, errExists := os.Stat(queryFile); os.IsNotExist(errExists) {
		return "", errors.Wrap(errExists, "query file does not exists")
	}

	// create template
	q := template.New(path.Base(queryFile)).Funcs(template.FuncMap{"ExtractStrings": utils.ExtractStrings}).Funcs(template.FuncMap{"ExtractPhones": utils.ExtractPhones}).Funcs(template.FuncMap{"ExtractOrigins": utils.ExtractOrigins}).Funcs(template.FuncMap{"ExtractSettings": utils.ExtractSettings}).Funcs(template.FuncMap{"PivotGroup": utils.PivotGroup}).Funcs(template.FuncMap{"ExtractUserExtensions": utils.ExtractUserExtensions}).Funcs(template.FuncMap{"ExtractPatterns": utils.ExtractPatterns}).Funcs(template.FuncMap{"ExtractCallDestinations": utils.ExtractCallDestinations}).Funcs(template.FuncMap{"ExtractDispositions": utils.ExtractDispositions}).Funcs(template.FuncMap{"ExtractRegexpStrings": utils.ExtractRegexpStrings}).Funcs(template.FuncMap{"ExtractRegexpSrcOrDst": utils.ExtractRegexpSrcOrDst}).Funcs(template.FuncMap{"ExtractRegexpTrunks": utils.ExtractRegexpTrunks}).Funcs(template.FuncMap{"MaskDstSQL": utils.MaskDstSQL}).Funcs(template.FuncMap{"MaskSrcSQL": utils.MaskSrcSQL}).Funcs(template.FuncMap{"MaskSrcLocalSQL": utils.MaskSrcLocalSQL}).Funcs(template.FuncMap{"MaskDstLocalSQL": utils.MaskDstLocalSQL})

	// parse template

	if report == "queue" {
		q = template.Must(q.ParseFiles(queryFile))
	} else {
		user := filter.CurrentUser

		// set sources and destinations for personal calls
		if section == "personal" && user != "admin" && user != "X" {
			// get user extensions
			extensionsString := utils.ExtractUserExtensions(user)
			extensions := strings.Split(extensionsString, ",")

			// get view
			if view == "inbound" {
				filter.Destinations = extensions
			}

			if view == "outbound" {
				filter.Sources = extensions
			}

			if view == "local" {
				if len(filter.Sources) == 0 {
					filter.Sources = extensions
				}

				if len(filter.Destinations) == 0 {
					filter.Destinations = extensions
				}
			}
		}

		if section == "dashboard" {
			q = template.Must(q.ParseFiles(queryFile))
		} else {
			// retrieve partitioned CDR tables
			query, err := buildCdrQuery(queryFile, filter)
			if err != nil {
				return "", err
			}
			q = template.Must(q.Parse(query))
		}
	}

	// compile query with filter object
	var queryString bytes.Buffer
	errTpl := q.Execute(&queryString, &filter)
	if errTpl != nil {
		return "", errors.Wrap(errTpl, "invalid query template compiling")
	}

	// print executed sql query
	// ...it can be useful for debug
	if gin.Mode() == gin.DebugMode {
		utils.LogInfo(queryFile + " | " + utils.InlineQuery(queryString.String()))
	}

	// execute query
	db := source.CDRInstance()
	results, errQuery := db.Query(queryString.String())
	if errQuery != nil {
		return "", errors.Wrap(errQuery, "invalid query execution")
	}

	// close results
	defer results.Close()

	// parse results
	data := utils.ParseSqlResults(results)
	return data, nil
}

func executeRrdQuery(filter models.Filter, report string, section string, view string, graph string) (string, error) {
	queryFile := configuration.Config.QueryPath + "/" + report + "/" + section + "/" + view + "/" + graph + ".rrd"

	// check if query file exists
	if _, errExists := os.Stat(queryFile); os.IsNotExist(errExists) {
		return "", errExists
	}

	rrdFilePathContent, errRead := ioutil.ReadFile(queryFile)
	if errRead != nil {
		return "", errors.Wrap(errRead, "cannot open RRD file")
	}
	rrdFilePath := strings.TrimSpace(string(rrdFilePathContent))

	// adjust time interval for RRD query
	start, end, err := utils.DatesTimeInterval(filter.Time.Interval.Start, filter.Time.Interval.End, filter.Time.Group)
	if err != nil {
		return "", errors.Wrap(err, "cannot retrieve time interval")
	}

	results, errRrd := QueryRrd(rrdFilePath, filter, start, end)
	if errRrd != nil {
		return "", errRrd
	}

	return results, nil
}

func buildCdrQuery(queryFile string, filter models.Filter) (string, error) {
	timeIntervalStart := filter.Time.Interval.Start
	timeIntervalEnd := filter.Time.Interval.End
	start, err := goment.New(timeIntervalStart, "YYYY-MM-DD")
	if err != nil {
		return "", errors.Wrap(err, "cannot create start goment")
	}
	start.StartOf("month")

	end, err := goment.New(timeIntervalEnd, "YYYY-MM-DD")
	if err != nil {
		return "", errors.Wrap(err, "cannot create end goment")
	}
	end.StartOf("month")

	// get first month with data to prevent access to non-existent tables (e.g. cdr_1999-12)

	cacheConnection := cache.Instance()
	firstMonthWithDataString, errCache := cacheConnection.Get("cdr_first_month").Result()
	if errCache != nil {
		return "", errors.Wrap(errCache, "cannot retrieve CDR first month from cache")
	}

	firstMonthWithData, err := goment.New(firstMonthWithDataString, "YYYY-MM")
	if err != nil {
		return "", errors.Wrap(err, "cannot create firstMonth goment")
	}
	firstMonthWithData.StartOf("month")

	if start.IsBefore(firstMonthWithData) {
		start = firstMonthWithData
	}

	var cdrTables []string

	for !start.IsAfter(end) {
		cdrTables = append(cdrTables, "cdr_"+start.Format("YYYY-MM"))
		start.Add(1, "month")
	}

	// read query from file

	content, err := ioutil.ReadFile(queryFile)
	if err != nil {
		return "", errors.Wrap(err, "cannot ready CDR query file")
	}
	queryWithTablePlaceholder := string(content)

	// build a query for every month and append all of them with UNION ALL

	var queryBuilder strings.Builder
	var query string

	// GROUP BY and ORDER BY must be applied to the result of UNION ALL

	// define regexps
	rS := regexp.MustCompile(`<CDR_SELECT: (.+)>`)
	rG := regexp.MustCompile(`<CDR_GROUP: (.+)>`)
	rO := regexp.MustCompile(`<CDR_ORDER: (.+)>`)

	findsS := rS.FindStringSubmatch(queryWithTablePlaceholder)
	findsG := rG.FindStringSubmatch(queryWithTablePlaceholder)
	findsO := rO.FindStringSubmatch(queryWithTablePlaceholder)

	hasGroupByOrOrderBy := len(findsG) > 0 || len(findsO) > 0

	if hasGroupByOrOrderBy {
		// build a query like this:
		// SELECT * FROM ( SELECT ... UNION ALL SELECT... UNION ALL SELECT...) t GROUP BY ... ORDER BY ... LIMIT ...
		// "t" is the alias for derived table
		// if there is at least one CDR_SELECT, change SELECT * with <CDR_SELECT> value
		if len(findsS) > 0 {
			// extract select fields
			querySelect := strings.Join(findsS[1:], ",")

			// build query string
			queryBuilder.WriteString("SELECT " + querySelect + " FROM (")
		} else {
			queryBuilder.WriteString("SELECT * FROM (")
		}
	}

	for i, cdrTable := range cdrTables {
		// clean placeholders
		query = strings.ReplaceAll(queryWithTablePlaceholder, "<CDR_TABLE>", cdrTable)

		// remove selects, groups and orders
		query = rG.ReplaceAllString(query, "")
		query = rO.ReplaceAllString(query, "")
		query = rS.ReplaceAllString(query, "")

		// remove trailing semicolon
		query = strings.ReplaceAll(query, ";", "")
		queryBuilder.WriteString(query)

		if i < len(cdrTables)-1 {
			queryBuilder.WriteString(" UNION ALL ")
		}
	}

	if hasGroupByOrOrderBy {
		// "t" is the alias for derived table
		queryBuilder.WriteString(") t ")
	}

	// get query groups
	if len(findsG) > 0 {
		queryGroup := strings.Join(findsG[1:], ",")

		// append group to query
		queryBuilder.WriteString(" GROUP BY " + queryGroup)
	}

	// get query orders
	if len(findsO) > 0 {
		queryOrder := strings.Join(findsO[1:], ",")

		// append order to query
		queryBuilder.WriteString(" ORDER BY " + queryOrder)
	}

	// get query limit

	var queryLimit string

	settingsString, errCache := cacheConnection.Get("admin_settings").Result()

	if errCache == nil {
		// admin settings are cached

		// convert to struct
		var settingsCache map[string]models.Settings

		errJson := json.Unmarshal([]byte(settingsString), &settingsCache)
		if errJson != nil {
			return "", errors.Wrap(err, "cannot unmarshal admin settings")
		}
		settings := settingsCache["settings"]
		queryLimit = settings.QueryLimit
	} else {
		// get settings struct from configuration
		settings := configuration.Config.Settings
		queryLimit = settings.QueryLimit
	}

	// append limit to query
	
	queryBuilder.WriteString(" LIMIT " + queryLimit)

	return queryBuilder.String(), nil
}
