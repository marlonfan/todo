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
		db, err := gorm.Open(sqlite.Open(cfg.DSN), gormCfg)
		if err != nil {
			return nil, err
		}
		sqlDB, err := db.DB()
		if err != nil {
			return nil, err
		}
		sqlDB.SetMaxOpenConns(8)
		sqlDB.SetMaxIdleConns(4)
		sqlDB.SetConnMaxLifetime(0)
		if err := db.Exec("PRAGMA journal_mode=WAL;").Error; err != nil {
			return nil, err
		}
		if err := db.Exec("PRAGMA synchronous=NORMAL;").Error; err != nil {
			return nil, err
		}
		if err := db.Exec("PRAGMA busy_timeout=10000;").Error; err != nil {
			return nil, err
		}
		if err := db.Exec("PRAGMA foreign_keys=ON;").Error; err != nil {
			return nil, err
		}
		return db, nil
	case "postgres":
		return gorm.Open(postgres.Open(cfg.DSN), gormCfg)
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", cfg.Driver)
	}
}
