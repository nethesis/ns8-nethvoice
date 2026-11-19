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
  calls_by_hour: v.pipe(v.array(CountSchema), v.maxLength(24)),
})

export type CallsSummary = Record<CallOutcome, number> & { callsByHour: number[] }

export const parseCallsSummary = (raw: unknown): CallsSummary => {
  const { calls_by_hour, ...outcomes } = v.parse(CallsSummarySchema, raw)
  return { ...outcomes, callsByHour: calls_by_hour }
}

export const getDashboardCalls = async (signal?: AbortSignal): Promise<CallsSummary> => {
  const { data } = await api.GET('/dashboard/calls', { signal })
  return parseCallsSummary(data)
}

export const DASHBOARD_CALLS_HISTORY_KEY = 'dashboardCallsHistory'

export const DASHBOARD_CALLS_HISTORY_STALE_TIME = 5 * 60 * 1000

export const CALLS_RANGES = ['24h', '7d', '15d'] as const

export type CallsRange = (typeof CALLS_RANGES)[number]

export const DEFAULT_CALLS_RANGE: CallsRange = '24h'

export const isCallsRange = (value: unknown): value is CallsRange =>
  typeof value === 'string' && (CALLS_RANGES as readonly string[]).includes(value)

export const normalizeCallsRange = (saved: unknown): CallsRange =>
  isCallsRange(saved) ? saved : DEFAULT_CALLS_RANGE

const UnixTimeSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

const CallsHistorySchema = v.object({
  range: v.picklist(CALLS_RANGES),
  history_start: v.nullable(UnixTimeSchema),
  series: v.array(
    v.object({
      time: UnixTimeSchema,
      calls: v.nullable(v.pipe(v.number(), v.minValue(0))),
    }),
  ),
})

export type CallsPoint = { time: number; calls: number | null }

export type CallsHistory = {
  range: CallsRange
  historyStart: number | null
  series: CallsPoint[]
}

export const parseCallsHistory = (raw: unknown): CallsHistory => {
  const { range, history_start, series } = v.parse(CallsHistorySchema, raw)

  return {
    range,
    historyStart: history_start === null ? null : history_start * 1000,
    series: series.map(({ time, calls }) => ({ time: time * 1000, calls })),
  }
}

export const getDashboardCallsHistory = async (
  range: CallsRange,
  signal?: AbortSignal,
): Promise<CallsHistory> => {
  const { data } = await api.GET('/dashboard/calls', { params: { query: { range } }, signal })
  return parseCallsHistory(data)
}

export const isHistoryPartial = (history: CallsHistory): boolean => {
  const first = history.series[0]

  return history.historyStart !== null && first !== undefined && history.historyStart > first.time
}
