//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'

export const DASHBOARD_CALLS_KEY = 'dashboardCalls'

export const CALL_OUTCOMES = ['total', 'answered', 'missed', 'invalid'] as const

export type CallOutcome = (typeof CALL_OUTCOMES)[number]

const CountSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

const CallsSummarySchema = v.object({
  total: CountSchema,
  answered: CountSchema,
  missed: CountSchema,
  invalid: CountSchema,
  incoming_by_hour: v.pipe(v.array(CountSchema), v.maxLength(24)),
})

export type CallsSummary = Record<CallOutcome, number> & { incomingByHour: number[] }

export const parseCallsSummary = (raw: unknown): CallsSummary => {
  const { incoming_by_hour, ...outcomes } = v.parse(CallsSummarySchema, raw)
  return { ...outcomes, incomingByHour: incoming_by_hour }
}

export const getDashboardCalls = async (signal?: AbortSignal): Promise<CallsSummary> => {
  const { data } = await api.GET('/dashboard/calls', { signal })
  return parseCallsSummary(data)
}
