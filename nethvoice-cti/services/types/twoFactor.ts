// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Two Factor Authentication types
 */

export interface TwoFactorSetupResponse {
  key: string
  url: string
}

export interface TwoFactorStatusResponse {
  status: boolean
}

export interface TwoFactorBackupCodesResponse {
  codes: string[]
}
