//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { ApiError } from '@/lib/api/errors'
import type { UserAccount } from '@/lib/users/accounts'
import {
  AdminFormSchema,
  buildPermissions,
  getAdminCandidates,
  getAdminErrorCode,
  getAdminSections,
  isFullAccess,
  isReservedUsername,
  parseAdminControl,
  sortPermissions,
  type AdminAccount,
} from './admins'

const GROUPS = {
  superadmin: 'nethvoice3-admins',
  dashboard: 'nethvoice3-dashboard',
  users: 'nethvoice3-users',
  trunks: 'nethvoice3-trunks',
  routes: 'nethvoice3-routes',
  phones: 'nethvoice3-phones',
  integrations: 'nethvoice3-integrations',
  settings: 'nethvoice3-settings',
}

const rawAdmin = (overrides: Record<string, unknown>) => ({
  username: 'a.miller',
  display_name: 'Anna Miller',
  source: 'domain',
  permissions: ['users'],
  groups: ['nethvoice3-users'],
  locked: false,
  editable: true,
  removable: true,
  reason: null,
  ...overrides,
})

const account = (username: string, overrides: Partial<UserAccount> = {}): UserAccount => ({
  username,
  displayName: username.toUpperCase(),
  mail: '',
  locked: false,
  domainAdmin: false,
  adminAccess: null,
  ...overrides,
})

const admin = (username: string): AdminAccount => ({
  username,
  displayName: '',
  source: 'domain',
  permissions: ['users'],
  groups: [],
  locked: false,
  editable: true,
  removable: true,
  reason: null,
})

describe('parseAdminControl', () => {
  it('reads the groups and the administrators sorted by username', () => {
    const control = parseAdminControl({
      prefix: 'nethvoice3',
      groups: GROUPS,
      manageable: true,
      reason: null,
      admins: [
        rawAdmin({ username: 'b.smith', permissions: ['settings', 'dashboard', 'unknown'] }),
        rawAdmin({
          username: 'admin',
          display_name: null,
          source: 'local',
          permissions: ['superadmin'],
          groups: [],
          locked: null,
          editable: false,
          removable: false,
          reason: 'builtin',
        }),
      ],
    })

    expect(control.prefix).toBe('nethvoice3')
    expect(control.groups.superadmin).toBe('nethvoice3-admins')
    expect(control.reason).toBeNull()
    expect(control.admins).toEqual([
      {
        username: 'admin',
        displayName: '',
        source: 'local',
        permissions: ['superadmin'],
        groups: [],
        locked: null,
        editable: false,
        removable: false,
        reason: 'builtin',
      },
      {
        username: 'b.smith',
        displayName: 'Anna Miller',
        source: 'domain',
        permissions: ['dashboard', 'settings'],
        groups: ['nethvoice3-users'],
        locked: false,
        editable: true,
        removable: true,
        reason: null,
      },
    ])
  })

  it('keeps the reason only when the domain is not manageable', () => {
    const base = { prefix: 'nethvoice', groups: GROUPS, admins: [] }

    expect(parseAdminControl({ ...base, manageable: true, reason: 'external' }).reason).toBeNull()
    expect(parseAdminControl({ ...base, manageable: false, reason: 'external' }).reason).toBe(
      'external',
    )
    expect(parseAdminControl({ ...base, manageable: false, reason: null }).reason).toBe(
      'unavailable',
    )
  })

  it('rejects an unexpected answer', () => {
    expect(() => parseAdminControl({ prefix: 'nethvoice', admins: [] })).toThrow()
    expect(() =>
      parseAdminControl({
        prefix: 'nethvoice',
        groups: GROUPS,
        manageable: true,
        admins: [rawAdmin({ source: 'ldap' })],
      }),
    ).toThrow()
  })
})

