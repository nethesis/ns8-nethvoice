//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { CallsPoint } from '@/lib/dashboard/calls'

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

const NICE_STEP_FACTORS = [1, 2, 5, 10]

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

export const MIN_TICK_SPACING = 64

const HOUR_TICK_STEPS = [1, 2, 3, 4, 6, 12]

const DAY_TICK_STEPS = [1, 2, 3, 5, 7]

const pickStep = (steps: number[], count: number, maxTicks: number) =>
  steps.find((step) => Math.ceil(count / step) <= maxTicks)

export const getMaxTicks = (width: number): number =>
  Math.max(2, Math.floor(width / MIN_TICK_SPACING))

export const getTimeTicks = (times: number[], maxTicks: number): number[] => {
  const hourStep = pickStep(HOUR_TICK_STEPS, times.length, maxTicks)

  if (hourStep !== undefined) {
    return times.filter((time) => new Date(time).getHours() % hourStep === 0)
  }
  const midnights = times.filter((time) => new Date(time).getHours() === 0)
  const step =
    pickStep(DAY_TICK_STEPS, midnights.length, maxTicks) ??
    DAY_TICK_STEPS[DAY_TICK_STEPS.length - 1]

  return midnights.filter((_, index) => (midnights.length - 1 - index) % step === 0)
}

export const formatTimeTick = (time: number, locale: string): string =>
  new Intl.DateTimeFormat(
    locale,
    new Date(time).getHours() === 0
      ? { day: 'numeric', month: 'short' }
      : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  ).format(time)

export const formatPointTime = (time: number, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(time)

export const formatDateTime = (time: number, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(time)

export const formatCallCount = (calls: number, locale: string): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(calls)

export type DefinedCallsPoint = { time: number; calls: number }

const isDefinedPoint = (point: CallsPoint): point is DefinedCallsPoint => point.calls !== null

export const splitIntoSegments = (series: CallsPoint[]): DefinedCallsPoint[][] =>
  series.reduce<DefinedCallsPoint[][]>((segments, point, index) => {
    if (!isDefinedPoint(point)) {
      return segments
    }
    const previous = series[index - 1]
    const current = segments[segments.length - 1]

    if (current && previous && isDefinedPoint(previous)) {
      current.push(point)
    } else {
      segments.push([point])
    }
    return segments
  }, [])

export type SeriesSummary = { total: number; peak: DefinedCallsPoint | null; hasData: boolean }

export const summarizeSeries = (series: CallsPoint[]): SeriesSummary =>
  series.filter(isDefinedPoint).reduce<SeriesSummary>(
    (summary, point) => ({
      total: summary.total + point.calls,
      peak: point.calls > (summary.peak?.calls ?? 0) ? point : summary.peak,
      hasData: true,
    }),
    { total: 0, peak: null, hasData: false },
  )

export type TimeDomain = [number, number]

export const HOUR_MS = 3600 * 1000

export const MIN_ZOOM_SPAN = 3 * HOUR_MS

export const MIN_DRAG_DISTANCE = 6

export const getVisiblePoints = (series: CallsPoint[], [start, end]: TimeDomain): CallsPoint[] =>
  series.filter((point) => point.time >= start && point.time <= end)

const snapToHour = (time: number, origin: number) =>
  origin + Math.round((time - origin) / HOUR_MS) * HOUR_MS

const fitDomain = (start: number, span: number, [dataStart, dataEnd]: TimeDomain): TimeDomain => {
  const fitted = Math.min(Math.max(start, dataStart), dataEnd - span)

  return [fitted, fitted + span]
}

const resizeDomain = (
  lower: number,
  upper: number,
  data: TimeDomain,
  minSpan: number,
): TimeDomain | null => {
  const span = Math.max(minSpan, upper - lower)

  if (span >= data[1] - data[0]) {
    return null
  }
  return fitDomain(
    upper - lower >= minSpan ? lower : snapToHour((lower + upper - minSpan) / 2, data[0]),
    span,
    data,
  )
}

export const getZoomDomain = (
  from: number,
  to: number,
  data: TimeDomain,
  minSpan = MIN_ZOOM_SPAN,
): TimeDomain | null =>
  resizeDomain(
    Math.max(snapToHour(Math.min(from, to), data[0]), data[0]),
    Math.min(snapToHour(Math.max(from, to), data[0]), data[1]),
    data,
    minSpan,
  )

export const scaleZoom = (
  [start, end]: TimeDomain,
  factor: number,
  data: TimeDomain,
): TimeDomain | null => {
  const center = (start + end) / 2
  const halfSpan = ((end - start) * factor) / 2

  return resizeDomain(
    snapToHour(center - halfSpan, data[0]),
    snapToHour(center + halfSpan, data[0]),
    data,
    MIN_ZOOM_SPAN,
  )
}

export const panZoom = ([start, end]: TimeDomain, ratio: number, data: TimeDomain): TimeDomain => {
  const shift = Math.sign(ratio) * Math.max(HOUR_MS, snapToHour(Math.abs((end - start) * ratio), 0))

  return fitDomain(start + shift, end - start, data)
}

export const keepZoom = (zoom: TimeDomain | null, data: TimeDomain): TimeDomain | null =>
  zoom && zoom[1] > data[0] && zoom[0] < data[1] && zoom[1] - zoom[0] < data[1] - data[0]
    ? fitDomain(zoom[0], zoom[1] - zoom[0], data)
    : null

export const formatPeriod = ([start, end]: TimeDomain, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatRange(start, end)
