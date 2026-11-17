//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { derivePbxCountry } from './country'

const countries = ['it', 'en', 'de']

describe('derivePbxCountry', () => {
  it('should keep the country chosen in this browser', () => {
    expect(derivePbxCountry({ cached: 'de', routesLocale: 'it', countries })).toBe('de')
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
})
