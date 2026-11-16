// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TFunction } from 'i18next'
import { decodeJWT } from './jwt'
import { PasswordPolicy } from '../services/types/password'

/**
 * Days before the expiration when the user is warned
 */
export const PASSWORD_EXPIRATION_WARNING_DAYS = 7

/**
 * Password management is not available when the login is delegated to an
 * external identity provider
 */
export const isSsoAuthentication = (config?: any) => {
  const cfg: any = config || (typeof window !== 'undefined' && (window as any).CONFIG) || {}
  return ['saml2', 'oidc'].includes(cfg.AUTHENTICATION_METHOD)
}

/**
 * Calendar days left before the password expiration: zero when it expires
 * today, negative when expired
 */
export const getPasswordDaysLeft = (expiration: string | null) => {
  if (!expiration) {
    return null
  }
  const expiry = new Date(expiration)
  if (isNaN(expiry.getTime())) {
    return null
  }
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  // rounded: a day is not always 24 hours long with the daylight saving time
  return Math.round((startOfDay(expiry) - startOfDay(new Date())) / (24 * 60 * 60 * 1000))
}

/**
 * End of the login session, read from the JWT: the session lasts a fixed time
 * after the login, also when the password expires in the meantime
 */
export const getSessionExpiration = (token: string) => {
  const exp = token ? decodeJWT(token)?.exp : null
  return typeof exp === 'number' ? new Date(exp * 1000) : null
}

/**
 * Title of the warning about a password that is about to expire
 */
export const getPasswordExpiringTitle = (t: TFunction, daysLeft: number) => {
  if (daysLeft <= 0) {
    return t('Password.Your password expires today')
  }
  return t('Password.Your password expires in {{count}} days', { count: daysLeft })
}

// character classes of the NS8 account providers complexity check
const PASSWORD_CLASSES = [
  { label: 'Password.At least one uppercase (A-Z)', pattern: /[A-Z]/ },
  { label: 'Password.At least one lowercase (a-z)', pattern: /[a-z]/ },
  { label: 'Password.At least one number (0-9)', pattern: /[0-9]/ },
  { label: 'Password.At least one special character (!@#^&_?-)', pattern: /[^A-Za-z0-9]/ },
]

/**
 * Character classes required by the complexity check: the NS8 account
 * providers (OpenLDAP and Samba) accept a password with 3 classes out of 4
 */
export const PASSWORD_REQUIRED_CLASSES = 3

export interface PasswordRequirement {
  label: string
  met: boolean
}

export interface PasswordRequirements {
  length: PasswordRequirement | null
  // empty when the complexity check is disabled
  classes: PasswordRequirement[]
  valid: boolean
}

/**
 * Requirements of the password policy and whether the password meets them
 */
export const getPasswordRequirements = (
  t: TFunction,
  policy: PasswordPolicy | null,
  password: string,
): PasswordRequirements => {
  const strength = policy?.strength?.enforced ? policy.strength : null
  const minLength = strength?.password_min_length || 0
  const length =
    minLength > 0
      ? {
          label: t('Password.Minimum {{count}} characters', { count: minLength }),
          met: password.length >= minLength,
        }
      : null
  const classes = strength?.complexity_check
    ? PASSWORD_CLASSES.map((c) => ({ label: t(c.label), met: c.pattern.test(password) }))
    : []
  const metClasses = classes.filter((c) => c.met).length

  return {
    length,
    classes,
    valid:
      password !== '' &&
      (length?.met ?? true) &&
      (classes.length === 0 || metClasses >= PASSWORD_REQUIRED_CLASSES),
  }
}

export type PasswordErrorField = 'current' | 'new' | 'form'

/**
 * Where to show an error message returned by the middleware, and its text
 */
export const getPasswordError = (
  t: TFunction,
  message: string,
): { field: PasswordErrorField; text: string } => {
  switch (message) {
    case 'error_invalid_credentials':
      return { field: 'current', text: t('Password.The current password is wrong') }
    case 'error_password_complexity':
    case 'error_password_length':
      return { field: 'new', text: t('Password.Choose a password that meets all requirements') }
    case 'error_password_history':
      return { field: 'new', text: t("Password.Choose a password you haven't used before") }
    case 'error_password_minimum_age':
      return {
        field: 'form',
        text: t('Password.The password was changed too recently, try again later'),
      }
    case 'password_not_expired':
      return { field: 'form', text: t('Password.Your password is no longer expired') }
    case 'password_change_unavailable':
      return { field: 'form', text: t('Password.Password change is not available right now') }
    default:
      return {
        field: 'form',
        text: t('Password.Something went wrong. Try again or contact your administrator.'),
      }
  }
}
