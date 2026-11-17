//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

export const MIN_VISIBLE_BAR_RATIO = 0.03

export type ChartOrientation = 'vertical' | 'horizontal'

export type ChartBar = {
  id: string
  label: string
  value: number
  color: string
  dotClass: string
  icon?: IconDefinition
}

export const getBarRatios = (values: number[]): number[] => {
  const max = Math.max(0, ...values)

  if (max === 0) {
    return values.map(() => 0)
  }
  return values.map((value) => (value > 0 ? Math.max(MIN_VISIBLE_BAR_RATIO, value / max) : 0))
}

export const getCenteredBarDomain = (
  count: number,
  availableSize: number,
  barSize: number,
  gap: number,
): [number, number] => {
  if (count <= 0 || availableSize <= 0) {
    return [0, 1]
  }
  const center = (count - 1) / 2
  const halfSpan = availableSize / (barSize + gap) / 2

  return [center - halfSpan, center + halfSpan]
}

export const LAST_HOUR_OF_DAY = 23

export const HOUR_TICK_STEP = 3

export const HOUR_TICKS = Array.from(
  { length: Math.floor(LAST_HOUR_OF_DAY / HOUR_TICK_STEP) + 1 },
  (_, index) => index * HOUR_TICK_STEP,
)

const NICE_STEP_FACTORS = [1, 2, 5, 10]

export const formatHourOfDay = (hour: number, locale: string): string =>
  new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(2000, 0, 1, hour),
  )

export const getIntegerTicks = (max: number, maxTicks = 5): number[] => {
  const top = Math.max(1, Math.ceil(max))
  const roughStep = top / Math.max(1, maxTicks - 1)
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const niceStep =
    NICE_STEP_FACTORS.map((factor) => factor * magnitude).find((step) => step >= roughStep) ??
    roughStep
  const step = Math.max(1, Math.round(niceStep))

  return Array.from({ length: Math.ceil(top / step) + 1 }, (_, index) => index * step)
}
