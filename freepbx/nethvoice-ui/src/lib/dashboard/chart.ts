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
