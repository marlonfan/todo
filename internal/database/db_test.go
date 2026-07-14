package database

import (
	"context"
	"fmt"
	"testing"
	"todo-app/internal/config"
)

func TestSQLiteConnectionPragmasApplyAcrossPool(t *testing.T) {
	t.Parallel()
	dsn := fmt.Sprintf("file:db-pragmas-%s?mode=memory&cache=shared", t.Name())
	db, err := NewDB(&config.DatabaseConfig{Driver: "sqlite", DSN: dsn})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	ctx := context.Background()
	connections := make([]interface{ Close() error }, 0, 8)
	for i := 0; i < 8; i++ {
		conn, err := sqlDB.Conn(ctx)
		if err != nil {
			t.Fatal(err)
		}
		connections = append(connections, conn)
		var foreignKeys, busyTimeout int
		if err := conn.QueryRowContext(ctx, "PRAGMA foreign_keys").Scan(&foreignKeys); err != nil {
			t.Fatal(err)
		}
		if err := conn.QueryRowContext(ctx, "PRAGMA busy_timeout").Scan(&busyTimeout); err != nil {
			t.Fatal(err)
		}
		if foreignKeys != 1 || busyTimeout != 10000 {
			t.Fatalf("connection %d has foreign_keys=%d busy_timeout=%d", i, foreignKeys, busyTimeout)
		}
	}
	for _, conn := range connections {
		if err := conn.Close(); err != nil {
			t.Fatal(err)
		}
	}
}
