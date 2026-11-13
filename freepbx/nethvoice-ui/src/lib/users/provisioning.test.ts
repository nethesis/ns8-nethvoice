//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { getDraftExtension, getDrafts, planProvisioning } from './provisioning'
import type { User } from './users'

const user = (
  id: number,
  username: string,
  mainExtension: string,
  profileId: number | null,
): User => ({
  id,
  username,
  displayName: username,
  mainExtension,
  profileId,
  email: '',
  devices: [],
})

const USERS = [
  user(1, 'a.miller', '300', 2),
  user(2, 'c.davis', '', null),
  user(3, 'd.jones', '', 3),
  user(4, 'e.johnson', '303', 1),
]

describe('drafts', () => {
  it('uses the edited value or the saved extension', () => {
    expect(getDraftExtension(USERS[0], {})).toBe('300')
    expect(getDraftExtension(USERS[0], { 'a.miller': ' 310 ' })).toBe('310')
    expect(getDrafts(USERS, { 'c.davis': '301' })).toEqual({
      'a.miller': '300',
      'c.davis': '301',
      'd.jones': '',
      'e.johnson': '303',
    })
  })
})

describe('planProvisioning', () => {
  it('plans nothing when nothing changed', () => {
    expect(planProvisioning(USERS, { 'a.miller': '300' })).toEqual({ extensions: [], defaults: [] })
  })

  it('assigns the new extensions and applies the defaults to the new users', () => {
    const plan = planProvisioning(USERS, { 'c.davis': '301', 'd.jones': '302', 'e.johnson': '' })

    expect(plan.extensions.map((step) => `${step.user.username}:${step.extension}`)).toEqual([
      'c.davis:301',
      'd.jones:302',
      'e.johnson:',
    ])
    expect(
      plan.defaults.map((item) => `${item.user.username}:${item.extension}:${item.setProfile}`),
    ).toEqual(['c.davis:301:true', 'd.jones:302:false'])
  })

  it('applies the defaults again to a user whose extension changed', () => {
    const plan = planProvisioning(USERS, { 'a.miller': '310' })

    expect(plan.defaults.map((item) => item.user.username)).toEqual(['a.miller'])
    expect(plan.defaults[0].setProfile).toBe(false)
  })
})
