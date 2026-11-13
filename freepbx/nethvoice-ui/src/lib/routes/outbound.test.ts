//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import {
  buildCreateDefaultsRequest,
  buildUpdateTrunksRequest,
  DefaultRoutesSchema,
  filterOutboundRoutes,
  getAvailableTrunks,
  getNoTrunksToAddReason,
  getOutboundRouteAdvancedUrl,
  getOutboundTrunks,
  getRouteTrunkState,
  getRoutesLocale,
  hasActiveTrunk,
  haveSameTrunks,
  moveItem,
  parseOutboundRouteDefaults,
  parseOutboundRoutes,
  parseRouteName,
  sortOutboundRoutes,
  type OutboundRoute,
} from './outbound'
import type { Trunk } from '@/lib/trunks/trunks'

const TWT = { id: 2, name: 'TWT-0212345678' }
const TIM = { id: 3, name: 'TIM-0114455667' }
const VODAFONE = { id: 5, name: 'Vodafone-0698765432' }

const AGENT = { id: 1, name: 'VoiceAgentTrunk_2' }

const BACKUP = { id: 7, name: 'Backup' }

const toTrunk = (trunk: { id: number; name: string }, values: Partial<Trunk> = {}): Trunk => ({
  id: trunk.id,
  name: trunk.name,
  technology: 'pjsip',
  phoneNumber: '',
  username: '',
  provider: '',
  sipServer: '',
  codecs: [],
  disabled: false,
  context: '',
  ...values,
})

const TRUNKS: Trunk[] = [
  toTrunk(AGENT, { provider: 'satellite-agent' }),
  toTrunk(TWT),
  toTrunk(TIM),
  toTrunk(VODAFONE),
  toTrunk(BACKUP, { disabled: true }),
]

const ROUTES_RESPONSE = [
  {
    route_id: 4,
    name: 'toll_it',
    outcid: '',
    mohclass: 'default',
    seq: 0,
    trunks: [],
  },
  {
    route_id: '1',
    name: 'national_it',
    seq: 1,
    trunks: [
      { trunkid: 2, name: 'TWT-0212345678' },
      { trunkid: '3', name: 'TIM-0114455667' },
    ],
  },
  { route_id: 9, name: 'Emergency calls', seq: 2, trunks: [{ trunkid: 5, name: null }] },
]

const DEFAULTS_RESPONSE = {
  en: [
    { name: 'national_en', trunks: [{ trunkid: 2, name: 'TWT-0212345678' }] },
    { name: 'cellphone_en', trunks: [{ trunkid: 2, name: 'TWT-0212345678' }] },
  ],
  it: [
    { name: 'national_it', trunks: [{ trunkid: 2, name: 'TWT-0212345678' }] },
    { name: 'cellphone_it', trunks: [{ trunkid: 2, name: 'TWT-0212345678' }] },
  ],
}

describe('parseRouteName', () => {
  it('should split the name of a default route', () => {
    expect(parseRouteName('international_it')).toEqual({ kind: 'international', locale: 'it' })
    expect(parseRouteName('toll_en')).toEqual({ kind: 'toll', locale: 'en' })
  })

  it('should treat any other name as a custom route', () => {
    expect(parseRouteName('Emergency calls')).toEqual({ kind: null, locale: '' })
    expect(parseRouteName('national')).toEqual({ kind: null, locale: '' })
    expect(parseRouteName('my_national_it')).toEqual({ kind: null, locale: '' })
  })
})

describe('parseOutboundRoutes', () => {
  it('should keep the order of the routes and of their trunks', () => {
    expect(parseOutboundRoutes(ROUTES_RESPONSE)).toEqual([
      { id: 4, name: 'toll_it', kind: 'toll', locale: 'it', trunks: [] },
      { id: 1, name: 'national_it', kind: 'national', locale: 'it', trunks: [TWT, TIM] },
      {
        id: 9,
        name: 'Emergency calls',
        kind: null,
        locale: '',
        trunks: [{ id: 5, name: '5' }],
      },
    ])
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseOutboundRoutes({})).toThrow()
    expect(() => parseOutboundRoutes([{ route_id: 'abc', name: 'x', trunks: [] }])).toThrow()
  })
})

describe('parseOutboundRouteDefaults', () => {
  it('should list locales, route names and the available trunks', () => {
    expect(parseOutboundRouteDefaults(DEFAULTS_RESPONSE)).toEqual({
      locales: ['en', 'it'],
      routeNamesByLocale: {
        en: ['national_en', 'cellphone_en'],
        it: ['national_it', 'cellphone_it'],
      },
      trunks: [TWT],
    })
  })

  it('should accept the empty array PHP sends when no locale is installed', () => {
    expect(parseOutboundRouteDefaults([])).toEqual({
      locales: [],
      routeNamesByLocale: {},
      trunks: [],
    })
  })
})

