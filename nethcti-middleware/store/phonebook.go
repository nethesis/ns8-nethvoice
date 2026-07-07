/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/nethesis/nethcti-middleware/db"
	"github.com/nethesis/nethcti-middleware/logs"
)

// GroupTypePrefix identifies contacts shared with one or more groups.
const GroupTypePrefix = "group:"

var phonebookMutableColumns = []string{
	"type",
	"name",
	"homeemail",
	"workemail",
	"homephone",
	"workphone",
	"cellphone",
	"fax",
	"title",
	"company",
	"notes",
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
	"extension",
	"speeddial_num",
}

// PhonebookEntry represents a phonebook contact from cti_phonebook table.
type PhonebookEntry struct {
	ID             int64
	OwnerID        string
	Type           string
	HomeEmail      string
	WorkEmail      string
	HomePhone      string
	WorkPhone      string
	CellPhone      string
	Fax            string
	Title          string
	Company        string
	Notes          string
	Name           string
	HomeStreet     string
	HomePOB        string
	HomeCity       string
	HomeProvince   string
	HomePostalCode string
	HomeCountry    string
	WorkStreet     string
	WorkPOB        string
	WorkCity       string
	WorkProvince   string
	WorkPostalCode string
	WorkCountry    string
	URL            string
	Extension      string
	SpeedDialNum   string
}

// IsReservedContactType reports whether the contact type is one of the built-in visibilities.
func IsReservedContactType(contactType string) bool {
	switch strings.ToLower(strings.TrimSpace(contactType)) {
	case "private", "public", "speeddial":
		return true
	default:
		return false
	}
}

// HasGroupTypePrefix reports whether the contact type uses the shared-group namespace.
func HasGroupTypePrefix(contactType string) bool {
	trimmed := strings.TrimSpace(contactType)
	if len(trimmed) < len(GroupTypePrefix) {
		return false
	}

	return strings.EqualFold(trimmed[:len(GroupTypePrefix)], GroupTypePrefix)
}

// NormalizeSharedGroups trims, deduplicates, and drops empty group names.
func NormalizeSharedGroups(groups []string) []string {
	normalized := make([]string, 0, len(groups))
	seen := make(map[string]struct{}, len(groups))

	for _, groupName := range groups {
		trimmed := strings.TrimSpace(groupName)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}

		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}

	return normalized
}

// IsValidSharedGroupName reports whether a group name can be serialized in the contact type.
func IsValidSharedGroupName(groupName string) bool {
	trimmed := strings.TrimSpace(groupName)
	if trimmed == "" {
		return false
	}
	if strings.Contains(trimmed, ",") {
		return false
	}
	if IsReservedContactType(trimmed) {
		return false
	}

	return !HasGroupTypePrefix(trimmed)
}

// GetSharedGroupsFromType parses the serialized group type and returns normalized group names.
func GetSharedGroupsFromType(contactType string) []string {
	if !HasGroupTypePrefix(contactType) {
		return []string{}
	}

	trimmed := strings.TrimSpace(contactType)
	rawGroups := strings.Split(trimmed[len(GroupTypePrefix):], ",")
	return NormalizeSharedGroups(rawGroups)
}

// EncodeSharedGroupsType serializes normalized group names into the contact type field.
func EncodeSharedGroupsType(groups []string) string {
	return GroupTypePrefix + strings.Join(NormalizeSharedGroups(groups), ",")
}

// IsValidGroupContactType reports whether the serialized group type is syntactically valid.
func IsValidGroupContactType(contactType string) bool {
	sharedGroups := GetSharedGroupsFromType(contactType)
	if len(sharedGroups) == 0 {
		return false
	}

	for _, groupName := range sharedGroups {
		if !IsValidSharedGroupName(groupName) {
			return false
		}
	}

	return true
}

// GetGroupPermissionID returns the normalized presence-panel permission id for a group name.
func GetGroupPermissionID(groupName string) string {
	normalized := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			return r
		case r >= 'A' && r <= 'Z':
			return r + ('a' - 'A')
		case r >= '0' && r <= '9':
			return r
		default:
			return -1
		}
	}, strings.TrimSpace(groupName))

	return "grp_" + normalized
}

// GetPhonebookPermissionLevelFromCapabilities derives the legacy permission level from flattened capabilities.
func GetPhonebookPermissionLevelFromCapabilities(capabilities map[string]bool) int {
	if !capabilities["phonebook"] {
		return -1
	}

	if capabilities["phonebook.ad_phonebook"] || capabilities["phonebook.phonebook_level_2"] {
		return 2
	}

	if capabilities["phonebook.phonebook_level_1"] {
		return 1
	}

	if capabilities["phonebook.phonebook_level_0"] {
		return 0
	}

	return 0
}

