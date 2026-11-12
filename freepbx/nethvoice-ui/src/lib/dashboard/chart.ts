//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export const MIN_VISIBLE_BAR_RATIO = 0.03

export const BAR_END_RADIUS = 4

export type ChartOrientation = 'vertical' | 'horizontal'

export type ChartBar = {
  id: string
  label: string
  value: number
  fillClass: string
  dotClass: string
}

export const getBarRatios = (values: number[]): number[] => {
  const max = Math.max(0, ...values)

  if (max === 0) {
    return values.map(() => 0)
  }
  return values.map((value) => (value > 0 ? Math.max(MIN_VISIBLE_BAR_RATIO, value / max) : 0))
}

const round = (value: number) => Math.round(value * 100) / 100

export const verticalBarPath = (x: number, width: number, height: number, baseline: number) => {
  if (width <= 0 || height <= 0) {
    return ''
  }
  const radius = Math.min(BAR_END_RADIUS, height, width / 2)
  const top = round(baseline - height)
  const left = round(x)
  const right = round(x + width)

  return [
    `M${left},${round(baseline)}`,
    `V${round(top + radius)}`,
    `Q${left},${top} ${round(left + radius)},${top}`,
    `H${round(right - radius)}`,
    `Q${right},${top} ${right},${round(top + radius)}`,
    `V${round(baseline)}`,
    'Z',
  ].join(' ')
}

export const horizontalBarPath = (y: number, length: number, thickness: number) => {
  if (length <= 0 || thickness <= 0) {
    return ''
  }
  const radius = Math.min(BAR_END_RADIUS, length, thickness / 2)
  const top = round(y)
  const bottom = round(y + thickness)
  const end = round(length)

  return [
    `M0,${top}`,
    `H${round(end - radius)}`,
    `Q${end},${top} ${end},${round(top + radius)}`,
    `V${round(bottom - radius)}`,
    `Q${end},${bottom} ${round(end - radius)},${bottom}`,
    'H0',
    'Z',
  ].join(' ')
}

export type VerticalBarsLayout = { barWidth: number; offset: number; step: number }

export const layoutVerticalBars = (
  count: number,
  availableWidth: number,
  maxBarWidth: number,
  gap: number,
): VerticalBarsLayout => {
  if (count <= 0 || availableWidth <= 0) {
    return { barWidth: 0, offset: 0, step: 0 }
  }
  const barWidth = Math.max(0, Math.min(maxBarWidth, (availableWidth - gap * (count - 1)) / count))
  const used = barWidth * count + gap * (count - 1)

  return { barWidth, offset: Math.max(0, (availableWidth - used) / 2), step: barWidth + gap }
}
