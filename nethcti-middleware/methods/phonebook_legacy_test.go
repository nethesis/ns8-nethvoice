/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	jwtv5 "github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/nethesis/nethcti-middleware/store"
)

func TestComputeVisibleGroupNames(t *testing.T) {
	// Visibility depends only on direct membership: "Sales" is enabled via the
	// presence-panel permission but alice is not a member, so it must not show.
	visibleGroups := computeVisibleGroupNames(
		"alice",
		map[string]legacyPhonebookOperatorGroup{
			"Sales":   {Users: []string{"bob"}},
			"Support": {Users: []string{"alice"}},
			"Hidden":  {Users: []string{"charlie"}},
		},
	)

	assert.Equal(t, []string{"Support"}, visibleGroups)
}

func TestGetUserGroupNamesForRead_FallsBackWhenGroupsUnavailable(t *testing.T) {
	originalFetchGroups := fetchPhonebookOperatorGroupsFunc
	originalCaps := getUserCapabilitiesFunc
	defer func() {
		fetchPhonebookOperatorGroupsFunc = originalFetchGroups
		getUserCapabilitiesFunc = originalCaps
	}()

	fetchPhonebookOperatorGroupsFunc = func(string) (map[string]legacyPhonebookOperatorGroup, error) {
		return nil, errors.New("opgroups unavailable")
	}
	getUserCapabilitiesFunc = func(string) (map[string]bool, error) {
		return map[string]bool{
			"phonebook": true,
		}, nil
	}

	groups, err := getUserGroupNamesForRead("alice")

	require.NoError(t, err)
	assert.Empty(t, groups)
}

