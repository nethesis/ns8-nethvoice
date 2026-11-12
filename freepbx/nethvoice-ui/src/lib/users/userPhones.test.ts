//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import type { Phone } from '@/lib/phones/phones'
import { getAssignedPhoneMacs, getMaxPhones, planPhoneChanges } from './userPhones'

const phone = (mac: string, username: string | null): Phone => ({
  mac,
  model: 'acme-T1',
  modelLabel: 'Acme T1',
  vendor: 'Acme',
  user: username ? { username, displayName: username, mainExtension: '300' } : null,
  extension: username ? '91300' : '',
  encrypted: false,
})

const PHONES = [
  phone('00-11-22-33-44-01', 'a.miller'),
  phone('00-11-22-33-44-02', 'a.miller'),
  phone('00-11-22-33-44-03', null),
]

const macs = (items: Phone[]) => items.map((item) => item.mac.slice(-2))

describe('getAssignedPhoneMacs', () => {
  it('converts the MAC of the devices and skips the ones without a MAC', () => {
    expect(
      getAssignedPhoneMacs([
        {
          id: 1,
          type: 'physical',
          extension: '91300',
          mac: '00:11:22:33:44:01',
          vendor: '',
          model: '',
          line: 1,
          registered: false,
        },
        {
          id: 2,
          type: 'physical',
          extension: '92300',
          mac: '00:11:22:33:44:01',
          vendor: '',
          model: '',
          line: 2,
          registered: false,
        },
        {
          id: 3,
          type: 'temporaryphysical',
          extension: '93300',
          mac: '',
          vendor: '',
          model: '',
          line: null,
          registered: false,
        },
      ]),
    ).toEqual(['00-11-22-33-44-01'])
  })
})

describe('getMaxPhones', () => {
  it('leaves the slots not used by the other devices', () => {
    expect(getMaxPhones(3)).toBe(6)
    expect(getMaxPhones(12)).toBe(0)
  })
})

describe('planPhoneChanges', () => {
  const current = ['00-11-22-33-44-01', '00-11-22-33-44-02']

  it('assigns the new phones and frees the removed ones', () => {
    const plan = planPhoneChanges(
      PHONES,
      current,
      ['00-11-22-33-44-02', '00-11-22-33-44-03', ''],
      false,
    )

    expect(macs(plan.unassign)).toEqual(['01'])
    expect(macs(plan.assign)).toEqual(['03'])
  })

  it('does nothing when the selection did not change', () => {
    expect(planPhoneChanges(PHONES, current, [...current].reverse(), false)).toEqual({
      unassign: [],
      assign: [],
    })
  })

  it('assigns again every phone after an extension change, as unassigned phones', () => {
    const plan = planPhoneChanges(PHONES, current, ['00-11-22-33-44-01'], true)

    expect(plan.unassign).toEqual([])
    expect(plan.assign).toEqual([{ ...PHONES[0], user: null, extension: '' }])
  })
})
