//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { compareNatural, matchesText } from '@/lib/common'
import { NumericIdSchema } from '@/lib/groups/groups'
import type { User } from '@/lib/users/users'

export const PROFILES_KEY = 'ctiProfiles'

export const USER_LIMITS_KEY = 'mainExtensionUserLimits'

export const BASE_PROFILE_ID = 1

export const DEFAULT_PROFILE_IDS = [1, 2, 3]

export const PROFILE_NAME_MAX_LENGTH = 255

export const CTI_MACRO = 'nethvoice_cti'

export const CTI_LINKED_MACROS = [
  'phonebook',
  'cdr',
  'presence_panel',
  'customer_card',
  'queue_agent',
  'streaming',
  'off_hour',
  'qmanager',
  'operator_panel',
]

export const PRIVACY_SENSITIVE_PERMISSIONS = ['recording', 'spy', 'intrude', 'ad_recording']

const PermissionSchema = v.object({
  id: v.nullish(NumericIdSchema, null),
  name: v.string(),
  displayname: v.nullish(v.string(), ''),
  description: v.nullish(v.string(), ''),
  value: v.nullish(v.boolean(), false),
})

const MacroPermissionSchema = v.object({
  value: v.nullish(v.boolean(), false),
  displayname: v.nullish(v.string(), ''),
  description: v.nullish(v.string(), ''),
  permissions: v.nullish(v.array(PermissionSchema), []),
})

const OutboundRoutePermissionSchema = v.object({
  route_id: NumericIdSchema,
  name: v.string(),
  permission: v.boolean(),
})

const ProfileSchema = v.object({
  id: NumericIdSchema,
  name: v.string(),
  macro_permissions: v.record(v.string(), MacroPermissionSchema),
  outbound_routes_permissions: v.nullish(v.array(OutboundRoutePermissionSchema), []),
})

const ProfilesResponseSchema = v.array(ProfileSchema)

const ProfileCreatedSchema = v.object({ id: NumericIdSchema })

const UserLimitsSchema = v.object({
  limit: v.union([v.number(), v.boolean()]),
})

export type ProfilePermission = {
  id: number | null
  name: string
  displayName: string
  description: string
  value: boolean
}

export type ProfileMacroPermission = {
  value: boolean
  displayName: string
  description: string
  permissions: ProfilePermission[]
}

export type ProfileOutboundRoute = {
  routeId: number
  name: string
  allowed: boolean
}

export type Profile = {
  id: number
  name: string
  macroPermissions: Record<string, ProfileMacroPermission>
  outboundRoutes: ProfileOutboundRoute[]
}

export type ProfileForm = {
  name: string
  macroPermissions: Record<string, ProfileMacroPermission>
  outboundEnabled: boolean
  outboundRoutes: ProfileOutboundRoute[]
}

export type ProfileDrawerMode =
  { kind: 'create'; source: Profile } | { kind: 'edit'; profile: Profile }

export type FeatureRef = {
  macro: string
  permission?: string
}

export type ProfileUsersChange = {
  assigned: number[]
  unassigned: number[]
}

export type OutboundRouteCategory = 'national' | 'cellphone' | 'international' | 'toll'

type ProfileRequest = components['schemas']['CtiProfileRequest']

const toProfile = (raw: v.InferOutput<typeof ProfileSchema>): Profile => ({
  id: raw.id,
  name: raw.name,
  macroPermissions: Object.fromEntries(
    Object.entries(raw.macro_permissions).map(([name, macro]) => [
      name,
      {
        value: macro.value,
        displayName: macro.displayname,
        description: macro.description,
        permissions: macro.permissions.map((permission) => ({
          id: permission.id,
          name: permission.name,
          displayName: permission.displayname,
          description: permission.description,
          value: permission.value,
        })),
      },
    ]),
  ),
  outboundRoutes: raw.outbound_routes_permissions.map((route) => ({
    routeId: route.route_id,
    name: route.name,
    allowed: route.permission,
  })),
})

export const parseProfile = (raw: unknown): Profile => toProfile(v.parse(ProfileSchema, raw))

export const parseProfiles = (raw: unknown): Profile[] =>
  v.parse(ProfilesResponseSchema, raw).map(toProfile)

export const parseSubscriptionActive = (raw: unknown): boolean =>
  v.parse(UserLimitsSchema, raw).limit === false

export const isDefaultProfile = (profile: Pick<Profile, 'id'>): boolean =>
  DEFAULT_PROFILE_IDS.includes(profile.id)

export const getProfileUsers = (profileId: number, users: User[]): User[] =>
  users.filter((user) => user.profileId === profileId)

