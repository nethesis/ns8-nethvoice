//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  canAccess,
  getAccessRedirect,
  getAllowedSections,
  getFirstAllowedRoute,
  isDeniedSectionRedirect,
  isSuperadmin,
  parseMe,
  type Permission,
} from './permissions'

const superadmin: Permission[] = ['superadmin']
const dashboardOnly: Permission[] = ['dashboard']
const trunksAndRoutes: Permission[] = ['routes', 'trunks']
const nothing: Permission[] = []

const completed = { inProgress: false, legacyStep: 13 }
const atVoipTrunks = { inProgress: true, legacyStep: 3 }

describe('parseMe', () => {
  it('should keep the known permissions only', () => {
    expect(
      parseMe({ username: 'alice', permissions: ['dashboard', 'reports', 'superadmin'] }),
    ).toEqual({ username: 'alice', permissions: ['dashboard', 'superadmin'] })
  })

  it('should reject a malformed answer', () => {
    expect(() => parseMe({ username: 'alice' })).toThrow()
    expect(() => parseMe(null)).toThrow()
  })
})

describe('canAccess', () => {
  it('should grant everything to superadmin', () => {
    expect(isSuperadmin(superadmin)).toBe(true)
    expect(canAccess(superadmin, 'trunks')).toBe(true)
    expect(canAccess(superadmin, 'superadmin')).toBe(true)
    expect(getAllowedSections(superadmin)).toEqual([
      'dashboard',
      'users',
      'trunks',
      'routes',
      'phones',
      'integrations',
      'settings',
    ])
  })

  it('should grant only the listed sections', () => {
    expect(isSuperadmin(dashboardOnly)).toBe(false)
    expect(canAccess(dashboardOnly, 'dashboard')).toBe(true)
    expect(canAccess(dashboardOnly, 'trunks')).toBe(false)
    expect(canAccess(dashboardOnly, 'superadmin')).toBe(false)
  })

  it('should follow the menu order for the first allowed section', () => {
    expect(getAllowedSections(trunksAndRoutes)).toEqual(['trunks', 'routes'])
    expect(getFirstAllowedRoute(trunksAndRoutes)).toEqual({ name: 'trunks' })
    expect(getFirstAllowedRoute(nothing)).toEqual({ name: 'no-access' })
  })
})

