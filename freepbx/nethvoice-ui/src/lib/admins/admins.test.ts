//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest'
import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import type { UserAccount } from '@/lib/users/accounts'
import {
  AdminFormSchema,
  buildNewAdmin,
  buildPermissions,
  createAdmin,
  getAdminCandidates,
  getAdminErrorCode,
  getNewAdminConflict,
  getNewAdminFieldIssue,
  NewAdminAccountSchema,
  getAdminSections,
  isFullAccess,
  isReservedUsername,
  parseAdminControl,
  sortPermissions,
  type AdminAccount,
} from './admins'

vi.mock('@/lib/api/client', () => ({ api: { POST: vi.fn() } }))

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
  member: null,
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

describe('NewAdminAccountSchema', () => {
  const VALID = {
    username: ' Z.Hart ',
    name: ' Zoe ',
    surname: 'Hart',
    email: '',
    password: 'Invented-Secret-42!',
    confirmPassword: 'Invented-Secret-42!',
  }
  const issues = (input: Partial<typeof VALID>) => {
    const result = v.safeParse(NewAdminAccountSchema, { ...VALID, ...input })
    return result.success
      ? {}
      : Object.fromEntries(
          [...result.issues]
            .reverse()
            .map((issue) => [String(issue.path?.[0]?.key), issue.message]),
        )
  }

  it('accepts an account with the rules of the Users page', () => {
    const result = v.safeParse(NewAdminAccountSchema, VALID)
    expect(result.success).toBe(true)
    expect(result.output).toMatchObject({ username: 'z.hart', name: 'Zoe', email: '' })
  })

  it('reports each invalid field with the texts of the Users page', () => {
    expect(
      issues({ username: '', name: '', surname: '', password: '', confirmPassword: '' }),
    ).toEqual({
      username: 'users.username_required',
      name: 'users.name_required',
      surname: 'users.surname_required',
      password: 'users.password_required',
      confirmPassword: 'users.confirm_password_required',
    })
    expect(issues({ username: '1zoe' })).toEqual({ username: 'users.username_invalid' })
    expect(issues({ username: 'z'.repeat(33) })).toEqual({ username: 'users.username_too_long' })
    expect(issues({ password: 'short', confirmPassword: 'short' })).toEqual({
      password: 'users.password_invalid',
    })
    expect(issues({ confirmPassword: 'Other-Secret-42!' })).toEqual({
      confirmPassword: 'users.passwords_do_not_match',
    })
    expect(issues({ name: 'Z'.repeat(30), surname: 'H'.repeat(20) })).toEqual({
      name: 'users.full_name_too_long',
    })
    expect(issues({ surname: 'Ha\trt' })).toEqual({ surname: 'users.name_control_characters' })
    expect(issues({ email: 'zoe@' })).toEqual({ email: 'users.email_invalid' })
  })
})

describe('new administrator', () => {
  it('builds the request without an extension and with the optional email', () => {
    const account = {
      username: 'z.hart',
      name: 'Zoe',
      surname: 'Hart',
      email: '',
      password: 'Invented-Secret-42!',
      confirmPassword: 'Invented-Secret-42!',
    }
    expect(buildNewAdmin(account, ['users'])).toEqual({
      username: 'z.hart',
      display_name: 'Zoe Hart',
      password: 'Invented-Secret-42!',
      permissions: ['users'],
    })
    expect(buildNewAdmin({ ...account, email: 'zoe@example.org' }, ['superadmin'])).toEqual({
      username: 'z.hart',
      display_name: 'Zoe Hart',
      password: 'Invented-Secret-42!',
      mail: 'zoe@example.org',
      permissions: ['superadmin'],
    })
  })

  it('posts the new administrator', async () => {
    const body = {
      username: 'z.hart',
      display_name: 'Zoe Hart',
      password: 'Invented-Secret-42!',
      permissions: ['users' as const],
    }
    vi.mocked(api.POST).mockResolvedValue({ data: undefined } as never)
    await createAdmin(body)
    expect(api.POST).toHaveBeenCalledWith('/admins', { body })
  })

  it('finds the usernames that cannot be created', () => {
    const accounts = [account('C.Davis')]
    const admins = [{ ...admin('operator'), source: 'local' as const }, admin('a.miller')]

    expect(getNewAdminConflict('c.davis', accounts, admins)).toBe('users.username_already_exists')
    expect(getNewAdminConflict('operator', accounts, admins)).toBe(
      'admin_control.username_local_admin',
    )
    expect(getNewAdminConflict('a.miller', accounts, admins)).toBe('users.username_already_exists')
    for (const username of ['admin', 'support-team', 'administrator', 'guest']) {
      expect(getNewAdminConflict(username, accounts, admins)).toBe(
        'admin_control.username_reserved',
      )
    }
    expect(getNewAdminConflict('z.hart', accounts, admins)).toBeNull()
  })

  it('moves the refusals about one field to that field', () => {
    const refusal = (code: string) =>
      new ApiError({ status: 409, method: 'POST', url: '/admins', body: { code } })

    expect(getNewAdminFieldIssue(refusal('username_taken'))).toEqual({
      field: 'username',
      message: 'users.username_already_exists',
    })
    expect(getNewAdminFieldIssue(refusal('local_account'))).toEqual({
      field: 'username',
      message: 'admin_control.username_local_admin',
    })
    expect(getNewAdminFieldIssue(refusal('protected_account'))).toEqual({
      field: 'username',
      message: 'admin_control.username_reserved',
    })
    expect(getNewAdminFieldIssue(refusal('invalid_mail'))).toEqual({
      field: 'email',
      message: 'users.email_invalid',
    })
    expect(getNewAdminFieldIssue(refusal('account_created'))).toBeNull()
    expect(getNewAdminFieldIssue(new Error('network'))).toBeNull()
  })

  it('reads the codes of the creation', () => {
    for (const code of ['username_taken', 'invalid_mail', 'password_rejected', 'account_created']) {
      expect(
        getAdminErrorCode(
          new ApiError({ status: 422, method: 'POST', url: '/admins', body: { code } }),
        ),
      ).toBe(code)
    }
  })
})
