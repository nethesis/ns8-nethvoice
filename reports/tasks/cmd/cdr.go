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
	"context"
	"database/sql"
	"fmt"
	"path"
	"text/template"
	"time"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"github.com/thoas/go-funk"

	"github.com/nethesis/nethvoice-report/api/cache"
	"github.com/nethesis/nethvoice-report/api/configuration"
	"github.com/nethesis/nethvoice-report/api/source"
	"github.com/nethesis/nethvoice-report/api/utils"
	"github.com/nethesis/nethvoice-report/tasks/helper"
)

var (
	pattern string
)

// Define command handled by cobra
var cdrCmd = &cobra.Command{
	Use:   "cdr",
	Short: "Group cdr records into date-based tables (by year, month, week etc...)",
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
			if !cmd.Flags().Changed("destination") {
				helper.FatalError(errors.New("Missing <destination> flag"))
			}
			if !cmd.Flags().Changed("pattern") {
				helper.FatalError(errors.New("Missing <pattern> flag"))
			}

			// execute command with flags
			executeReportCDR(true)

		} else {
			// execute command without flags
			executeReportCDR(false)

		}
	},
}

// Register "cdr" command to root command
func init() {
	RootCmd.AddCommand(cdrCmd)

	// add flags
	cdrCmd.Flags().StringVarP(&from, "from", "f", "", "Date interval <from> to update cdr records")
	cdrCmd.Flags().StringVarP(&to, "to", "t", "", "Date interval <to> to update cdr records")
	cdrCmd.Flags().StringVarP(&destination, "destination", "d", "", "Type of call to update: national, international, cell etc...")
	cdrCmd.Flags().StringVarP(&pattern, "pattern", "p", "", "Pattern to match dst number. Ex. 00390 to match italian national numbers")
}

// Define objects and utilities
type CDRObj struct {
	Year        int
	Month       int
	Destination string
	Pattern     string
	Table       string
}

func yearMap(year int) string {
	return fmt.Sprintf("%d", year)
}

func monthMap(month int) string {
	return fmt.Sprintf("%02d", month)
}

// ensureCDRSourceIndexes adds indexes on the source cdr table if they don't exist.
// Uses the migration pool (no read/write timeout) since ALTER TABLE on large tables can take minutes.
func ensureCDRSourceIndexes(db *sql.DB) {
	indexes := []struct{ name, columns string }{
		{"idx_cdr_calldate", "calldate"},
		{"idx_cdr_linkedid", "linkedid"},
	}
	for _, idx := range indexes {
		var count int
		db.QueryRow("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cdr' AND INDEX_NAME = ?", idx.name).Scan(&count)
		if count == 0 {
			start := time.Now()
			helper.LogDebug("Adding index %s on cdr...", idx.name)
			_, err := db.Exec("ALTER TABLE cdr ADD INDEX " + idx.name + " (" + idx.columns + ")")
			if err != nil {
				helper.LogDebug("Warning: could not add index %s on cdr: %s", idx.name, err.Error())
			} else {
				helper.LogDebug("Index %s on cdr created in %s", idx.name, time.Since(start))
			}
		}
	}
}

// ensureYearTableIndexes adds indexes on cdr_YYYY tables.
// Each ALTER TABLE is a separate db.Exec() to avoid single-operation timeout issues.
func ensureYearTableIndexes(db *sql.DB, table string) {
	indexes := []struct{ name, columns string }{
		{"idx_type_calldate", "type, calldate"},
		{"idx_type", "type"},
		{"idx_cnum", "cnum"},
		{"idx_dst", "dst"},
		{"idx_channel", "channel"},
		{"idx_dstchannel", "dstchannel"},
		{"idx_type_cnum_calldate", "type, cnum, calldate"},
	}
	for _, idx := range indexes {
		var count int
		db.QueryRow("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?", table, idx.name).Scan(&count)
		if count == 0 {
			start := time.Now()
			helper.LogDebug("Adding index %s on %s...", idx.name, table)
			_, err := db.Exec("ALTER TABLE `" + table + "` ADD INDEX `" + idx.name + "` (" + idx.columns + ")")
			if err != nil {
				helper.LogDebug("Warning: could not add index %s on %s: %s", idx.name, table, err.Error())
			} else {
				helper.LogDebug("Index %s on %s created in %s", idx.name, table, time.Since(start))
			}
		}
	}
}

