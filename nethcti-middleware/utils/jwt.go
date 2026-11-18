/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package utils

import (
	jwtv5 "github.com/golang-jwt/jwt/v5"
)

// OTPPending reports whether the claims belong to a token of a user with 2FA
// enabled whose OTP has not been verified yet.
func OTPPending(claims map[string]interface{}) bool {
	has2FA, _ := claims["2fa"].(bool)
	otpVerified, _ := claims["otp_verified"].(bool)
	return has2FA && !otpVerified
}

// ParseUserJWT validates a user JWT (HS256 signature with secret and
// expiration) and returns its claims.
func ParseUserJWT(tokenString, secret string) (jwtv5.MapClaims, error) {
	claims := jwtv5.MapClaims{}
	_, err := jwtv5.ParseWithClaims(tokenString, claims, func(token *jwtv5.Token) (interface{}, error) {
		return []byte(secret), nil
	}, jwtv5.WithValidMethods([]string{jwtv5.SigningMethodHS256.Alg()}))
	if err != nil {
		return nil, err
	}
	return claims, nil
}
