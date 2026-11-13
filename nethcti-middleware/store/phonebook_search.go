/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/nethesis/nethcti-middleware/db"
)

const centralizedPhonebookTable = "phonebook.phonebook"
const centralizedPhonebookSyncMetadataTable = "phonebook.sync_metadata"
const centralizedPhonebookSyncScope = "centralized_phonebook"

var legacyPhonebookSelectColumns = strings.Join([]string{
	"id",
	"owner_id",
	"type",
	"homeemail",
	"workemail",
	"homephone",
	"workphone",
	"cellphone",
	"fax",
	"title",
	"company",
	"notes",
	"name",
	"homestreet",
	"homepob",
	"homecity",
	"homeprovince",
	"homepostalcode",
	"homecountry",
	"workstreet",
	"workpob",
	"workcity",
	"workprovince",
	"workpostalcode",
	"workcountry",
	"url",
}, ", ")

// Extended contact fields, present in both cti_phonebook and the centralized phonebook,
// so both branches of every UNION project the real columns in the same scan order.
const ctiPhonebookExtraColumns = "firstname, lastname, job, facebook, instagram, linkedin, workphone2, cellphone2, otherphone, otheremail"
const centralizedPhonebookExtraColumns = "firstname, lastname, job, facebook, instagram, linkedin, workphone2, cellphone2, otherphone, otheremail"

// LegacyPhonebookQuery describes legacy-compatible union search/list parameters.
type LegacyPhonebookQuery struct {
	Username               string
	UserGroups             []string
	View                   string
	Visibility             string
	Sort                   string
	Term                   string
	Offset                 int
	Limit                  int
	ApplyPagination        bool
	IncludePrivateContacts bool
}

// LegacyPhonebookContact mirrors the legacy phonebook search payload.
type LegacyPhonebookContact struct {
	ID             int64  `json:"id"`
	OwnerID        string `json:"owner_id"`
	Type           string `json:"type"`
	HomeEmail      string `json:"homeemail"`
	WorkEmail      string `json:"workemail"`
	HomePhone      string `json:"homephone"`
	WorkPhone      string `json:"workphone"`
	CellPhone      string `json:"cellphone"`
	Fax            string `json:"fax"`
	Title          string `json:"title"`
	Company        string `json:"company"`
	Notes          string `json:"notes"`
	Name           string `json:"name"`
	HomeStreet     string `json:"homestreet"`
	HomePOB        string `json:"homepob"`
	HomeCity       string `json:"homecity"`
	HomeProvince   string `json:"homeprovince"`
	HomePostalCode string `json:"homepostalcode"`
	HomeCountry    string `json:"homecountry"`
	WorkStreet     string `json:"workstreet"`
	WorkPOB        string `json:"workpob"`
	WorkCity       string `json:"workcity"`
	WorkProvince   string `json:"workprovince"`
	WorkPostalCode string `json:"workpostalcode"`
	WorkCountry    string `json:"workcountry"`
	URL            string `json:"url"`
	Extension      string `json:"extension"`
	SpeedDialNum   string `json:"speeddial_num"`
	FirstName      string `json:"firstname"`
	LastName       string `json:"lastname"`
	Job            string `json:"job"`
	Facebook       string `json:"facebook"`
	Instagram      string `json:"instagram"`
	LinkedIn       string `json:"linkedin"`
	WorkPhone2     string `json:"workphone2"`
	CellPhone2     string `json:"cellphone2"`
	OtherPhone     string `json:"otherphone"`
	OtherEmail     string `json:"otheremail"`
	Source         string `json:"source"`
	Contacts       string `json:"contacts,omitempty"`
}

// LegacyPhonebookResult mirrors the legacy phonebook search/list envelope.
type LegacyPhonebookResult struct {
	Count      int                      `json:"count"`
	Rows       []LegacyPhonebookContact `json:"rows"`
	LastSyncAt *string                  `json:"last_sync_at"`
}

type legacyPhonebookCompanyContact struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Source string `json:"source"`
}

// SearchLegacyPhonebook returns legacy-compatible search results across CTI and centralized phonebooks.
func SearchLegacyPhonebook(ctx context.Context, query LegacyPhonebookQuery) (*LegacyPhonebookResult, error) {
	database := db.GetDB()
	if database == nil {
		return nil, errors.New("database not initialized")
	}

	if strings.EqualFold(strings.TrimSpace(query.View), "company") {
		return searchLegacyPhonebookByCompany(ctx, database, query)
	}

	return searchLegacyPhonebookFlat(ctx, database, query)
}

