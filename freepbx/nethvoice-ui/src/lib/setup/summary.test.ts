//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { getLanguageName, getSummaryWarnings } from './summary'

const COMPLETE = {
  usersWithExtension: 3,
  physicalTrunks: 0,
  voipTrunks: 1,
  inboundRoutes: 2,
  outboundRoutes: 4,
  outboundRoutesWithoutTrunks: 0,
}

describe('getSummaryWarnings', () => {
  it('should not warn about a complete configuration', () => {
    expect(getSummaryWarnings(COMPLETE)).toEqual([])
  })

  it('should accept a physical trunk instead of a VoIP one', () => {
    expect(getSummaryWarnings({ ...COMPLETE, physicalTrunks: 1, voipTrunks: 0 })).toEqual([])
  })

  it('should list every missing piece', () => {
    expect(
      getSummaryWarnings({
        usersWithExtension: 0,
        physicalTrunks: 0,
        voipTrunks: 0,
        inboundRoutes: 0,
        outboundRoutes: 0,
        outboundRoutesWithoutTrunks: 0,
      }),
    ).toEqual(['no_extensions', 'no_trunks', 'no_inbound_routes', 'no_outbound_routes'])
  })

  it('should warn about outbound routes without trunks', () => {
    expect(getSummaryWarnings({ ...COMPLETE, outboundRoutesWithoutTrunks: 2 })).toEqual([
      'outbound_routes_without_trunks',
    ])
  })

  it('should not warn about counts that are not known yet', () => {
    expect(getSummaryWarnings({})).toEqual([])
    expect(getSummaryWarnings({ voipTrunks: 0 })).toEqual([])
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
