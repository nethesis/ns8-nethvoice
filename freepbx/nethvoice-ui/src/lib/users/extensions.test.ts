//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import {
  countConfiguredDrafts,
  getExtensionErrorKind,
  isValidExtension,
  parseUserLimits,
  planExtensionSteps,
  validateExtensionDrafts,
} from './extensions'
import type { User } from './users'

const user = (username: string, mainExtension: string): User => ({
  id: username.length,
  username,
  displayName: username,
  mainExtension,
  profileId: null,
  email: '',
  devices: [],
})

const apiError = (status: number) =>
  new ApiError({ status, method: 'POST', url: '/freepbx/rest/mainextensions', body: null })

const plan = (users: User[], drafts: Record<string, string>) =>
  planExtensionSteps(users, drafts).map((step) => `${step.user.username}:${step.extension}`)

describe('parseUserLimits', () => {
  it('reads the limits of the community version', () => {
    expect(parseUserLimits({ configured: 3, limit: 8, configurable: 5 })).toEqual({
      configured: 3,
      limit: 8,
      configurable: 5,
    })
  })

  it('has no limit when a subscription is active', () => {
    expect(parseUserLimits({ configured: 40, limit: false, configurable: false })).toEqual({
      configured: 40,
      limit: null,
      configurable: null,
    })
  })
})

describe('extension drafts', () => {
  it('accepts only digits', () => {
    expect(isValidExtension('201')).toBe(true)
    expect(isValidExtension('')).toBe(false)
    expect(isValidExtension('20a')).toBe(false)
    expect(isValidExtension('+201')).toBe(false)
  })

  it('reports invalid and duplicated extensions', () => {
    expect(
      validateExtensionDrafts({
        'a.miller': '300',
        'c.davis': ' 300 ',
        'd.jones': 'abc',
        'e.johnson': '',
        'j.smith': '304',
      }),
    ).toEqual({ 'c.davis': 'duplicate', 'd.jones': 'invalid' })
  })

  it('counts only the users with a valid extension', () => {
    expect(countConfiguredDrafts({ a: '300', b: '300', c: 'x', d: '', e: '301' })).toBe(2)
  })
})

describe('planExtensionSteps', () => {
  it('sends only the changed users', () => {
    const users = [user('a.miller', '300'), user('c.davis', ''), user('d.jones', '')]

    expect(plan(users, { 'a.miller': '300', 'c.davis': '301', 'd.jones': '' })).toEqual([
      'c.davis:301',
    ])
  })

  it('removes an extension that was cleared', () => {
    expect(plan([user('a.miller', '300')], { 'a.miller': '' })).toEqual(['a.miller:'])
  })

  it('frees an extension before giving it to another user', () => {
    const users = [user('a.miller', '300'), user('c.davis', '301')]

    expect(plan(users, { 'a.miller': '301', 'c.davis': '302' })).toEqual([
      'c.davis:302',
      'a.miller:301',
    ])
  })

  it('breaks a swap by clearing one of the two users first', () => {
    const users = [user('a.miller', '300'), user('c.davis', '301')]

    expect(plan(users, { 'a.miller': '301', 'c.davis': '300' })).toEqual([
      'a.miller:',
      'c.davis:300',
      'a.miller:301',
    ])
  })

  it('still ends when the wanted extension belongs to an unchanged user', () => {
    const users = [user('a.miller', '300'), user('c.davis', '')]

    expect(plan(users, { 'c.davis': '300' })).toEqual(['c.davis:300'])
  })
})

describe('getExtensionErrorKind', () => {
  it('maps the status codes of POST /mainextensions', () => {
    expect(getExtensionErrorKind(apiError(422))).toBe('in_use')
    expect(getExtensionErrorKind(apiError(403))).toBe('users_limit')
    expect(getExtensionErrorKind(apiError(404))).toBe('user_not_found')
    expect(getExtensionErrorKind(apiError(500))).toBe('unknown')
    expect(getExtensionErrorKind(new Error('offline'))).toBe('unknown')
  })
})
