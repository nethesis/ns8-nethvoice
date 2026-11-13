/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package models

type UserSession struct {
	Username     string
	JWTTokens    []string
	NethCTIToken string
	OTP_Verified bool
}

type OTPJson struct {
	Username string `json:"username" structs:"username"`
	OTP      string `json:"otp" structs:"otp"`
}

type LoginJson struct {
	Username string `json:"username" structs:"username"`
	Password string `json:"password" structs:"password"`
}
