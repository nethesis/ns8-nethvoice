//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { derivePbxCountry, getTimeZoneCountry } from './country'

const countries = ['it', 'en', 'de']
const allCountries = ['de', 'en', 'es', 'fr', 'it']

describe('derivePbxCountry', () => {
  it('should use the country of the existing outbound routes over the one chosen in this browser', () => {
    expect(derivePbxCountry({ cached: 'de', routesLocale: 'it', countries })).toBe('it')
  })

  it('should keep the country chosen in this browser when there are no outbound routes', () => {
    expect(derivePbxCountry({ cached: 'de', routesLocale: '', countries })).toBe('de')
    expect(derivePbxCountry({ cached: 'de', routesLocale: '' })).toBe('de')
  })

  it('should use the country of the outbound routes when nothing is cached', () => {
    expect(
      derivePbxCountry({ cached: '', routesLocale: 'it', countries, defaultLanguage: 'en' }),
    ).toBe('it')
  })

  it('should fall back to the PBX language when it is a supported country', () => {
    expect(
      derivePbxCountry({ cached: '', routesLocale: '', countries, defaultLanguage: 'en' }),
    ).toBe('en')
    expect(
      derivePbxCountry({ cached: '', routesLocale: '', countries, defaultLanguage: 'fr' }),
    ).toBe('')
    expect(derivePbxCountry({ cached: '', routesLocale: '', defaultLanguage: 'en' })).toBe('')
  })

  it('should ignore values that are not supported countries', () => {
    expect(
      derivePbxCountry({ cached: 'xx', routesLocale: 'yy', countries, defaultLanguage: 'it' }),
    ).toBe('it')
  })

  it('should prefer the country of the PBX time zone to the PBX language', () => {
    expect(
      derivePbxCountry({
        cached: '',
        routesLocale: '',
        countries,
        timeZone: 'Europe/Rome',
        defaultLanguage: 'en',
      }),
    ).toBe('it')
    expect(
      derivePbxCountry({
        cached: '',
        routesLocale: '',
        countries,
        timeZone: 'America/New_York',
        defaultLanguage: 'it',
      }),
    ).toBe('en')
  })

  it('should keep the country of the outbound routes and the one chosen over the time zone', () => {
    expect(
      derivePbxCountry({ cached: '', routesLocale: 'de', countries, timeZone: 'Europe/Rome' }),
    ).toBe('de')
    expect(
      derivePbxCountry({ cached: 'de', routesLocale: '', countries, timeZone: 'Europe/Rome' }),
    ).toBe('de')
  })

  it('should fall back to the PBX language when the time zone gives no supported country', () => {
    for (const timeZone of ['', 'UTC', 'Asia/Tokyo', 'Europe/Paris', 'Not/AZone']) {
      expect(
        derivePbxCountry({
          cached: '',
          routesLocale: '',
          countries,
          timeZone,
          defaultLanguage: 'en',
        }),
      ).toBe('en')
    }
    expect(derivePbxCountry({ cached: '', routesLocale: '', timeZone: 'Europe/Rome' })).toBe('')
  })
})

describe('getTimeZoneCountry', () => {
  it('should map the time zones of the supported countries', () => {
    expect(getTimeZoneCountry('Europe/Rome', allCountries)).toBe('it')
    expect(getTimeZoneCountry('Europe/Berlin', allCountries)).toBe('de')
    expect(getTimeZoneCountry('Europe/Busingen', allCountries)).toBe('de')
    expect(getTimeZoneCountry('Europe/Paris', allCountries)).toBe('fr')
    expect(getTimeZoneCountry('Europe/Madrid', allCountries)).toBe('es')
    expect(getTimeZoneCountry('Atlantic/Canary', allCountries)).toBe('es')
    expect(getTimeZoneCountry('Africa/Ceuta', allCountries)).toBe('es')
    expect(getTimeZoneCountry('America/New_York', allCountries)).toBe('en')
    expect(getTimeZoneCountry('America/Los_Angeles', allCountries)).toBe('en')
    expect(getTimeZoneCountry('America/Indiana/Indianapolis', allCountries)).toBe('en')
    expect(getTimeZoneCountry('Pacific/Honolulu', allCountries)).toBe('en')
    expect(getTimeZoneCountry('US/Eastern', allCountries)).toBe('en')
  })

  it('should not map time zones of other countries or unknown values', () => {
    for (const timeZone of [
      '',
      ' ',
      'UTC',
      'Etc/UTC',
      'Europe/London',
      'Europe/Vatican',
      'America/Toronto',
      'America/Argentina/Buenos_Aires',
      'Europe/Rome/',
      'US/',
      'America/Indiana/',
      'europe/rome',
    ]) {
      expect(getTimeZoneCountry(timeZone, allCountries)).toBe('')
    }
  })

  it('should map only to countries the PBX supports', () => {
    expect(getTimeZoneCountry('Europe/Rome', ['de', 'en'])).toBe('')
    expect(getTimeZoneCountry('Europe/Rome')).toBe('')
  })
})