// GetPhonebookPermissionLevel derives the legacy permission level for a user.
func GetPhonebookPermissionLevel(username string) int {
	capabilities, err := GetUserCapabilities(username)
	if err != nil {
		return -1
	}

	return GetPhonebookPermissionLevelFromCapabilities(capabilities)
}

// GetAllowedOperatorGroupIDs returns the enabled grp_* presence-panel permission ids.
func GetAllowedOperatorGroupIDs(capabilities map[string]bool) []string {
	allowedGroups := make([]string, 0)
	for capability, enabled := range capabilities {
		if enabled && strings.HasPrefix(capability, "presence_panel.grp_") {
			allowedGroups = append(allowedGroups, strings.TrimPrefix(capability, "presence_panel."))
		}
	}
	sort.Strings(allowedGroups)
	return allowedGroups
}

// CanSeeAllOperatorGroups reports whether the user can access all operator groups.
func CanSeeAllOperatorGroups(capabilities map[string]bool) bool {
	return capabilities["presence_panel.all_groups"]
}

var batchInsertPhonebookEntriesFunc = batchInsertPhonebookEntries

// SetBatchInsertPhonebookEntriesFuncForTest allows tests to override the batch insert behavior.
func SetBatchInsertPhonebookEntriesFuncForTest(fn func(context.Context, []*PhonebookEntry) (int, int, error)) func() {
	previous := batchInsertPhonebookEntriesFunc
	if fn == nil {
		batchInsertPhonebookEntriesFunc = batchInsertPhonebookEntries
	} else {
		batchInsertPhonebookEntriesFunc = fn
	}
	return func() {
		batchInsertPhonebookEntriesFunc = previous
	}
}

// BatchInsertPhonebookEntries inserts multiple phonebook entries in a transaction.
func BatchInsertPhonebookEntries(ctx context.Context, entries []*PhonebookEntry) (int, int, error) {
	return batchInsertPhonebookEntriesFunc(ctx, entries)
}

