//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const

export type TimeRule = {
  startTime: string
  endTime: string
  startDay: string
  endDay: string
  startDate: string
  endDate: string
  startMonth: string
  endMonth: string
}

export const EMPTY_RULE: TimeRule = {
  startTime: '09:00',
  endTime: '18:00',
  startDay: 'mon',
  endDay: 'fri',
  startDate: '',
  endDate: '',
  startMonth: '',
  endMonth: '',
}

const splitRange = (value: string | undefined): [string, string] => {
  if (!value || value === '*') {
    return ['', '']
  }
  const [start = '', end = start] = value.split('-')
  return [start, end]
}

export const ALWAYS_SPEC = '*|*|*|*'

export const parseTimeRule = (spec: string): TimeRule => {
  const [time, days, dates, months] = spec.trim().toLowerCase().split('|')
  const [startTime, endTime] = splitRange(time)
  const [startDay, endDay] = splitRange(days)
  const [startDate, endDate] = splitRange(dates)
  const [startMonth, endMonth] = splitRange(months)

  return { startTime, endTime, startDay, endDay, startDate, endDate, startMonth, endMonth }
}

const joinRange = (start: string, end: string): string => {
  if (!start) {
    return '*'
  }
  return !end || end === start ? start : `${start}-${end}`
}

export const formatTimeRule = (rule: TimeRule): string =>
  [
    joinRange(rule.startTime, rule.endTime),
    joinRange(rule.startDay, rule.endDay),
    joinRange(rule.startDate, rule.endDate),
    joinRange(rule.startMonth, rule.endMonth),
  ].join('|')

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const validateTimeRule = (rule: TimeRule): string[] => {
  const errors: string[] = []

  if (formatTimeRule(rule) === ALWAYS_SPEC) {
    return ['always']
  }

  if (rule.startTime || rule.endTime) {
    if (!TIME.test(rule.startTime)) errors.push('startTime')
    if (!TIME.test(rule.endTime)) errors.push('endTime')
  }
  for (const field of ['startDate', 'endDate'] as const) {
    const value = rule[field]
    if (value && !(/^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 31)) {
      errors.push(field)
    }
  }
  const pairs = [
    ['startDay', 'endDay'],
    ['startDate', 'endDate'],
    ['startMonth', 'endMonth'],
  ] as const
  for (const [start, end] of pairs) {
    if (rule[end] && !rule[start] && !errors.includes(start)) {
      errors.push(start)
    }
  }
  return errors
}
