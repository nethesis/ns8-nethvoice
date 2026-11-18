//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  assertVariablesSaved,
  getUnsavedVariables,
  PhoneSettingsNotSavedError,
} from './persistence'

describe('getUnsavedVariables', () => {
  it('should compare only the variables that were sent', () => {
    expect(
      getUnsavedVariables({ language: 'it' }, { language: 'it', tonezone: 'us', adminpw: 'x' }),
    ).toEqual([])
    expect(getUnsavedVariables({ language: 'it', tonezone: 'it' }, { language: 'en' })).toEqual([
      'language',
      'tonezone',
    ])
  })

  it('should expect a removed variable to be missing or empty', () => {
    expect(getUnsavedVariables({ ldap_server: null }, {})).toEqual([])
    expect(getUnsavedVariables({ ldap_server: null }, { ldap_server: '' })).toEqual([])
    expect(getUnsavedVariables({ ldap_server: null }, { ldap_server: 'ldap.example.org' })).toEqual(
      ['ldap_server'],
    )
  })

  it('should never compare the account passwords', () => {
    expect(getUnsavedVariables({ account_password_1: 'secret' }, {})).toEqual([])
  })
})

describe('assertVariablesSaved', () => {
  it('should throw when a sent value was not stored', () => {
    expect(() => assertVariablesSaved({ userpw: 'new' }, { userpw: 'old' })).toThrow(
      PhoneSettingsNotSavedError,
    )
    expect(() => assertVariablesSaved({ userpw: 'new' }, { userpw: 'new' })).not.toThrow()
  })
})
