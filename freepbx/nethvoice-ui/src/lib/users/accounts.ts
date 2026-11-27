//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { isValidPassword } from '@/lib/users/createUser'

export const USERS_DOMAIN_KEY = 'usersDomain'

export const USER_ACCOUNTS_KEY = 'userAccounts'

export type UsersDomainReason = 'external' | 'unavailable'

export type UsersDomain = {
  manageable: boolean
  reason: UsersDomainReason | null
}

export type AdminAccess = 'superadmin' | 'sections' | 'other_instance'

export type UserAccount = {
  username: string
  displayName: string
  mail: string
  locked: boolean | null
  domainAdmin: boolean | null
  adminAccess: AdminAccess | null
}

export type AccountChanges = {
  display_name?: string
  mail?: string
  locked?: boolean
}

export const ACCOUNT_ERROR_CODES = [
  'invalid_request',
  'protected_account',
  'own_account',
  'domain_admin',
  'domain_not_manageable',
  'domain_unavailable',
  'password_complexity',
  'password_history',
  'password_same',
  'password_rejected',
  'invalid_mail',
  'invalid_display_name',
  'user_not_found',
  'superadmin_account',
  'nethvoice_admin',
  'not_instance_user',
  'display_name_too_long',
] as const

export type AccountErrorCode = (typeof ACCOUNT_ERROR_CODES)[number]

export type AccountRestriction =
  | 'own_account'
  | 'accounts_unavailable'
  | 'domain_admin'
  | 'superadmin_account'
  | 'nethvoice_admin'
  | 'not_instance_user'

export type DeleteAccountResult = {
  synchronized: boolean
  cleaned: boolean
}

const UsersDomainSchema = v.object({
  manageable: v.boolean(),
  reason: v.optional(v.nullable(v.picklist(['external', 'unavailable'])), null),
})

const AccountsSchema = v.array(
  v.object({
    username: v.pipe(v.string(), v.nonEmpty()),
    display_name: v.optional(v.nullable(v.string()), ''),
    mail: v.optional(v.nullable(v.string()), ''),
    locked: v.optional(v.nullable(v.boolean()), null),
    domain_admin: v.optional(v.nullable(v.boolean()), null),
    admin_access: v.optional(
      v.fallback(v.nullable(v.picklist(['superadmin', 'sections', 'other_instance'])), null),
      null,
    ),
  }),
)

const SyncResultSchema = v.object({ synchronized: v.nullable(v.boolean()) })

const DeleteResultSchema = v.object({ synchronized: v.boolean(), cleaned: v.boolean() })

export const parseUsersDomain = (raw: unknown): UsersDomain => {
  const domain = v.parse(UsersDomainSchema, raw)
  return { manageable: domain.manageable, reason: domain.manageable ? null : domain.reason }
}

export const parseUserAccounts = (raw: unknown): UserAccount[] =>
  v.parse(AccountsSchema, raw).map((account) => ({
    username: account.username,
    displayName: account.display_name ?? '',
    mail: account.mail ?? '',
    locked: account.locked,
    domainAdmin: account.domain_admin,
    adminAccess: account.admin_access,
  }))

export const parseSyncResult = (raw: unknown): boolean | null => {
  const result = v.safeParse(SyncResultSchema, raw)
  return result.success ? result.output.synchronized : false
}

export const parseDeleteResult = (raw: unknown): DeleteAccountResult => {
  const result = v.safeParse(DeleteResultSchema, raw)
  return result.success ? result.output : { synchronized: false, cleaned: false }
}

export const getUsersDomain = async (): Promise<UsersDomain> => {
  const { data } = await api.GET('/users/domain')
  return parseUsersDomain(data)
}

export const getUserAccounts = async (): Promise<UserAccount[]> => {
  const { data } = await api.GET('/users/domain/accounts')
  return parseUserAccounts(data)
}

export const changeAccountPassword = async (username: string, password: string): Promise<void> => {
  await api.PUT('/users/{username}/account/password', {
    params: { path: { username } },
    body: { password },
    parseAs: 'text',
  })
}

export const updateAccount = async (
  username: string,
  changes: AccountChanges,
): Promise<boolean | null> => {
  const { data } = await api.PATCH('/users/{username}/account', {
    params: { path: { username } },
    body: changes,
  })
  return parseSyncResult(data)
}

export const deleteAccount = async (username: string): Promise<DeleteAccountResult> => {
  const { data } = await api.DELETE('/users/{username}/account', {
    params: { path: { username } },
  })
  return parseDeleteResult(data)
}

export const findAccount = (accounts: UserAccount[], username: string): UserAccount | undefined =>
  accounts.find((account) => account.username.toLowerCase() === username.toLowerCase())

export const getAccountErrorCode = (error: unknown): AccountErrorCode | null => {
  if (!isApiError(error) || error.status < 400 || error.status >= 500) {
    return null
  }
  const body = error.body
  const code =
    typeof body === 'object' && body !== null && 'code' in body
      ? (body as { code: unknown }).code
      : null
  return ACCOUNT_ERROR_CODES.find((known) => known === code) ?? null
}

export const isAccountMissing = (error: unknown): boolean =>
  getAccountErrorCode(error) === 'user_not_found'

export const getAccountRestriction = ({
  username,
  signedInUsername,
  isSuperadmin,
  account,
  accountsLoaded = true,
  mainExtension,
}: {
  username: string
  signedInUsername: string
  isSuperadmin: boolean
  account?: UserAccount
  accountsLoaded?: boolean
  mainExtension?: string
}): AccountRestriction | null => {
  if (username.toLowerCase() === signedInUsername.toLowerCase()) {
    return 'own_account'
  }
  if (!accountsLoaded) {
    return 'accounts_unavailable'
  }
  if (account?.domainAdmin === true) {
    return 'domain_admin'
  }
  if (account?.adminAccess === 'superadmin' || account?.adminAccess === 'other_instance') {
    return 'superadmin_account'
  }
  if (!isSuperadmin && account?.adminAccess === 'sections') {
    return 'nethvoice_admin'
  }
  if (!isSuperadmin && mainExtension === '') {
    return 'not_instance_user'
  }
  return null
}

export const splitDisplayName = (displayName: string): { name: string; surname: string } => {
  const words = displayName.trim().split(/\s+/).filter(Boolean)

  if (words.length < 2) {
    return { name: words[0] ?? '', surname: '' }
  }
  return { name: words.slice(0, -1).join(' '), surname: words.at(-1) ?? '' }
}

export const getAccountChanges = (
  current: { displayName: string; mail: string; locked: boolean },
  next: { displayName: string; mail: string; locked: boolean },
): AccountChanges => {
  const changes: AccountChanges = {}

  if (next.displayName.trim() !== current.displayName.trim()) {
    changes.display_name = next.displayName.trim()
  }
  if (next.mail.trim() !== current.mail.trim()) {
    changes.mail = next.mail.trim()
  }
  if (next.locked !== current.locked) {
    changes.locked = next.locked
  }
  return changes
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const EmailSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check((value) => value === '' || EMAIL_REGEX.test(value), 'users.email_invalid'),
)

export const ChangePasswordSchema = v.pipe(
  v.object({
    password: v.pipe(
      v.string(),
      v.nonEmpty('users.password_required'),
      v.check(isValidPassword, 'users.password_invalid'),
    ),
    confirmPassword: v.pipe(v.string(), v.nonEmpty('users.confirm_password_required')),
  }),
  v.forward(
    v.partialCheck(
      [['password'], ['confirmPassword']],
      (input) => input.password === input.confirmPassword,
      'users.passwords_do_not_match',
    ),
    ['confirmPassword'],
  ),
)