// ListLegacyPhonebook returns the legacy alphabetical list across CTI and centralized phonebooks.
func ListLegacyPhonebook(ctx context.Context, query LegacyPhonebookQuery) (*LegacyPhonebookResult, error) {
	database := db.GetDB()
	if database == nil {
		return nil, errors.New("database not initialized")
	}

	visibleCTIWhere, visibleCTIArgs := buildVisibleCTIWhere(query.Username, query.UserGroups, query.IncludePrivateContacts)
	ctiVisibilityWhere, ctiVisibilityArgs, centralizedVisibilityWhere, centralizedVisibilityArgs := buildLegacyVisibilityClauses(query.Visibility)
	visibleCentralizedWhere, visibleCentralizedArgs := buildVisibleCentralizedWhere(query.UserGroups)

	args := append([]any{}, visibleCTIArgs...)
	args = append(args, ctiVisibilityArgs...)
	args = append(args, visibleCentralizedArgs...)
	args = append(args, centralizedVisibilityArgs...)
	args = append(args, visibleCTIArgs...)
	args = append(args, ctiVisibilityArgs...)
	args = append(args, visibleCentralizedArgs...)
	args = append(args, centralizedVisibilityArgs...)
	countArgs := append([]any{}, visibleCTIArgs...)
	countArgs = append(countArgs, ctiVisibilityArgs...)
	countArgs = append(countArgs, visibleCentralizedArgs...)
	countArgs = append(countArgs, centralizedVisibilityArgs...)
	countArgs = append(countArgs, visibleCTIArgs...)
	countArgs = append(countArgs, ctiVisibilityArgs...)
	countArgs = append(countArgs, visibleCentralizedArgs...)
	countArgs = append(countArgs, centralizedVisibilityArgs...)

	listQuery := strings.Join([]string{
		"SELECT id, owner_id, type, homeemail, workemail, homephone, workphone, cellphone, fax, title, company, notes, name, homestreet, homepob, homecity, homeprovince, homepostalcode, homecountry, workstreet, workpob, workcity, workprovince, workpostalcode, workcountry, url, extension, speeddial_num, firstname, lastname, job, facebook, instagram, linkedin, workphone2, cellphone2, otherphone, otheremail, source, sort_name",
		"FROM (",
		"SELECT", legacyPhonebookSelectColumns, ", extension, speeddial_num, " + ctiPhonebookExtraColumns + ", 'cti' AS source, name AS sort_name",
		"FROM cti_phonebook",
		"WHERE (name IS NOT NULL AND name != '') AND", visibleCTIWhere, "AND type != 'speeddial' AND", ctiVisibilityWhere,
		"UNION",
		"SELECT", legacyPhonebookSelectColumns, ", '' AS extension, '' AS speeddial_num, " + centralizedPhonebookExtraColumns + ", 'centralized' AS source, name AS sort_name",
		"FROM", centralizedPhonebookTable,
		"WHERE (name IS NOT NULL AND name != '') AND type != 'nethcti' AND", visibleCentralizedWhere, "AND", centralizedVisibilityWhere,
		"UNION",
		"SELECT", legacyPhonebookSelectColumns, ", extension, speeddial_num, " + ctiPhonebookExtraColumns + ", 'cti' AS source, company AS sort_name",
		"FROM cti_phonebook",
		"WHERE (name IS NULL OR name = '') AND (company IS NOT NULL AND company != '') AND", visibleCTIWhere, "AND type != 'speeddial' AND", ctiVisibilityWhere,
		"UNION",
		"SELECT", legacyPhonebookSelectColumns, ", '' AS extension, '' AS speeddial_num, " + centralizedPhonebookExtraColumns + ", 'centralized' AS source, company AS sort_name",
		"FROM", centralizedPhonebookTable,
		"WHERE (name IS NULL OR name = '') AND (company IS NOT NULL AND company != '') AND type != 'nethcti' AND", visibleCentralizedWhere, "AND", centralizedVisibilityWhere,
		") phonebook_union",
		legacyListOrderByClause(query.Sort),
	}, " ")
	if query.ApplyPagination {
		listQuery += " LIMIT ? OFFSET ?"
		args = append(args, query.Limit, query.Offset)
	}

	countQuery := strings.Join([]string{
		"SELECT COUNT(*)",
		"FROM (",
		"SELECT id FROM cti_phonebook WHERE (name IS NOT NULL AND name != '') AND", visibleCTIWhere, "AND type != 'speeddial' AND", ctiVisibilityWhere,
		"UNION ALL",
		"SELECT id FROM", centralizedPhonebookTable, "WHERE (name IS NOT NULL AND name != '') AND type != 'nethcti' AND", visibleCentralizedWhere, "AND", centralizedVisibilityWhere,
		"UNION ALL",
		"SELECT id FROM cti_phonebook WHERE (name IS NULL OR name = '') AND (company IS NOT NULL AND company != '') AND", visibleCTIWhere, "AND type != 'speeddial' AND", ctiVisibilityWhere,
		"UNION ALL",
		"SELECT id FROM", centralizedPhonebookTable, "WHERE (name IS NULL OR name = '') AND (company IS NOT NULL AND company != '') AND type != 'nethcti' AND", visibleCentralizedWhere, "AND", centralizedVisibilityWhere,
		") phonebook_union",
	}, " ")

	count, err := queryLegacyPhonebookCount(ctx, database, countQuery, countArgs)
	if err != nil {
		return nil, err
	}

	lastSyncAt, err := loadLegacyPhonebookLastSyncAt(ctx, database)
	if err != nil {
		return nil, err
	}

	rows, err := database.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	contacts := make([]LegacyPhonebookContact, 0)
	for rows.Next() {
		contact, err := scanLegacyPhonebookContactWithSortKey(rows)
		if err != nil {
			return nil, err
		}
		contacts = append(contacts, contact)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &LegacyPhonebookResult{Count: count, Rows: contacts, LastSyncAt: lastSyncAt}, nil
}

func searchLegacyPhonebookFlat(ctx context.Context, database *sql.DB, query LegacyPhonebookQuery) (*LegacyPhonebookResult, error) {
	visibleCTIWhere, visibleCTIArgs := buildVisibleCTIWhere(query.Username, query.UserGroups, query.IncludePrivateContacts)
	ctiVisibilityWhere, ctiVisibilityArgs, centralizedVisibilityWhere, centralizedVisibilityArgs := buildLegacyVisibilityClauses(query.Visibility)
	visibleCentralizedWhere, visibleCentralizedArgs := buildVisibleCentralizedWhere(query.UserGroups)
	termArgsCTI, termArgsCentralized, ctiSearchClause, centralizedSearchClause := buildLegacySearchClauses(query.View, query.Term)

	selectArgs := append([]any{}, visibleCTIArgs...)
	selectArgs = append(selectArgs, ctiVisibilityArgs...)
	selectArgs = append(selectArgs, termArgsCTI...)
	selectArgs = append(selectArgs, visibleCentralizedArgs...)
	selectArgs = append(selectArgs, centralizedVisibilityArgs...)
	selectArgs = append(selectArgs, termArgsCentralized...)

	countArgs := append([]any{}, visibleCTIArgs...)
	countArgs = append(countArgs, ctiVisibilityArgs...)
	countArgs = append(countArgs, termArgsCTI...)
	countArgs = append(countArgs, visibleCentralizedArgs...)
	countArgs = append(countArgs, centralizedVisibilityArgs...)
	countArgs = append(countArgs, termArgsCentralized...)

	selectQuery := strings.Join([]string{
		"SELECT * FROM (",
		"SELECT", legacyPhonebookSelectColumns, ", extension, speeddial_num, " + ctiPhonebookExtraColumns + ", 'cti' AS source",
		"FROM cti_phonebook",
		"WHERE", visibleCTIWhere, "AND type != 'speeddial' AND", ctiVisibilityWhere, "AND (", ctiSearchClause, ")",
		"UNION",
		"SELECT", legacyPhonebookSelectColumns, ", '' AS extension, '' AS speeddial_num, " + centralizedPhonebookExtraColumns + ", 'centralized' AS source",
		"FROM", centralizedPhonebookTable,
		"WHERE type != 'nethcti' AND", visibleCentralizedWhere, "AND", centralizedVisibilityWhere, "AND (", centralizedSearchClause, ")",
		") phonebook_union " + legacyFlatOrderByClause(query.Sort),
	}, " ")
	if query.ApplyPagination {
		selectQuery += " LIMIT ? OFFSET ?"
		selectArgs = append(selectArgs, query.Limit, query.Offset)
	}

	countQuery := strings.Join([]string{
		"SELECT COUNT(*)",
		"FROM (",
		"SELECT id FROM cti_phonebook WHERE", visibleCTIWhere, "AND type != 'speeddial' AND", ctiVisibilityWhere, "AND (", ctiSearchClause, ")",
		"UNION ALL",
		"SELECT id FROM", centralizedPhonebookTable, "WHERE type != 'nethcti' AND", visibleCentralizedWhere, "AND", centralizedVisibilityWhere, "AND (", centralizedSearchClause, ")",
		") phonebook_union",
	}, " ")

	count, err := queryLegacyPhonebookCount(ctx, database, countQuery, countArgs)
	if err != nil {
		return nil, err
	}

	lastSyncAt, err := loadLegacyPhonebookLastSyncAt(ctx, database)
	if err != nil {
		return nil, err
	}

	rows, err := database.QueryContext(ctx, selectQuery, selectArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	contacts := make([]LegacyPhonebookContact, 0)
	for rows.Next() {
		contact, err := scanLegacyPhonebookContact(rows)
		if err != nil {
			return nil, err
		}
		contacts = append(contacts, contact)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &LegacyPhonebookResult{Count: count, Rows: contacts, LastSyncAt: lastSyncAt}, nil
}

func searchLegacyPhonebookByCompany(ctx context.Context, database *sql.DB, query LegacyPhonebookQuery) (*LegacyPhonebookResult, error) {
	visibleCTIWhere, visibleCTIArgs := buildVisibleCTIWhere(query.Username, query.UserGroups, query.IncludePrivateContacts)
	ctiVisibilityWhere, ctiVisibilityArgs, centralizedVisibilityWhere, centralizedVisibilityArgs := buildLegacyVisibilityClauses(query.Visibility)
	visibleCentralizedWhere, visibleCentralizedArgs := buildVisibleCentralizedWhere(query.UserGroups)
	termArgsCTI, termArgsCentralized, ctiSearchClause, centralizedSearchClause := buildLegacySearchClauses("company", query.Term)

	companyQueryArgs := append([]any{}, visibleCTIArgs...)
	companyQueryArgs = append(companyQueryArgs, ctiVisibilityArgs...)
	companyQueryArgs = append(companyQueryArgs, termArgsCTI...)
	companyQueryArgs = append(companyQueryArgs, visibleCentralizedArgs...)
	companyQueryArgs = append(companyQueryArgs, centralizedVisibilityArgs...)
	companyQueryArgs = append(companyQueryArgs, termArgsCentralized...)

	companiesQuery := strings.Join([]string{
		"SELECT company FROM (",
		"SELECT company FROM cti_phonebook WHERE", visibleCTIWhere, "AND type != 'speeddial' AND", ctiVisibilityWhere, "AND (", ctiSearchClause, ")",
		"UNION",
		"SELECT company FROM", centralizedPhonebookTable, "WHERE type != 'nethcti' AND", visibleCentralizedWhere, "AND", centralizedVisibilityWhere, "AND (", centralizedSearchClause, ")",
		") phonebook_union ORDER BY company ASC",
	}, " ")
	if query.ApplyPagination {
		companiesQuery += " LIMIT ? OFFSET ?"
		companyQueryArgs = append(companyQueryArgs, query.Limit, query.Offset)
	}

	countQuery := strings.Join([]string{
		"SELECT COUNT(*) FROM (",
		"SELECT company FROM cti_phonebook WHERE", visibleCTIWhere, "AND type != 'speeddial' AND", ctiVisibilityWhere, "AND (", ctiSearchClause, ")",
		"UNION",
		"SELECT company FROM", centralizedPhonebookTable, "WHERE type != 'nethcti' AND", visibleCentralizedWhere, "AND", centralizedVisibilityWhere, "AND (", centralizedSearchClause, ")",
		") phonebook_union",
	}, " ")

	countArgs := append([]any{}, visibleCTIArgs...)
	countArgs = append(countArgs, ctiVisibilityArgs...)
	countArgs = append(countArgs, termArgsCTI...)
	countArgs = append(countArgs, visibleCentralizedArgs...)
	countArgs = append(countArgs, centralizedVisibilityArgs...)
	countArgs = append(countArgs, termArgsCentralized...)

	count, err := queryLegacyPhonebookCount(ctx, database, countQuery, countArgs)
	if err != nil {
		return nil, err
	}

	lastSyncAt, err := loadLegacyPhonebookLastSyncAt(ctx, database)
	if err != nil {
		return nil, err
	}

	rows, err := database.QueryContext(ctx, companiesQuery, companyQueryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	companies := make([]string, 0)
	for rows.Next() {
		var company sql.NullString
		if err := rows.Scan(&company); err != nil {
			return nil, err
		}
		companies = append(companies, nullStringValue(company))
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	results := make([]LegacyPhonebookContact, 0, len(companies))
	for _, company := range companies {
		result, err := loadLegacyCompanyResult(
			ctx,
			database,
			visibleCTIWhere,
			visibleCTIArgs,
			ctiVisibilityWhere,
			ctiVisibilityArgs,
			visibleCentralizedWhere,
			visibleCentralizedArgs,
			centralizedVisibilityWhere,
			centralizedVisibilityArgs,
			company,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, result)
	}

	return &LegacyPhonebookResult{Count: count, Rows: results, LastSyncAt: lastSyncAt}, nil
}

func loadLegacyPhonebookLastSyncAt(ctx context.Context, database *sql.DB) (*string, error) {
	var lastSyncAt sql.NullTime
	err := database.QueryRowContext(
		ctx,
		"SELECT last_sync_at FROM "+centralizedPhonebookSyncMetadataTable+" WHERE scope = ? LIMIT 1",
		centralizedPhonebookSyncScope,
	).Scan(&lastSyncAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || isMissingLegacyPhonebookSyncMetadataTable(err) {
			return nil, nil
		}
		return nil, err
	}
	if !lastSyncAt.Valid {
		return nil, nil
	}

	formatted := lastSyncAt.Time.UTC().Format(time.RFC3339)
	return &formatted, nil
}

func isMissingLegacyPhonebookSyncMetadataTable(err error) bool {
	var mysqlErr *mysqlDriver.MySQLError
	return errors.As(err, &mysqlErr) && mysqlErr.Number == 1146
}

func loadLegacyCompanyResult(
	ctx context.Context,
	database *sql.DB,
	visibleCTIWhere string,
	visibleCTIArgs []any,
	ctiVisibilityWhere string,
	ctiVisibilityArgs []any,
	visibleCentralizedWhere string,
	visibleCentralizedArgs []any,
	centralizedVisibilityWhere string,
	centralizedVisibilityArgs []any,
	company string,
) (LegacyPhonebookContact, error) {
	companyResult := LegacyPhonebookContact{Company: company}

	infoQuery := strings.Join([]string{
		"SELECT * FROM (",
		"SELECT", legacyPhonebookSelectColumns, ", extension, speeddial_num, " + ctiPhonebookExtraColumns + ", 'cti' AS source",
		"FROM cti_phonebook",
		"WHERE", visibleCTIWhere, "AND company = ? AND (name IS NULL OR name = '' OR name = '-') AND type != 'speeddial' AND", ctiVisibilityWhere,
		"UNION",
		"SELECT", legacyPhonebookSelectColumns, ", '' AS extension, '' AS speeddial_num, " + centralizedPhonebookExtraColumns + ", 'centralized' AS source",
		"FROM", centralizedPhonebookTable,
		"WHERE company = ? AND (name IS NULL OR name = '' OR name = '-') AND type != 'nethcti' AND", visibleCentralizedWhere, "AND", centralizedVisibilityWhere,
		") company_info LIMIT 1",
	}, " ")
	infoArgs := append([]any{}, visibleCTIArgs...)
	infoArgs = append(infoArgs, company)
	infoArgs = append(infoArgs, ctiVisibilityArgs...)
	infoArgs = append(infoArgs, company)
	infoArgs = append(infoArgs, visibleCentralizedArgs...)
	infoArgs = append(infoArgs, centralizedVisibilityArgs...)

	infoRows, err := database.QueryContext(ctx, infoQuery, infoArgs...)
	if err != nil {
		return companyResult, err
	}
	defer infoRows.Close()

	if infoRows.Next() {
		info, err := scanLegacyPhonebookContact(infoRows)
		if err != nil {
			return companyResult, err
		}
		companyResult = info
		companyResult.Company = company
	}
	if err := infoRows.Err(); err != nil {
		return companyResult, err
	}

	contactsQuery := strings.Join([]string{
		"SELECT id, name, source FROM (",
		"SELECT id, name, 'cti' AS source",
		"FROM cti_phonebook",
		"WHERE", visibleCTIWhere, "AND company = ? AND (name IS NOT NULL AND name != '') AND type != 'speeddial' AND", ctiVisibilityWhere,
		"UNION",
		"SELECT id, name, 'centralized' AS source",
		"FROM", centralizedPhonebookTable,
		"WHERE company = ? AND (name IS NOT NULL AND name != '') AND type != 'nethcti' AND", visibleCentralizedWhere, "AND", centralizedVisibilityWhere,
		") company_contacts ORDER BY name ASC",
	}, " ")
	contactsArgs := append([]any{}, visibleCTIArgs...)
	contactsArgs = append(contactsArgs, company)
	contactsArgs = append(contactsArgs, ctiVisibilityArgs...)
	contactsArgs = append(contactsArgs, company)
	contactsArgs = append(contactsArgs, visibleCentralizedArgs...)
	contactsArgs = append(contactsArgs, centralizedVisibilityArgs...)

	contactRows, err := database.QueryContext(ctx, contactsQuery, contactsArgs...)
	if err != nil {
		return companyResult, err
	}
	defer contactRows.Close()

	contacts := make([]legacyPhonebookCompanyContact, 0)
	for contactRows.Next() {
		var (
			id     int64
			name   sql.NullString
			source sql.NullString
		)
		if err := contactRows.Scan(&id, &name, &source); err != nil {
			return companyResult, err
		}
		contacts = append(contacts, legacyPhonebookCompanyContact{
			ID:     id,
			Name:   nullStringValue(name),
			Source: nullStringValue(source),
		})
	}
	if err := contactRows.Err(); err != nil {
		return companyResult, err
	}

	contactsPayload, err := json.Marshal(contacts)
	if err != nil {
		return companyResult, err
	}
	companyResult.Contacts = string(contactsPayload)

	return companyResult, nil
}

func queryLegacyPhonebookCount(ctx context.Context, database *sql.DB, query string, args []any) (int, error) {
	var count int
	if err := database.QueryRowContext(ctx, query, args...).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

// flatDisplayKey is the display-name sort key used by the flat search union.
// Companies store an empty or '-' placeholder name, so we fall back to the
// company field; otherwise such rows would collapse to the top (in MariaDB
// '-'/NULL sort before letters and digits in ASC).
const flatDisplayKey = "COALESCE(NULLIF(NULLIF(name, ''), '-'), company)"

// legacyFlatOrderByClause returns the ORDER BY clause for the flat search/list
// union. The phonebook UI sorts by firstname / lastname / displayname  "name"/"surname"/"company" are kept as backward-compatible aliases.
//
// firstname/lastname use a two-level ordering: contacts that have the new field
// populated come first (A-Z by that field), then everyone else A-Z by the
// display key (legacy single "name", company for company rows).
//
// With no (or unknown) sort the legacy ordering "company ASC, name ASC" is kept:
// existing callers (nethvoice-cti, phone-island) do not send a sort param yet,
// so the default must not silently change the live search order.
func legacyFlatOrderByClause(sort string) string {
	switch strings.ToLower(strings.TrimSpace(sort)) {
	case "firstname":
		return "ORDER BY (firstname IS NULL OR firstname = '') ASC, " +
			"COALESCE(NULLIF(firstname, ''), " + flatDisplayKey + ") ASC"
	case "lastname", "surname":
		return "ORDER BY (lastname IS NULL OR lastname = '') ASC, " +
			"COALESCE(NULLIF(lastname, ''), " + flatDisplayKey + ") ASC"
	case "company":
		return "ORDER BY COALESCE(NULLIF(company, ''), " + flatDisplayKey + ") ASC"
	case "displayname", "name":
		return "ORDER BY " + flatDisplayKey + " ASC"
	default:
		return "ORDER BY company ASC, name ASC"
	}
}

// legacyListOrderByClause returns the ORDER BY clause for the alphabetical list
// union, which exposes a computed sort_name (name, falling back to company).
// Mirrors legacyFlatOrderByClause but reuses sort_name as the display key.
func legacyListOrderByClause(sort string) string {
	switch strings.ToLower(strings.TrimSpace(sort)) {
	case "firstname":
		return "ORDER BY (firstname IS NULL OR firstname = '') ASC, " +
			"COALESCE(NULLIF(firstname, ''), sort_name) ASC"
	case "lastname", "surname":
		return "ORDER BY (lastname IS NULL OR lastname = '') ASC, " +
			"COALESCE(NULLIF(lastname, ''), sort_name) ASC"
	case "company":
		return "ORDER BY company ASC, sort_name ASC"
	default: // "displayname", "name", empty
		return "ORDER BY sort_name ASC"
	}
}

const legacySearchTokenLimit = 6

func legacySearchTokens(rawTerm string) []string {
	fields := strings.Fields(rawTerm)
	if len(fields) == 0 {
		return []string{""}
	}

	tokens := make([]string, 0, len(fields))
	seen := make(map[string]struct{}, len(fields))
	for _, field := range fields {
		key := strings.ToLower(field)
		if _, duplicate := seen[key]; duplicate {
			continue
		}
		seen[key] = struct{}{}
		tokens = append(tokens, field)
		if len(tokens) == legacySearchTokenLimit {
			break
		}
	}

	return tokens
}

func legacySearchFields(view string) ([]string, []string) {
	var base []string
	switch strings.ToLower(strings.TrimSpace(view)) {
	case "person":
		base = []string{"name", "firstname", "lastname"}
	case "company":
		base = []string{"company"}
	default:
		base = []string{"name", "company", "firstname", "lastname"}
	}

	ctiFields := append(append([]string{}, base...),
		"workphone", "workphone2", "homephone", "cellphone", "cellphone2", "otherphone", "extension", "notes")
	centralizedFields := append(append([]string{}, base...),
		"workphone", "homephone", "cellphone", "notes")

	return ctiFields, centralizedFields
}

func legacySearchTokenClause(fields []string, token string) (string, []any) {
	pattern := "%" + escapeLikeValue(token) + "%"
	predicates := make([]string, 0, len(fields))
	args := make([]any, 0, len(fields))
	for _, field := range fields {
		predicates = append(predicates, field+" LIKE ? ESCAPE '\\\\'")
		args = append(args, pattern)
	}

	return "(" + strings.Join(predicates, " OR ") + ")", args
}

func buildLegacySearchClauses(view, rawTerm string) ([]any, []any, string, string) {
	ctiFields, centralizedFields := legacySearchFields(view)
	tokens := legacySearchTokens(rawTerm)

	ctiGroups := make([]string, 0, len(tokens))
	centralizedGroups := make([]string, 0, len(tokens))
	ctiArgs := make([]any, 0, len(tokens)*len(ctiFields))
	centralizedArgs := make([]any, 0, len(tokens)*len(centralizedFields))

	for _, token := range tokens {
		ctiGroup, ctiTokenArgs := legacySearchTokenClause(ctiFields, token)
		ctiGroups = append(ctiGroups, ctiGroup)
		ctiArgs = append(ctiArgs, ctiTokenArgs...)

		centralizedGroup, centralizedTokenArgs := legacySearchTokenClause(centralizedFields, token)
		centralizedGroups = append(centralizedGroups, centralizedGroup)
		centralizedArgs = append(centralizedArgs, centralizedTokenArgs...)
	}

	ctiClause := strings.Join(ctiGroups, " AND ")
	centralizedClause := strings.Join(centralizedGroups, " AND ")

	// The phone/notes OR-terms above match any contact with a populated phone,
	// so the base name/company match is not enough to keep the view clean:
	// - "person" would still leak companies (empty/'-' placeholder name);
	// - "company" would still leak persons without a company (empty company),
	//   collapsing them into a bogus company="" bucket.
	// Guard each view to rows that actually belong to it.
	switch strings.ToLower(strings.TrimSpace(view)) {
	case "person":
		const personGuard = "name IS NOT NULL AND name != '' AND name != '-'"
		ctiClause = personGuard + " AND (" + ctiClause + ")"
		centralizedClause = personGuard + " AND (" + centralizedClause + ")"
	case "company":
		const companyGuard = "company IS NOT NULL AND company != '' AND company != '-'"
		ctiClause = companyGuard + " AND (" + ctiClause + ")"
		centralizedClause = companyGuard + " AND (" + centralizedClause + ")"
	}

	return ctiArgs, centralizedArgs, ctiClause, centralizedClause
}

func buildLegacyVisibilityClauses(rawVisibility string) (string, []any, string, []any) {
	switch strings.ToLower(strings.TrimSpace(rawVisibility)) {
	case "", "all":
		return "1 = 1", nil, "1 = 1", nil
	case "public":
		// CTI side matches its native public type; the centralized side is any
		// non-group-scoped row (explicit 'public' plus legacy/empty access), so the
		// public view excludes group-scoped centralized contacts.
		return "type = ?", []any{"public"}, "access NOT LIKE ?", []any{GroupTypePrefix + "%"}
	case "private":
		return "type = ?", []any{"private"}, "1 = 0", nil
	case "group":
		// CTI side gates on its native `type`; the centralized side gates on the
		// dedicated `access` column (sharing lives there, `type` is the source
		// category). Membership is enforced by the ANDed buildVisibleCentralizedWhere.
		groupPattern := GroupTypePrefix + "%"
		return "type LIKE ?", []any{groupPattern}, "access LIKE ?", []any{groupPattern}
	default:
		return "1 = 1", nil, "1 = 1", nil
	}
}

func buildVisibleCentralizedWhere(userGroups []string) (string, []any) {
	groups := NormalizeSharedGroups(userGroups)
	// Sharing on the centralized phonebook lives in the dedicated `access` column
	// ('public'/'group:...'), so `type` stays free for the source category used by
	// the customer import scripts. Rows with empty access (legacy, scripts, nethcti
	// republished) are non-group-scoped and therefore visible to everyone.
	notGroupScoped := "access NOT LIKE ? ESCAPE '\\\\'"
	args := []any{GroupTypePrefix + "%"}
	if len(groups) == 0 {
		return notGroupScoped, args
	}

	clause := "(" + notGroupScoped
	for _, groupName := range groups {
		patterns := getSharedGroupPatterns(groupName)
		clause += " OR (access = ? OR access LIKE ? ESCAPE '\\\\' OR access LIKE ? ESCAPE '\\\\' OR access LIKE ? ESCAPE '\\\\')"
		args = append(args, patterns[0], patterns[1], patterns[2], patterns[3])
	}
	clause += ")"
	return clause, args
}

func buildVisibleCTIWhere(username string, userGroups []string, includePrivateContacts bool) (string, []any) {
	groups := NormalizeSharedGroups(userGroups)
	args := []any{username}
	base := "(owner_id = ? OR type = 'public'"
	if !includePrivateContacts {
		base = "((owner_id = ? AND 1 = 0) OR type = 'public'"
	}

	for _, groupName := range groups {
		patterns := getSharedGroupPatterns(groupName)
		base += " OR (type = ? OR type LIKE ? ESCAPE '\\\\' OR type LIKE ? ESCAPE '\\\\' OR type LIKE ? ESCAPE '\\\\')"
		args = append(args, patterns[0], patterns[1], patterns[2], patterns[3])
	}

	base += ")"
	return base, args
}

func getSharedGroupPatterns(groupName string) []string {
	escapedGroup := escapeLikeValue(groupName)
	return []string{
		GroupTypePrefix + groupName,
		GroupTypePrefix + escapedGroup + ",%",
		GroupTypePrefix + "%," + escapedGroup + ",%",
		GroupTypePrefix + "%," + escapedGroup,
	}
}

func escapeLikeValue(value string) string {
	replacer := strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_")
	return replacer.Replace(value)
}

func scanLegacyPhonebookContact(scanner interface{ Scan(dest ...any) error }) (LegacyPhonebookContact, error) {
	var (
		contact        LegacyPhonebookContact
		ownerID        sql.NullString
		contactType    sql.NullString
		homeEmail      sql.NullString
		workEmail      sql.NullString
		homePhone      sql.NullString
		workPhone      sql.NullString
		cellPhone      sql.NullString
		fax            sql.NullString
		title          sql.NullString
		company        sql.NullString
		notes          sql.NullString
		name           sql.NullString
		homeStreet     sql.NullString
		homePOB        sql.NullString
		homeCity       sql.NullString
		homeProvince   sql.NullString
		homePostalCode sql.NullString
		homeCountry    sql.NullString
		workStreet     sql.NullString
		workPOB        sql.NullString
		workCity       sql.NullString
		workProvince   sql.NullString
		workPostalCode sql.NullString
		workCountry    sql.NullString
		url            sql.NullString
		extension      sql.NullString
		speedDialNum   sql.NullString
		firstName      sql.NullString
		lastName       sql.NullString
		job            sql.NullString
		facebook       sql.NullString
		instagram      sql.NullString
		linkedIn       sql.NullString
		workPhone2     sql.NullString
		cellPhone2     sql.NullString
		otherPhone     sql.NullString
		otherEmail     sql.NullString
		source         sql.NullString
	)

	err := scanner.Scan(
		&contact.ID,
		&ownerID,
		&contactType,
		&homeEmail,
		&workEmail,
		&homePhone,
		&workPhone,
		&cellPhone,
		&fax,
		&title,
		&company,
		&notes,
		&name,
		&homeStreet,
		&homePOB,
		&homeCity,
		&homeProvince,
		&homePostalCode,
		&homeCountry,
		&workStreet,
		&workPOB,
		&workCity,
		&workProvince,
		&workPostalCode,
		&workCountry,
		&url,
		&extension,
		&speedDialNum,
		&firstName,
		&lastName,
		&job,
		&facebook,
		&instagram,
		&linkedIn,
		&workPhone2,
		&cellPhone2,
		&otherPhone,
		&otherEmail,
		&source,
	)
	if err != nil {
		return LegacyPhonebookContact{}, err
	}

	contact.OwnerID = nullStringValue(ownerID)
	contact.Type = nullStringValue(contactType)
	contact.HomeEmail = nullStringValue(homeEmail)
	contact.WorkEmail = nullStringValue(workEmail)
	contact.HomePhone = nullStringValue(homePhone)
	contact.WorkPhone = nullStringValue(workPhone)
	contact.CellPhone = nullStringValue(cellPhone)
	contact.Fax = nullStringValue(fax)
	contact.Title = nullStringValue(title)
	contact.Company = nullStringValue(company)
	contact.Notes = nullStringValue(notes)
	contact.Name = nullStringValue(name)
	contact.HomeStreet = nullStringValue(homeStreet)
	contact.HomePOB = nullStringValue(homePOB)
	contact.HomeCity = nullStringValue(homeCity)
	contact.HomeProvince = nullStringValue(homeProvince)
	contact.HomePostalCode = nullStringValue(homePostalCode)
	contact.HomeCountry = nullStringValue(homeCountry)
	contact.WorkStreet = nullStringValue(workStreet)
	contact.WorkPOB = nullStringValue(workPOB)
	contact.WorkCity = nullStringValue(workCity)
	contact.WorkProvince = nullStringValue(workProvince)
	contact.WorkPostalCode = nullStringValue(workPostalCode)
	contact.WorkCountry = nullStringValue(workCountry)
	contact.URL = nullStringValue(url)
	contact.Extension = nullStringValue(extension)
	contact.SpeedDialNum = nullStringValue(speedDialNum)
	contact.FirstName = nullStringValue(firstName)
	contact.LastName = nullStringValue(lastName)
	contact.Job = nullStringValue(job)
	contact.Facebook = nullStringValue(facebook)
	contact.Instagram = nullStringValue(instagram)
	contact.LinkedIn = nullStringValue(linkedIn)
	contact.WorkPhone2 = nullStringValue(workPhone2)
	contact.CellPhone2 = nullStringValue(cellPhone2)
	contact.OtherPhone = nullStringValue(otherPhone)
	contact.OtherEmail = nullStringValue(otherEmail)
	contact.Source = nullStringValue(source)

	return contact, nil
}

func scanLegacyPhonebookContactWithSortKey(scanner interface{ Scan(dest ...any) error }) (LegacyPhonebookContact, error) {
	var (
		contact        LegacyPhonebookContact
		ownerID        sql.NullString
		contactType    sql.NullString
		homeEmail      sql.NullString
		workEmail      sql.NullString
		homePhone      sql.NullString
		workPhone      sql.NullString
		cellPhone      sql.NullString
		fax            sql.NullString
		title          sql.NullString
		company        sql.NullString
		notes          sql.NullString
		name           sql.NullString
		homeStreet     sql.NullString
		homePOB        sql.NullString
		homeCity       sql.NullString
		homeProvince   sql.NullString
		homePostalCode sql.NullString
		homeCountry    sql.NullString
		workStreet     sql.NullString
		workPOB        sql.NullString
		workCity       sql.NullString
		workProvince   sql.NullString
		workPostalCode sql.NullString
		workCountry    sql.NullString
		url            sql.NullString
		extension      sql.NullString
		speedDialNum   sql.NullString
		firstName      sql.NullString
		lastName       sql.NullString
		job            sql.NullString
		facebook       sql.NullString
		instagram      sql.NullString
		linkedIn       sql.NullString
		workPhone2     sql.NullString
		cellPhone2     sql.NullString
		otherPhone     sql.NullString
		otherEmail     sql.NullString
		source         sql.NullString
		sortKey        sql.NullString
	)

	err := scanner.Scan(
		&contact.ID,
		&ownerID,
		&contactType,
		&homeEmail,
		&workEmail,
		&homePhone,
		&workPhone,
		&cellPhone,
		&fax,
		&title,
		&company,
		&notes,
		&name,
		&homeStreet,
		&homePOB,
		&homeCity,
		&homeProvince,
		&homePostalCode,
		&homeCountry,
		&workStreet,
		&workPOB,
		&workCity,
		&workProvince,
		&workPostalCode,
		&workCountry,
		&url,
		&extension,
		&speedDialNum,
		&firstName,
		&lastName,
		&job,
		&facebook,
		&instagram,
		&linkedIn,
		&workPhone2,
		&cellPhone2,
		&otherPhone,
		&otherEmail,
		&source,
		&sortKey,
	)
	if err != nil {
		return LegacyPhonebookContact{}, err
	}

	contact.OwnerID = nullStringValue(ownerID)
	contact.Type = nullStringValue(contactType)
	contact.HomeEmail = nullStringValue(homeEmail)
	contact.WorkEmail = nullStringValue(workEmail)
	contact.HomePhone = nullStringValue(homePhone)
	contact.WorkPhone = nullStringValue(workPhone)
	contact.CellPhone = nullStringValue(cellPhone)
	contact.Fax = nullStringValue(fax)
	contact.Title = nullStringValue(title)
	contact.Company = nullStringValue(company)
	contact.Notes = nullStringValue(notes)
	contact.Name = nullStringValue(name)
	contact.HomeStreet = nullStringValue(homeStreet)
	contact.HomePOB = nullStringValue(homePOB)
	contact.HomeCity = nullStringValue(homeCity)
	contact.HomeProvince = nullStringValue(homeProvince)
	contact.HomePostalCode = nullStringValue(homePostalCode)
	contact.HomeCountry = nullStringValue(homeCountry)
	contact.WorkStreet = nullStringValue(workStreet)
	contact.WorkPOB = nullStringValue(workPOB)
	contact.WorkCity = nullStringValue(workCity)
	contact.WorkProvince = nullStringValue(workProvince)
	contact.WorkPostalCode = nullStringValue(workPostalCode)
	contact.WorkCountry = nullStringValue(workCountry)
	contact.URL = nullStringValue(url)
	contact.Extension = nullStringValue(extension)
	contact.SpeedDialNum = nullStringValue(speedDialNum)
	contact.FirstName = nullStringValue(firstName)
	contact.LastName = nullStringValue(lastName)
	contact.Job = nullStringValue(job)
	contact.Facebook = nullStringValue(facebook)
	contact.Instagram = nullStringValue(instagram)
	contact.LinkedIn = nullStringValue(linkedIn)
	contact.WorkPhone2 = nullStringValue(workPhone2)
	contact.CellPhone2 = nullStringValue(cellPhone2)
	contact.OtherPhone = nullStringValue(otherPhone)
	contact.OtherEmail = nullStringValue(otherEmail)
	contact.Source = nullStringValue(source)

	return contact, nil
}
