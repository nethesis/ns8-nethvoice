//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Component } from 'vue'

export type SetupStepId =
  | 'system'
  | 'users'
  | 'physical-trunks'
  | 'voip-trunks'
  | 'inbound-routes'
  | 'outbound-routes'
  | 'summary'

export type SetupStep = {
  id: SetupStepId
  path: string
  i18n: string
  legacyStep: number
  component: () => Promise<Component>
}

export const LEGACY_FINAL_STEP = 13

export const LEGACY_SUMMARY_STEP = 12

export const SETUP_STEPS: SetupStep[] = [
  {
    id: 'system',
    path: 'system',
    i18n: 'system',
    legacyStep: 0,
    component: () => import('@/components/setup/SetupSystemStep.vue'),
  },
  {
    id: 'users',
    path: 'users',
    i18n: 'users',
    legacyStep: 1,
    component: () => import('@/components/setup/SetupUsersStep.vue'),
  },
  {
    id: 'physical-trunks',
    path: 'physical-trunks',
    i18n: 'physical_trunks',
    legacyStep: 2,
    component: () => import('@/components/setup/SetupPhysicalTrunksStep.vue'),
  },
  {
    id: 'voip-trunks',
    path: 'voip-trunks',
    i18n: 'voip_trunks',
    legacyStep: 3,
    component: () => import('@/components/setup/SetupVoipTrunksStep.vue'),
  },
  {
    id: 'inbound-routes',
    path: 'inbound-routes',
    i18n: 'inbound_routes',
    legacyStep: 4,
    component: () => import('@/components/setup/SetupInboundRoutesStep.vue'),
  },
  {
    id: 'outbound-routes',
    path: 'outbound-routes',
    i18n: 'outbound_routes',
    legacyStep: 5,
    component: () => import('@/components/setup/SetupOutboundRoutesStep.vue'),
  },
  {
    id: 'summary',
    path: 'summary',
    i18n: 'summary',
    legacyStep: LEGACY_SUMMARY_STEP,
    component: () => import('@/components/setup/SetupSummaryStep.vue'),
  },
]

export const getStepIndex = (stepId: SetupStepId): number =>
  SETUP_STEPS.findIndex((step) => step.id === stepId)

export const getStepById = (stepId: SetupStepId): SetupStep => {
  const step = SETUP_STEPS.find((item) => item.id === stepId)

  if (!step) {
    throw new Error(`unknown setup step ${stepId}`)
  }
  return step
}

export const getPreviousStep = (stepId: SetupStepId): SetupStep | undefined =>
  SETUP_STEPS[getStepIndex(stepId) - 1]

export const getNextStep = (stepId: SetupStepId): SetupStep | undefined =>
  SETUP_STEPS[getStepIndex(stepId) + 1]

export const getStepForLegacyStep = (legacyStep: number): SetupStep => {
  const reached = SETUP_STEPS.filter((step) => step.legacyStep <= legacyStep)
  return reached[reached.length - 1] ?? SETUP_STEPS[0]
}

export const getStepProgress = (stepId: SetupStepId): number =>
  Math.round(((getStepIndex(stepId) + 1) / SETUP_STEPS.length) * 100)