// ensureMonthTableIndexes adds indexes on cdr_YYYY-MM tables.
func ensureMonthTableIndexes(db *sql.DB, table string) {
	indexes := []struct{ name, columns string }{
		{"idx_type_calldate", "type, calldate"},
		{"idx_type", "type"},
		{"idx_cnum", "cnum"},
		{"idx_dst", "dst"},
		{"idx_calldate", "calldate"},
	}
	for _, idx := range indexes {
		var count int
		db.QueryRow("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?", table, idx.name).Scan(&count)
		if count == 0 {
			start := time.Now()
			helper.LogDebug("Adding index %s on %s...", idx.name, table)
			_, err := db.Exec("ALTER TABLE `" + table + "` ADD INDEX `" + idx.name + "` (" + idx.columns + ")")
			if err != nil {
				helper.LogDebug("Warning: could not add index %s on %s: %s", idx.name, table, err.Error())
			} else {
				helper.LogDebug("Index %s on %s created in %s", idx.name, table, time.Since(start))
			}
		}
	}
}

// ensureGeoColumns adds geo columns to a table without populating them.
// Used on month tables so that INSERT ... SELECT * from year table doesn't fail
// when the year table already has the geo columns but the month table doesn't.
func ensureGeoColumns(db *sql.DB, table string) {
	for _, col := range []string{"src_region", "src_province", "dst_region", "dst_province"} {
		db.Exec("ALTER TABLE `" + table + "` ADD COLUMN IF NOT EXISTS " + col + " VARCHAR(100) DEFAULT NULL")
	}
}

