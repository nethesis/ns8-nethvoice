//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { compareNatural } from '@/lib/common'
import { SECTIONS, SUPERADMIN, type Permission, type Section } from '@/lib/permissions/permissions'
import { EmailSchema, type UserAccount } from '@/lib/users/accounts'
import { getFullName, NEW_ACCOUNT_ENTRIES } from '@/lib/users/createUser'
import { DISPLAY_NAME_MAX_LENGTH, hasControlCharacters } from '@/lib/users/csv'
import type { components } from '@/lib/api/schema'

export const ADMINS_KEY = 'admins'

export const ADMIN_SOURCES = ['local', 'domain', 'domain_admin'] as const

export const ADMIN_REASONS = [
  'builtin',
  'own_account',
  'domain_admin',
  'local_account',
  'domain_not_manageable',
] as const

export const ADMIN_ERROR_CODES = [
  'invalid_request',
  'own_account',
  'protected_account',
  'domain_admin',
  'local_account',
  'user_not_found',
  'domain_not_manageable',
  'domain_unavailable',
  'provider_error',
  'username_taken',
  'invalid_mail',
  'password_rejected',
  'account_created',
] as const

export type AdminSource = (typeof ADMIN_SOURCES)[number]

export type AdminReason = (typeof ADMIN_REASONS)[number]

export type AdminErrorCode = (typeof ADMIN_ERROR_CODES)[number]

export type AdminControlReason = 'external' | 'unavailable'

export type AdminAccess = 'full' | 'sections'

export type AdminAccount = {
  username: string
  displayName: string
  source: AdminSource
  permissions: Permission[]
  groups: string[]
  locked: boolean | null
  editable: boolean
  removable: boolean
  reason: AdminReason | null
}

export type AdminControl = {
  prefix: string
  groups: Record<Permission, string>
  manageable: boolean
  reason: AdminControlReason | null
  admins: AdminAccount[]
}

export type AdminCandidate = {
  username: string
  displayName: string
  unavailable: AdminCandidateRestriction | null
}

export type AdminCandidateRestriction = 'already_admin' | 'reserved' | 'superadmin'

const PERMISSIONS: readonly string[] = [SUPERADMIN, ...SECTIONS]

const isPermission = (value: string): value is Permission => PERMISSIONS.includes(value)

const isSection = (value: string): value is Section =>
  (SECTIONS as readonly string[]).includes(value)

const GroupsSchema = v.object({
  superadmin: v.string(),
  dashboard: v.string(),
  users: v.string(),
  trunks: v.string(),
  routes: v.string(),
  phones: v.string(),
  integrations: v.string(),
  settings: v.string(),
})

const AdminAccountSchema = v.object({
  username: v.pipe(v.string(), v.nonEmpty()),
  display_name: v.optional(v.nullable(v.string()), null),
  source: v.picklist(ADMIN_SOURCES),
  permissions: v.array(v.string()),
  groups: v.optional(v.array(v.string()), []),
  locked: v.optional(v.nullable(v.boolean()), null),
  editable: v.boolean(),
  removable: v.boolean(),
  reason: v.optional(v.nullable(v.picklist(ADMIN_REASONS)), null),
})

const AdminControlSchema = v.object({
  prefix: v.string(),
  groups: GroupsSchema,
  manageable: v.boolean(),
  reason: v.optional(v.nullable(v.picklist(['external', 'unavailable'])), null),
  admins: v.array(AdminAccountSchema),
})

const RESERVED_USERNAME = /^(admin|support-.*)$/i

export const isReservedUsername = (username: string): boolean => RESERVED_USERNAME.test(username)

const PROTECTED_USERNAMES = ['administrator', 'guest', 'krbtgt', 'ldapservice']

export const sortPermissions = (permissions: readonly Permission[]): Permission[] =>
  permissions.includes(SUPERADMIN)
    ? [SUPERADMIN]
    : SECTIONS.filter((section) => permissions.includes(section))

const parseAdminAccount = (raw: v.InferOutput<typeof AdminAccountSchema>): AdminAccount => ({
  username: raw.username,
  displayName: raw.display_name ?? '',
  source: raw.source,
  permissions: sortPermissions(raw.permissions.filter(isPermission)),
  groups: raw.groups,
  locked: raw.locked,
  editable: raw.editable,
  removable: raw.removable,
  reason: raw.reason,
})

export const parseAdminControl = (raw: unknown): AdminControl => {
  const control = v.parse(AdminControlSchema, raw)

  return {
    prefix: control.prefix,
    groups: control.groups,
    manageable: control.manageable,
    reason: control.manageable ? null : (control.reason ?? 'unavailable'),
    admins: control.admins
      .map(parseAdminAccount)
      .sort((first, second) => compareNatural(first.username, second.username)),
  }
}

export const getAdminControl = async (): Promise<AdminControl> => {
  const { data } = await api.GET('/admins')
  return parseAdminControl(data)
}

export const setAdminPermissions = async (
  username: string,
  permissions: Permission[],
): Promise<void> => {
  await api.PUT('/admins/{username}', {
    params: { path: { username } },
    body: { permissions },
  })
}

export type NewAdmin = components['schemas']['AdminCreate']

