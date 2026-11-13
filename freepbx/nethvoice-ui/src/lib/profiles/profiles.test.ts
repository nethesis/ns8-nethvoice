//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { rawProfile } from './fixtures'
import {
  buildProfileNameSchema,
  canRenameProfile,
  diffProfileUsers,
  filterProfiles,
  getCopyName,
  getFeatureValue,
  getNewlyEnabledPrivacyPermissions,
  getOutboundRouteCategory,
  getProfileNameIssue,
  getProfileSaveErrorKey,
  getProfileUsers,
  isDefaultProfile,
  parseProfile,
  parseProfiles,
  parseSubscriptionActive,
  setFeatureValue,
  sortProfiles,
  toProfileForm,
  toProfileRequest,
} from './profiles'
import { ApiError } from '@/lib/api/errors'
import type { User } from '@/lib/users/users'

const advanced = parseProfile(rawProfile(3, 'Advanced'))

describe('parseProfiles', () => {
  it('should map macro permissions and outbound routes', () => {
    const [profile] = parseProfiles([rawProfile(1, 'Base')])

    expect(profile.id).toBe(1)
    expect(profile.macroPermissions.settings.permissions[0]).toEqual({
      id: 2,
      name: 'dnd',
      displayName: 'dnd',
      description: 'dnd description',
      value: true,
    })
    expect(profile.outboundRoutes[1]).toEqual({ routeId: 2, name: 'cellphone_it', allowed: false })
  })

  it('should accept a profile without outbound routes', () => {
    const raw = { ...rawProfile(4, 'Custom'), outbound_routes_permissions: undefined }
    expect(parseProfile(raw).outboundRoutes).toEqual([])
  })

  it('should keep permissions that are not stored yet', () => {
    expect(advanced.macroPermissions.qmanager.permissions[0].id).toBeNull()
  })

  it('should reject a profile without macro permissions', () => {
    expect(() => parseProfile({ id: 1, name: 'Base' })).toThrow()
  })
})

describe('parseSubscriptionActive', () => {
  it('should detect an active subscription from a missing limit', () => {
    expect(parseSubscriptionActive({ configured: 4, limit: false, configurable: false })).toBe(true)
    expect(parseSubscriptionActive({ configured: 4, limit: 8, configurable: 4 })).toBe(false)
  })
})

describe('sortProfiles', () => {
  it('should list the default profiles first, then the others by name', () => {
    const profiles = [
      parseProfile(rawProfile(9, 'zeta')),
      parseProfile(rawProfile(2, 'Standard')),
      parseProfile(rawProfile(5, 'Alpha')),
      parseProfile(rawProfile(1, 'Base')),
    ]
    expect(sortProfiles(profiles).map((profile) => profile.id)).toEqual([1, 2, 5, 9])
  })
})

describe('isDefaultProfile', () => {
  it('should flag Base, Standard and Advanced', () => {
    expect(isDefaultProfile({ id: 3 })).toBe(true)
    expect(isDefaultProfile({ id: 4 })).toBe(false)
  })
})

describe('getProfileUsers and filterProfiles', () => {
  const user = (id: number, profileId: number | null): User => ({
    id,
    username: `user${id}`,
    displayName: `User ${id}`,
    mainExtension: '300',
    profileId,
    email: '',
    devices: [],
  })

  it('should count the users of a profile', () => {
    expect(getProfileUsers(3, [user(1, 3), user(2, 1), user(3, 3)]).map((item) => item.id)).toEqual(
      [1, 3],
    )
  })

  it('should filter profiles by name', () => {
    expect(filterProfiles([advanced], 'adv')).toHaveLength(1)
    expect(filterProfiles([advanced], 'base')).toHaveLength(0)
  })
})

describe('getCopyName', () => {
  it('should append the suffix', () => {
    expect(getCopyName('Base', 'copy', ['Base'])).toBe('Base (copy)')
  })

  it('should number further copies', () => {
    expect(getCopyName('Base', 'copy', ['Base', 'base (copy)', 'Base (copy 2)'])).toBe(
      'Base (copy 3)',
    )
  })
})

describe('getOutboundRouteCategory', () => {
  it('should recognize the default routes', () => {
    expect(getOutboundRouteCategory('national_it')).toBe('national')
    expect(getOutboundRouteCategory('cellphone_en')).toBe('cellphone')
    expect(getOutboundRouteCategory('international_it')).toBe('international')
    expect(getOutboundRouteCategory('toll_de')).toBe('toll')
  })

  it('should not categorize other routes', () => {
    expect(getOutboundRouteCategory('Custom route')).toBeNull()
  })
})

describe('profile rename', () => {
  const apiError = (status: number) =>
    new ApiError({ status, method: 'POST', url: '/freepbx/rest/cti/profiles/4', body: null })

  it('should allow renaming only the custom profiles', () => {
    expect(canRenameProfile({ id: 1, name: 'Base' })).toBe(false)
    expect(canRenameProfile({ id: 7, name: 'Hotel' })).toBe(false)
    expect(canRenameProfile({ id: 4, name: 'Sales' })).toBe(true)
  })

  it('should reject a reserved name', () => {
    const result = v.safeParse(buildProfileNameSchema([], ['Hotel']), 'Hotel')

    expect(result.issues?.[0].message).toBe('profiles.name_not_allowed')
  })

  it('should map the backend errors to translated messages', () => {
    expect(getProfileNameIssue(apiError(409))).toBe('profiles.name_already_exists')
    expect(getProfileNameIssue(apiError(422))).toBe('profiles.name_not_allowed')
    expect(getProfileNameIssue(apiError(423))).toBeNull()
    expect(getProfileNameIssue(new Error('x'))).toBeNull()
    expect(getProfileSaveErrorKey(apiError(423))).toBe('profiles.profile_change_in_progress')
    expect(getProfileSaveErrorKey(apiError(500))).toBeNull()
  })
})

