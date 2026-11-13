// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { endOfDay, format, isValid, parse, startOfDay } from 'date-fns'
import { zonedTimeToUtc } from 'date-fns-tz'

export function normalizeForwardingPickerDate(dateValue: any) {
  if (!dateValue) {
    return ''
  }

  if (dateValue instanceof Date) {
    return isValid(dateValue) ? format(dateValue, 'yyyy-MM-dd') : ''
  }

  if (typeof dateValue === 'string') {
    const parsedDateValue = dateValue.includes('T')
      ? parse(dateValue, "yyyy-MM-dd'T'HH:mm", new Date())
      : parse(dateValue, 'yyyy-MM-dd', new Date())

    if (isValid(parsedDateValue)) {
      return format(parsedDateValue, 'yyyy-MM-dd')
    }
  }

  const fallbackDateValue = new Date(dateValue)
  return isValid(fallbackDateValue) ? format(fallbackDateValue, 'yyyy-MM-dd') : ''
}

export function buildForwardingDateTime(
  dateValue: any,
  timeValue: string | null | undefined,
  fallbackTime: string,
) {
  const normalizedDate = normalizeForwardingPickerDate(dateValue)

  if (!normalizedDate) {
    return ''
  }

  const effectiveTime = timeValue && timeValue !== '' ? timeValue : fallbackTime
  return `${normalizedDate}T${effectiveTime}`
}

export function convertForwardingDateRangeToIso(
  dateBeginValue: string,
  dateEndValue: string,
  timezone: string,
) {
  const dateBeginConversion = parse(dateBeginValue, "yyyy-MM-dd'T'HH:mm", new Date())
  const dateEndConversion = parse(dateEndValue, "yyyy-MM-dd'T'HH:mm", new Date())

  if (!isValid(dateBeginConversion) || !isValid(dateEndConversion)) {
    throw new RangeError('Invalid forwarding date value')
  }

  return {
    dateBeginToSendApi: zonedTimeToUtc(dateBeginConversion, timezone).toISOString(),
    dateEndToSendApi: zonedTimeToUtc(dateEndConversion, timezone).toISOString(),
  }
}

export function convertForwardingFullDayToIso(dateValue: string, timezone: string) {
  const normalizedDate = normalizeForwardingPickerDate(dateValue)
  const parsedDate = parse(normalizedDate, 'yyyy-MM-dd', new Date())

  if (!normalizedDate || !isValid(parsedDate)) {
    throw new RangeError('Invalid forwarding date value')
  }

  return {
    dateBegin: zonedTimeToUtc(startOfDay(parsedDate), timezone).toISOString(),
    dateEnd: zonedTimeToUtc(endOfDay(parsedDate), timezone).toISOString(),
  }
}