func TestGetLegacyCTIPhonebookContact_GroupVisibility(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p2","name":"phonebook_level_2","value":true}]},"presence_panel":{"value":true,"permissions":[{"id":"grp_sales","name":"grp_sales","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalGet := getPhonebookEntryByIDFunc
	originalFetchGroups := fetchPhonebookOperatorGroupsFunc
	originalCaps := getUserCapabilitiesFunc
	defer func() {
		getPhonebookEntryByIDFunc = originalGet
		fetchPhonebookOperatorGroupsFunc = originalFetchGroups
		getUserCapabilitiesFunc = originalCaps
	}()

	getPhonebookEntryByIDFunc = func(context.Context, int64) (*store.PhonebookEntry, error) {
		return &store.PhonebookEntry{ID: 7, OwnerID: "bob", Type: "group:Sales", Name: "Alice Shared"}, nil
	}
	// alice is a direct member of "Sales", so the group-shared contact is visible.
	fetchPhonebookOperatorGroupsFunc = func(string) (map[string]legacyPhonebookOperatorGroup, error) {
		return map[string]legacyPhonebookOperatorGroup{"Sales": {Users: []string{"bob", "alice"}}}, nil
	}
	getUserCapabilitiesFunc = func(string) (map[string]bool, error) {
		return map[string]bool{
			"phonebook":                   true,
			"phonebook.phonebook_level_2": true,
		}, nil
	}

	ctx, recorder := newLegacyPhonebookTestContext(http.MethodGet, "/phonebook/cticontact/7", nil, "alice")
	ctx.Params = gin.Params{{Key: "id", Value: "7"}}

	GetLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"source":"cti"`)
	assert.Contains(t, recorder.Body.String(), `"type":"group:Sales"`)
}

func TestGetLegacyCTIPhonebookContact_ForbiddenWhenGroupHidden(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalGet := getPhonebookEntryByIDFunc
	originalFetchGroups := fetchPhonebookOperatorGroupsFunc
	originalCaps := getUserCapabilitiesFunc
	defer func() {
		getPhonebookEntryByIDFunc = originalGet
		fetchPhonebookOperatorGroupsFunc = originalFetchGroups
		getUserCapabilitiesFunc = originalCaps
	}()

	getPhonebookEntryByIDFunc = func(context.Context, int64) (*store.PhonebookEntry, error) {
		return &store.PhonebookEntry{ID: 8, OwnerID: "bob", Type: "group:Support", Name: "Hidden Shared"}, nil
	}
	fetchPhonebookOperatorGroupsFunc = func(string) (map[string]legacyPhonebookOperatorGroup, error) {
		return map[string]legacyPhonebookOperatorGroup{"Support": {Users: []string{"bob"}}}, nil
	}
	getUserCapabilitiesFunc = func(string) (map[string]bool, error) {
		return map[string]bool{
			"phonebook":                   true,
			"phonebook.phonebook_level_2": true,
		}, nil
	}

	ctx, recorder := newLegacyPhonebookTestContext(http.MethodGet, "/phonebook/cticontact/8", nil, "alice")
	ctx.Params = gin.Params{{Key: "id", Value: "8"}}

	GetLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusForbidden, recorder.Code)
}

func TestCreateLegacyCTIPhonebookContact_PrivateLevelTwo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p2","name":"phonebook_level_2","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalCreate := createPhonebookEntryFunc
	defer func() {
		createPhonebookEntryFunc = originalCreate
	}()

	var capturedEntry *store.PhonebookEntry
	createPhonebookEntryFunc = func(_ context.Context, entry *store.PhonebookEntry) error {
		capturedEntry = entry
		return nil
	}

	payload := map[string]any{
		"name":      "Alice",
		"type":      "private",
		"workphone": "+39123",
	}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/create", payload, "alice")

	CreateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusCreated, recorder.Code)
	require.NotNil(t, capturedEntry)
	assert.Equal(t, "alice", capturedEntry.OwnerID)
	assert.Equal(t, "private", capturedEntry.Type)
	assert.Equal(t, "+39123", capturedEntry.WorkPhone)
}

func TestCreateLegacyCTIPhonebookContact_PrivateLevelOne(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p1","name":"phonebook_level_1","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalCreate := createPhonebookEntryFunc
	defer func() {
		createPhonebookEntryFunc = originalCreate
	}()

	var capturedEntry *store.PhonebookEntry
	createPhonebookEntryFunc = func(_ context.Context, entry *store.PhonebookEntry) error {
		capturedEntry = entry
		return nil
	}

	payload := map[string]any{
		"name": "Alice",
		"type": "private",
	}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/create", payload, "alice")

	CreateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusCreated, recorder.Code)
	require.NotNil(t, capturedEntry)
	assert.Equal(t, "private", capturedEntry.Type)
}

func TestCreateLegacyCTIPhonebookContact_GroupForbiddenForLevelOne(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p1","name":"phonebook_level_1","value":true}]},"presence_panel":{"value":true,"permissions":[{"id":"grp_sales","name":"grp_sales","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalCreate := createPhonebookEntryFunc
	originalFetchGroups := fetchPhonebookOperatorGroupsFunc
	defer func() {
		createPhonebookEntryFunc = originalCreate
		fetchPhonebookOperatorGroupsFunc = originalFetchGroups
	}()

	var capturedEntry *store.PhonebookEntry
	createPhonebookEntryFunc = func(_ context.Context, entry *store.PhonebookEntry) error {
		t.Fatalf("create should not be called for group contacts at level 1")
		return nil
	}
	fetchPhonebookOperatorGroupsFunc = func(string) (map[string]legacyPhonebookOperatorGroup, error) {
		return map[string]legacyPhonebookOperatorGroup{"Sales": {Users: []string{"alice"}}}, nil
	}

	payload := map[string]any{
		"name": "Alice",
		"type": "group:Sales",
	}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/create", payload, "alice")

	CreateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.Nil(t, capturedEntry)
}

func TestCreateLegacyCTIPhonebookContact_PrivateMacroOnlyForbidden(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalCreate := createPhonebookEntryFunc
	defer func() {
		createPhonebookEntryFunc = originalCreate
	}()

	createPhonebookEntryFunc = func(_ context.Context, entry *store.PhonebookEntry) error {
		t.Fatalf("create should not be called for private contacts at level 0")
		return nil
	}

	payload := map[string]any{
		"name": "Alice",
		"type": "private",
	}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/create", payload, "alice")

	CreateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusForbidden, recorder.Code)
}

func TestCreateLegacyCTIPhonebookContact_PublicForbiddenForLevelOne(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p1","name":"phonebook_level_1","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalCreate := createPhonebookEntryFunc
	defer func() {
		createPhonebookEntryFunc = originalCreate
	}()

	createPhonebookEntryFunc = func(_ context.Context, entry *store.PhonebookEntry) error {
		t.Fatalf("create should not be called for public contacts at level 1")
		return nil
	}

	payload := map[string]any{
		"name": "Alice",
		"type": "public",
	}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/create", payload, "alice")

	CreateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusForbidden, recorder.Code)
}

func TestCreateLegacyCTIPhonebookContact_PublicAllowedForLevelTwo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p2","name":"phonebook_level_2","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalCreate := createPhonebookEntryFunc
	defer func() {
		createPhonebookEntryFunc = originalCreate
	}()

	var capturedEntry *store.PhonebookEntry
	createPhonebookEntryFunc = func(_ context.Context, entry *store.PhonebookEntry) error {
		capturedEntry = entry
		return nil
	}

	payload := map[string]any{
		"name": "Alice",
		"type": "public",
	}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/create", payload, "alice")

	CreateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusCreated, recorder.Code)
	require.NotNil(t, capturedEntry)
	assert.Equal(t, "public", capturedEntry.Type)
}

func TestCreateLegacyCTIPhonebookContact_GroupForbiddenWhenNotMemberEvenForLevelTwo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// Level 2 user, but NOT a member of the target group. Sharing must be
	// rejected: there is no admin bypass, membership is required for everyone.
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p2","name":"phonebook_level_2","value":true}]},"presence_panel":{"value":true,"permissions":[{"id":"grp_sales","name":"grp_sales","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalCreate := createPhonebookEntryFunc
	originalFetchGroups := fetchPhonebookOperatorGroupsFunc
	defer func() {
		createPhonebookEntryFunc = originalCreate
		fetchPhonebookOperatorGroupsFunc = originalFetchGroups
	}()

	createPhonebookEntryFunc = func(_ context.Context, entry *store.PhonebookEntry) error {
		t.Fatalf("create should not be called when sharing with a non-membership group")
		return nil
	}
	// alice is NOT in the "Sales" members list.
	fetchPhonebookOperatorGroupsFunc = func(string) (map[string]legacyPhonebookOperatorGroup, error) {
		return map[string]legacyPhonebookOperatorGroup{"Sales": {Users: []string{"bob"}}}, nil
	}

	payload := map[string]any{
		"name": "Alice",
		"type": "group:Sales",
	}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/create", payload, "alice")

	CreateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusForbidden, recorder.Code)
}

func TestCreateLegacyCTIPhonebookContact_GroupAllowedForMemberLevelTwo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p2","name":"phonebook_level_2","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalCreate := createPhonebookEntryFunc
	originalFetchGroups := fetchPhonebookOperatorGroupsFunc
	defer func() {
		createPhonebookEntryFunc = originalCreate
		fetchPhonebookOperatorGroupsFunc = originalFetchGroups
	}()

	var capturedEntry *store.PhonebookEntry
	createPhonebookEntryFunc = func(_ context.Context, entry *store.PhonebookEntry) error {
		capturedEntry = entry
		return nil
	}
	// alice IS a member of "Sales".
	fetchPhonebookOperatorGroupsFunc = func(string) (map[string]legacyPhonebookOperatorGroup, error) {
		return map[string]legacyPhonebookOperatorGroup{"Sales": {Users: []string{"bob", "alice"}}}, nil
	}

	payload := map[string]any{
		"name": "Alice",
		"type": "group:Sales",
	}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/create", payload, "alice")

	CreateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusCreated, recorder.Code)
	require.NotNil(t, capturedEntry)
	assert.Equal(t, "group:Sales", capturedEntry.Type)
}

func TestUpdateLegacyCTIPhonebookContact_RejectsVisibilityEscalation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p1","name":"phonebook_level_1","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalGet := getPhonebookEntryByIDFunc
	originalUpdate := updatePhonebookEntryFieldsFunc
	defer func() {
		getPhonebookEntryByIDFunc = originalGet
		updatePhonebookEntryFieldsFunc = originalUpdate
	}()

	getPhonebookEntryByIDFunc = func(context.Context, int64) (*store.PhonebookEntry, error) {
		return &store.PhonebookEntry{ID: 9, OwnerID: "alice", Type: "private", Name: "Alice"}, nil
	}
	updatePhonebookEntryFieldsFunc = func(context.Context, int64, map[string]any) error {
		t.Fatalf("update should not be called when visibility escalation is forbidden")
		return nil
	}

	payload := map[string]any{
		"id":   "9",
		"type": "public",
	}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/modify_cticontact", payload, "alice")

	UpdateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusForbidden, recorder.Code)
}

func TestSearchLegacyPhonebook_UsesMiddlewareQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalSearch := searchLegacyPhonebookFunc
	originalFetchGroups := fetchPhonebookOperatorGroupsFunc
	originalCaps := getUserCapabilitiesFunc
	defer func() {
		searchLegacyPhonebookFunc = originalSearch
		fetchPhonebookOperatorGroupsFunc = originalFetchGroups
		getUserCapabilitiesFunc = originalCaps
	}()

	var capturedQuery store.LegacyPhonebookQuery
	lastSyncAt := "2026-05-25T10:11:12Z"
	searchLegacyPhonebookFunc = func(_ context.Context, query store.LegacyPhonebookQuery) (*store.LegacyPhonebookResult, error) {
		capturedQuery = query
		return &store.LegacyPhonebookResult{Count: 1, Rows: []store.LegacyPhonebookContact{{Name: "Alice", Source: "cti"}}, LastSyncAt: &lastSyncAt}, nil
	}
	fetchPhonebookOperatorGroupsFunc = func(string) (map[string]legacyPhonebookOperatorGroup, error) {
		return map[string]legacyPhonebookOperatorGroup{"Sales": {Users: []string{"alice"}}}, nil
	}
	getUserCapabilitiesFunc = func(string) (map[string]bool, error) {
		return map[string]bool{"phonebook": true}, nil
	}

	ctx, recorder := newLegacyPhonebookTestContext(http.MethodGet, "/phonebook/search?view=company&visibility=group&offset=0&limit=10", nil, "alice")
	ctx.Params = gin.Params{{Key: "term", Value: ""}}

	SearchLegacyPhonebook(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "alice", capturedQuery.Username)
	assert.Equal(t, "company", capturedQuery.View)
	assert.Equal(t, "group", capturedQuery.Visibility)
	assert.Equal(t, 0, capturedQuery.Offset)
	assert.Equal(t, 10, capturedQuery.Limit)
	assert.True(t, capturedQuery.ApplyPagination)
	assert.True(t, capturedQuery.IncludePrivateContacts)
	assert.Equal(t, []string{"Sales"}, capturedQuery.UserGroups)
	assert.Contains(t, recorder.Body.String(), `"count":1`)
	assert.Contains(t, recorder.Body.String(), `"last_sync_at":"2026-05-25T10:11:12Z"`)
}

func TestListLegacyPhonebook_UsesMiddlewareQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalList := listLegacyPhonebookFunc
	originalFetchGroups := fetchPhonebookOperatorGroupsFunc
	originalCaps := getUserCapabilitiesFunc
	defer func() {
		listLegacyPhonebookFunc = originalList
		fetchPhonebookOperatorGroupsFunc = originalFetchGroups
		getUserCapabilitiesFunc = originalCaps
	}()

	var capturedQuery store.LegacyPhonebookQuery
	lastSyncAt := "2026-05-25T12:13:14Z"
	listLegacyPhonebookFunc = func(_ context.Context, query store.LegacyPhonebookQuery) (*store.LegacyPhonebookResult, error) {
		capturedQuery = query
		return &store.LegacyPhonebookResult{Count: 0, Rows: []store.LegacyPhonebookContact{}, LastSyncAt: &lastSyncAt}, nil
	}
	fetchPhonebookOperatorGroupsFunc = func(string) (map[string]legacyPhonebookOperatorGroup, error) {
		return map[string]legacyPhonebookOperatorGroup{}, nil
	}
	getUserCapabilitiesFunc = func(string) (map[string]bool, error) {
		return map[string]bool{"phonebook": true}, nil
	}

	ctx, recorder := newLegacyPhonebookTestContext(http.MethodGet, "/phonebook/getall?visibility=private&offset=5&limit=20", nil, "alice")

	ListLegacyPhonebook(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "alice", capturedQuery.Username)
	assert.Equal(t, "private", capturedQuery.Visibility)
	assert.Equal(t, 5, capturedQuery.Offset)
	assert.Equal(t, 20, capturedQuery.Limit)
	assert.True(t, capturedQuery.ApplyPagination)
	assert.True(t, capturedQuery.IncludePrivateContacts)
	assert.Empty(t, capturedQuery.Term)
	assert.Contains(t, recorder.Body.String(), `"count":0`)
	assert.Contains(t, recorder.Body.String(), `"last_sync_at":"2026-05-25T12:13:14Z"`)
}

func newLegacyPhonebookTestContext(method, target string, payload map[string]any, username string) (*gin.Context, *httptest.ResponseRecorder) {
	var body *bytes.Reader
	if payload == nil {
		body = bytes.NewReader(nil)
	} else {
		payloadBytes, _ := json.Marshal(payload)
		body = bytes.NewReader(payloadBytes)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, body)
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": username})
	return ctx, recorder
}

func TestGetLegacyCTIPhonebookContact_ForbiddenWhenOtherUserPrivate(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalGet := getPhonebookEntryByIDFunc
	originalCaps := getUserCapabilitiesFunc
	defer func() {
		getPhonebookEntryByIDFunc = originalGet
		getUserCapabilitiesFunc = originalCaps
	}()

	// A private contact owned by bob must never be readable by alice.
	getPhonebookEntryByIDFunc = func(context.Context, int64) (*store.PhonebookEntry, error) {
		return &store.PhonebookEntry{ID: 9, OwnerID: "bob", Type: "private", Name: "Bob Private"}, nil
	}
	getUserCapabilitiesFunc = func(string) (map[string]bool, error) {
		return map[string]bool{
			"phonebook":                   true,
			"phonebook.phonebook_level_2": true,
		}, nil
	}

	ctx, recorder := newLegacyPhonebookTestContext(http.MethodGet, "/phonebook/cticontact/9", nil, "alice")
	ctx.Params = gin.Params{{Key: "id", Value: "9"}}

	GetLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusForbidden, recorder.Code)
}

func TestGetLegacyCTIPhonebookContact_GroupVisibilityCaseInsensitive(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalGet := getPhonebookEntryByIDFunc
	originalFetchGroups := fetchPhonebookOperatorGroupsFunc
	originalCaps := getUserCapabilitiesFunc
	defer func() {
		getPhonebookEntryByIDFunc = originalGet
		fetchPhonebookOperatorGroupsFunc = originalFetchGroups
		getUserCapabilitiesFunc = originalCaps
	}()

	// Contact is shared with "sales" (lowercase) while the operator group is
	// "Sales"; the listing matches case-insensitively, so the detail endpoint
	// must too (see containsStringFold).
	getPhonebookEntryByIDFunc = func(context.Context, int64) (*store.PhonebookEntry, error) {
		return &store.PhonebookEntry{ID: 10, OwnerID: "bob", Type: "group:sales", Name: "Shared Lower"}, nil
	}
	// alice is a member of "Sales" (capitalized) while the contact is shared with
	// "sales" (lowercase): the membership match is by username, the group-name
	// match is case-insensitive (see containsStringFold).
	fetchPhonebookOperatorGroupsFunc = func(string) (map[string]legacyPhonebookOperatorGroup, error) {
		return map[string]legacyPhonebookOperatorGroup{"Sales": {Users: []string{"bob", "alice"}}}, nil
	}
	getUserCapabilitiesFunc = func(string) (map[string]bool, error) {
		return map[string]bool{
			"phonebook": true,
		}, nil
	}

	ctx, recorder := newLegacyPhonebookTestContext(http.MethodGet, "/phonebook/cticontact/10", nil, "alice")
	ctx.Params = gin.Params{{Key: "id", Value: "10"}}

	GetLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"type":"group:sales"`)
}