export const filterProfiles = (profiles: Profile[], textFilter: string): Profile[] =>
  profiles.filter((profile) => matchesText(textFilter, profile.name))

export const sortProfiles = (profiles: Profile[]): Profile[] =>
  [...profiles].sort((a, b) => {
    if (isDefaultProfile(a) !== isDefaultProfile(b)) {
      return isDefaultProfile(a) ? -1 : 1
    }
    return isDefaultProfile(a) ? a.id - b.id : compareNatural(a.name, b.name)
  })

export const getCopyName = (name: string, suffix: string, existingNames: string[]): string => {
  const taken = existingNames.map((existing) => existing.trim().toLowerCase())
  const base = `${name} (${suffix})`

  if (!taken.includes(base.toLowerCase())) {
    return base
  }
  let index = 2

  while (taken.includes(`${name} (${suffix} ${index})`.toLowerCase())) {
    index += 1
  }
  return `${name} (${suffix} ${index})`
}

export const getOutboundRouteCategory = (routeName: string): OutboundRouteCategory | null => {
  const match = /^(national|cellphone|international|toll)_[a-z]{2,3}$/i.exec(routeName)

  switch (match?.[1].toLowerCase()) {
    case 'national':
      return 'national'
    case 'cellphone':
      return 'cellphone'
    case 'international':
      return 'international'
    case 'toll':
      return 'toll'
    default:
      return null
  }
}

export const buildProfileNameSchema = (otherProfileNames: string[]) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('profiles.name_required'),
    v.maxLength(PROFILE_NAME_MAX_LENGTH, 'profiles.name_too_long'),
    v.check(
      (name) =>
        !otherProfileNames.some((other) => other.trim().toLowerCase() === name.toLowerCase()),
      'profiles.name_already_exists',
    ),
  )

const findPermission = (
  form: Pick<ProfileForm, 'macroPermissions'>,
  ref: FeatureRef,
): ProfilePermission | undefined =>
  form.macroPermissions[ref.macro]?.permissions.find(
    (permission) => permission.name === ref.permission,
  )

export const hasFeature = (
  form: Pick<ProfileForm, 'macroPermissions'>,
  ref: FeatureRef,
): boolean => (ref.permission ? !!findPermission(form, ref) : !!form.macroPermissions[ref.macro])

export const getFeatureValue = (
  form: Pick<ProfileForm, 'macroPermissions'>,
  ref: FeatureRef,
): boolean =>
  ref.permission
    ? (findPermission(form, ref)?.value ?? false)
    : (form.macroPermissions[ref.macro]?.value ?? false)

export const setFeatureValue = (
  form: Pick<ProfileForm, 'macroPermissions'>,
  ref: FeatureRef,
  value: boolean,
): void => {
  const target = ref.permission ? findPermission(form, ref) : form.macroPermissions[ref.macro]

  if (target) {
    target.value = value
  }
}

const cloneMacroPermissions = (
  macroPermissions: Record<string, ProfileMacroPermission>,
): Record<string, ProfileMacroPermission> =>
  Object.fromEntries(
    Object.entries(macroPermissions).map(([name, macro]) => [
      name,
      { ...macro, permissions: macro.permissions.map((permission) => ({ ...permission })) },
    ]),
  )

export const toProfileForm = (profile: Profile, name = profile.name): ProfileForm => {
  const form: ProfileForm = {
    name,
    macroPermissions: cloneMacroPermissions(profile.macroPermissions),
    outboundEnabled:
      profile.outboundRoutes.length === 0 || profile.outboundRoutes.some((route) => route.allowed),
    outboundRoutes: profile.outboundRoutes.map((route) => ({ ...route })),
  }
  const shared =
    getFeatureValue(form, { macro: 'phonebook', permission: 'phonebook_level_2' }) ||
    getFeatureValue(form, { macro: 'phonebook', permission: 'ad_phonebook' })

  setFeatureValue(form, { macro: 'phonebook', permission: 'phonebook_level_2' }, shared)
  return form
}