describe('permissions', () => {
  it('orders the sections and keeps full access alone', () => {
    expect(sortPermissions(['settings', 'users'])).toEqual(['users', 'settings'])
    expect(sortPermissions(['users', 'superadmin'])).toEqual(['superadmin'])
    expect(isFullAccess(['superadmin'])).toBe(true)
    expect(isFullAccess(['users'])).toBe(false)
    expect(getAdminSections(['superadmin', 'phones'])).toEqual(['phones'])
  })

  it('builds the permissions to send from the form', () => {
    expect(buildPermissions('full', ['users'])).toEqual(['superadmin'])
    expect(buildPermissions('sections', ['settings', 'users', 'unknown'])).toEqual([
      'users',
      'settings',
    ])
  })
})

describe('AdminFormSchema', () => {
  const parse = (input: { username: string; access: 'full' | 'sections'; sections: string[] }) =>
    v.safeParse(AdminFormSchema, input)

  it('requires a user', () => {
    const result = parse({ username: ' ', access: 'full', sections: [] })
    expect(result.success).toBe(false)
    expect(result.issues?.[0]?.message).toBe('admin_control.user_required')
  })

  it('requires at least one section unless the access is full', () => {
    expect(parse({ username: 'a.miller', access: 'full', sections: [] }).success).toBe(true)
    expect(parse({ username: 'a.miller', access: 'sections', sections: ['phones'] }).success).toBe(
      true,
    )

    const result = parse({ username: 'a.miller', access: 'sections', sections: [] })
    expect(result.success).toBe(false)
    expect(result.issues?.[0]?.message).toBe('admin_control.sections_required')
    expect(result.issues?.[0]?.path?.[0]?.key).toBe('sections')
  })
})

describe('getAdminCandidates', () => {
  it('excludes the own account and tells why the others cannot be added', () => {
    const candidates = getAdminCandidates(
      [
        account('d.jones', { domainAdmin: true, adminAccess: 'superadmin' }),
        account('Helpdesk'),
        account('c.davis', { adminAccess: 'sections' }),
        account('Admin'),
        account('support-x'),
        account('e.brown', { adminAccess: 'superadmin' }),
        account('f.green', { adminAccess: 'other_instance' }),
        account('a.miller'),
      ],
      [admin('C.Davis')],
      'helpdesk',
    )

    expect(candidates.map((candidate) => [candidate.username, candidate.unavailable])).toEqual([
      ['a.miller', null],
      ['Admin', 'reserved'],
      ['c.davis', 'already_admin'],
      ['d.jones', 'superadmin'],
      ['e.brown', 'superadmin'],
      ['f.green', null],
      ['support-x', 'reserved'],
    ])
    expect(candidates[0].displayName).toBe('A.MILLER')
  })

  it('recognizes the reserved usernames', () => {
    expect(isReservedUsername('admin')).toBe(true)
    expect(isReservedUsername('SUPPORT-team')).toBe(true)
    expect(isReservedUsername('administrator')).toBe(false)
    expect(isReservedUsername('my-support-x')).toBe(false)
  })
})

describe('getAdminErrorCode', () => {
  const apiError = (status: number, body: unknown) =>
    new ApiError({ status, method: 'PUT', url: '/admins/a.miller', body })

  it('reads the known codes of the errors', () => {
    expect(getAdminErrorCode(apiError(403, { code: 'own_account' }))).toBe('own_account')
    expect(getAdminErrorCode(apiError(404, { code: 'user_not_found' }))).toBe('user_not_found')
    expect(getAdminErrorCode(apiError(409, { code: 'domain_not_manageable' }))).toBe(
      'domain_not_manageable',
    )
    expect(getAdminErrorCode(apiError(403, { code: 'something_new' }))).toBeNull()
    expect(getAdminErrorCode(apiError(503, { code: 'domain_unavailable' }))).toBe(
      'domain_unavailable',
    )
    expect(getAdminErrorCode(apiError(502, 'Bad gateway'))).toBeNull()
    expect(getAdminErrorCode(new Error('network'))).toBeNull()
  })
})
