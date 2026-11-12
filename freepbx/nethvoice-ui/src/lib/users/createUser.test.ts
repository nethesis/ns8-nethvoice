//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { parseCsv } from './csv'
import {
  buildNewUserCsv,
  getFullName,
  getNewUserConflicts,
  isValidPassword,
  NewUserSchema,
  PASSWORD_RULES,
  type NewUser,
} from './createUser'
import type { User } from './users'

const NEW_USER = {
  username: ' A.Miller ',
  name: 'Anna',
  surname: 'Miller',
  password: 'Secret,123',
  confirmPassword: 'Secret,123',
  extension: '300',
  mobile: '',
}

const issues = (input: Partial<typeof NEW_USER>) => {
  const result = v.safeParse(NewUserSchema, { ...NEW_USER, ...input })

  if (result.success) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(v.flatten(result.issues).nested ?? {}).map(([field, messages]) => [
      field,
      messages?.[0],
    ]),
  )
}

describe('password rules', () => {
  it('checks every rule', () => {
    const failed = (password: string) =>
      PASSWORD_RULES.filter((rule) => !rule.validate(password)).map((rule) => rule.key)

    expect(failed('abc')).toEqual(['min_length', 'uppercase', 'number', 'special'])
    expect(failed('ABCDEFGH1!')).toEqual(['lowercase'])
    expect(isValidPassword('Secret,123')).toBe(true)
  })
})

describe('NewUserSchema', () => {
  it('normalizes the username', () => {
    const result = v.safeParse(NewUserSchema, NEW_USER)
    expect(result.success && result.output.username).toBe('a.miller')
  })

  it('reports the missing and invalid fields', () => {
    expect(
      issues({ username: '', name: ' ', surname: '', password: 'weak', confirmPassword: '' }),
    ).toEqual({
      username: 'users.username_required',
      name: 'users.name_required',
      surname: 'users.surname_required',
      password: 'users.password_invalid',
      confirmPassword: 'users.confirm_password_required',
    })
    expect(issues({ username: '9lives', extension: 'abc', mobile: 'x' })).toEqual({
      username: 'users.username_invalid',
      extension: 'users.extension_invalid',
      mobile: 'users.mobile_invalid',
    })
  })

  it('requires matching passwords', () => {
    expect(issues({ confirmPassword: 'Secret,124' })).toEqual({
      confirmPassword: 'users.passwords_do_not_match',
    })
  })

  it('accepts a user without extension and mobile', () => {
    expect(issues({ extension: '', mobile: '' })).toEqual({})
  })
})

describe('getNewUserConflicts', () => {
  const users: User[] = [
    {
      id: 1,
      username: 'a.miller',
      displayName: 'Anna Miller',
      mainExtension: '300',
      profileId: 1,
      email: '',
      devices: [],
    },
  ]

  it('finds a taken username or extension', () => {
    expect(getNewUserConflicts({ username: 'a.miller', extension: '300' }, users)).toEqual({
      username: 'users.username_already_exists',
      extension: 'users.extension_already_assigned',
    })
    expect(getNewUserConflicts({ username: 'c.davis', extension: '301' }, users)).toEqual({})
    expect(getNewUserConflicts({ username: 'c.davis', extension: '301' }, users, ['301'])).toEqual({
      extension: 'users.extension_already_assigned',
    })
  })
})

describe('buildNewUserCsv', () => {
  it('writes the single row expected by the CSV import', () => {
    const newUser: NewUser = { ...NEW_USER, username: 'a.miller' }

    expect(getFullName(newUser)).toBe('Anna Miller')
    expect(parseCsv(buildNewUserCsv(newUser, '300'))).toEqual([
      ['a.miller', 'Anna Miller', '300', 'Secret,123'],
    ])
  })
})
