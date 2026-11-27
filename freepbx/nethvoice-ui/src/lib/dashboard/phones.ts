//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import {
  faCircleCheck,
  faCircleXmark,
  faClock,
  faLinkSlash,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { api } from '@/lib/api/client'
import type { ChartBar } from './chart'

export const DASHBOARD_PHONES_KEY = 'dashboardPhones'

export const PHONE_STATUSES = ['provisioned', 'pending', 'unassigned', 'failed'] as const

export type PhoneStatus = (typeof PHONE_STATUSES)[number]

const PHONE_STATUS_STYLES: Record<
  PhoneStatus,
  { color: string; dotClass: string; icon: IconDefinition }
> = {
  provisioned: {
    color: 'var(--accent-green)',
    dotClass: 'size-4 text-accent-green',
    icon: faCircleCheck,
  },
  pending: { color: 'var(--accent-gray)', dotClass: 'size-4 text-accent-gray', icon: faClock },
  unassigned: {
    color: 'var(--accent-amber)',
    dotClass: 'size-4 text-accent-amber',
    icon: faLinkSlash,
  },
  failed: { color: 'var(--accent-rose)', dotClass: 'size-4 text-accent-rose', icon: faCircleXmark },
}

const CountSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

const PhoneStatusSummarySchema = v.object({
  provisioned: CountSchema,
  pending: CountSchema,
  unassigned: CountSchema,
  failed: CountSchema,
  unknown: CountSchema,
  total: CountSchema,
})

export type PhoneStatusSummary = v.InferOutput<typeof PhoneStatusSummarySchema>

export const parsePhoneStatusSummary = (raw: unknown): PhoneStatusSummary =>
  v.parse(PhoneStatusSummarySchema, raw)

export const getDashboardPhones = async (signal?: AbortSignal): Promise<PhoneStatusSummary> => {
  const { data } = await api.GET('/dashboard/phones', { signal })
  return parsePhoneStatusSummary(data)
}

export const getPhoneStatusBars = (
  summary: PhoneStatusSummary | undefined,
  label: (status: PhoneStatus) => string,
): ChartBar[] =>
  PHONE_STATUSES.map((status) => ({
    id: status,
    label: label(status),
    value: summary?.[status] ?? 0,
    ...PHONE_STATUS_STYLES[status],
  }))
