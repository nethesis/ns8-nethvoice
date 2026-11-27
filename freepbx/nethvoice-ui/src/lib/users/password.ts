//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export const PASSWORD_MIN_LENGTH = 8

export type PasswordRuleKey = 'min_length' | 'uppercase' | 'lowercase' | 'number' | 'special'

export const PASSWORD_RULES: { key: PasswordRuleKey; validate: (password: string) => boolean }[] = [
  { key: 'min_length', validate: (password) => password.length >= PASSWORD_MIN_LENGTH },
  { key: 'uppercase', validate: (password) => /[A-Z]/.test(password) },
  { key: 'lowercase', validate: (password) => /[a-z]/.test(password) },
  { key: 'number', validate: (password) => /[0-9]/.test(password) },
  { key: 'special', validate: (password) => /[^A-Za-z0-9\s]/.test(password) },
]

export const isValidPassword = (password: string): boolean =>
  PASSWORD_RULES.every((rule) => rule.validate(password))