// migrateGeoColumns adds geo columns and populates them on a year table.
// Uses a dedicated sql.Conn to keep temporary tables alive across statements.
// UPDATEs are batched (100K rows at a time) to keep each operation short.
func migrateGeoColumns(db *sql.DB, table string) {
	ctx := context.Background()

	// use a dedicated connection for temp table operations
	conn, err := db.Conn(ctx)
	if err != nil {
		helper.LogDebug("Warning: could not get connection for geo migration on %s: %s", table, err.Error())
		return
	}
	defer conn.Close()

	// add columns if not present
	for _, col := range []string{"src_region", "src_province", "dst_region", "dst_province"} {
		_, err := conn.ExecContext(ctx, "ALTER TABLE `"+table+"` ADD COLUMN IF NOT EXISTS "+col+" VARCHAR(100) DEFAULT NULL")
		if err != nil {
			helper.LogDebug("Warning: could not add column %s on %s: %s", col, table, err.Error())
			return
		}
	}

	// check if there are NULL geo records to populate
	var srcNullCount, dstNullCount int
	conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM `"+table+"` WHERE type = 'IN' AND src_region IS NULL").Scan(&srcNullCount)
	conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM `"+table+"` WHERE type = 'OUT' AND dst_region IS NULL").Scan(&dstNullCount)

	if srcNullCount == 0 && dstNullCount == 0 {
		helper.LogDebug("Geo columns on %s already populated, skipping", table)
		return
	}

	// migrate inbound geo
	if srcNullCount > 0 {
		start := time.Now()
		helper.LogDebug("Populating inbound geo columns on %s (%d rows)...", table, srcNullCount)

		// build lookup + resolve as multi-statement (stays on same connection)
		_, err := conn.ExecContext(ctx, ""+
			"DROP TEMPORARY TABLE IF EXISTS _geo_src_lookup;"+
			"CREATE TEMPORARY TABLE _geo_src_lookup AS "+
			"SELECT DISTINCT clean_prefix(IF(cnum IS NULL OR cnum = '', src, cnum)) AS clean_phone "+
			"FROM `"+table+"` "+
			"WHERE type = 'IN' AND src_region IS NULL;"+
			"ALTER TABLE _geo_src_lookup ADD INDEX idx_phone (clean_phone);"+
			"DROP TEMPORARY TABLE IF EXISTS _geo_src_resolved;"+
			"CREATE TEMPORARY TABLE _geo_src_resolved AS "+
			"SELECT gsl.clean_phone, "+
			"(SELECT z.regione FROM zone z WHERE gsl.clean_phone LIKE CONCAT(z.prefisso, '%') "+
			"ORDER BY LENGTH(z.prefisso) DESC LIMIT 1) AS region, "+
			"(SELECT z.provincia FROM zone z WHERE gsl.clean_phone LIKE CONCAT(z.prefisso, '%') "+
			"ORDER BY LENGTH(z.prefisso) DESC LIMIT 1) AS province "+
			"FROM _geo_src_lookup gsl;"+
			"ALTER TABLE _geo_src_resolved ADD INDEX idx_phone (clean_phone)")
		if err != nil {
			helper.LogDebug("Warning: could not build inbound geo lookup on %s: %s", table, err.Error())
		} else {
			// batch update to keep each operation within timeout
			totalUpdated := int64(0)
			for {
				result, err := conn.ExecContext(ctx,
					"UPDATE `"+table+"` c "+
						"JOIN _geo_src_resolved gsr ON clean_prefix(IF(c.cnum IS NULL OR c.cnum = '', c.src, c.cnum)) = gsr.clean_phone "+
						"SET c.src_region = gsr.region, c.src_province = gsr.province "+
						"WHERE c.type = 'IN' AND c.src_region IS NULL LIMIT 100000")
				if err != nil {
					helper.LogDebug("Warning: geo inbound update failed on %s: %s", table, err.Error())
					break
				}
				affected, _ := result.RowsAffected()
				totalUpdated += affected
				if affected == 0 {
					break
				}
				helper.LogDebug("  Updated %d inbound rows so far on %s...", totalUpdated, table)
			}
			helper.LogDebug("Inbound geo on %s: %d rows in %s", table, totalUpdated, time.Since(start))
		}
		conn.ExecContext(ctx, "DROP TEMPORARY TABLE IF EXISTS _geo_src_lookup; DROP TEMPORARY TABLE IF EXISTS _geo_src_resolved")
	}

	// migrate outbound geo
	if dstNullCount > 0 {
		start := time.Now()
		helper.LogDebug("Populating outbound geo columns on %s (%d rows)...", table, dstNullCount)

		_, err := conn.ExecContext(ctx, ""+
			"DROP TEMPORARY TABLE IF EXISTS _geo_dst_lookup;"+
			"CREATE TEMPORARY TABLE _geo_dst_lookup AS "+
			"SELECT DISTINCT clean_prefix(dst) AS clean_phone "+
			"FROM `"+table+"` "+
			"WHERE type = 'OUT' AND dst_region IS NULL;"+
			"ALTER TABLE _geo_dst_lookup ADD INDEX idx_phone (clean_phone);"+
			"DROP TEMPORARY TABLE IF EXISTS _geo_dst_resolved;"+
			"CREATE TEMPORARY TABLE _geo_dst_resolved AS "+
			"SELECT gdl.clean_phone, "+
			"(SELECT z.regione FROM zone z WHERE gdl.clean_phone LIKE CONCAT(z.prefisso, '%') "+
			"ORDER BY LENGTH(z.prefisso) DESC LIMIT 1) AS region, "+
			"(SELECT z.provincia FROM zone z WHERE gdl.clean_phone LIKE CONCAT(z.prefisso, '%') "+
			"ORDER BY LENGTH(z.prefisso) DESC LIMIT 1) AS province "+
			"FROM _geo_dst_lookup gdl;"+
			"ALTER TABLE _geo_dst_resolved ADD INDEX idx_phone (clean_phone)")
		if err != nil {
			helper.LogDebug("Warning: could not build outbound geo lookup on %s: %s", table, err.Error())
		} else {
			totalUpdated := int64(0)
			for {
				result, err := conn.ExecContext(ctx,
					"UPDATE `"+table+"` c "+
						"JOIN _geo_dst_resolved gdr ON clean_prefix(c.dst) = gdr.clean_phone "+
						"SET c.dst_region = gdr.region, c.dst_province = gdr.province "+
						"WHERE c.type = 'OUT' AND c.dst_region IS NULL LIMIT 100000")
				if err != nil {
					helper.LogDebug("Warning: geo outbound update failed on %s: %s", table, err.Error())
					break
				}
				affected, _ := result.RowsAffected()
				totalUpdated += affected
				if affected == 0 {
					break
				}
				helper.LogDebug("  Updated %d outbound rows so far on %s...", totalUpdated, table)
			}
			helper.LogDebug("Outbound geo on %s: %d rows in %s", table, totalUpdated, time.Since(start))
		}
		conn.ExecContext(ctx, "DROP TEMPORARY TABLE IF EXISTS _geo_dst_lookup; DROP TEMPORARY TABLE IF EXISTS _geo_dst_resolved")
	}

	// add geo indexes
	for _, idx := range []struct{ name, columns string }{
		{"idx_src_region", "type, src_region"},
		{"idx_dst_region", "type, dst_region"},
	} {
		var count int
		conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?", table, idx.name).Scan(&count)
		if count == 0 {
			start := time.Now()
			helper.LogDebug("Adding index %s on %s...", idx.name, table)
			_, err := conn.ExecContext(ctx, "ALTER TABLE `"+table+"` ADD INDEX `"+idx.name+"` ("+idx.columns+")")
			if err != nil {
				helper.LogDebug("Warning: could not add index %s on %s: %s", idx.name, table, err.Error())
			} else {
				helper.LogDebug("Index %s on %s created in %s", idx.name, table, time.Since(start))
			}
		}
	}
}

