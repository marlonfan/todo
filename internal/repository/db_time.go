package repository

import (
	"database/sql/driver"
	"fmt"
	"time"
)

type nullableDBTime struct {
	Time  time.Time
	Valid bool
}

func (value nullableDBTime) Value() (driver.Value, error) {
	if !value.Valid {
		return nil, nil
	}
	return value.Time, nil
}

func (value *nullableDBTime) Scan(input any) error {
	value.Time = time.Time{}
	value.Valid = false

	switch typed := input.(type) {
	case nil:
		return nil
	case time.Time:
		value.Time = typed
		value.Valid = true
		return nil
	case string:
		return value.scanString(typed)
	case []byte:
		return value.scanString(string(typed))
	default:
		return fmt.Errorf("unsupported database time type %T", input)
	}
}

func (value *nullableDBTime) scanString(input string) error {
	for _, layout := range databaseTimeLayouts {
		parsed, err := time.Parse(layout, input)
		if err == nil {
			value.Time = parsed
			value.Valid = true
			return nil
		}
	}
	return fmt.Errorf("unsupported database time value %q", input)
}

var databaseTimeLayouts = []string{
	time.RFC3339Nano,
	"2006-01-02 15:04:05.999999999Z07:00",
	"2006-01-02T15:04:05.999999999Z07:00",
	"2006-01-02 15:04:05.999999999",
	"2006-01-02T15:04:05.999999999",
	"2006-01-02 15:04:05",
	"2006-01-02T15:04:05",
	"2006-01-02",
}
