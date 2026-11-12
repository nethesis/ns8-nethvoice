//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { TANCREDI_API_URL } from '@/lib/config'
import { parseGroups } from '@/lib/groups/groups'
import { adminApiGet } from './ctiClient'

export const DASHBOARD_COUNTER_KEY = 'dashboardCounter'

export const DASHBOARD_COUNTERS_REFRESH_INTERVAL = 60000

export const DASHBOARD_COUNTERS_STALE_TIME = DASHBOARD_COUNTERS_REFRESH_INTERVAL / 2

export const DASHBOARD_COUNTER_IDS = [
  'users',
  'groups',
  'physicalPhones',
  'trunks',
  'inboundRoutes',
  'outboundRoutes',
] as const

export type DashboardCounterId = (typeof DASHBOARD_COUNTER_IDS)[number]

const CountSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

const ListSchema = v.array(v.unknown())

export const parseCount = (raw: unknown): number => v.parse(CountSchema, raw)

const COUNTER_LOADERS: Record<DashboardCounterId, (signal?: AbortSignal) => Promise<number>> = {
  users: async (signal) => parseCount((await api.GET('/users/count', { signal })).data),
  groups: async (signal) => parseGroups((await api.GET('/cti/groups', { signal })).data).length,
  physicalPhones: async (signal) =>
    (await adminApiGet(`${TANCREDI_API_URL}/phones`, ListSchema, signal)).length,
  trunks: async (signal) => parseCount((await api.GET('/trunks/count', { signal })).data),
  inboundRoutes: async (signal) =>
    parseCount((await api.GET('/inboundroutes/count', { signal })).data),
  outboundRoutes: async (signal) =>
    parseCount((await api.GET('/outboundroutes/count', { signal })).data),
}

export const getDashboardCounter = (
  id: DashboardCounterId,
  signal?: AbortSignal,
): Promise<number> => COUNTER_LOADERS[id](signal)