describe('getRoutesLocale', () => {
  it('should read the locale from the first default route', () => {
    expect(getRoutesLocale(parseOutboundRoutes(ROUTES_RESPONSE))).toBe('it')
  })

  it('should return an empty string when every route is custom', () => {
    expect(getRoutesLocale([{ locale: '' }])).toBe('')
    expect(getRoutesLocale([])).toBe('')
  })
})

describe('buildCreateDefaultsRequest', () => {
  it('should create the routes of the locale with every available trunk', () => {
    const defaults = parseOutboundRouteDefaults(DEFAULTS_RESPONSE)

    expect(buildCreateDefaultsRequest('it', defaults, TRUNKS)).toEqual({
      it: [
        { name: 'national_it', trunks: [{ trunkid: 2, name: 'TWT-0212345678' }] },
        { name: 'cellphone_it', trunks: [{ trunkid: 2, name: 'TWT-0212345678' }] },
      ],
    })
  })

  it('should leave out the trunks of the AI agents and the disabled trunks', () => {
    const toDefaultTrunk = (trunk: { id: number; name: string }) => ({
      trunkid: trunk.id,
      name: trunk.name,
    })
    const defaults = parseOutboundRouteDefaults({
      it: [
        {
          name: 'national_it',
          trunks: [AGENT, TWT, BACKUP, TIM].map(toDefaultTrunk),
        },
      ],
    })

    expect(buildCreateDefaultsRequest('it', defaults, TRUNKS)).toEqual({
      it: [
        {
          name: 'national_it',
          trunks: [
            { trunkid: 2, name: 'TWT-0212345678' },
            { trunkid: 3, name: 'TIM-0114455667' },
          ],
        },
      ],
    })
  })

  it('should build an empty list for an unknown locale', () => {
    const defaults = parseOutboundRouteDefaults(DEFAULTS_RESPONSE)

    expect(buildCreateDefaultsRequest('pt', defaults, TRUNKS)).toEqual({ pt: [] })
  })
})

describe('buildUpdateTrunksRequest', () => {
  const routes = parseOutboundRoutes(ROUTES_RESPONSE)

  it('should send every route in its current order and replace the trunks of one', () => {
    expect(buildUpdateTrunksRequest(routes, 4, [VODAFONE, TWT])).toEqual({
      it: [
        {
          route_id: 4,
          name: 'toll_it',
          trunks: [
            { trunkid: 5, name: 'Vodafone-0698765432' },
            { trunkid: 2, name: 'TWT-0212345678' },
          ],
        },
        {
          route_id: 1,
          name: 'national_it',
          trunks: [
            { trunkid: 2, name: 'TWT-0212345678' },
            { trunkid: 3, name: 'TIM-0114455667' },
          ],
        },
        { route_id: 9, name: 'Emergency calls', trunks: [{ trunkid: 5, name: '5' }] },
      ],
    })
  })

  it('should drop the trunks that do not exist anymore', () => {
    const request = buildUpdateTrunksRequest(routes, 4, [VODAFONE, TWT], [toTrunk(TWT)])

    expect(request.it.map((route) => route.trunks)).toEqual([
      [{ trunkid: 2, name: 'TWT-0212345678' }],
      [{ trunkid: 2, name: 'TWT-0212345678' }],
      [],
    ])
  })

  it('should fall back to a locale key when every route is custom', () => {
    const custom = routes.filter((route) => route.kind === null)

    expect(Object.keys(buildUpdateTrunksRequest(custom, 9, []))).toEqual(['en'])
  })
})

describe('getAvailableTrunks', () => {
  it('should leave out the trunks already in the route', () => {
    expect(getAvailableTrunks([TWT, TIM, VODAFONE], [TIM])).toEqual([TWT, VODAFONE])
    expect(getAvailableTrunks([TWT], [TWT])).toEqual([])
  })

  it('should leave out the trunks of the AI agents and the disabled trunks', () => {
    expect(getAvailableTrunks([AGENT, TWT, BACKUP, TIM], [TIM], TRUNKS)).toEqual([TWT])
  })
})

describe('getOutboundTrunks', () => {
  it('should keep only the enabled trunks that can place calls', () => {
    expect(getOutboundTrunks([AGENT, TWT, BACKUP, { id: 42, name: '42' }], TRUNKS)).toEqual([TWT])
  })
})

