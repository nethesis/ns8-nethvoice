//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { getChangeAdminPasswordIssues, isStrongAdminPassword } from './adminPassword'

describe('isStrongAdminPassword', () => {
  it('should accept a password meeting every requirement', () => {
    expect(isStrongAdminPassword('Nethvoice,2026')).toBe(true)
  })

  it.each([
    ['too short', 'Ab1!'],
    ['no uppercase', 'nethvoice,2026'],
    ['no lowercase', 'NETHVOICE,2026'],
    ['no number', 'Nethvoice,abcd'],
    ['no special character', 'Nethvoice2026'],
  ])('should reject a password with %s', (_case, password) => {
    expect(isStrongAdminPassword(password)).toBe(false)
  })
})

describe('getChangeAdminPasswordIssues', () => {
  it('should return no issues for a valid form', () => {
    expect(
      getChangeAdminPasswordIssues({
        currentPassword: 'Old,pass1',
        newPassword: 'New,pass2',
        confirmPassword: 'New,pass2',
      }),
    ).toEqual({})
  })

  it('should require every field', () => {
    expect(
      getChangeAdminPasswordIssues({ currentPassword: '', newPassword: '', confirmPassword: '' }),
    ).toEqual({
      currentPassword: 'settings.current_password_required',
      newPassword: 'settings.new_password_required',
      confirmPassword: 'settings.confirm_password_required',
    })
  })

  it('should reject a weak new password', () => {
    expect(
      getChangeAdminPasswordIssues({
        currentPassword: 'Old,pass1',
        newPassword: 'weak',
        confirmPassword: 'weak',
      }),
    ).toEqual({ newPassword: 'settings.new_password_requirements_not_met' })
  })

  it('should reject a confirmation that does not match', () => {
    expect(
      getChangeAdminPasswordIssues({
        currentPassword: 'Old,pass1',
        newPassword: 'New,pass2',
        confirmPassword: 'New,pass3',
      }),
    ).toEqual({ confirmPassword: 'settings.passwords_do_not_match' })
  })

  it('should reject a new password equal to the current one', () => {
    expect(
      getChangeAdminPasswordIssues({
        currentPassword: 'Same,pass1',
        newPassword: 'Same,pass1',
        confirmPassword: 'Same,pass1',
      }),
    ).toEqual({ newPassword: 'settings.new_password_must_be_different' })
  })
})
