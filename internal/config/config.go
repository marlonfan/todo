package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	JWT      JWTConfig      `yaml:"jwt"`
	Notify   NotifyConfig   `yaml:"notify"`
	Caldav   CaldavConfig   `yaml:"caldav"`
	Plugins  PluginsConfig  `yaml:"plugins"`
}

type ServerConfig struct {
	Port int    `yaml:"port"`
	Host string `yaml:"host"`
}

type DatabaseConfig struct {
	Driver string `yaml:"driver"`
	DSN    string `yaml:"dsn"`
}

type JWTConfig struct {
	Secret string        `yaml:"secret"`
	Expire time.Duration `yaml:"expire"`
}

type NotifyConfig struct {
	CheckInterval time.Duration `yaml:"check_interval"`
}

type CaldavConfig struct {
	CheckInterval time.Duration `yaml:"check_interval"`
}

type PluginsConfig struct {
	Telegram TelegramConfig `yaml:"telegram"`
	Ntfy     NtfyConfig     `yaml:"ntfy"`
	Webhook  WebhookConfig  `yaml:"webhook"`
}

type TelegramConfig struct {
	Enabled bool `yaml:"enabled"`
}

type NtfyConfig struct {
	Enabled bool `yaml:"enabled"`
}

type WebhookConfig struct {
	Enabled bool `yaml:"enabled"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Set defaults
	if cfg.Server.Port == 0 {
		cfg.Server.Port = 8080
	}
	if cfg.Server.Host == "" {
		cfg.Server.Host = "0.0.0.0"
	}
	if cfg.JWT.Secret == "" {
		cfg.JWT.Secret = "default-secret-change-in-production"
	}
	if cfg.JWT.Expire == 0 {
		cfg.JWT.Expire = 180 * 24 * time.Hour
	}
	if cfg.Notify.CheckInterval == 0 {
		cfg.Notify.CheckInterval = 60 * time.Second
	}
	if cfg.Caldav.CheckInterval == 0 {
		cfg.Caldav.CheckInterval = 15 * time.Minute
	}

	return &cfg, nil
}

func Default() *Config {
	return &Config{
		Server: ServerConfig{
			Port: 8080,
			Host: "0.0.0.0",
		},
		Database: DatabaseConfig{
			Driver: "sqlite",
			DSN:    "todo.db",
		},
		JWT: JWTConfig{
			Secret: "default-secret-change-in-production",
			Expire: 180 * 24 * time.Hour,
		},
		Notify: NotifyConfig{
			CheckInterval: 60 * time.Second,
		},
		Caldav: CaldavConfig{
			CheckInterval: 15 * time.Minute,
		},
		Plugins: PluginsConfig{
			Telegram: TelegramConfig{Enabled: true},
			Ntfy:     NtfyConfig{Enabled: true},
			Webhook:  WebhookConfig{Enabled: true},
		},
	}
}
