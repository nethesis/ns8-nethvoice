//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { getCountryLabel, getLanguageLabel, parsePbxLanguages } from './system'

describe('parsePbxLanguages', () => {
  it('should list languages and pick the default one', () => {
    expect(parsePbxLanguages({ it: { default: false }, en: { default: true } })).toEqual({
      languages: ['it', 'en'],
      defaultLanguage: 'en',
    })
  })

  it('should return an empty default when none is flagged', () => {
    expect(parsePbxLanguages({ it: { default: false } }).defaultLanguage).toBe('')
  })

  it('should reject an unexpected shape', () => {
    expect(() => parsePbxLanguages({ it: true })).toThrow()
  })
})

describe('getCountryLabel', () => {
  it('should name the country of a dial plan locale', () => {
    expect(getCountryLabel('it', 'en')).toBe('Italy')
    expect(getCountryLabel('de', 'it')).toBe('Germania')
  })

  it('should map the English dial plan to the United States', () => {
    expect(getCountryLabel('en', 'en')).toBe('United States')
  })

  it('should fall back to the locale code', () => {
    expect(getCountryLabel('not-a-region', 'en')).toBe('not-a-region')
  })
})

describe('getLanguageLabel', () => {
  it('should name each language in the language itself', () => {
    expect(getLanguageLabel('it')).toBe('Italiano')
    expect(getLanguageLabel('en')).toBe('English')
  })
})
