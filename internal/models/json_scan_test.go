package models

import (
	"github.com/jackc/pgx/v5/pgtype"
	"testing"
)

func TestJSONScannersAcceptDatabaseRepresentations(t *testing.T) {
	for _, representation := range []string{"bytes", "string", "postgres"} {
		t.Run(representation, func(t *testing.T) {
			for _, c := range []struct {
				raw  string
				scan func(any) error
			}{
				{"{\"freq\":\"daily\"}", new(RecurrenceRule).Scan},
				{"{\"topic\":\"test\"}", new(NotifyConfigMap).Scan},
			} {
				var value any = []byte(c.raw)
				if representation == "string" {
					value = c.raw
				}
				if representation == "postgres" {
					var err error
					value, err = (pgtype.TextCodec{}).DecodeDatabaseSQLValue(pgtype.NewMap(), pgtype.TextOID, pgtype.TextFormatCode, []byte(c.raw))
					if err != nil {
						t.Fatal(err)
					}
				}
				if err := c.scan(value); err != nil {
					t.Fatal(err)
				}
			}
		})
	}
	rule := RecurrenceRule{Freq: "daily"}
	config := NotifyConfigMap{"topic": "old"}
	if err := rule.Scan(nil); err != nil || rule.Freq != "" {
		t.Fatal("nil must reset recurrence", err)
	}
	if err := config.Scan(nil); err != nil || config != nil {
		t.Fatal("nil must reset notification config", err)
	}
	if err := rule.Scan(42); err == nil {
		t.Fatal("invalid database type accepted")
	}
	if err := config.Scan("invalid json"); err == nil {
		t.Fatal("invalid JSON accepted")
	}
}
