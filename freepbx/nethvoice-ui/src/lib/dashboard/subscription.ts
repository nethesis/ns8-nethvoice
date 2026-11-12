//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'

export const DASHBOARD_SUBSCRIPTION_KEY = 'dashboardSubscription'

const UserLimitsResponseSchema = v.object({
  configured: v.pipe(v.number(), v.integer(), v.minValue(0)),
  limit: v.union([v.pipe(v.number(), v.integer(), v.minValue(0)), v.literal(false)]),
})

export type SubscriptionPlan = 'enterprise' | 'community'

export type DashboardSubscription = {
  plan: SubscriptionPlan
  configuredExtensions: number
  extensionsLimit: number | null
}

export const parseSubscription = (raw: unknown): DashboardSubscription => {
  const { configured, limit } = v.parse(UserLimitsResponseSchema, raw)

  return {
    plan: limit === false ? 'enterprise' : 'community',
    configuredExtensions: configured,
    extensionsLimit: limit === false ? null : limit,
  }
}

export const getExtensionsUsagePercent = (subscription: DashboardSubscription): number => {
  if (!subscription.extensionsLimit) {
    return 0
  }
  return Math.min(
    100,
    Math.round((subscription.configuredExtensions / subscription.extensionsLimit) * 100),
  )
}

export const getDashboardSubscription = async (): Promise<DashboardSubscription> => {
  const { data } = await api.GET('/mainextensions/userlimits')
  return parseSubscription(data)
}
