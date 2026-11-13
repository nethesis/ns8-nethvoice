//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { getStepForLegacyStep, getStepIndex, SETUP_STEPS } from '@/lib/setup/steps'
import type { WizardState } from '@/lib/setup/wizard'

export type NamedRoute = { name: string }

const SETUP_WELCOME_ROUTE = 'setup'

const SETUP_STEP_ROUTE_PREFIX = 'setup-'

export const isSetupRoute = (routeName: unknown): boolean =>
  typeof routeName === 'string' &&
  (routeName === SETUP_WELCOME_ROUTE || routeName.startsWith(SETUP_STEP_ROUTE_PREFIX))

export const getCurrentSetupRoute = (state: WizardState): NamedRoute =>
  state.legacyStep > 0
    ? { name: `${SETUP_STEP_ROUTE_PREFIX}${getStepForLegacyStep(state.legacyStep).id}` }
    : { name: SETUP_WELCOME_ROUTE }

export const getWizardRedirect = (routeName: unknown, state: WizardState): NamedRoute | null => {
  if (!state.inProgress) {
    return isSetupRoute(routeName) ? { name: 'dashboard' } : null
  }

  if (!isSetupRoute(routeName)) {
    return getCurrentSetupRoute(state)
  }

  if (routeName === SETUP_WELCOME_ROUTE) {
    return null
  }
  const reachedIndex = getStepIndex(getStepForLegacyStep(state.legacyStep).id)
  const targetIndex = SETUP_STEPS.findIndex(
    (step) => `${SETUP_STEP_ROUTE_PREFIX}${step.id}` === routeName,
  )
  return targetIndex > reachedIndex ? getCurrentSetupRoute(state) : null
}

export const getLegacyStepToSave = (nextLegacyStep: number, state?: WizardState): number =>
  state?.inProgress ? Math.max(nextLegacyStep, state.legacyStep) : nextLegacyStep

export const getInternalRedirect = (redirect: unknown): string | null =>
  typeof redirect === 'string' &&
  redirect.startsWith('/') &&
  !redirect.startsWith('//') &&
  !redirect.startsWith('/\\') &&
  !redirect.startsWith('/login')
    ? redirect
    : null
