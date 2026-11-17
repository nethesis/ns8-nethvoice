//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'

export const DASHBOARD_SYSTEM_KEY = 'dashboardSystem'

const SystemInfoSchema = v.object({
  release: v.nullable(v.pipe(v.string(), v.trim(), v.minLength(1))),
  uptime_seconds: v.pipe(v.number(), v.integer(), v.minValue(0)),
  load_average: v.pipe(v.number(), v.minValue(0)),
  memory_used_percent: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
})

export type DashboardSystemInfo = {
  release: string | null
  uptimeSeconds: number
  loadAverage: number
  memoryUsedPercent: number
}

export type UptimeUnit = 'days' | 'hours' | 'minutes'

export type UptimePart = { unit: UptimeUnit; value: number }

export const parseSystemInfo = (raw: unknown): DashboardSystemInfo => {
  const { release, uptime_seconds, load_average, memory_used_percent } = v.parse(
    SystemInfoSchema,
    raw,
  )
  return {
    release,
    uptimeSeconds: uptime_seconds,
    loadAverage: load_average,
    memoryUsedPercent: memory_used_percent,
  }
}

export const splitUptime = (seconds: number): UptimePart[] => {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60)
  const parts: UptimePart[] = [
    { unit: 'days', value: Math.floor(totalMinutes / 1440) },
    { unit: 'hours', value: Math.floor((totalMinutes % 1440) / 60) },
    { unit: 'minutes', value: totalMinutes % 60 },
  ]
  const nonZero = parts.filter((part) => part.value > 0)

  return nonZero.length ? nonZero : [{ unit: 'minutes', value: 0 }]
}

export const formatLoadAndMemory = (
  info: Pick<DashboardSystemInfo, 'loadAverage' | 'memoryUsedPercent'>,
  locale: string,
): string => {
  const load = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(info.loadAverage)
  const memory = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(info.memoryUsedPercent / 100)

  return `${load} · ${memory}`
}

export const getDashboardSystem = async (signal?: AbortSignal): Promise<DashboardSystemInfo> => {
  const { data } = await api.GET('/dashboard/system', { signal })
  return parseSystemInfo(data)
}