export const createAdmin = async (newAdmin: NewAdmin): Promise<void> => {
  await api.POST('/admins', { body: newAdmin })
}

export const removeAdmin = async (username: string): Promise<void> => {
  await api.DELETE('/admins/{username}', { params: { path: { username } } })
}

export const getAdminErrorCode = (error: unknown): AdminErrorCode | null => {
  if (!isApiError(error) || error.status < 400) {
    return null
  }
  const body = error.body
  const code =
    typeof body === 'object' && body !== null && 'code' in body
      ? (body as { code: unknown }).code
      : null
  return ADMIN_ERROR_CODES.find((known) => known === code) ?? null
}

export const isFullAccess = (permissions: readonly Permission[]): boolean =>
  permissions.includes(SUPERADMIN)

export const getAdminSections = (permissions: readonly Permission[]): Section[] =>
  permissions.filter(isSection)

export const buildPermissions = (access: AdminAccess, sections: readonly string[]): Permission[] =>
  access === 'full' ? [SUPERADMIN] : SECTIONS.filter((section) => sections.includes(section))

export const AdminFormSchema = v.pipe(
  v.object({
    username: v.pipe(v.string(), v.trim(), v.nonEmpty('admin_control.user_required')),
    access: v.picklist(['full', 'sections']),
    sections: v.array(v.string()),
  }),
  v.forward(
    v.partialCheck(
      [['access'], ['sections']],
      (input) => input.access === 'full' || input.sections.some(isSection),
      'admin_control.sections_required',
    ),
    ['sections'],
  ),
)

export type AdminForm = v.InferInput<typeof AdminFormSchema>

const sameUsername = (first: string, second: string) => first.toLowerCase() === second.toLowerCase()

export const getAdminCandidates = (
  accounts: readonly UserAccount[],
  admins: readonly AdminAccount[],
  signedInUsername: string,
): AdminCandidate[] =>
  accounts
    .filter((account) => !sameUsername(account.username, signedInUsername))
    .map((account) => {
      let unavailable: AdminCandidateRestriction | null = null

      if (admins.some((admin) => sameUsername(admin.username, account.username))) {
        unavailable = 'already_admin'
      } else if (isReservedUsername(account.username)) {
        unavailable = 'reserved'
      } else if (account.domainAdmin === true || account.adminAccess === 'superadmin') {
        unavailable = 'superadmin'
      }
      return { username: account.username, displayName: account.displayName, unavailable }
    })
    .sort((first, second) => compareNatural(first.username, second.username))

const withoutControlCharacters = <TSchema extends v.GenericSchema<string, string>>(
  schema: TSchema,
) =>
  v.pipe(
    schema,
    v.check((value: string) => !hasControlCharacters(value), 'users.name_control_characters'),
  )

export const NewAdminAccountSchema = v.pipe(
  v.object({
    ...NEW_ACCOUNT_ENTRIES,
    name: withoutControlCharacters(NEW_ACCOUNT_ENTRIES.name),
    surname: withoutControlCharacters(NEW_ACCOUNT_ENTRIES.surname),
    email: EmailSchema,
  }),
  v.forward(
    v.partialCheck(
      [['password'], ['confirmPassword']],
      (input) => input.password === input.confirmPassword,
      'users.passwords_do_not_match',
    ),
    ['confirmPassword'],
  ),
  v.forward(
    v.partialCheck(
      [['name'], ['surname']],
      (input) => getFullName(input).length <= DISPLAY_NAME_MAX_LENGTH,
      'users.full_name_too_long',
    ),
    ['name'],
  ),
)

export type NewAdminAccount = v.InferOutput<typeof NewAdminAccountSchema>

export type NewAdminField = keyof NewAdminAccount

export const buildNewAdmin = (account: NewAdminAccount, permissions: Permission[]): NewAdmin => ({
  username: account.username,
  display_name: getFullName(account),
  password: account.password,
  ...(account.email ? { mail: account.email } : {}),
  permissions,
})

export const getNewAdminConflict = (
  username: string,
  accounts: readonly UserAccount[],
  admins: readonly AdminAccount[],
): string | null => {
  if (isReservedUsername(username) || PROTECTED_USERNAMES.includes(username.toLowerCase())) {
    return 'admin_control.username_reserved'
  }
  const admin = admins.find((candidate) => sameUsername(candidate.username, username))

  if (admin?.source === 'local') {
    return 'admin_control.username_local_admin'
  }
  if (admin || accounts.some((account) => sameUsername(account.username, username))) {
    return 'users.username_already_exists'
  }
  return null
}

const NEW_ADMIN_FIELD_ISSUES: Partial<
  Record<AdminErrorCode, { field: NewAdminField; message: string }>
> = {
  username_taken: { field: 'username', message: 'users.username_already_exists' },
  local_account: { field: 'username', message: 'admin_control.username_local_admin' },
  protected_account: { field: 'username', message: 'admin_control.username_reserved' },
  invalid_mail: { field: 'email', message: 'users.email_invalid' },
}

export const getNewAdminFieldIssue = (
  error: unknown,
): { field: NewAdminField; message: string } | null => {
  const code = getAdminErrorCode(error)
  return (code && NEW_ADMIN_FIELD_ISSUES[code]) ?? null
}
