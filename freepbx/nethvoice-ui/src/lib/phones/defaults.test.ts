//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import {
  getPhoneWebPassword,
  getToneZoneLabel,
  getUnmetPasswordRequirements,
  parsePhoneDefaults,
  PhonePasswordSchema,
  withCurrentOption,
} from './defaults'

describe('parsePhoneDefaults', () => {
  it('should read the variables used by the settings tab', () => {
    const defaults = parsePhoneDefaults({
      language: 'it',
      tonezone: 'it',
      provisioning_freq: 'never',
      adminpw: 'Secret-1x',
      userpw: 'user',
      provisioning_url_scheme: 'https',
      ldap_port: 20014,
    })

    expect(defaults).toMatchObject({
      language: 'it',
      toneZone: 'it',
      provisioningFrequency: 'never',
      adminPassword: 'Secret-1x',
      userPassword: 'user',
      encryptionByDefault: true,
    })
    expect(defaults.variables.ldap_port).toBe('20014')
  })

  it('should fall back to every day and empty values', () => {
    expect(parsePhoneDefaults({})).toMatchObject({
      language: '',
      provisioningFrequency: 'everyday',
      encryptionByDefault: false,
    })
  })
})

describe('getPhoneWebPassword', () => {
  it('should use the admin password of the defaults', () => {
    expect(getPhoneWebPassword(parsePhoneDefaults({ adminpw: 'Abc' }))).toBe('Abc')
    expect(getPhoneWebPassword(undefined)).toBe('admin')
  })
})

describe('password policy', () => {
  it('should list the unmet requirements', () => {
    expect(getUnmetPasswordRequirements('abc')).toEqual([
      'min_length',
      'uppercase',
      'number',
      'special',
    ])
    expect(getUnmetPasswordRequirements('Abcdefg1!')).toEqual([])
  })

  it('should require matching confirmation', () => {
    const result = v.safeParse(PhonePasswordSchema, {
      password: 'Abcdefg1!',
      confirmPassword: 'Abcdefg1?',
    })

    expect(result.success).toBe(false)
    expect(result.issues?.[0].message).toBe('phones.settings.passwords_do_not_match')
    expect(result.issues?.[0].path?.[0].key).toBe('confirmPassword')
  })

  it('should accept a valid password', () => {
    expect(
      v.safeParse(PhonePasswordSchema, { password: 'Abcdefg1!', confirmPassword: 'Abcdefg1!' })
        .success,
    ).toBe(true)
  })
})

describe('options helpers', () => {
  it('should keep an unknown current value among the options', () => {
    expect(withCurrentOption(['en', 'it'], 'de')).toEqual(['en', 'it', 'de'])
    expect(withCurrentOption(['en', 'it'], 'it')).toEqual(['en', 'it'])
  })

  it('should name tone zones as countries', () => {
    expect(getToneZoneLabel('it', 'en')).toBe('Italy')
    expect(getToneZoneLabel('uk', 'en')).toBe('United Kingdom')
  })
})