func TestGetCentralizedPhonebookContact_ReturnsCentralizedSource(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalGet := getCentralizedPhonebookEntryByIDFunc
	defer func() {
		getCentralizedPhonebookEntryByIDFunc = originalGet
	}()

	getCentralizedPhonebookEntryByIDFunc = func(context.Context, int64) (*store.PhonebookEntry, error) {
		return &store.PhonebookEntry{ID: 42, Type: "extension", Name: "Front Desk", Company: "Acme"}, nil
	}

	ctx, recorder := newLegacyPhonebookTestContext(http.MethodGet, "/phonebook/contact/42", nil, "alice")
	ctx.Params = gin.Params{{Key: "id", Value: "42"}}

	GetCentralizedPhonebookContact(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"source":"centralized"`)
	assert.Contains(t, recorder.Body.String(), `"name":"Front Desk"`)
}

func TestGetCentralizedPhonebookContact_NotFoundReturnsEmpty(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalGet := getCentralizedPhonebookEntryByIDFunc
	defer func() {
		getCentralizedPhonebookEntryByIDFunc = originalGet
	}()

	getCentralizedPhonebookEntryByIDFunc = func(context.Context, int64) (*store.PhonebookEntry, error) {
		return nil, nil
	}

	ctx, recorder := newLegacyPhonebookTestContext(http.MethodGet, "/phonebook/contact/404", nil, "alice")
	ctx.Params = gin.Params{{Key: "id", Value: "404"}}

	GetCentralizedPhonebookContact(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "{}", recorder.Body.String())
}

func loadPhonebookTestProfiles(t *testing.T, profilesJSON, usersJSON string) {
	t.Helper()
	tempDir := t.TempDir()
	profilesPath := filepath.Join(tempDir, "profiles.json")
	usersPath := filepath.Join(tempDir, "users.json")
	require.NoError(t, os.WriteFile(profilesPath, []byte(profilesJSON), 0o600))
	require.NoError(t, os.WriteFile(usersPath, []byte(usersJSON), 0o600))
	require.NoError(t, store.InitProfiles(profilesPath, usersPath))
}

func TestCreateLegacyCTIPhonebookContact_PublicTriggersCentralizedSync(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p2","name":"phonebook_level_2","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalCreate := createPhonebookEntryFunc
	originalSchedule := scheduleSyncCentralizedPublicContactsFunc
	defer func() {
		createPhonebookEntryFunc = originalCreate
		scheduleSyncCentralizedPublicContactsFunc = originalSchedule
	}()

	createPhonebookEntryFunc = func(context.Context, *store.PhonebookEntry) error { return nil }
	syncCalls := 0
	scheduleSyncCentralizedPublicContactsFunc = func() {
		syncCalls++
	}

	payload := map[string]any{"name": "Alice", "type": "public"}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/create", payload, "alice")

	CreateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusCreated, recorder.Code)
	assert.Equal(t, 1, syncCalls)
}

func TestCreateLegacyCTIPhonebookContact_PrivateDoesNotTriggerCentralizedSync(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p2","name":"phonebook_level_2","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalCreate := createPhonebookEntryFunc
	originalSchedule := scheduleSyncCentralizedPublicContactsFunc
	defer func() {
		createPhonebookEntryFunc = originalCreate
		scheduleSyncCentralizedPublicContactsFunc = originalSchedule
	}()

	createPhonebookEntryFunc = func(context.Context, *store.PhonebookEntry) error { return nil }
	scheduleSyncCentralizedPublicContactsFunc = func() {
		t.Fatalf("centralized sync must not run for a private contact")
	}

	payload := map[string]any{"name": "Alice", "type": "private"}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/create", payload, "alice")

	CreateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusCreated, recorder.Code)
}

func TestDeleteLegacyCTIPhonebookContact_PublicTriggersCentralizedSync(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p2","name":"phonebook_level_2","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalGet := getPhonebookEntryByIDFunc
	originalDelete := deletePhonebookEntryByIDFunc
	originalSchedule := scheduleSyncCentralizedPublicContactsFunc
	defer func() {
		getPhonebookEntryByIDFunc = originalGet
		deletePhonebookEntryByIDFunc = originalDelete
		scheduleSyncCentralizedPublicContactsFunc = originalSchedule
	}()

	getPhonebookEntryByIDFunc = func(context.Context, int64) (*store.PhonebookEntry, error) {
		return &store.PhonebookEntry{ID: 7, OwnerID: "alice", Type: "public", Name: "Alice"}, nil
	}
	deletePhonebookEntryByIDFunc = func(context.Context, int64) error { return nil }
	syncCalls := 0
	scheduleSyncCentralizedPublicContactsFunc = func() {
		syncCalls++
	}

	payload := map[string]any{"id": "7"}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/delete_cticontact", payload, "alice")

	DeleteLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, 1, syncCalls)
}

func TestUpdateLegacyCTIPhonebookContact_PrivateToPublicTriggersCentralizedSync(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p2","name":"phonebook_level_2","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalGet := getPhonebookEntryByIDFunc
	originalUpdate := updatePhonebookEntryFieldsFunc
	originalSchedule := scheduleSyncCentralizedPublicContactsFunc
	defer func() {
		getPhonebookEntryByIDFunc = originalGet
		updatePhonebookEntryFieldsFunc = originalUpdate
		scheduleSyncCentralizedPublicContactsFunc = originalSchedule
	}()

	getPhonebookEntryByIDFunc = func(context.Context, int64) (*store.PhonebookEntry, error) {
		return &store.PhonebookEntry{ID: 5, OwnerID: "alice", Type: "private", Name: "Alice"}, nil
	}
	updatePhonebookEntryFieldsFunc = func(context.Context, int64, map[string]any) error { return nil }
	syncCalls := 0
	scheduleSyncCentralizedPublicContactsFunc = func() {
		syncCalls++
	}

	payload := map[string]any{"id": "5", "type": "public"}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/modify_cticontact", payload, "alice")

	UpdateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, 1, syncCalls)
}

func TestUpdateLegacyCTIPhonebookContact_PublicToPrivateTriggersCentralizedSync(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p2","name":"phonebook_level_2","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalGet := getPhonebookEntryByIDFunc
	originalUpdate := updatePhonebookEntryFieldsFunc
	originalSchedule := scheduleSyncCentralizedPublicContactsFunc
	defer func() {
		getPhonebookEntryByIDFunc = originalGet
		updatePhonebookEntryFieldsFunc = originalUpdate
		scheduleSyncCentralizedPublicContactsFunc = originalSchedule
	}()

	getPhonebookEntryByIDFunc = func(context.Context, int64) (*store.PhonebookEntry, error) {
		return &store.PhonebookEntry{ID: 5, OwnerID: "alice", Type: "public", Name: "Alice"}, nil
	}
	updatePhonebookEntryFieldsFunc = func(context.Context, int64, map[string]any) error { return nil }
	syncCalls := 0
	scheduleSyncCentralizedPublicContactsFunc = func() {
		syncCalls++
	}

	payload := map[string]any{"id": "5", "type": "private"}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/modify_cticontact", payload, "alice")

	UpdateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, 1, syncCalls)
}

func TestUpdateLegacyCTIPhonebookContact_PrivateToPrivateDoesNotTriggerCentralizedSync(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadPhonebookTestProfiles(t, `{"p":{"id":"p","name":"P","macro_permissions":{"phonebook":{"value":true,"permissions":[{"id":"p1","name":"phonebook_level_1","value":true}]}}}}`, `{"alice":{"profile_id":"p"}}`)

	originalGet := getPhonebookEntryByIDFunc
	originalUpdate := updatePhonebookEntryFieldsFunc
	originalSchedule := scheduleSyncCentralizedPublicContactsFunc
	defer func() {
		getPhonebookEntryByIDFunc = originalGet
		updatePhonebookEntryFieldsFunc = originalUpdate
		scheduleSyncCentralizedPublicContactsFunc = originalSchedule
	}()

	getPhonebookEntryByIDFunc = func(context.Context, int64) (*store.PhonebookEntry, error) {
		return &store.PhonebookEntry{ID: 5, OwnerID: "alice", Type: "private", Name: "Alice"}, nil
	}
	updatePhonebookEntryFieldsFunc = func(context.Context, int64, map[string]any) error { return nil }
	scheduleSyncCentralizedPublicContactsFunc = func() {
		t.Fatalf("centralized sync must not run for a private->private update")
	}

	payload := map[string]any{"id": "5", "name": "Alice Updated"}
	ctx, recorder := newLegacyPhonebookTestContext(http.MethodPost, "/phonebook/modify_cticontact", payload, "alice")

	UpdateLegacyCTIPhonebookContact(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
}
