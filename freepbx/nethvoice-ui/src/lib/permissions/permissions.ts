//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { getCurrentSetupRoute, getWizardRedirect, type NamedRoute } from '@/lib/setup/guard'
import type { WizardState } from '@/lib/setup/wizard'

export const ME_KEY = 'me'

export const SUPERADMIN = 'superadmin'

export const SECTIONS = [
  'dashboard',
  'users',
  'trunks',
  'routes',
  'phones',
  'integrations',
  'settings',
] as const

export type Section = (typeof SECTIONS)[number]

export type Permission = Section | typeof SUPERADMIN

export type Me = { username: string; permissions: Permission[] }

export const NO_ACCESS_ROUTE = 'no-access'

export const SETUP_PENDING_ROUTE = 'setup-pending'

const DASHBOARD_ROUTE: NamedRoute = { name: 'dashboard' }

const PERMISSIONS: readonly string[] = [SUPERADMIN, ...SECTIONS]

const isPermission = (value: string): value is Permission => PERMISSIONS.includes(value)

const MeSchema = v.object({
  username: v.string(),
  permissions: v.array(v.string()),
})

export const parseMe = (raw: unknown): Me => {
  const me = v.parse(MeSchema, raw)

  return { username: me.username, permissions: me.permissions.filter(isPermission) }
}

export const getMe = async (signal?: AbortSignal): Promise<Me> => {
  const { data } = await api.GET('/me', { signal })
  return parseMe(data)
}

export const isSuperadmin = (permissions: readonly Permission[]): boolean =>
  permissions.includes(SUPERADMIN)

export const canAccess = (permissions: readonly Permission[], permission: Permission): boolean =>
  isSuperadmin(permissions) || permissions.includes(permission)

export const getAllowedSections = (permissions: readonly Permission[]): Section[] =>
  SECTIONS.filter((section) => canAccess(permissions, section))

export const getFirstAllowedRoute = (permissions: readonly Permission[]): NamedRoute => {
  const [section] = getAllowedSections(permissions)
  return { name: section ?? NO_ACCESS_ROUTE }
}

const getSuperadminRedirect = (routeName: unknown, wizardState?: WizardState) => {
  if (routeName === NO_ACCESS_ROUTE || routeName === SETUP_PENDING_ROUTE) {
    return wizardState?.inProgress ? getCurrentSetupRoute(wizardState) : DASHBOARD_ROUTE
  }
  return wizardState ? getWizardRedirect(routeName, wizardState) : null
}

export const getAccessRedirect = (
  routeName: unknown,
  permission: Permission | undefined,
  permissions: readonly Permission[] | undefined,
  wizardState?: WizardState,
): NamedRoute | null => {
  if (!permissions) {
    return routeName === NO_ACCESS_ROUTE ? null : { name: NO_ACCESS_ROUTE }
  }

  if (isSuperadmin(permissions)) {
    return getSuperadminRedirect(routeName, wizardState)
  }

  if (wizardState?.inProgress) {
    return routeName === SETUP_PENDING_ROUTE ? null : { name: SETUP_PENDING_ROUTE }
  }
  const firstAllowedRoute = getFirstAllowedRoute(permissions)

  if (routeName === SETUP_PENDING_ROUTE) {
    return firstAllowedRoute
  }

  if (routeName === NO_ACCESS_ROUTE) {
    return firstAllowedRoute.name === NO_ACCESS_ROUTE ? null : firstAllowedRoute
  }
  return permission && !canAccess(permissions, permission) ? firstAllowedRoute : null
}