describe('buildProfileNameSchema', () => {
  const schema = buildProfileNameSchema(['Base', 'Sales'])

  it('should trim a valid name', () => {
    expect(v.parse(schema, ' Marketing ')).toBe('Marketing')
  })

  it('should reject an empty or duplicate name', () => {
    expect(v.safeParse(schema, ' ').issues?.[0].message).toBe('profiles.name_required')
    expect(v.safeParse(schema, 'sales').issues?.[0].message).toBe('profiles.name_already_exists')
  })
})

describe('toProfileForm', () => {
  it('should copy the profile without sharing references', () => {
    const form = toProfileForm(advanced)
    setFeatureValue(form, { macro: 'settings', permission: 'dnd' }, false)

    expect(getFeatureValue(form, { macro: 'settings', permission: 'dnd' })).toBe(false)
    expect(advanced.macroPermissions.settings.permissions[0].value).toBe(true)
  })

  it('should show shared contacts when the legacy advanced phonebook is on', () => {
    const form = toProfileForm(advanced)
    expect(getFeatureValue(form, { macro: 'phonebook', permission: 'phonebook_level_2' })).toBe(
      true,
    )
  })

  it('should turn outbound calling on when at least one route is allowed', () => {
    expect(toProfileForm(advanced).outboundEnabled).toBe(true)
  })

  it('should use the given name', () => {
    expect(toProfileForm(advanced, 'Advanced (copy)').name).toBe('Advanced (copy)')
  })
})

describe('toProfileRequest', () => {
  it('should serialize the profile in the legacy shape', () => {
    const request = toProfileRequest(toProfileForm(advanced, ' New '))

    expect(request.name).toBe('New')
    expect(request.macro_permissions.settings.permissions?.[0]).toEqual({
      id: 2,
      name: 'dnd',
      displayname: 'dnd',
      description: 'dnd description',
      value: true,
    })
    expect(request.outbound_routes_permissions).toEqual([
      { route_id: 1, name: 'national_it', permission: true },
      { route_id: 2, name: 'cellphone_it', permission: false },
      { route_id: 5, name: 'Custom route', permission: true },
    ])
  })

  it('should keep the permissions of a disabled macro', () => {
    const form = toProfileForm(advanced)
    setFeatureValue(form, { macro: 'settings' }, false)
    const request = toProfileRequest(form)

    expect(request.macro_permissions.settings.value).toBe(false)
    expect(request.macro_permissions.settings.permissions?.[0].value).toBe(true)
  })

  it('should turn off the CTI panels when the CTI is disabled', () => {
    const form = toProfileForm(advanced)
    setFeatureValue(form, { macro: 'nethvoice_cti' }, false)
    const request = toProfileRequest(form)

    expect(request.macro_permissions.phonebook.value).toBe(false)
    expect(request.macro_permissions.presence_panel.value).toBe(false)
    expect(request.macro_permissions.settings.value).toBe(true)
  })

  it('should deny every route when outbound calling is off', () => {
    const form = toProfileForm(advanced)
    form.outboundEnabled = false

    expect(
      toProfileRequest(form).outbound_routes_permissions?.every((route) => !route.permission),
    ).toBe(true)
  })

  it('should map shared contacts to the phonebook levels', () => {
    const form = toProfileForm(advanced)
    setFeatureValue(form, { macro: 'phonebook', permission: 'phonebook_level_1' }, true)
    const values = Object.fromEntries(
      (toProfileRequest(form).macro_permissions.phonebook.permissions ?? []).map((permission) => [
        permission.name,
        permission.value,
      ]),
    )

    expect(values).toEqual({
      phonebook_level_0: true,
      phonebook_level_1: false,
      ad_phonebook: true,
      phonebook_level_2: true,
    })
  })

  it('should map private contacts only', () => {
    const form = toProfileForm(advanced)
    setFeatureValue(form, { macro: 'phonebook', permission: 'phonebook_level_2' }, false)
    setFeatureValue(form, { macro: 'phonebook', permission: 'phonebook_level_1' }, true)
    const values = Object.fromEntries(
      (toProfileRequest(form).macro_permissions.phonebook.permissions ?? []).map((permission) => [
        permission.name,
        permission.value,
      ]),
    )

    expect(values).toEqual({
      phonebook_level_0: true,
      phonebook_level_1: true,
      ad_phonebook: false,
      phonebook_level_2: false,
    })
  })
})

describe('getNewlyEnabledPrivacyPermissions', () => {
  it('should report recording features enabled since the drawer opened', () => {
    const initial = toProfileForm(advanced)
    const current = toProfileForm(advanced)
    setFeatureValue(current, { macro: 'settings', permission: 'recording' }, true)
    setFeatureValue(current, { macro: 'settings', permission: 'call_forward' }, true)

    expect(getNewlyEnabledPrivacyPermissions(initial, current)).toEqual(['recording'])
  })

  it('should ignore permissions of a disabled macro', () => {
    const initial = toProfileForm(advanced)
    const current = toProfileForm(advanced)
    setFeatureValue(current, { macro: 'presence_panel', permission: 'ad_recording' }, true)
    setFeatureValue(current, { macro: 'presence_panel' }, false)

    expect(getNewlyEnabledPrivacyPermissions(initial, current)).toEqual([])
  })
})

describe('diffProfileUsers', () => {
  it('should list assigned and unassigned users', () => {
    expect(diffProfileUsers([1, 2], [2, 3])).toEqual({ assigned: [3], unassigned: [1] })
  })
})
