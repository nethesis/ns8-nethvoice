/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	jwtv5 "github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/middleware"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
	"github.com/nethesis/nethcti-middleware/utils"
)

// Global variables for test server URLs and mock server
var testServerURL string
var mockNetCTI *httptest.Server
var restoreBatchInsert func()

// TestMain sets up the test environment once for all tests
func TestMain(m *testing.M) {
	// Setup test environment and dependencies
	setupTestEnvironment()

	// Run all tests
	code := m.Run()

	// Cleanup after all tests
	cleanupTestEnvironment()

	// Exit with the same code as the tests
	os.Exit(code)
}

// Global test setup - starts actual main server once
func setupTestEnvironment() {
	gin.SetMode(gin.TestMode)

	// Start mock NetCTI server first
	mockNetCTI = mockNetCTIServer()
	mockURL := strings.TrimPrefix(mockNetCTI.URL, "http://")

	// Set environment variables for the middleware
	os.Setenv("NETHVOICE_MIDDLEWARE_LISTEN_ADDRESS", "127.0.0.1:8899")
	os.Setenv("NETHVOICE_MIDDLEWARE_V1_PROTOCOL", "http")
	os.Setenv("NETHVOICE_MIDDLEWARE_V1_API_ENDPOINT", mockURL)
	os.Setenv("NETHVOICE_MIDDLEWARE_V1_WS_ENDPOINT", mockURL)
	os.Setenv("NETHVOICE_MIDDLEWARE_V1_API_PATH", "/webrest")
	os.Setenv("NETHVOICE_MIDDLEWARE_V1_WS_PATH", "/socket.io")
	os.Setenv("NETHVOICE_MIDDLEWARE_SECRETS_DIR", "/tmp/test-secrets/nethcti")
	os.Setenv("NETHVOICE_MIDDLEWARE_ISSUER_2FA", "NetCTI-Test")
	os.Setenv("NETHVOICE_MIDDLEWARE_SENSITIVE_LIST", "password,secret")

	// Set database environment variables for testing
	os.Setenv("NETHVOICE_MIDDLEWARE_MARIADB_HOST", "127.0.0.1")
	os.Setenv("NETHVOICE_MIDDLEWARE_MARIADB_PORT", "3306")
	os.Setenv("NETHVOICE_MIDDLEWARE_MARIADB_USER", "root")
	os.Setenv("NETHVOICE_MIDDLEWARE_MARIADB_PASSWORD", "root")
	os.Setenv("NETHVOICE_MIDDLEWARE_MARIADB_DATABASE", "nethcti3")
	// Create test secrets directory
	os.MkdirAll(os.Getenv("NETHVOICE_MIDDLEWARE_SECRETS_DIR"), 0700)

	restoreBatchInsert = store.SetBatchInsertPhonebookEntriesFuncForTest(func(_ context.Context, entries []*store.PhonebookEntry) (int, int, error) {
		if len(entries) == 0 {
			return 0, 0, nil
		}
		return len(entries), 0, nil
	})

	// Start the actual main server in a goroutine
	go func() {
		main()
	}()

	// Set test server URL
	testServerURL = "http://127.0.0.1:8899"

	// Wait for server to fully start
	if err := waitForServer(testServerURL, 35*time.Second); err != nil {
		_, _ = os.Stderr.WriteString("test server failed to start: " + err.Error() + "\n")
		os.Exit(1)
	}
}

func waitForServer(url string, timeout time.Duration) error {
	address := strings.TrimPrefix(url, "http://")
	address = strings.TrimPrefix(address, "https://")
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", address, 300*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return nil
		}
		time.Sleep(250 * time.Millisecond)
	}
	return fmt.Errorf("timeout waiting for %s", address)
}

// Mock NetCTI server for testing
func mockNetCTIServer() *httptest.Server {
	// This mock server simulates the NetCTI backend for authentication and user info
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/webrest/authentication/login":
			var loginData map[string]string
			json.NewDecoder(r.Body).Decode(&loginData)

			// Simulate Digest authentication challenge for correct credentials
			if loginData["username"] == "testuser" && loginData["password"] == "testpass" {
				w.Header().Set("Www-Authenticate", `Digest realm="test", nonce="test123", qop="auth"`)
				w.WriteHeader(http.StatusUnauthorized)
			} else {
				w.WriteHeader(http.StatusUnauthorized)
			}
		case "/webrest/user/me":
			auth := r.Header.Get("Authorization")
			if strings.Contains(auth, "testuser") {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`{"username": "testuser"}`))
			} else {
				w.WriteHeader(http.StatusUnauthorized)
			}
		case "/webrest/authentication/phone_island_token_login":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"token": "phone-island-token"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