// Entry point for "cdr" command
func executeReportCDR(flags bool) {
	// define db instance
	db := source.CDRInstance()

	// check if flags is passed
	if flags {
		var objTemplate CDRObj
		objTemplate.Destination = destination
		objTemplate.Pattern = pattern

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

			// define template cdr update
			templateCDR := configuration.Config.TemplatePath + "/cdr_update.sql"

			// define query
			var query bytes.Buffer

			tpl := template.Must(template.New(path.Base(templateCDR)).ParseFiles(templateCDR))
			errTpl := tpl.Execute(&query, &objTemplate)
			if errTpl != nil {
				helper.FatalError(errors.Wrap(errTpl, "invalid query template compiling"))
			}

			helper.LogDebug("\nExecuting query %s for [%s]:\n%s", templateCDR, t, query.String())

			// execute query
			rows, errQueryCDR := db.Query(query.String())
			if errQueryCDR != nil {
				helper.LogDebug(errQueryCDR.Error() + ". Skipping...")
				continue
			}

			// close results
			rows.Close()
		}
	} else {
		// migration pool: no read/write timeout for DDL and bulk updates
		migDB := source.CDRMigrationInstance()

		// ensure indexes on source cdr table
		ensureCDRSourceIndexes(migDB)

		// define vars
		var minYear int
		var minMonth int
		var objTemplate CDRObj

		// define template path
		templateY := configuration.Config.TemplatePath + "/cdr_year.sql"
		templateM := configuration.Config.TemplatePath + "/cdr_month.sql"

		// get min year and min month using sql.NullInt64 to handle NULL values
		var nullableYear sql.NullInt64
		var nullableMonth sql.NullInt64
		rowMin := db.QueryRow("SELECT year(min(calldate)), month(min(calldate)) FROM cdr")
		errQueryMin := rowMin.Scan(&nullableYear, &nullableMonth)

		// check errors
		if errQueryMin != nil {
			helper.FatalError(errors.Wrap(errQueryMin, "error getting min year and min month"))
		}

		// check if cdr table has data (NULL means empty table)
		if !nullableYear.Valid || !nullableMonth.Valid {
			helper.LogDebug("CDR table is empty or has no valid calldate, skipping processing")
			return
		}

		minYear = int(nullableYear.Int64)
		minMonth = int(nullableMonth.Int64)

		// save minYear and minMonth in cache
		cacheConnection := cache.Instance()
		errCache := cacheConnection.Set("cdr_first_month", fmt.Sprintf("%d-%02d", minYear, minMonth), 0).Err()
		if errCache != nil {
			helper.FatalError(errors.Wrap(errCache, "error saving to cache"))
		}

		now := time.Now()

		// used to generate cdr tables
		cdrTime := time.Date(minYear, time.Month(minMonth), now.Day(), now.Hour(), now.Minute(), now.Second(), now.Nanosecond(), now.Location())

		// loop months from minYear-minMonth to maxYear-maxMonth
		for cdrTime.Before(now) || cdrTime.Equal(now) {
			y := cdrTime.Year()
			m := int(cdrTime.Month())

			// create year table on minYear-minMonth and on every January
			if m == 1 || (y == minYear && m == minMonth) {
				// ensure geo columns on year table before template runs,
				// so INSERT IGNORE ... SELECT with geo NULLs doesn't fail on column mismatch
				ensureGeoColumns(migDB, fmt.Sprintf("cdr_%d", y))

				// create query for year
				var queryY bytes.Buffer
				objTemplate.Year = y
				objTemplate.Month = 0

				tplY := template.Must(template.New(path.Base(templateY)).Funcs(template.FuncMap{"YearMap": yearMap}).Funcs(template.FuncMap{"MonthMap": monthMap}).Funcs(template.FuncMap{"ExtractPatterns": utils.ExtractPatterns}).ParseFiles(templateY))
				errTpl := tplY.Execute(&queryY, &objTemplate)
				if errTpl != nil {
					helper.FatalError(errors.Wrap(errTpl, "invalid query template compiling"))
				}

				helper.LogDebug("\nExecuting query %s for [%d]:\n%s", templateY, y, queryY.String())

				// execute query
				rowsY, errQueryY := db.Query(queryY.String())
				if errQueryY != nil {
					helper.FatalError(errors.Wrap(errQueryY, "Error in query [year] execution:\n"+queryY.String()))
				}

				// close results
				rowsY.Close()

				// run migration on year table using dedicated pool (no timeout)
				yearTable := fmt.Sprintf("cdr_%d", y)
				ensureYearTableIndexes(migDB, yearTable)
				migrateGeoColumns(migDB, yearTable)
			}

			// ensure geo columns on month table before template runs,
			// so INSERT ... SELECT * from year table doesn't fail on column mismatch
			ensureGeoColumns(migDB, fmt.Sprintf("cdr_%d-%02d", y, m))

			var queryM bytes.Buffer
			objTemplate.Year = y
			objTemplate.Month = m

			tplM := template.Must(template.New(path.Base(templateM)).Funcs(template.FuncMap{"YearMap": yearMap}).Funcs(template.FuncMap{"MonthMap": monthMap}).ParseFiles(templateM))
			errTpl := tplM.Execute(&queryM, &objTemplate)
			if errTpl != nil {
				helper.FatalError(errors.Wrap(errTpl, "invalid query template compiling"))
			}

			helper.LogDebug("\nExecuting query %s for [%d-%d]:\n%s", templateM, y, m, queryM.String())

			// execute query
			rowsM, errQueryM := db.Query(queryM.String())
			if errQueryM != nil {
				helper.FatalError(errors.Wrap(errQueryM, "Error in query [month] execution:\n"+queryM.String()))
			}

			// close results
			rowsM.Close()

			// ensure indexes on month table using dedicated pool (no timeout)
			ensureMonthTableIndexes(migDB, fmt.Sprintf("cdr_%d-%02d", y, m))

			// go to next month for loop iteration
			cdrTime = cdrTime.AddDate(0, 1, 0)
		}
	}
}
