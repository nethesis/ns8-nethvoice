// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Provides the keys of an union as type
 */

export type KeysOfUnion<T> = T extends T ? keyof T : never

/**
 * The error type
 */

export type ErrorType = {
  error: boolean
  message: string
}

export type RadioButtonType = {
  value: string
  label: string
}
