//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { ApiError } from '@/lib/api/errors'
import {
  ChangePasswordSchema,
  EmailSchema,
  getAccountChanges,
  getAccountErrorCode,
  getAccountRestriction,
  isAccountMissing,
  parseSyncResult,
  parseUserAccounts,
  parseUsersDomain,
  splitDisplayName,
} from './accounts'
import { PASSWORD_RULES } from './createUser'

const apiError = (status: number, body: unknown) =>
  new ApiError({ status, method: 'PUT', url: '/users/a/account/password', body })

describe('parseUsersDomain', () => {
  it('reads a manageable and an external domain', () => {
    expect(parseUsersDomain({ manageable: true, reason: null })).toEqual({
      manageable: true,
      reason: null,
    })
    expect(parseUsersDomain({ manageable: false, reason: 'external' })).toEqual({
      manageable: false,
      reason: 'external',
    })
    expect(parseUsersDomain({ manageable: true, reason: 'external' }).reason).toBeNull()
  })

  it('rejects an unexpected answer', () => {
    expect(() => parseUsersDomain([{ username: 'a.miller' }])).toThrow()
    expect(() => parseUsersDomain({ manageable: 'yes' })).toThrow()
  })
})

describe('parseUserAccounts', () => {
  it('keeps an unknown lock state and domain administrator flag as null', () => {
    expect(
      parseUserAccounts([
        {
          username: 'a.miller',
          display_name: 'Anna Miller',
          mail: 'anna@example.org',
          locked: true,
          domain_admin: false,
        },
        { username: 'c.davis' },
      ]),
    ).toEqual([
      {
        username: 'a.miller',
        displayName: 'Anna Miller',
        mail: 'anna@example.org',
        locked: true,
        domainAdmin: false,
      },
      { username: 'c.davis', displayName: '', mail: '', locked: null, domainAdmin: null },
    ])
  })

  it('rejects accounts without username', () => {
    expect(() => parseUserAccounts([{ display_name: 'Nobody' }])).toThrow()
  })
})

describe('getAccountErrorCode', () => {
  it('reads the known codes of client errors only', () => {
    expect(getAccountErrorCode(apiError(422, { code: 'password_history' }))).toBe(
      'password_history',
    )
    expect(getAccountErrorCode(apiError(403, { code: 'domain_admin' }))).toBe('domain_admin')
    expect(getAccountErrorCode(apiError(422, { code: 'invalid_display_name' }))).toBe(
      'invalid_display_name',
    )
    expect(getAccountErrorCode(apiError(422, { code: 'something_new' }))).toBeNull()
    expect(getAccountErrorCode(apiError(502, { code: 'provider_error' }))).toBeNull()
    expect(getAccountErrorCode(apiError(403, 'Forbidden'))).toBeNull()
    expect(getAccountErrorCode(new Error('network'))).toBeNull()
  })
})

describe('parseSyncResult', () => {
  it('tells a synchronization that ran from one that was not needed', () => {
    expect(parseSyncResult({ synchronized: true })).toBe(true)
    expect(parseSyncResult({ synchronized: false })).toBe(false)
    expect(parseSyncResult({ synchronized: null })).toBeNull()
  })

  it('treats an unexpected answer as a failed synchronization', () => {
    expect(parseSyncResult({})).toBe(false)
    expect(parseSyncResult({ synchronized: 'yes' })).toBe(false)
    expect(parseSyncResult(undefined)).toBe(false)
  })
})

describe('isAccountMissing', () => {
  it('recognizes an account removed from the account provider', () => {
    expect(isAccountMissing(apiError(404, { code: 'user_not_found' }))).toBe(true)
    expect(getAccountErrorCode(apiError(404, { code: 'user_not_found' }))).toBe('user_not_found')
    expect(isAccountMissing(apiError(404, 'Not Found'))).toBe(false)
    expect(isAccountMissing(apiError(502, { code: 'user_not_found' }))).toBe(false)
  })
})

describe('getAccountRestriction', () => {
  const account = {
    username: 'd.jones',
    displayName: 'Daniel Jones',
    mail: '',
    locked: false,
    domainAdmin: true,
  }

  it('protects the own account from everyone', () => {
    expect(
      getAccountRestriction({
        username: 'Helpdesk',
        signedInUsername: 'helpdesk',
        isSuperadmin: true,
      }),
    ).toBe('own_account')
  })

  it('protects domain administrators from limited administrators only', () => {
    const base = { username: 'd.jones', signedInUsername: 'helpdesk', account }

    expect(getAccountRestriction({ ...base, isSuperadmin: false })).toBe('domain_admin')
    expect(getAccountRestriction({ ...base, isSuperadmin: true })).toBeNull()
    expect(
      getAccountRestriction({
        ...base,
        isSuperadmin: false,
        account: { ...account, domainAdmin: null },
      }),
    ).toBeNull()
  })
})

describe('splitDisplayName', () => {
  it('takes the last word as surname', () => {
    expect(splitDisplayName('Anna Maria  Rossi ')).toEqual({ name: 'Anna Maria', surname: 'Rossi' })
    expect(splitDisplayName('Daniel')).toEqual({ name: 'Daniel', surname: '' })
    expect(splitDisplayName('')).toEqual({ name: '', surname: '' })
  })
})

describe('getAccountChanges', () => {
  const current = { displayName: 'Anna Miller', mail: 'anna@example.org', locked: false }

  it('sends only what changed', () => {
    expect(getAccountChanges(current, { ...current })).toEqual({})
    expect(getAccountChanges(current, { ...current, displayName: ' Anna  Miller ' })).toEqual({
      display_name: 'Anna  Miller',
    })
    expect(getAccountChanges(current, { ...current, locked: true })).toEqual({ locked: true })
    expect(getAccountChanges(current, { ...current, mail: '' })).toEqual({ mail: '' })
  })
})

describe('EmailSchema', () => {
  it('accepts an empty or a valid address', () => {
    expect(v.safeParse(EmailSchema, '').success).toBe(true)
    expect(v.safeParse(EmailSchema, ' anna@example.org ').success).toBe(true)
    expect(v.safeParse(EmailSchema, 'anna@example').success).toBe(false)
  })
})

describe('ChangePasswordSchema', () => {
  const parse = (password: string, confirmPassword = password) =>
    v.safeParse(ChangePasswordSchema, { password, confirmPassword })

  it('reuses the rules of the create user form', () => {
    expect(parse('Invented-Pass1!').success).toBe(true)

    for (const weak of ['Short1!', 'nouppercase1!', 'NOLOWERCASE1!', 'NoNumber!!', 'NoSpecial11']) {
      expect(PASSWORD_RULES.some((rule) => !rule.validate(weak))).toBe(true)
      const result = parse(weak)
      expect(result.success).toBe(false)
      expect(result.issues?.[0]?.message).toBe('users.password_invalid')
    }
  })

  it('requires the confirmation to match', () => {
    const result = parse('Invented-Pass1!', 'Invented-Pass2!')
    expect(result.success).toBe(false)
    expect(result.issues?.[0]?.message).toBe('users.passwords_do_not_match')
    expect(result.issues?.[0]?.path?.[0]?.key).toBe('confirmPassword')
  })
})
