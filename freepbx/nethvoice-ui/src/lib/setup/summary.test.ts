//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { getLanguageName, getSummaryWarnings } from './summary'

const COMPLETE = {
  usersWithExtension: 3,
  usableTrunks: 1,
  inboundRoutes: 2,
  outboundRoutes: 4,
  outboundRoutesWithoutTrunks: 0,
  outboundRoutesWithUnusableTrunks: 0,
}

describe('getSummaryWarnings', () => {
  it('should not warn about a complete configuration', () => {
    expect(getSummaryWarnings(COMPLETE)).toEqual([])
  })

  it('should list every missing piece', () => {
    expect(
      getSummaryWarnings({
        usersWithExtension: 0,
        usableTrunks: 0,
        inboundRoutes: 0,
        outboundRoutes: 0,
        outboundRoutesWithoutTrunks: 0,
        outboundRoutesWithUnusableTrunks: 0,
      }),
    ).toEqual(['no_extensions', 'no_trunks', 'no_inbound_routes', 'no_outbound_routes'])
  })

  it('should warn about outbound routes without trunks', () => {
    expect(getSummaryWarnings({ ...COMPLETE, outboundRoutesWithoutTrunks: 2 })).toEqual([
      'outbound_routes_without_trunks',
    ])
  })

  it('should tell when no outbound route has trunks', () => {
    expect(getSummaryWarnings({ ...COMPLETE, outboundRoutesWithoutTrunks: 4 })).toEqual([
      'all_outbound_routes_without_trunks',
    ])
  })

  it('should warn about outbound routes with only trunks that cannot be used', () => {
    expect(getSummaryWarnings({ ...COMPLETE, outboundRoutesWithUnusableTrunks: 1 })).toEqual([
      'outbound_routes_with_unusable_trunks',
    ])
    expect(
      getSummaryWarnings({ ...COMPLETE, usableTrunks: 0, outboundRoutesWithUnusableTrunks: 4 }),
    ).toEqual(['no_trunks'])
  })

  it('should not warn about counts that are not known yet', () => {
    expect(getSummaryWarnings({})).toEqual([])
    expect(getSummaryWarnings({ outboundRoutes: 2 })).toEqual([])
  })
})

describe('getLanguageName', () => {
  it('should name the language in the interface language', () => {
    expect(getLanguageName('it', 'en')).toBe('Italian')
    expect(getLanguageName('en', 'it')).toBe('Inglese')
  })

  it('should fall back to the code', () => {
    expect(getLanguageName('', 'en')).toBe('')
  })
})
