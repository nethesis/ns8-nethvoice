//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  findDuplicatedMacs,
  formatMac,
  getMacVendor,
  isValidMac,
  parseMacList,
  parseMacVendors,
  toTancrediMac,
} from './mac'

describe('isValidMac', () => {
  it('should accept colon, dash and no separators', () => {
    expect(isValidMac('00:15:65:ab:cd:ef')).toBe(true)
    expect(isValidMac('00-15-65-AB-CD-EF')).toBe(true)
    expect(isValidMac('001565ABCDEF')).toBe(true)
  })

  it('should reject wrong lengths and non hex characters', () => {
    expect(isValidMac('')).toBe(false)
    expect(isValidMac('zz:15:65:ab:cd:ef')).toBe(false)
    expect(isValidMac('00:15:65:ab:cd')).toBe(false)
  })
})

describe('toTancrediMac', () => {
  it('should uppercase and separate with dashes', () => {
    expect(toTancrediMac('00:15:65:ab:cd:ef')).toBe('00-15-65-AB-CD-EF')
    expect(toTancrediMac('001565abcdef')).toBe('00-15-65-AB-CD-EF')
  })
})

describe('formatMac', () => {
  it('should display a valid MAC with colons', () => {
    expect(formatMac('00-15-65-AB-CD-EF')).toBe('00:15:65:AB:CD:EF')
  })

  it('should leave an invalid value as typed', () => {
    expect(formatMac(' not-a-mac ')).toBe('not-a-mac')
  })
})

describe('parseMacList', () => {
  it('should split on new lines, spaces, commas and semicolons', () => {
    expect(parseMacList('00:15:65:AB:CD:EF\n 001565ABCDF0,00-15-65-AB-CD-F1;\n\n')).toEqual([
      '00:15:65:AB:CD:EF',
      '001565ABCDF0',
      '00-15-65-AB-CD-F1',
    ])
  })

  it('should return an empty list for blank text', () => {
    expect(parseMacList('  \n ')).toEqual([])
  })
})

describe('findDuplicatedMacs', () => {
  it('should compare MACs regardless of format', () => {
    expect(findDuplicatedMacs(['00:15:65:ab:cd:ef', '001565ABCDEF', '001565ABCDF0'])).toEqual([
      '00-15-65-AB-CD-EF',
    ])
  })

  it('should ignore invalid values', () => {
    expect(findDuplicatedMacs(['x', 'x'])).toEqual([])
  })
})

describe('getMacVendor', () => {
  const vendors = parseMacVendors({ '001565': 'Yealink', '0C383E': 'fanvil' })

  it('should find the vendor from the OUI', () => {
    expect(getMacVendor('00:15:65:ab:cd:ef', vendors)).toBe('yealink')
    expect(getMacVendor('0C-38-3E-00-00-01', vendors)).toBe('fanvil')
  })

  it('should return an empty vendor for unknown or invalid MACs', () => {
    expect(getMacVendor('AA:BB:CC:00:00:01', vendors)).toBe('')
    expect(getMacVendor('nope', vendors)).toBe('')
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseMacVendors({ '001565': 1 })).toThrow()
  })
})