func batchInsertPhonebookEntries(ctx context.Context, entries []*PhonebookEntry) (int, int, error) {
	if len(entries) == 0 {
		return 0, 0, nil
	}

	database := db.GetDB()
	if database == nil {
		return 0, len(entries), errors.New("database not initialized")
	}

	tx, err := database.BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO cti_phonebook (
			owner_id, type, homeemail, workemail, homephone, workphone, cellphone, fax,
			title, company, notes, name, homestreet, homepob, homecity, homeprovince,
			homepostalcode, homecountry, workstreet, workpob, workcity, workprovince,
			workpostalcode, workcountry, url, extension, speeddial_num
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	successful := 0
	failed := 0

	for _, entry := range entries {
		_, err := tx.ExecContext(ctx, query,
			entry.OwnerID, entry.Type, entry.HomeEmail, entry.WorkEmail, entry.HomePhone,
			entry.WorkPhone, entry.CellPhone, entry.Fax, entry.Title, entry.Company, entry.Notes,
			entry.Name, entry.HomeStreet, entry.HomePOB, entry.HomeCity, entry.HomeProvince,
			entry.HomePostalCode, entry.HomeCountry, entry.WorkStreet, entry.WorkPOB,
			entry.WorkCity, entry.WorkProvince, entry.WorkPostalCode, entry.WorkCountry,
			entry.URL, entry.Extension, entry.SpeedDialNum,
		)
		if err != nil {
			logs.Log("[ERROR][PHONEBOOK] Failed to insert entry for " + entry.Name + ": " + err.Error())
			failed++
		} else {
			successful++
		}
	}

	err = tx.Commit()
	if err != nil {
		return 0, len(entries), err
	}

	return successful, failed, nil
}

// CreatePhonebookEntry inserts a single CTI phonebook contact.
func CreatePhonebookEntry(ctx context.Context, entry *PhonebookEntry) error {
	successful, failed, err := BatchInsertPhonebookEntries(ctx, []*PhonebookEntry{entry})
	if err != nil {
		return err
	}
	if successful != 1 || failed != 0 {
		return fmt.Errorf("failed to insert phonebook entry")
	}

	return nil
}

// GetPhonebookEntryByID returns a single CTI phonebook contact by id.
func GetPhonebookEntryByID(ctx context.Context, id int64) (*PhonebookEntry, error) {
	database := db.GetDB()
	if database == nil {
		return nil, errors.New("database not initialized")
	}

	query := `
		SELECT id, owner_id, type, homeemail, workemail, homephone, workphone, cellphone, fax,
			title, company, notes, name, homestreet, homepob, homecity, homeprovince,
			homepostalcode, homecountry, workstreet, workpob, workcity, workprovince,
			workpostalcode, workcountry, url, extension, speeddial_num
		FROM cti_phonebook
		WHERE id = ?
		LIMIT 1
	`

	entry, err := scanPhonebookEntry(database.QueryRowContext(ctx, query, id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}

	return entry, err
}

// GetCentralizedPhonebookEntryByID returns a single contact from the centralized
// phonebook table (the company-wide phonebook published for physical phones) by id.
// The nethcti-exported rows are excluded: those are CTI contacts and must be fetched
// from cti_phonebook instead, to avoid returning the duplicated copy.
func GetCentralizedPhonebookEntryByID(ctx context.Context, id int64) (*PhonebookEntry, error) {
	database := db.GetDB()
	if database == nil {
		return nil, errors.New("database not initialized")
	}

	query := `
		SELECT id, owner_id, type, homeemail, workemail, homephone, workphone, cellphone, fax,
			title, company, notes, name, homestreet, homepob, homecity, homeprovince,
			homepostalcode, homecountry, workstreet, workpob, workcity, workprovince,
			workpostalcode, workcountry, url, '' AS extension, '' AS speeddial_num
		FROM ` + centralizedPhonebookTable + `
		WHERE id = ? AND type != 'nethcti'
		LIMIT 1
	`

	entry, err := scanPhonebookEntry(database.QueryRowContext(ctx, query, id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}

	return entry, err
}

// UpdatePhonebookEntryFields updates the provided columns on a CTI phonebook contact.
func UpdatePhonebookEntryFields(ctx context.Context, id int64, fields map[string]any) error {
	database := db.GetDB()
	if database == nil {
		return errors.New("database not initialized")
	}

	setClauses := make([]string, 0, len(fields))
	args := make([]any, 0, len(fields)+1)

	for _, column := range phonebookMutableColumns {
		value, ok := fields[column]
		if !ok {
			continue
		}

		switch typedValue := value.(type) {
		case nil:
			args = append(args, nil)
		case string:
			args = append(args, typedValue)
		default:
			return fmt.Errorf("invalid value type for field %s", column)
		}

		setClauses = append(setClauses, "`"+column+"` = ?")
	}

	if len(setClauses) == 0 {
		return errors.New("no fields to update")
	}

	args = append(args, id)
	query := "UPDATE `cti_phonebook` SET " + strings.Join(setClauses, ", ") + " WHERE id = ?"
	_, err := database.ExecContext(ctx, query, args...)
	return err
}

// DeletePhonebookEntryByID removes a CTI phonebook contact.
func DeletePhonebookEntryByID(ctx context.Context, id int64) error {
	database := db.GetDB()
	if database == nil {
		return errors.New("database not initialized")
	}

	_, err := database.ExecContext(ctx, "DELETE FROM `cti_phonebook` WHERE id = ?", id)
	return err
}

// centralizedSyncColumns are the cti_phonebook columns copied verbatim into
// phonebook.phonebook by SyncPublicContactsToCentralized. `type` and `sid_imported`
// are intentionally NOT in this list: both are written as the literal 'nethcti' marker
// (lockstep with nethcti_export.php). Keeping a single list, reused for both the INSERT
// column clause and the SELECT projection, is the single source of truth for a schema
// change and prevents the two halves from drifting out of column alignment.
var centralizedSyncColumns = []string{
	"owner_id", "homeemail", "workemail", "homephone", "workphone", "cellphone", "fax",
	"title", "company", "notes", "name", "homestreet", "homepob", "homecity", "homeprovince",
	"homepostalcode", "homecountry", "workstreet", "workpob", "workcity", "workprovince",
	"workpostalcode", "workcountry", "url",
}

// SyncPublicContactsToCentralized republishes every public CTI contact into the
// centralized phonebook used for call-time name resolution (Asterisk lookup.php and
// the CTI customer-card "Identity" query both read phonebook.phonebook).
//
// It mirrors exactly the nightly nethcti_export.php job. NethCTI-exported rows are marked
// with both type='nethcti' and sid_imported='nethcti': the middleware union search excludes
// them via type != 'nethcti', while cleanup here keys on sid_imported='nethcti' to stay in
// lockstep with the nightly export (which deletes by the same column). The function deletes
// those rows and reinserts every cti_phonebook row with type='public', so new/changed public
// contacts become immediately resolvable instead of waiting for the nightly export. Rows from
// other sync sources (sid_imported != 'nethcti') are left untouched.
//
// phonebook.phonebook is a MyISAM table (no transactions), so the delete+reinsert is
// wrapped in LOCK TABLES ... WRITE to avoid exposing an empty result set to concurrent
// readers. LOCK TABLES is connection-scoped, hence the work runs on a single pinned
// connection.
func SyncPublicContactsToCentralized(ctx context.Context) error {
	database := db.GetDB()
	if database == nil {
		return errors.New("database not initialized")
	}

	conn, err := database.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, "LOCK TABLES `phonebook`.`phonebook` WRITE, `cti_phonebook` READ"); err != nil {
		return err
	}
	// Always release the lock with a fresh context. The original ctx may be expired by
	// the time DELETE/INSERT finishes (large table or WRITE-lock contention), and
	// conn.ExecContext with a cancelled ctx returns immediately without sending UNLOCK to
	// MySQL, leaving the connection in LOCK TABLES state inside the pool. The next
	// borrower would then inherit the lock and receive MySQL error 1100 on unrelated
	// queries, poisoning up to MaxOpenConns connections until ConnMaxLifetime recycles them.
	defer func() {
		unlockCtx, unlockCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer unlockCancel()
		if _, unlockErr := conn.ExecContext(unlockCtx, "UNLOCK TABLES"); unlockErr != nil {
			logs.Log("[CRITICAL][PHONEBOOK] Failed to unlock tables after centralized sync: " + unlockErr.Error())
		}
	}()

	if _, err := conn.ExecContext(ctx, "DELETE FROM `phonebook`.`phonebook` WHERE sid_imported = 'nethcti'"); err != nil {
		return err
	}

	// Build the INSERT column clause and the SELECT projection from the same list so
	// they cannot drift out of alignment (a mismatch would silently write a value into
	// the wrong column). `type` and `sid_imported` are appended explicitly because both
	// are written as the literal 'nethcti' marker rather than copied from the source row.
	columns := strings.Join(centralizedSyncColumns, ", ")
	insertSelect := "INSERT INTO `phonebook`.`phonebook` (" + columns + ", type, sid_imported)\n" +
		"SELECT " + columns + ", 'nethcti', 'nethcti'\n" +
		"FROM cti_phonebook\n" +
		"WHERE type = 'public'"
	if _, err := conn.ExecContext(ctx, insertSelect); err != nil {
		return err
	}

	return nil
}

func scanPhonebookEntry(scanner interface{ Scan(dest ...any) error }) (*PhonebookEntry, error) {
	var (
		entry           PhonebookEntry
		ownerID         sql.NullString
		contactType     sql.NullString
		homeEmail       sql.NullString
		workEmail       sql.NullString
		homePhone       sql.NullString
		workPhone       sql.NullString
		cellPhone       sql.NullString
		fax             sql.NullString
		title           sql.NullString
		company         sql.NullString
		notes           sql.NullString
		name            sql.NullString
		homeStreet      sql.NullString
		homePOB         sql.NullString
		homeCity        sql.NullString
		homeProvince    sql.NullString
		homePostalCode  sql.NullString
		homeCountry     sql.NullString
		workStreet      sql.NullString
		workPOB         sql.NullString
		workCity        sql.NullString
		workProvince    sql.NullString
		workPostalCode  sql.NullString
		workCountry     sql.NullString
		url             sql.NullString
		extension       sql.NullString
		speedDialNumber sql.NullString
	)

	err := scanner.Scan(
		&entry.ID,
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
		&speedDialNumber,
	)
	if err != nil {
		return nil, err
	}

	entry.OwnerID = nullStringValue(ownerID)
	entry.Type = nullStringValue(contactType)
	entry.HomeEmail = nullStringValue(homeEmail)
	entry.WorkEmail = nullStringValue(workEmail)
	entry.HomePhone = nullStringValue(homePhone)
	entry.WorkPhone = nullStringValue(workPhone)
	entry.CellPhone = nullStringValue(cellPhone)
	entry.Fax = nullStringValue(fax)
	entry.Title = nullStringValue(title)
	entry.Company = nullStringValue(company)
	entry.Notes = nullStringValue(notes)
	entry.Name = nullStringValue(name)
	entry.HomeStreet = nullStringValue(homeStreet)
	entry.HomePOB = nullStringValue(homePOB)
	entry.HomeCity = nullStringValue(homeCity)
	entry.HomeProvince = nullStringValue(homeProvince)
	entry.HomePostalCode = nullStringValue(homePostalCode)
	entry.HomeCountry = nullStringValue(homeCountry)
	entry.WorkStreet = nullStringValue(workStreet)
	entry.WorkPOB = nullStringValue(workPOB)
	entry.WorkCity = nullStringValue(workCity)
	entry.WorkProvince = nullStringValue(workProvince)
	entry.WorkPostalCode = nullStringValue(workPostalCode)
	entry.WorkCountry = nullStringValue(workCountry)
	entry.URL = nullStringValue(url)
	entry.Extension = nullStringValue(extension)
	entry.SpeedDialNum = nullStringValue(speedDialNumber)

	return &entry, nil
}

func nullStringValue(value sql.NullString) string {
	if value.Valid {
		return value.String
	}

	return ""
}
