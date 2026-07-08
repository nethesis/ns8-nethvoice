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
	"database/sql"
	"fmt"
	"regexp"
	"time"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/nethesis/nethvoice-report/api/source"
	"github.com/nethesis/nethvoice-report/tasks/helper"
)

// reYearTable matches cdr_YYYY
var reYearTable = regexp.MustCompile(`^cdr_(\d{4})$`)

// reMonthTable matches cdr_YYYY-MM
var reMonthTable = regexp.MustCompile(`^cdr_(\d{4})-(\d{2})$`)

// cleanupBatchSize bounds each DELETE so locks stay short and progress is visible.
const cleanupBatchSize = 100000

var cleanupCmd = &cobra.Command{
	Use:   "cleanup",
	Short: "Remove out-of-period rows from cdr_YYYY and cdr_YYYY-MM tables (idempotent)",
	Args:  cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		executeCleanup()
	},
}

func init() {
	RootCmd.AddCommand(cleanupCmd)
}

func executeCleanup() {
	db := source.CDRMigrationInstance()

	rows, err := db.Query("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_NAME REGEXP '^cdr_[0-9]{4}(-[0-9]{2})?$' ORDER BY TABLE_NAME")
	if err != nil {
		helper.FatalError(errors.Wrap(err, "cannot list cdr tables"))
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			helper.FatalError(errors.Wrap(err, "cannot scan table name"))
		}
		tables = append(tables, t)
	}

	var grandTotal int64
	start := time.Now()

	for _, t := range tables {
		if m := reMonthTable.FindStringSubmatch(t); m != nil {
			lower := fmt.Sprintf("'%s-%s-01'", m[1], m[2])
			where := fmt.Sprintf("calldate < %s OR calldate >= %s + INTERVAL 1 MONTH", lower, lower)
			grandTotal += deleteOutOfPeriod(db, t, where)
			continue
		}
		if m := reYearTable.FindStringSubmatch(t); m != nil {
			lower := fmt.Sprintf("'%s-01-01'", m[1])
			where := fmt.Sprintf("calldate < %s OR calldate >= %s + INTERVAL 1 YEAR", lower, lower)
			grandTotal += deleteOutOfPeriod(db, t, where)
			continue
		}
	}

	helper.LogDebug("Cleanup completed: %d rows deleted in %s", grandTotal, time.Since(start))
}

// deleteOutOfPeriod removes rows from the table whose calldate is outside the
// table's expected period. Batched to keep locks short; idempotent (re-runs
// against a clean table return 0 affected rows on the first iteration and exit).
func deleteOutOfPeriod(db *sql.DB, table string, where string) int64 {
	var total int64
	start := time.Now()
	query := fmt.Sprintf("DELETE FROM `%s` WHERE %s LIMIT %d", table, where, cleanupBatchSize)

	for {
		result, err := db.Exec(query)
		if err != nil {
			helper.LogError(errors.Wrapf(err, "cleanup failed on %s", table))
			return total
		}
		affected, _ := result.RowsAffected()
		total += affected
		if affected < cleanupBatchSize {
			break
		}
		helper.LogDebug("  %s: %d rows so far...", table, total)
	}

	if total > 0 {
		helper.LogDebug("Cleanup %s: deleted %d out-of-period rows in %s", table, total, time.Since(start))
	}
	return total
}
