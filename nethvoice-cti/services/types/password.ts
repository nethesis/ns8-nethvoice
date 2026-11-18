// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Password management types
 */

export interface PasswordPolicy {
  expiration: {
    enforced: boolean
    max_age: number
    min_age: number
  }
  strength: {
    enforced: boolean
    history_length: number
    password_min_length: number
    complexity_check: boolean
  }
}

export interface PasswordInfo {
  // password management is available (user portal configured)
  enabled: boolean
  // null when the password never expires or the info is not known yet
  expiration: string | null
  expired: boolean
  policy: PasswordPolicy | null
  // null until the middleware reads the info after the login
  updated_at: string | null
  // true while the middleware reads the info again after a login
  refreshing?: boolean
}