describe('getRouteTrunkState', () => {
  it('should describe the trunks of a route', () => {
    expect(getRouteTrunkState(2, TRUNKS)).toBe('active')
    expect(getRouteTrunkState(7, TRUNKS)).toBe('disabled')
    expect(getRouteTrunkState(1, TRUNKS)).toBe('voice_agents')
    expect(getRouteTrunkState(42, TRUNKS)).toBe('deleted')
  })

  it('should not flag anything before the trunks are loaded', () => {
    expect(getRouteTrunkState(42, undefined)).toBe('active')
  })
})

describe('getNoTrunksToAddReason', () => {
  it('should tell why no trunk can be added', () => {
    expect(getNoTrunksToAddReason([TWT, TIM], TRUNKS)).toBe('all_assigned')
    expect(getNoTrunksToAddReason([AGENT, BACKUP], TRUNKS)).toBe('no_enabled_trunks')
    expect(getNoTrunksToAddReason([AGENT], TRUNKS)).toBe('no_trunks')
    expect(getNoTrunksToAddReason([], TRUNKS)).toBe('no_trunks')
  })
})

describe('hasActiveTrunk', () => {
  it('should find an enabled trunk in the route', () => {
    expect(hasActiveTrunk([BACKUP, TWT], TRUNKS)).toBe(true)
    expect(hasActiveTrunk([BACKUP, AGENT, { id: 42, name: '42' }], TRUNKS)).toBe(false)
    expect(hasActiveTrunk([], TRUNKS)).toBe(false)
  })

  it('should not flag anything before the trunks are loaded', () => {
    expect(hasActiveTrunk([BACKUP], undefined)).toBe(true)
  })
})

describe('moveItem', () => {
  it('should move an item up or down', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  })

  it('should ignore a move outside of the list', () => {
    const items = ['a', 'b']

    expect(moveItem(items, 0, 2)).toBe(items)
    expect(moveItem(items, -1, 0)).toBe(items)
    expect(moveItem(items, 1, 1)).toBe(items)
  })

  it('should not change the given list', () => {
    const items = ['a', 'b', 'c']

    moveItem(items, 0, 2)
    expect(items).toEqual(['a', 'b', 'c'])
  })
})

describe('haveSameTrunks', () => {
  it('should compare trunks and their order', () => {
    expect(haveSameTrunks([TWT, TIM], [TWT, TIM])).toBe(true)
    expect(haveSameTrunks([TWT, TIM], [TIM, TWT])).toBe(false)
    expect(haveSameTrunks([TWT], [TWT, TIM])).toBe(false)
    expect(haveSameTrunks([], [])).toBe(true)
  })
})

describe('filterOutboundRoutes', () => {
  const routes = parseOutboundRoutes(ROUTES_RESPONSE)
  const describeRoute = (route: OutboundRoute) => [route.kind === 'toll' ? 'Premium numbers' : '']
  const filter = (text: string) =>
    filterOutboundRoutes(routes, text, describeRoute).map((route) => route.id)

  it('should match name, translated labels and trunks', () => {
    expect(filter('')).toEqual([4, 1, 9])
    expect(filter('premium')).toEqual([4])
    expect(filter('emergency')).toEqual([9])
    expect(filter('tim-01')).toEqual([1])
    expect(filter('nothing')).toEqual([])
  })
})

describe('sortOutboundRoutes', () => {
  const routes = parseOutboundRoutes(ROUTES_RESPONSE)
  const getRouteTitle = (route: OutboundRoute) => route.name
  const sort = (key: 'position' | 'name', descending = false) =>
    sortOutboundRoutes(routes, key, descending, getRouteTitle).map((route) => route.id)

  it('should keep the dialplan order by default', () => {
    expect(sort('position')).toEqual([4, 1, 9])
    expect(sort('position', true)).toEqual([9, 1, 4])
  })

  it('should sort by title', () => {
    expect(sort('name')).toEqual([9, 1, 4])
    expect(sort('name', true)).toEqual([4, 1, 9])
  })
})

describe('getOutboundRouteAdvancedUrl', () => {
  it('should point to the FreePBX form of the route', () => {
    expect(getOutboundRouteAdvancedUrl({ id: 7 })).toBe(
      '/freepbx/admin/config.php?display=routing&view=form&id=7',
    )
  })
})

describe('DefaultRoutesSchema', () => {
  it('should require a country', () => {
    const result = v.safeParse(DefaultRoutesSchema, { country: '' })

    expect(result.success).toBe(false)
    expect(result.issues?.[0].message).toBe('routes.country_required')
    expect(v.safeParse(DefaultRoutesSchema, { country: 'it' }).success).toBe(true)
  })
})
