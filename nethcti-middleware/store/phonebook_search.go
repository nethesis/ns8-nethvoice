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

// LegacyPhonebookQuery describes legacy-compatible union search/list parameters.
type LegacyPhonebookQuery struct {
	Username               string
	UserGroups             []string
	View                   string
	Visibility             string
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

	args := append([]any{}, visibleCTIArgs...)
	args = append(args, ctiVisibilityArgs...)
	args = append(args, centralizedVisibilityArgs...)
	args = append(args, visibleCTIArgs...)
	args = append(args, ctiVisibilityArgs...)
	args = append(args, centralizedVisibilityArgs...)
	countArgs := append([]any{}, visibleCTIArgs...)
	countArgs = append(countArgs, ctiVisibilityArgs...)
	countArgs = append(countArgs, centralizedVisibilityArgs...)
	countArgs = append(countArgs, visibleCTIArgs...)
	countArgs = append(countArgs, ctiVisibilityArgs...)
	countArgs = append(countArgs, centralizedVisibilityArgs...)

	listQuery := strings.Join([]string{
		"SELECT id, owner_id, type, homeemail, workemail, homephone, workphone, cellphone, fax, title, company, notes, name, homestreet, homepob, homecity, homeprovince, homepostalcode, homecountry, workstreet, workpob, workcity, workprovince, workpostalcode, workcountry, url, extension, speeddial_num, source, sort_name",
		"FROM (",
		"SELECT", legacyPhonebookSelectColumns, ", extension, speeddial_num, 'cti' AS source, name AS sort_name",
		"FROM cti_phonebook",
		"WHERE (name IS NOT NULL AND name != '') AND", visibleCTIWhere, "AND type != 'speeddial' AND", ctiVisibilityWhere,
		"UNION",
		"SELECT", legacyPhonebookSelectColumns, ", '' AS extension, '' AS speeddial_num, 'centralized' AS source, name AS sort_name",
		"FROM", centralizedPhonebookTable,
		"WHERE (name IS NOT NULL AND name != '') AND type != 'nethcti' AND", centralizedVisibilityWhere,
		"UNION",
		"SELECT", legacyPhonebookSelectColumns, ", extension, speeddial_num, 'cti' AS source, company AS sort_name",
		"FROM cti_phonebook",
		"WHERE (name IS NULL OR name = '') AND (company IS NOT NULL AND company != '') AND", visibleCTIWhere, "AND type != 'speeddial' AND", ctiVisibilityWhere,
		"UNION",
		"SELECT", legacyPhonebookSelectColumns, ", '' AS extension, '' AS speeddial_num, 'centralized' AS source, company AS sort_name",
		"FROM", centralizedPhonebookTable,
		"WHERE (name IS NULL OR name = '') AND (company IS NOT NULL AND company != '') AND type != 'nethcti' AND", centralizedVisibilityWhere,
		") phonebook_union",
		"ORDER BY sort_name ASC",
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
		"SELECT id FROM", centralizedPhonebookTable, "WHERE (name IS NOT NULL AND name != '') AND type != 'nethcti' AND", centralizedVisibilityWhere,
		"UNION ALL",
		"SELECT id FROM cti_phonebook WHERE (name IS NULL OR name = '') AND (company IS NOT NULL AND company != '') AND", visibleCTIWhere, "AND type != 'speeddial' AND", ctiVisibilityWhere,
		"UNION ALL",
		"SELECT id FROM", centralizedPhonebookTable, "WHERE (name IS NULL OR name = '') AND (company IS NOT NULL AND company != '') AND type != 'nethcti' AND", centralizedVisibilityWhere,
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
	termArgsCTI, termArgsCentralized, ctiSearchClause, centralizedSearchClause := buildLegacySearchClauses(query.View, query.Term)

	selectArgs := append([]any{}, visibleCTIArgs...)
	selectArgs = append(selectArgs, ctiVisibilityArgs...)
	selectArgs = append(selectArgs, termArgsCTI...)
	selectArgs = append(selectArgs, centralizedVisibilityArgs...)
	selectArgs = append(selectArgs, termArgsCentralized...)

	countArgs := append([]any{}, visibleCTIArgs...)
	countArgs = append(countArgs, ctiVisibilityArgs...)
	countArgs = append(countArgs, termArgsCTI...)
	countArgs = append(countArgs, centralizedVisibilityArgs...)
	countArgs = append(countArgs, termArgsCentralized...)

	selectQuery := strings.Join([]string{
		"SELECT * FROM (",
		"SELECT", legacyPhonebookSelectColumns, ", extension, speeddial_num, 'cti' AS source",
		"FROM cti_phonebook",
		"WHERE", visibleCTIWhere, "AND type != 'speeddial' AND", ctiVisibilityWhere, "AND (", ctiSearchClause, ")",
		"UNION",
		"SELECT", legacyPhonebookSelectColumns, ", '' AS extension, '' AS speeddial_num, 'centralized' AS source",
		"FROM", centralizedPhonebookTable,
		"WHERE type != 'nethcti' AND", centralizedVisibilityWhere, "AND (", centralizedSearchClause, ")",
		") phonebook_union ORDER BY company ASC, name ASC",
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
		"SELECT id FROM", centralizedPhonebookTable, "WHERE type != 'nethcti' AND", centralizedVisibilityWhere, "AND (", centralizedSearchClause, ")",
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
	termArgsCTI, termArgsCentralized, ctiSearchClause, centralizedSearchClause := buildLegacySearchClauses("company", query.Term)

	companyQueryArgs := append([]any{}, visibleCTIArgs...)
	companyQueryArgs = append(companyQueryArgs, ctiVisibilityArgs...)
	companyQueryArgs = append(companyQueryArgs, termArgsCTI...)
	companyQueryArgs = append(companyQueryArgs, centralizedVisibilityArgs...)
	companyQueryArgs = append(companyQueryArgs, termArgsCentralized...)

	companiesQuery := strings.Join([]string{
		"SELECT company FROM (",
		"SELECT company FROM cti_phonebook WHERE", visibleCTIWhere, "AND type != 'speeddial' AND", ctiVisibilityWhere, "AND (", ctiSearchClause, ")",
		"UNION",
		"SELECT company FROM", centralizedPhonebookTable, "WHERE type != 'nethcti' AND", centralizedVisibilityWhere, "AND (", centralizedSearchClause, ")",
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
		"SELECT company FROM", centralizedPhonebookTable, "WHERE type != 'nethcti' AND", centralizedVisibilityWhere, "AND (", centralizedSearchClause, ")",
		") phonebook_union",
	}, " ")

	countArgs := append([]any{}, visibleCTIArgs...)
	countArgs = append(countArgs, ctiVisibilityArgs...)
	countArgs = append(countArgs, termArgsCTI...)
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
	centralizedVisibilityWhere string,
	centralizedVisibilityArgs []any,
	company string,
) (LegacyPhonebookContact, error) {
	companyResult := LegacyPhonebookContact{Company: company}

	infoQuery := strings.Join([]string{
		"SELECT * FROM (",
		"SELECT", legacyPhonebookSelectColumns, ", extension, speeddial_num, 'cti' AS source",
		"FROM cti_phonebook",
		"WHERE", visibleCTIWhere, "AND company = ? AND (name IS NULL OR name = '') AND type != 'speeddial' AND", ctiVisibilityWhere,
		"UNION",
		"SELECT", legacyPhonebookSelectColumns, ", '' AS extension, '' AS speeddial_num, 'centralized' AS source",
		"FROM", centralizedPhonebookTable,
		"WHERE company = ? AND (name IS NULL OR name = '') AND type != 'nethcti' AND", centralizedVisibilityWhere,
		") company_info LIMIT 1",
	}, " ")
	infoArgs := append([]any{}, visibleCTIArgs...)
	infoArgs = append(infoArgs, company)
	infoArgs = append(infoArgs, ctiVisibilityArgs...)
	infoArgs = append(infoArgs, company)
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
		"WHERE company = ? AND (name IS NOT NULL AND name != '') AND type != 'nethcti' AND", centralizedVisibilityWhere,
		") company_contacts ORDER BY name ASC",
	}, " ")
	contactsArgs := append([]any{}, visibleCTIArgs...)
	contactsArgs = append(contactsArgs, company)
	contactsArgs = append(contactsArgs, ctiVisibilityArgs...)
	contactsArgs = append(contactsArgs, company)
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

func buildLegacySearchClauses(view, rawTerm string) ([]any, []any, string, string) {
	term := "%" + escapeLikeValue(rawTerm) + "%"
	baseClause := "(name LIKE ? ESCAPE '\\\\' OR company LIKE ? ESCAPE '\\\\')"
	ctiArgs := []any{term, term}
	centralizedArgs := []any{term, term}

	switch strings.ToLower(strings.TrimSpace(view)) {
	case "person":
		baseClause = "name LIKE ? ESCAPE '\\\\'"
		ctiArgs = []any{term}
		centralizedArgs = []any{term}
	case "company":
		baseClause = "company LIKE ? ESCAPE '\\\\'"
		ctiArgs = []any{term}
		centralizedArgs = []any{term}
	}

	ctiClause := strings.Join([]string{
		baseClause,
		"OR workphone LIKE ? ESCAPE '\\\\'",
		"OR homephone LIKE ? ESCAPE '\\\\'",
		"OR cellphone LIKE ? ESCAPE '\\\\'",
		"OR extension LIKE ? ESCAPE '\\\\'",
		"OR notes LIKE ? ESCAPE '\\\\'",
	}, " ")
	centralizedClause := strings.Join([]string{
		baseClause,
		"OR workphone LIKE ? ESCAPE '\\\\'",
		"OR homephone LIKE ? ESCAPE '\\\\'",
		"OR cellphone LIKE ? ESCAPE '\\\\'",
		"OR notes LIKE ? ESCAPE '\\\\'",
	}, " ")

	ctiArgs = append(ctiArgs, term, term, term, term, term)
	centralizedArgs = append(centralizedArgs, term, term, term, term)

	return ctiArgs, centralizedArgs, ctiClause, centralizedClause
}

func buildLegacyVisibilityClauses(rawVisibility string) (string, []any, string, []any) {
	switch strings.ToLower(strings.TrimSpace(rawVisibility)) {
	case "", "all":
		return "1 = 1", nil, "1 = 1", nil
	case "public":
		return "type = ?", []any{"public"}, "1 = 1", nil
	case "private":
		return "type = ?", []any{"private"}, "1 = 0", nil
	case "group":
		groupPattern := GroupTypePrefix + "%"
		return "type LIKE ?", []any{groupPattern}, "1 = 0", nil
	default:
		return "1 = 1", nil, "1 = 1", nil
	}
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
	contact.Source = nullStringValue(source)

	return contact, nil
}