describe('getAccessRedirect', () => {
  it('should leave superadmin to the setup guard', () => {
    expect(getAccessRedirect('trunks', 'trunks', superadmin, completed)).toBeNull()
    expect(getAccessRedirect('trunks', 'trunks', superadmin, atVoipTrunks)).toEqual({
      name: 'setup-voip-trunks',
    })
    expect(getAccessRedirect('setup', 'superadmin', superadmin, completed)).toEqual({
      name: 'dashboard',
    })
  })

  it('should move superadmin away from the restricted pages', () => {
    expect(getAccessRedirect('no-access', undefined, superadmin, completed)).toEqual({
      name: 'dashboard',
    })
    expect(getAccessRedirect('setup-pending', undefined, superadmin, atVoipTrunks)).toEqual({
      name: 'setup-voip-trunks',
    })
  })

  it('should send superadmin to the setup when the wizard state is unknown', () => {
    expect(getAccessRedirect('setup', 'superadmin', superadmin, undefined)).toBeNull()
    expect(getAccessRedirect('setup-users', 'superadmin', superadmin, undefined)).toBeNull()
    expect(getAccessRedirect('dashboard', 'dashboard', superadmin, undefined)).toEqual({
      name: 'setup',
    })
    expect(getAccessRedirect('trunks', 'trunks', superadmin)).toEqual({ name: 'setup' })
    expect(getAccessRedirect('setup-pending', undefined, superadmin, undefined)).toEqual({
      name: 'setup',
    })
    expect(getAccessRedirect('no-access', undefined, superadmin, undefined)).toEqual({
      name: 'setup',
    })
  })

  it('should send a restricted administrator to the waiting page when the wizard state is unknown', () => {
    expect(getAccessRedirect('dashboard', 'dashboard', dashboardOnly, undefined)).toEqual({
      name: 'setup-pending',
    })
    expect(getAccessRedirect('no-access', undefined, nothing, undefined)).toEqual({
      name: 'setup-pending',
    })
    expect(getAccessRedirect('setup-pending', undefined, dashboardOnly, undefined)).toBeNull()
  })

  it('should redirect a forbidden section to the first allowed one', () => {
    expect(getAccessRedirect('trunks', 'trunks', dashboardOnly, completed)).toEqual({
      name: 'dashboard',
    })
    expect(getAccessRedirect('dashboard', 'dashboard', trunksAndRoutes, completed)).toEqual({
      name: 'trunks',
    })
    expect(getAccessRedirect('routes', 'routes', trunksAndRoutes, completed)).toBeNull()
  })

  it('should keep pages without a section open', () => {
    expect(getAccessRedirect('not-found', undefined, dashboardOnly, completed)).toBeNull()
  })

  it('should keep the setup reserved to superadmin', () => {
    expect(getAccessRedirect('setup-users', 'superadmin', dashboardOnly, completed)).toEqual({
      name: 'dashboard',
    })
  })

  it('should block a restricted administrator while the setup is not completed', () => {
    expect(getAccessRedirect('dashboard', 'dashboard', dashboardOnly, atVoipTrunks)).toEqual({
      name: 'setup-pending',
    })
    expect(getAccessRedirect('setup', 'superadmin', dashboardOnly, atVoipTrunks)).toEqual({
      name: 'setup-pending',
    })
    expect(getAccessRedirect('setup-pending', undefined, dashboardOnly, atVoipTrunks)).toBeNull()
    expect(getAccessRedirect('setup-pending', undefined, dashboardOnly, completed)).toEqual({
      name: 'dashboard',
    })
  })

  it('should show the no access page when no section is allowed', () => {
    expect(getAccessRedirect('dashboard', 'dashboard', nothing, completed)).toEqual({
      name: 'no-access',
    })
    expect(getAccessRedirect('no-access', undefined, nothing, completed)).toBeNull()
    expect(getAccessRedirect('no-access', undefined, dashboardOnly, completed)).toEqual({
      name: 'dashboard',
    })
  })

  it('should fail closed when the permissions cannot be loaded', () => {
    expect(getAccessRedirect('dashboard', 'dashboard', undefined, completed)).toEqual({
      name: 'no-access',
    })
    expect(getAccessRedirect('no-access', undefined, undefined, completed)).toBeNull()
  })
})

describe('isDeniedSectionRedirect', () => {
  it('should report a section the administrator cannot open', () => {
    expect(isDeniedSectionRedirect('trunks', 'trunks', dashboardOnly, completed)).toBe(true)
    expect(isDeniedSectionRedirect('setup-users', 'superadmin', dashboardOnly, completed)).toBe(
      true,
    )
  })

  it('should stay silent on the default page and on allowed sections', () => {
    expect(isDeniedSectionRedirect('dashboard', 'dashboard', trunksAndRoutes, completed)).toBe(
      false,
    )
    expect(isDeniedSectionRedirect('routes', 'routes', trunksAndRoutes, completed)).toBe(false)
    expect(isDeniedSectionRedirect('not-found', undefined, dashboardOnly, completed)).toBe(false)
    expect(isDeniedSectionRedirect('trunks', 'trunks', superadmin, completed)).toBe(false)
  })

  it('should stay silent when another page explains the redirect', () => {
    expect(isDeniedSectionRedirect('trunks', 'trunks', dashboardOnly, atVoipTrunks)).toBe(false)
    expect(isDeniedSectionRedirect('trunks', 'trunks', nothing, completed)).toBe(false)
    expect(isDeniedSectionRedirect('trunks', 'trunks', undefined, completed)).toBe(false)
    expect(isDeniedSectionRedirect('trunks', 'trunks', dashboardOnly, undefined)).toBe(false)
  })
})
