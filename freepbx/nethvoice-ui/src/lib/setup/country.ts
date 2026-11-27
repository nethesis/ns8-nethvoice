//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export type PbxCountrySources = {
  cached: string
  routesLocale: string
  countries?: readonly string[]
  timeZone?: string
  defaultLanguage?: string
}

const COUNTRY_TIME_ZONES: Record<string, readonly string[]> = {
  de: ['Europe/Berlin', 'Europe/Busingen'],
  en: [
    'America/New_York',
    'America/Detroit',
    'America/Chicago',
    'America/Menominee',
    'America/Denver',
    'America/Boise',
    'America/Phoenix',
    'America/Los_Angeles',
    'America/Anchorage',
    'America/Juneau',
    'America/Sitka',
    'America/Metlakatla',
    'America/Yakutat',
    'America/Nome',
    'America/Adak',
    'Pacific/Honolulu',
    'America/Indiana/',
    'America/Kentucky/',
    'America/North_Dakota/',
    'US/',
  ],
  es: ['Europe/Madrid', 'Africa/Ceuta', 'Atlantic/Canary'],
  fr: ['Europe/Paris'],
  it: ['Europe/Rome'],
}

const matchesTimeZone = (timeZone: string, zone: string) =>
  zone.endsWith('/')
    ? timeZone.startsWith(zone) && /^[^/]+$/.test(timeZone.slice(zone.length))
    : timeZone === zone

export const getTimeZoneCountry = (timeZone: string, countries?: readonly string[]): string =>
  countries?.find((pbxLocale) =>
    (COUNTRY_TIME_ZONES[pbxLocale] ?? []).some((zone) => matchesTimeZone(timeZone, zone)),
  ) ?? ''

export const derivePbxCountry = ({
  cached,
  routesLocale,
  countries,
  timeZone = '',
  defaultLanguage = '',
}: PbxCountrySources): string => {
  const isSupported = (pbxLocale: string) =>
    pbxLocale !== '' && (!countries || countries.includes(pbxLocale))

  if (isSupported(routesLocale)) {
    return routesLocale
  }

  if (isSupported(cached)) {
    return cached
  }
  const timeZoneCountry = getTimeZoneCountry(timeZone, countries)

  if (timeZoneCountry) {
    return timeZoneCountry
  }
  return countries?.includes(defaultLanguage) ? defaultLanguage : ''
}