// Global cleanup test data
func cleanupTestEnvironment() {
	if mockNetCTI != nil {
		mockNetCTI.Close()
	}
	if restoreBatchInsert != nil {
		restoreBatchInsert()
	}
	os.RemoveAll(os.Getenv("NETHVOICE_MIDDLEWARE_SECRETS_DIR"))

	// Clear environment variables
	os.Unsetenv("NETHVOICE_MIDDLEWARE_LISTEN_ADDRESS")
	os.Unsetenv("NETHVOICE_MIDDLEWARE_V1_PROTOCOL")
	os.Unsetenv("NETHVOICE_MIDDLEWARE_V1_API_ENDPOINT")
	os.Unsetenv("NETHVOICE_MIDDLEWARE_V1_API_PATH")
	os.Unsetenv("NETHVOICE_MIDDLEWARE_V1_WS_PATH")
	os.Unsetenv("NETHVOICE_MIDDLEWARE_SECRETS_DIR")
	os.Unsetenv("NETHVOICE_MIDDLEWARE_ISSUER_2FA")
	os.Unsetenv("NETHVOICE_MIDDLEWARE_SENSITIVE_LIST")
}

// Helper function to reset test state between tests
func resetTestState() {
	// Clear user sessions and test files to ensure isolation between tests
	store.UserSessions = make(map[string]*models.UserSession)

	// Clean up any test files
	os.RemoveAll(os.Getenv("NETHVOICE_MIDDLEWARE_SECRETS_DIR"))
	os.MkdirAll(os.Getenv("NETHVOICE_MIDDLEWARE_SECRETS_DIR"), 0700)
}

// Test login endpoint
func TestLogin(t *testing.T) {
	resetTestState()

	loginData := map[string]string{
		"username": "testuser",
		"password": "testpass",
	}
	jsonData, _ := json.Marshal(loginData)

	resp, err := http.Post(testServerURL+"/login", "application/json", bytes.NewBuffer(jsonData))
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, float64(200), response["code"])
	assert.NotEmpty(t, response["token"])
}

