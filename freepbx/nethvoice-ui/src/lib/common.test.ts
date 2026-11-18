//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  compareNatural,
  foldText,
  matchesText,
  needsPaginator,
  normalize,
  paginate,
} from './common'

describe('normalize', () => {
  it('should lowercase and replace spaces', () => {
    expect(normalize('Already Exists')).toBe('already_exists')
  })
})

describe('matchesText', () => {
  it('should match everything with an empty filter', () => {
    expect(matchesText('  ', 'anything')).toBe(true)
  })

  it('should match case-insensitively on any value', () => {
    expect(matchesText('MIL', 'Anna Miller', 'a.miller')).toBe(true)
    expect(matchesText('30', 'Anna', 300)).toBe(true)
  })

  it('should not match missing values', () => {
    expect(matchesText('x', null, undefined, 'abc')).toBe(false)
  })

  it('should ignore accents and repeated spaces', () => {
    expect(matchesText('muller', 'Ärger Müller')).toBe(true)
    expect(matchesText('Müller', 'Arger Muller')).toBe(true)
    expect(matchesText('anna  rossi', 'Anna Rossi')).toBe(true)
    expect(matchesText('anna rossi', 'Anna   Rossi')).toBe(true)
  })
})

describe('foldText', () => {
  it('should strip diacritics, collapse spaces and lowercase', () => {
    expect(foldText('  Ärger   Müller ')).toBe('arger muller')
  })
})

describe('paginate', () => {
  it('should return the requested page', () => {
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4])
  })

  it('should return a short last page', () => {
    expect(paginate([1, 2, 3, 4, 5], 3, 2)).toEqual([5])
  })
})

describe('needsPaginator', () => {
  it('should hide the paginator when every row fits in the default page', () => {
    expect(needsPaginator(0, 5, 5)).toBe(false)
    expect(needsPaginator(5, 5, 5)).toBe(false)
    expect(needsPaginator(4, 10, 5)).toBe(false)
  })

  it('should show the paginator when the rows exceed the page', () => {
    expect(needsPaginator(6, 5, 5)).toBe(true)
  })

  it('should keep the page size control after a larger page size is chosen', () => {
    expect(needsPaginator(7, 25, 5)).toBe(true)
  })

  it('should show the paginator when a smaller page size is chosen', () => {
    expect(needsPaginator(7, 5, 10)).toBe(true)
    expect(needsPaginator(7, 25, 10)).toBe(false)
  })
})

describe('compareNatural', () => {
  it('should sort numbers inside strings by value', () => {
    expect(['302', '91200', '1000', '200'].sort(compareNatural)).toEqual([
      '200',
      '302',
      '1000',
      '91200',
    ])
  })
})
