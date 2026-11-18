/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"errors"
	"fmt"
	"os"
	"time"

	jwtv5 "github.com/golang-jwt/jwt/v5"
	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/store"
	"github.com/nethesis/nethcti-middleware/utils"
)

type UserJWTOptions struct {
	Username    string
	OTPVerified bool
	IssuedAt    time.Time
	ExpiresAt   *time.Time
	Audience    string
}

func buildBaseUserJWTClaims(username string, otpVerified bool) jwtv5.MapClaims {
	status, err := GetUserStatus(username)
	enabled2FA := status == "1"
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		// unknown status: require the OTP rather than skip it
		logs.Log(fmt.Sprintf("[ERROR][AUTH] Failed to read the 2FA status of user %s: %v", username, err))
		enabled2FA = true
	}

	claims := jwtv5.MapClaims{
		"id":           username,
		"2fa":          enabled2FA,
		"otp_verified": otpVerified,
	}

	profile, err := store.GetUserProfile(username)
	if err != nil {
		logs.Log(fmt.Sprintf("[WARNING][AUTH] Failed to load profile for user %s: %v", username, err))
		return claims
	}

	claims["profile_id"] = profile.ID
	logs.Log(fmt.Sprintf("[INFO][AUTH] Added profile metadata into JWT claims for user %s (profile: %s)",
		username, profile.Name))

	return claims
}

// BuildUserJWTClaims builds the canonical final JWT claims set for a user.
func BuildUserJWTClaims(opts UserJWTOptions) jwtv5.MapClaims {
	claims := buildBaseUserJWTClaims(opts.Username, opts.OTPVerified)
	claims["iat"] = opts.IssuedAt.Unix()

	if opts.Audience != "" {
		claims["aud"] = opts.Audience
	}
	if opts.ExpiresAt != nil {
		claims["exp"] = opts.ExpiresAt.Unix()
	}

	return claims
}

// IssueUserJWT builds and signs a canonical user JWT in one place.
func IssueUserJWT(opts UserJWTOptions) (jwtv5.MapClaims, string, error) {
	claims := BuildUserJWTClaims(opts)
	token := jwtv5.NewWithClaims(jwtv5.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(configuration.Config.Secret_jwt))
	if err != nil {
		return nil, "", err
	}
	return claims, tokenString, nil
}

// OTPPending reports whether the claims belong to a token of a user with 2FA
// enabled whose OTP has not been verified yet.
func OTPPending(claims map[string]interface{}) bool {
	return utils.OTPPending(claims)
}

// ParseUserJWT validates a user JWT (signature and expiration) and returns its
// claims.
func ParseUserJWT(tokenString string) (jwtv5.MapClaims, error) {
	return utils.ParseUserJWT(tokenString, configuration.Config.Secret_jwt)
}
