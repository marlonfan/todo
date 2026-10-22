package utils

import (
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	Purpose  string `json:"purpose,omitempty"`
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// GenerateToken generates a new JWT token
func GenerateToken(userID int64, username string, secret string, expire time.Duration) (string, error) {
	claims := Claims{
		Purpose:  "access",
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expire)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ParseToken parses and validates an application access token.
func ParseToken(tokenString string, secret string) (*Claims, error) {
	return parseToken(tokenString, secret, false)
}

// ParseTokenWithoutTimeValidation validates the signature and identity, but skips
// exp/nbf checks. The caller must enforce the refresh window and not-before time.
func ParseTokenWithoutTimeValidation(tokenString string, secret string) (*Claims, error) {
	return parseToken(tokenString, secret, true)
}

func parseToken(tokenString, secret string, skipTimeValidation bool) (*Claims, error) {
	options := []jwt.ParserOption{
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
	}
	if skipTimeValidation {
		options = append(options, jwt.WithoutClaimsValidation())
	}
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	}, options...)
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || claims == nil || !token.Valid || claims.UserID <= 0 || strings.TrimSpace(claims.Username) == "" || claims.ExpiresAt == nil {
		return nil, errors.New("invalid token claims")
	}
	// Older access tokens have no purpose. Feed tokens must never grant API access,
	// even if a future feed format adds an expiry.
	if claims.Purpose != "" && claims.Purpose != "access" {
		return nil, errors.New("invalid token purpose")
	}
	return claims, nil
}
