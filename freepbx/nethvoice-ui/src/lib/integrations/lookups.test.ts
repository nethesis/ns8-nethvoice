//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  getProfileNames,
  parseExtensionOptions,
  parseGroupNames,
  parseProfileIdList,
  toProfileIdNumbers,
  toProfileOptions,
} from './lookups'

describe('toProfileOptions', () => {
  it('should keep id as text and name, sorted by name', () => {
    expect(
      toProfileOptions([
        { id: 3, name: 'Standard' },
        { id: 1, name: 'Base' },
      ]),
    ).toEqual([
      { id: '1', name: 'Base' },
      { id: '3', name: 'Standard' },
    ])
  })
})

describe('parseGroupNames', () => {
  it('should list the names in order', () => {
    expect(
      parseGroupNames([
        { id: 2, name: 'Sales' },
        { id: 1, name: 'Marketing' },
      ]),
    ).toEqual(['Marketing', 'Sales'])
  })
})

describe('parseExtensionOptions', () => {
  it('should keep extension and name, ignoring the rest', () => {
    expect(
      parseExtensionOptions([
        { extension: '301', name: 'Christopher Davis', password: 'x' },
        { extension: 300, name: null },
      ]),
    ).toEqual([
      { extension: '300', name: '' },
      { extension: '301', name: 'Christopher Davis' },
    ])
  })
})

describe('getProfileNames', () => {
  const profiles = [
    { id: '1', name: 'Base' },
    { id: '3', name: 'Standard' },
  ]

  it('should name the profiles and fall back to the id', () => {
    expect(getProfileNames(['3', '1', '9'], profiles)).toEqual(['#9', 'Base', 'Standard'])
  })
})

describe('toProfileIdNumbers', () => {
  it('should return unique positive integers in order', () => {
    expect(toProfileIdNumbers(['3', '1', '3', 'x', '0'])).toEqual([1, 3])
  })
})

describe('parseProfileIdList', () => {
  it('should split a comma separated list', () => {
    expect(parseProfileIdList('1, 3,')).toEqual(['1', '3'])
    expect(parseProfileIdList('')).toEqual([])
  })
})