export const toProfileRequest = (form: ProfileForm): ProfileRequest => {
  const ctiEnabled = form.macroPermissions[CTI_MACRO]?.value ?? true
  const effective = cloneMacroPermissions(form.macroPermissions)

  for (const [name, macro] of Object.entries(effective)) {
    macro.value = macro.value && (!CTI_LINKED_MACROS.includes(name) || ctiEnabled)
  }

  const phonebook = effective.phonebook

  if (phonebook) {
    const valueOf = (name: string) =>
      phonebook.permissions.find((permission) => permission.name === name)?.value ?? false
    const shared = valueOf('phonebook_level_2')
    const levels: Record<string, boolean> = {
      phonebook_level_0: phonebook.value,
      phonebook_level_1: valueOf('phonebook_level_1') && !shared,
      phonebook_level_2: shared,
      ad_phonebook: shared,
    }

    for (const permission of phonebook.permissions) {
      permission.value = levels[permission.name] ?? permission.value
    }
  }

  return {
    name: form.name.trim(),
    macro_permissions: Object.fromEntries(
      Object.entries(effective).map(([name, macro]) => [
        name,
        {
          value: macro.value,
          permissions: macro.permissions.map((permission) => ({
            id: permission.id,
            name: permission.name,
            displayname: permission.displayName,
            description: permission.description,
            value: permission.value,
          })),
        },
      ]),
    ),
    outbound_routes_permissions: form.outboundRoutes.map((route) => ({
      route_id: route.routeId,
      name: route.name,
      permission: route.allowed && form.outboundEnabled,
    })),
  }
}

export const getNewlyEnabledPrivacyPermissions = (
  initial: Pick<ProfileForm, 'macroPermissions'>,
  current: Pick<ProfileForm, 'macroPermissions'>,
): string[] => {
  const enabledIn = (form: Pick<ProfileForm, 'macroPermissions'>) =>
    Object.values(form.macroPermissions)
      .filter((macro) => macro.value)
      .flatMap((macro) => macro.permissions)
      .filter((permission) => permission.value)
      .map((permission) => permission.name)
  const before = enabledIn(initial)

  return enabledIn(current).filter(
    (name) => PRIVACY_SENSITIVE_PERMISSIONS.includes(name) && !before.includes(name),
  )
}

export const diffProfileUsers = (current: number[], next: number[]): ProfileUsersChange => ({
  assigned: next.filter((userId) => !current.includes(userId)),
  unassigned: current.filter((userId) => !next.includes(userId)),
})

export const getProfiles = async (): Promise<Profile[]> => {
  const { data } = await api.GET('/cti/profiles')
  return sortProfiles(parseProfiles(data))
}

export const getProfile = async (profileId: number): Promise<Profile> => {
  const { data } = await api.GET('/cti/profiles/{id}', {
    params: { path: { id: String(profileId) } },
  })
  return parseProfile(data)
}

export const getSubscriptionActive = async (): Promise<boolean> => {
  const { data } = await api.GET('/mainextensions/userlimits')
  return parseSubscriptionActive(data)
}

export const postProfile = async (form: ProfileForm): Promise<number> => {
  const { data } = await api.POST('/cti/profiles', { body: toProfileRequest(form) })
  return v.parse(ProfileCreatedSchema, data).id
}

export const postProfileUpdate = async (profileId: number, form: ProfileForm): Promise<void> => {
  await api.POST('/cti/profiles/{id}', {
    params: { path: { id: String(profileId) } },
    body: { ...toProfileRequest(form), id: profileId },
  })
}

export const postUserProfile = async (userId: number, profileId: number): Promise<void> => {
  await api.POST('/cti/profiles/users/{user_id}', {
    params: { path: { user_id: String(userId) } },
    body: { profile_id: profileId },
  })
}

export const deleteProfile = async (profileId: number): Promise<void> => {
  await api.DELETE('/cti/profiles/{id}', { params: { path: { id: String(profileId) } } })
}

export const saveProfileUsers = async (
  profileId: number,
  currentUserIds: number[],
  nextUserIds: number[],
): Promise<void> => {
  const { assigned, unassigned } = diffProfileUsers(currentUserIds, nextUserIds)

  for (const userId of assigned) {
    await postUserProfile(userId, profileId)
  }

  for (const userId of unassigned) {
    await postUserProfile(userId, BASE_PROFILE_ID)
  }
}

export const createProfile = async (form: ProfileForm, userIds: number[]): Promise<number> => {
  const profileId = await postProfile(form)
  await saveProfileUsers(profileId, [], userIds)
  return profileId
}

export const updateProfile = async (
  profileId: number,
  form: ProfileForm,
  currentUserIds: number[],
  nextUserIds: number[],
): Promise<void> => {
  await postProfileUpdate(profileId, form)
  await saveProfileUsers(profileId, currentUserIds, nextUserIds)
}

export const deleteProfileAndMoveUsers = async (
  profileId: number,
  userIds: number[],
): Promise<void> => {
  for (const userId of userIds) {
    await postUserProfile(userId, BASE_PROFILE_ID)
  }
  await deleteProfile(profileId)
}
