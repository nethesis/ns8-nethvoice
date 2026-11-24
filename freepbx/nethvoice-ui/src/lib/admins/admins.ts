//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { compareNatural } from '@/lib/common'
import { SECTIONS, SUPERADMIN, type Permission, type Section } from '@/lib/permissions/permissions'
import type { UserAccount } from '@/lib/users/accounts'

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