// Test logout endpoint
func TestLogout(t *testing.T) {
	resetTestState()

	token := utils.PerformLogin(testServerURL)

	client := &http.Client{}
	req, _ := http.NewRequest("POST", testServerURL+"/logout", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestCreateRouter_IncludesLegacyPhonebookTrailingSlashRoutes(t *testing.T) {
	router := createRouter()
	routes := router.Routes()
	expectedRoutes := map[string]bool{
		"GET /phonebook/search/":      false,
		"GET /phonebook/search/:term/": false,
		"GET /phonebook/getall/":      false,
		"GET /phonebook/getall/:term/": false,
	}

	for _, route := range routes {
		key := route.Method + " " + route.Path
		if _, ok := expectedRoutes[key]; ok {
			expectedRoutes[key] = true
		}
	}

	for routeKey, found := range expectedRoutes {
		assert.True(t, found, "expected route %s to be registered", routeKey)
	}
}

// Test 2FA QR code generation
func TestQRCode(t *testing.T) {
	resetTestState()

	token := utils.PerformLogin(testServerURL)

	client := &http.Client{}
	req, _ := http.NewRequest("GET", testServerURL+"/2fa/qr-code", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)

	data := response["data"].(map[string]interface{})
	assert.NotEmpty(t, data["url"])
	assert.NotEmpty(t, data["key"])
}

// Test 2FA status check
func Test2FAStatus(t *testing.T) {
	resetTestState()

	token := utils.PerformLogin(testServerURL)

	client := &http.Client{}
	req, _ := http.NewRequest("GET", testServerURL+"/2fa/status", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.False(t, response["status"].(bool))
}

// Test OTP verification
func TestOTPVerify(t *testing.T) {
	resetTestState()

	token := utils.PerformLogin(testServerURL)
	otpSecret := utils.Setup2FA(testServerURL, token, t)
	otp := utils.GenerateOTP(otpSecret)

	otpData := map[string]string{
		"username": "testuser",
		"otp":      otp,
	}
	jsonData, _ := json.Marshal(otpData)

	client := &http.Client{}
	req, _ := http.NewRequest("POST", testServerURL+"/2fa/verify-otp", bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// Test recovery codes generation
func TestRecoveryCodes(t *testing.T) {
	resetTestState()

	token := utils.PerformLogin(testServerURL)
	otpSecret := utils.Setup2FA(testServerURL, token, t)
	otp := utils.GenerateOTP(otpSecret)
	token = utils.Verify2FA(testServerURL, otp, token, t)

	recoveryCodes := map[string]string{
		"password": "testpass",
	}
	jsonData, _ := json.Marshal(recoveryCodes)

	client := &http.Client{}
	req, _ := http.NewRequest("POST", testServerURL+"/2fa/recovery-codes", bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)

	codes := response["codes"].([]interface{})
	assert.Greater(t, len(codes), 0)
}

// Test 2FA disable
func TestDisable2FA(t *testing.T) {
	resetTestState()

	token := utils.PerformLogin(testServerURL)
	otpSecret := utils.Setup2FA(testServerURL, token, t)
	otp := utils.GenerateOTP(otpSecret)
	token = utils.Verify2FA(testServerURL, otp, token, t)

	disableData := map[string]string{
		"password": "testpass",
	}
	jsonData, _ := json.Marshal(disableData)

	client := &http.Client{}
	req, _ := http.NewRequest("POST", testServerURL+"/2fa/disable", bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// ** Phonebook Import Admin Endpoint Tests **

// Helper function to create a multipart request with CSV file and username
func createPhonebookImportRequest(username, csvData string) (*http.Request, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add username field
	if username != "" {
		writer.WriteField("username", username)
	}

	// Add CSV file
	part, err := writer.CreateFormFile("file", "phonebook.csv")
	if err != nil {
		return nil, err
	}

	io.WriteString(part, csvData)
	writer.Close()

	req, err := http.NewRequest("POST", testServerURL+"/admin/phonebook/import", body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req, nil
}

// TestAdminPhonebookImportWithValidTokenAndIP tests successful import with valid super admin credentials
func TestAdminPhonebookImportWithValidTokenAndIP(t *testing.T) {
	resetTestState()

	// Set up super admin configuration
	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	csvData := `name,workemail,workphone
John Doe,john@example.com,5551234
Jane Smith,jane@example.com,5555678`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	// Should be accepted by middleware and processed
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&response)

	// Should contain import response fields
	assert.Contains(t, response, "total_rows")
	assert.Contains(t, response, "message")
	assert.Contains(t, response, "imported_rows")
	assert.Contains(t, response, "failed_rows")
	assert.Contains(t, response, "skipped_rows")
}

// TestAdminPhonebookImportWithInvalidToken tests rejection with invalid super admin token
func TestAdminPhonebookImportWithInvalidToken(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	csvData := `name,workemail
John Doe,john@example.com`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	req.Header.Set("Authorization", "Bearer wrong-token")
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	// Should be rejected by middleware
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	respBody, _ := io.ReadAll(resp.Body)
	assert.Contains(t, string(respBody), "authentication required")
}

// TestAdminPhonebookImportWithoutToken tests rejection when no token is provided
func TestAdminPhonebookImportWithoutToken(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	csvData := `name,workemail
John Doe,john@example.com`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	// No Authorization header
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	// Should be rejected by middleware
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

// TestAdminPhonebookImportWithInvalidIPAddress tests rejection from non-allowed IP
func TestAdminPhonebookImportWithInvalidIPAddress(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"192.168.1.0/24"}

	csvData := `name,workemail
John Doe,john@example.com`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "10.0.0.1:12345" // Not in allowed IP range

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	// Should be rejected by middleware due to IP
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	respBody, _ := io.ReadAll(resp.Body)
	assert.Contains(t, string(respBody), "IP not in allowed list")
}

// TestAdminPhonebookImportWithCIDRAllowedIP tests access from IP within CIDR range
func TestAdminPhonebookImportWithCIDRAllowedIP(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	// Use 127.0.0.0/8 CIDR since httptest uses 127.0.0.1 by default
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.0/8", "10.0.0.0/8"}

	csvData := `name,workemail,workphone
John Doe,john@example.com,5551234`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "127.0.0.1:12345" // Within CIDR range

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	// Should be allowed through
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// TestAdminPhonebookImportWithoutFile tests rejection when file is missing
func TestAdminPhonebookImportWithoutFile(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.WriteField("username", "testuser")
	writer.Close()

	req, _ := http.NewRequest("POST", testServerURL+"/admin/phonebook/import", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	// Should return error about missing file
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	respBody, _ := io.ReadAll(resp.Body)
	assert.Contains(t, string(respBody), "file required")
}

// TestAdminPhonebookImportWithoutUsername tests rejection when username field is missing
func TestAdminPhonebookImportWithoutUsername(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	csvData := `name,workemail
John Doe,john@example.com`

	buf := &bytes.Buffer{}
	writer := multipart.NewWriter(buf)

	part, _ := writer.CreateFormFile("file", "phonebook.csv")
	io.WriteString(part, csvData)
	writer.Close()

	req, _ := http.NewRequest("POST", testServerURL+"/admin/phonebook/import", buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	// Should return error about missing username
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	respBody, _ := io.ReadAll(resp.Body)
	assert.Contains(t, string(respBody), "username field is required")
}

// TestAdminPhonebookImportInvalidCSVFormat tests rejection with invalid CSV format
func TestAdminPhonebookImportInvalidCSVFormat(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	// CSV without required 'name' column
	csvData := `workemail,workphone
john@example.com,5551234`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	// Should return error about missing 'name' column
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	respBody, _ := io.ReadAll(resp.Body)
	assert.Contains(t, string(respBody), "must have 'name' column")
}

// TestAdminPhonebookImportWithMultipleRows tests successful import of multiple contacts
func TestAdminPhonebookImportWithMultipleRows(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	csvData := `name,workemail,workphone,title,company
John Doe,john@example.com,5551234,Manager,Acme Corp
Jane Smith,jane@example.com,5555678,Engineer,Tech Inc
Bob Johnson,bob@example.com,5559999,Developer,Dev Co`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&response)

	// Should report 3 total rows
	assert.Equal(t, float64(3), response["total_rows"].(float64))
	assert.Contains(t, response["message"], "completed")
}

// TestAdminPhonebookImportCSVWithSpecialCharacters tests handling of special characters
func TestAdminPhonebookImportCSVWithSpecialCharacters(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	csvData := `name,company,notes
José García,Acme & Corp,"Note with, comma"
François Müller,Société Générale,Café`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&response)

	assert.Equal(t, float64(2), response["total_rows"].(float64))
}

// TestAdminPhonebookImportResponseFormat tests that response contains all required fields
func TestAdminPhonebookImportResponseFormat(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	csvData := `name,workemail
John Doe,john@example.com`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)

	// Verify all required fields are present in response
	assert.Contains(t, response, "message")
	assert.Contains(t, response, "total_rows")
	assert.Contains(t, response, "imported_rows")
	assert.Contains(t, response, "failed_rows")
	assert.Contains(t, response, "skipped_rows")
}

// TestAdminPhonebookImportWithMixedCaseHeaders tests case-insensitive column headers
func TestAdminPhonebookImportWithMixedCaseHeaders(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	// Mixed case headers
	csvData := `NAME,WorkEmail,WORKPHONE,Title
John Doe,john@example.com,5551234,Manager`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&response)

	// Should parse successfully even with mixed case headers
	assert.Equal(t, float64(1), response["total_rows"].(float64))
}

// TestAdminPhonebookImportWithValidTypes tests valid type values (private/public/group)
func TestAdminPhonebookImportWithValidTypes(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	csvData := `name,type,workemail
John Doe,private,john@example.com
Jane Smith,public,jane@example.com
Ops Team,"group:Sales,Support",ops@example.com
Bob Johnson,,bob@example.com`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&response)

	// All 4 rows should be parsed (empty type defaults to 'private')
	assert.Equal(t, float64(4), response["total_rows"].(float64))
}

// TestAdminPhonebookImportWithInvalidType tests rejection of invalid type values
func TestAdminPhonebookImportWithInvalidType(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	csvData := `name,type,workemail
John Doe,invalid_type,john@example.com`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	// Should return 400 when all rows are skipped due to invalid type
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	var response map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&response)

	// Should report 1 row that was skipped due to invalid type
	assert.Greater(t, response["skipped_rows"].(float64), float64(0))
}

// TestAdminPhonebookImportWithEmptyNames tests skipping rows with empty name field
func TestAdminPhonebookImportWithEmptyNames(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	csvData := `name,workemail,workphone
John Doe,john@example.com,5551234
,jane@example.com,5555678
Jane Smith,jane2@example.com,5555679`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&response)

	// Should have 2 total rows parsed, 1 skipped (empty name)
	assert.Equal(t, float64(3), response["total_rows"].(float64))
	assert.Greater(t, response["skipped_rows"].(float64), float64(0))
}

// TestAdminPhonebookImportWithAllFields tests CSV with all possible fields
func TestAdminPhonebookImportWithAllFields(t *testing.T) {
	resetTestState()

	configuration.Config.SuperAdminToken = "test-super-admin-token"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	csvData := `name,type,workemail,homeemail,workphone,homephone,cellphone,fax,title,company,notes,homestreet,homepob,homecity,homeprovince,homepostalcode,homecountry,workstreet,workpob,workcity,workprovince,workpostalcode,workcountry,url,extension,speeddial_num
John Doe,private,john@work.com,john@home.com,555-1234,555-1111,555-9999,555-2222,Manager,Acme Corp,Senior manager,123 Home St,PO123,HomeCity,HP,12345,HomeCountry,456 Work Ave,PO456,WorkCity,WP,54321,WorkCountry,https://example.com,1001,101`

	req, _ := createPhonebookImportRequest("testuser", csvData)
	req.Header.Set("Authorization", "Bearer test-super-admin-token")
	req.RemoteAddr = "127.0.0.1:12345"

	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var response map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&response)

	assert.Equal(t, float64(1), response["total_rows"].(float64))
}

// ** End of Phonebook Import Admin Endpoint Tests **

// ** User Phonebook Import Endpoint Tests **

// writeTempFileForTest helper to write test files
func writeTempFileForTest(t *testing.T, name, content string) string {
	t.Helper()
	tmp := t.TempDir()
	p := filepath.Join(tmp, name)
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}
	return p
}

// generateTestJWTWithCapabilities creates a signed JWT for the given username.
func generateTestJWTWithCapabilities(username string) (string, error) {
	// If a user session exists, use middleware PayloadFunc so claims are consistent with runtime auth.
	if sess, ok := store.UserSessions[username]; ok && sess != nil {
		mw := middleware.InstanceJWT()
		// PayloadFunc returns jwt.MapClaims
		payload := mw.PayloadFunc(sess)
		// ensure standard claims
		payload["exp"] = time.Now().Add(time.Hour).Unix()
		payload["iat"] = time.Now().Unix()

		token := jwtv5.NewWithClaims(jwtv5.SigningMethodHS256, jwtv5.MapClaims(payload))
		return token.SignedString([]byte(configuration.Config.Secret_jwt))
	}

	// fallback minimal token
	claims := jwtv5.MapClaims{
		"id":  username,
		"exp": time.Now().Add(time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwtv5.NewWithClaims(jwtv5.SigningMethodHS256, claims)
	return token.SignedString([]byte(configuration.Config.Secret_jwt))
}

// TestImportPhonebookCSV_Capability tests the /phonebook/import/ endpoint with different user permission levels
// - user nopower: no phonebook access → denied (403)
// - user smallpower: phonebook access but no ad_phonebook permission → denied (403)
// - user superpower: phonebook access + ad_phonebook permission → allowed (200)
func TestImportPhonebookCSV_Capability(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Ensure middleware uses test secret
	configuration.Config.Secret_jwt = "test-phonebook-secret"
	// Reset cached middleware to use new secret
	middleware.ResetJWTMiddleware()

	// Initialize store
	store.UserSessionInit()

	// Create test profiles with different capability levels
	profilesJSON := `{
		"nopower_profile": {
			"id": "nopower_profile",
			"name": "NoPhonebookAccess",
			"macro_permissions": {}
		},
		"smallpower_profile": {
			"id": "smallpower_profile",
			"name": "PhonebookReadOnly",
			"macro_permissions": {
				"phonebook": {
					"value": true,
					"permissions": []
				}
			}
		},
		"superpower_profile": {
			"id": "superpower_profile",
			"name": "PhonebookAdmin",
			"macro_permissions": {
				"phonebook": {
					"value": true,
					"permissions": [
						{"id": "12", "name": "ad_phonebook", "value": true}
					]
				}
			}
		}
	}`

	usersJSON := `{
		"nopower": {"profile_id": "nopower_profile"},
		"smallpower": {"profile_id": "smallpower_profile"},
		"superpower": {"profile_id": "superpower_profile"}
	}`

	profFile := writeTempFileForTest(t, "profiles.json", profilesJSON)
	usersFile := writeTempFileForTest(t, "users.json", usersJSON)

	if err := store.InitProfiles(profFile, usersFile); err != nil {
		t.Fatalf("InitProfiles failed: %v", err)
	}

	// Create user sessions for all test users
	store.UserSessions["nopower"] = &models.UserSession{Username: "nopower"}
	store.UserSessions["smallpower"] = &models.UserSession{Username: "smallpower"}
	store.UserSessions["superpower"] = &models.UserSession{Username: "superpower"}

	// Create test CSV content
	csvContent := `name,workemail,cellphone
John Doe,john@example.com,555-1234
Jane Smith,jane@example.com,555-5678`

	// Create router with the /phonebook/import/ endpoint protected by RequireCapabilities
	router := gin.New()
	router.Use(gin.LoggerWithWriter(gin.DefaultWriter), gin.Recovery())

	apiGroup := router.Group("")
	apiGroup.Use(middleware.InstanceJWT().MiddlewareFunc())
	{
		// The phonebook import endpoint requires phonebook.ad_phonebook capability
		apiGroup.POST("/phonebook/import/", middleware.RequireCapabilities("phonebook.ad_phonebook"), func(c *gin.Context) {
			// Mock response for successful import (normally methods.ImportPhonebookCSV)
			c.JSON(http.StatusOK, map[string]interface{}{
				"message":        "phonebook import completed",
				"total_rows":     2,
				"imported_rows":  2,
				"failed_rows":    0,
				"skipped_rows":   0,
				"error_messages": nil,
			})
		})
	}

	// Test Case 1: User with no phonebook access should be denied
	t.Run("nopower_denied", func(t *testing.T) {
		token1, err := generateTestJWTWithCapabilities("nopower")
		assert.NoError(t, err)
		store.UserSessions["nopower"].JWTTokens = []string{token1}

		// Create multipart form with CSV file
		body := new(bytes.Buffer)
		writer := multipart.NewWriter(body)
		part, err := writer.CreateFormFile("file", "contacts.csv")
		assert.NoError(t, err)
		_, err = io.WriteString(part, csvContent)
		assert.NoError(t, err)
		writer.Close()

		req, _ := http.NewRequest("POST", "/phonebook/import/", body)
		req.Header.Set("Authorization", "Bearer "+token1)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Should be denied due to missing phonebook.ad_phonebook capability
		assert.Equal(t, http.StatusForbidden, w.Code, "nopower user should be denied with 403: got %d response %s", w.Code, w.Body.String())
		assert.Contains(t, w.Body.String(), "forbidden: missing capability")
	})

	// Test Case 2: User with phonebook access but without ad_phonebook permission should be denied
	t.Run("smallpower_denied", func(t *testing.T) {
		token2, err := generateTestJWTWithCapabilities("smallpower")
		assert.NoError(t, err)
		store.UserSessions["smallpower"].JWTTokens = []string{token2}

		// Create multipart form with CSV file
		body := new(bytes.Buffer)
		writer := multipart.NewWriter(body)
		part, err := writer.CreateFormFile("file", "contacts.csv")
		assert.NoError(t, err)
		_, err = io.WriteString(part, csvContent)
		assert.NoError(t, err)
		writer.Close()

		req, _ := http.NewRequest("POST", "/phonebook/import/", body)
		req.Header.Set("Authorization", "Bearer "+token2)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Should be denied due to missing ad_phonebook permission
		assert.Equal(t, http.StatusForbidden, w.Code, "smallpower user should be denied with 403: got %d response %s", w.Code, w.Body.String())
		assert.Contains(t, w.Body.String(), "forbidden: missing capability")
	})

	// Test Case 3: User with phonebook and ad_phonebook permission should be allowed
	t.Run("superpower_allowed", func(t *testing.T) {
		token3, err := generateTestJWTWithCapabilities("superpower")
		assert.NoError(t, err)
		store.UserSessions["superpower"].JWTTokens = []string{token3}

		// Create multipart form with CSV file
		body := new(bytes.Buffer)
		writer := multipart.NewWriter(body)
		part, err := writer.CreateFormFile("file", "contacts.csv")
		assert.NoError(t, err)
		_, err = io.WriteString(part, csvContent)
		assert.NoError(t, err)
		writer.Close()

		req, _ := http.NewRequest("POST", "/phonebook/import/", body)
		req.Header.Set("Authorization", "Bearer "+token3)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Should be allowed (capability check passes) and reach the handler
		assert.Equal(t, http.StatusOK, w.Code, "superpower user should be allowed with 200: got %d response %s", w.Code, w.Body.String())
		assert.Contains(t, w.Body.String(), "phonebook import completed")
	})
}

// ** End of User Phonebook Import Endpoint Tests **
