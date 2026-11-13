//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  getCurrentSetupRoute,
  getInternalRedirect,
  getLegacyStepToSave,
  getWizardRedirect,
  isSetupRoute,
} from './guard'

const completed = { inProgress: false, legacyStep: 13 }
const neverStarted = { inProgress: true, legacyStep: 0 }
const atVoipTrunks = { inProgress: true, legacyStep: 3 }

describe('isSetupRoute', () => {
  it('should recognize the welcome page and the steps', () => {
    expect(isSetupRoute('setup')).toBe(true)
    expect(isSetupRoute('setup-users')).toBe(true)
    expect(isSetupRoute('settings')).toBe(false)
    expect(isSetupRoute(undefined)).toBe(false)
  })
})

describe('getCurrentSetupRoute', () => {
  it('should open the welcome page when no step was saved', () => {
    expect(getCurrentSetupRoute(neverStarted)).toEqual({ name: 'setup' })
  })

  it('should open the saved step', () => {
    expect(getCurrentSetupRoute(atVoipTrunks)).toEqual({ name: 'setup-voip-trunks' })
    expect(getCurrentSetupRoute({ inProgress: true, legacyStep: 12 })).toEqual({
      name: 'setup-summary',
    })
  })
})

describe('getWizardRedirect', () => {
  it('should keep a completed wizard away from the setup', () => {
    expect(getWizardRedirect('setup', completed)).toEqual({ name: 'dashboard' })
    expect(getWizardRedirect('setup-summary', completed)).toEqual({ name: 'dashboard' })
    expect(getWizardRedirect('users', completed)).toBeNull()
  })

  it('should send the app pages to the saved step while the wizard is in progress', () => {
    expect(getWizardRedirect('dashboard', atVoipTrunks)).toEqual({ name: 'setup-voip-trunks' })
    expect(getWizardRedirect('settings', neverStarted)).toEqual({ name: 'setup' })
    expect(getWizardRedirect('not-found', atVoipTrunks)).toEqual({ name: 'setup-voip-trunks' })
  })

  it('should allow the reached step and the previous ones', () => {
    expect(getWizardRedirect('setup', atVoipTrunks)).toBeNull()
    expect(getWizardRedirect('setup-system', atVoipTrunks)).toBeNull()
    expect(getWizardRedirect('setup-voip-trunks', atVoipTrunks)).toBeNull()
    expect(getWizardRedirect('setup-system', neverStarted)).toBeNull()
  })

  it('should not skip ahead of the saved step', () => {
    expect(getWizardRedirect('setup-outbound-routes', atVoipTrunks)).toEqual({
      name: 'setup-voip-trunks',
    })
    expect(getWizardRedirect('setup-summary', atVoipTrunks)).toEqual({
      name: 'setup-voip-trunks',
    })
    expect(getWizardRedirect('setup-users', neverStarted)).toEqual({ name: 'setup' })
  })
})

describe('getLegacyStepToSave', () => {
  it('should never move the saved step back', () => {
    expect(getLegacyStepToSave(1, atVoipTrunks)).toBe(3)
    expect(getLegacyStepToSave(4, atVoipTrunks)).toBe(4)
  })

  it('should save the next step when the state is unknown or completed', () => {
    expect(getLegacyStepToSave(1)).toBe(1)
    expect(getLegacyStepToSave(1, completed)).toBe(1)
  })
})

describe('getInternalRedirect', () => {
  it('should accept an internal path', () => {
    expect(getInternalRedirect('/settings')).toBe('/settings')
    expect(getInternalRedirect('/trunks/voip?x=1')).toBe('/trunks/voip?x=1')
  })

  it('should reject external, malformed and login paths', () => {
    expect(getInternalRedirect('//evil.example.com')).toBeNull()
    expect(getInternalRedirect('/\\evil.example.com')).toBeNull()
    expect(getInternalRedirect('https://evil.example.com')).toBeNull()
    expect(getInternalRedirect('/login?redirect=/settings')).toBeNull()
    expect(getInternalRedirect(['/settings'])).toBeNull()
    expect(getInternalRedirect(undefined)).toBeNull()
  })
})
