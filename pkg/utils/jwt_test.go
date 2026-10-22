package utils

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestTokenValidationContract(t *testing.T) {
	now := time.Now()
	for _, tc := range []struct {
		name         string
		method       jwt.SigningMethod
		claims       Claims
		secret       string
		valid        bool
		refreshValid bool
	}{
		{"valid", jwt.SigningMethodHS256, Claims{UserID: 1, Username: "user", RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour))}}, "secret", true, true},
		{"expired", jwt.SigningMethodHS256, Claims{UserID: 1, Username: "user", RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(now.Add(-time.Hour))}}, "secret", false, true},
		{"feed with expiry", jwt.SigningMethodHS256, Claims{Purpose: "calendar_feed", UserID: 1, Username: "user", RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour))}}, "secret", false, false},
		{"missing expiry", jwt.SigningMethodHS256, Claims{UserID: 1, Username: "user"}, "secret", false, false},
		{"zero user", jwt.SigningMethodHS256, Claims{Username: "user", RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour))}}, "secret", false, false},
		{"negative user", jwt.SigningMethodHS256, Claims{UserID: -1, Username: "user", RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour))}}, "secret", false, false},
		{"blank username", jwt.SigningMethodHS256, Claims{UserID: 1, Username: " ", RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour))}}, "secret", false, false},
		{"other algorithm", jwt.SigningMethodHS512, Claims{UserID: 1, Username: "user", RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour))}}, "secret", false, false},
		{"wrong secret", jwt.SigningMethodHS256, Claims{UserID: 1, Username: "user", RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour))}}, "wrong", false, false},
		{"future nbf", jwt.SigningMethodHS256, Claims{UserID: 1, Username: "user", RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)), NotBefore: jwt.NewNumericDate(now.Add(time.Minute))}}, "secret", false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			raw, err := jwt.NewWithClaims(tc.method, tc.claims).SignedString([]byte(tc.secret))
			if err != nil {
				t.Fatal(err)
			}
			_, err = ParseToken(raw, "secret")
			if (err == nil) != tc.valid {
				t.Errorf("ParseToken accepted=%v, want %v; err=%v", err == nil, tc.valid, err)
			}
			_, err = ParseTokenWithoutTimeValidation(raw, "secret")
			if (err == nil) != tc.refreshValid {
				t.Errorf("refresh signature validation accepted=%v, want %v; err=%v", err == nil, tc.refreshValid, err)
			}
		})
	}
}

func TestGeneratedTokenRemainsValid(t *testing.T) {
	raw, err := GenerateToken(42, "user", "secret", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := ParseToken(raw, "secret")
	if err != nil {
		t.Fatal(err)
	}
	if claims.UserID != 42 || claims.Username != "user" {
		t.Fatalf("unexpected identity: %+v", claims)
	}
}
