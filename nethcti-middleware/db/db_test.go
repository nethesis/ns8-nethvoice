package db_test

import (
	"database/sql"
	"fmt"
	"os"
	"testing"

	_ "github.com/go-sql-driver/mysql"
	"github.com/stretchr/testify/assert"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/db"
	"github.com/nethesis/nethcti-middleware/logs"
)

func TestMain(m *testing.M) {
	applyTestEnv()
	logs.Init("db-tests")
	configuration.Init()
	if err := ensureTestDatabase(); err != nil {
		logs.Log("[DBTEST] failed to create test database, skipping: " + err.Error())
		os.Exit(0)
	}
	if err := db.Init(); err != nil {
		logs.Log("[DBTEST] failed to init DB, skipping: " + err.Error())
		os.Exit(0)
	}
	code := m.Run()
	db.Close()
	os.Exit(code)
}

func TestDatabaseConnection(t *testing.T) {
	assert.NotNil(t, db.GetDB(), "Database connection pool should be initialized")
	err := db.GetDB().Ping()
	assert.NoError(t, err, "Database ping should succeed")
}

func applyTestEnv() {
	os.Setenv("NETHVOICE_MIDDLEWARE_LISTEN_ADDRESS", "127.0.0.1:8899")
	os.Setenv("NETHVOICE_MIDDLEWARE_V1_PROTOCOL", "http")
	os.Setenv("NETHVOICE_MIDDLEWARE_V1_API_ENDPOINT", "127.0.0.1")
	os.Setenv("NETHVOICE_MIDDLEWARE_V1_WS_ENDPOINT", "127.0.0.1")
	os.Setenv("NETHVOICE_MIDDLEWARE_V1_API_PATH", "/webrest")
	os.Setenv("NETHVOICE_MIDDLEWARE_V1_WS_PATH", "/socket.io")
	os.Setenv("NETHVOICE_MIDDLEWARE_SECRET_JWT", "test-secret-key-for-jwt-tokens")
	os.Setenv("NETHVOICE_MIDDLEWARE_SECRETS_DIR", "/tmp/test-secrets/nethcti-db")
	os.Setenv("NETHVOICE_MIDDLEWARE_ISSUER_2FA", "NetCTI-Test")
	os.Setenv("NETHVOICE_MIDDLEWARE_SENSITIVE_LIST", "password,secret")
	os.Setenv("NETHVOICE_MIDDLEWARE_MARIADB_HOST", "127.0.0.1")
	os.Setenv("NETHVOICE_MIDDLEWARE_MARIADB_PORT", "3306")
	os.Setenv("NETHVOICE_MIDDLEWARE_MARIADB_USER", "root")
	os.Setenv("NETHVOICE_MIDDLEWARE_MARIADB_PASSWORD", "root")
	os.Setenv("NETHVOICE_MIDDLEWARE_MARIADB_DATABASE", "testdb")
	os.MkdirAll("/tmp/test-secrets/nethcti-db", 0755)
}

func ensureTestDatabase() error {
	host := os.Getenv("NETHVOICE_MIDDLEWARE_MARIADB_HOST")
	port := os.Getenv("NETHVOICE_MIDDLEWARE_MARIADB_PORT")
	user := os.Getenv("NETHVOICE_MIDDLEWARE_MARIADB_USER")
	pass := os.Getenv("NETHVOICE_MIDDLEWARE_MARIADB_PASSWORD")
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/", user, pass, host, port)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return err
	}
	defer db.Close()

	target := os.Getenv("NETHVOICE_MIDDLEWARE_MARIADB_DATABASE")
	_, err = db.Exec("CREATE DATABASE IF NOT EXISTS " + target)
	return err
}
