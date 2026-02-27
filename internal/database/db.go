package database

import (
	"fmt"
	"time"
	"todo-app/internal/config"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func NewDB(cfg *config.DatabaseConfig) (*gorm.DB, error) {
	gormCfg := &gorm.Config{
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	switch cfg.Driver {
	case "sqlite":
		return gorm.Open(sqlite.Open(cfg.DSN), gormCfg)
	case "postgres":
		return gorm.Open(postgres.Open(cfg.DSN), gormCfg)
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", cfg.Driver)
	}
}
