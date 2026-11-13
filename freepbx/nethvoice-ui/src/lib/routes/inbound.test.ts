//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import {
  deleteInboundRoute,
  describeInboundDestination,
  filterInboundRoutes,
  getDestinationKind,
  getInboundRouteName,
  getVisualPlanRouteUrl,
  isInvalidDestination,
  parseInboundRoutes,
  sortInboundRoutes,
  type InboundRoute,
  type RouteDestination,
} from './inbound'

const RESPONSE = {
  destinations: {
    'ext-queues,400,1': {
      destination: 'ext-queues,400,1',
      description: '400 Customer service',
      module: 'queues',
      name: 'Queues',
      edit_url: 'config.php?display=queues&view=form&extdisplay=400',
    },
    'from-did-direct,300,1': {
      destination: 'from-did-direct,300,1',
      description: ' 300 Anna Miller',
      category: 'Extensions',
      id: 'extensions',
      module: 'core',
      name: 'Extensions',
      edit_url: '',
    },
    'ivr-2,s,1': { destination: 'ivr-2,s,1', description: 'Main menu', name: 'IVR' },
    'voice-agent-receptionist,s,1': {
      destination: 'voice-agent-receptionist,s,1',
      description: 'Agent: Receptionist',
      module: 'satellite',
      name: 'Satellite Module',
    },
    'custom-thing,s,1': {
      destination: 'custom-thing,s,1',
      description: 'Night bell',
      category: 'Custom Destinations',
      name: 'Custom',
    },
  },
  routes: [
    {
      extension: '0212345670',
      cidnum: '',
      description: 'Main office number',
      destination: 'ext-queues,400,1',
      privacyman: 0,
    },
    { extension: '0212345680', cidnum: '333', description: null, destination: 'ivr-2,s,1' },
    { extension: '0212345690', cidnum: '', description: 'Direct', destination: null },
  ],
}

const describeDestination = (destination: RouteDestination) =>
  destination.kind ? `${destination.kind}: ${destination.description}` : destination.description

describe('parseInboundRoutes', () => {
  it('should map routes and resolve their destination', () => {
    const [queueRoute, ivrRoute, emptyRoute] = parseInboundRoutes(RESPONSE)

    expect(queueRoute).toEqual({
      id: '0212345670/',
      number: '0212345670',
      cid: '',
      description: 'Main office number',
      destination: {
        target: 'ext-queues,400,1',
        kind: 'queue',
        category: 'Queues',
        description: 'Customer service (400)',
      },
    })
    expect(ivrRoute.cid).toBe('333')
    expect(ivrRoute.description).toBe('')
    expect(ivrRoute.destination).toMatchObject({ kind: 'ivr', description: 'Main menu' })
    expect(emptyRoute.destination).toEqual({
      target: '',
      kind: null,
      category: '',
      description: '',
    })
  })

  it('should move the number of an extension after its name', () => {
    const [route] = parseInboundRoutes({
      ...RESPONSE,
      routes: [{ extension: '1', cidnum: '', destination: 'from-did-direct,300,1' }],
    })

    expect(route.destination).toMatchObject({
      kind: 'extension',
      category: 'Extensions',
      description: 'Anna Miller (300)',
    })
  })

  it('should drop the redundant prefix of an AI agent', () => {
    const [route] = parseInboundRoutes({
      ...RESPONSE,
      routes: [{ extension: '1', cidnum: '', destination: 'voice-agent-receptionist,s,1' }],
    })

    expect(route.destination).toMatchObject({ kind: 'voice_agent', description: 'Receptionist' })
  })

  it('should keep the category of a destination of an unknown kind', () => {
    const [route] = parseInboundRoutes({
      ...RESPONSE,
      routes: [{ extension: '1', cidnum: '', destination: 'custom-thing,s,1' }],
    })

    expect(route.destination).toEqual({
      target: 'custom-thing,s,1',
      kind: null,
      category: 'Custom Destinations',
      description: 'Night bell',
    })
  })

  it('should show the raw target of a destination that does not exist anymore', () => {
    const [route] = parseInboundRoutes({
      ...RESPONSE,
      routes: [{ extension: '1', cidnum: '', destination: 'ext-queues,999,1' }],
    })

    expect(route.destination).toEqual({
      target: 'ext-queues,999,1',
      kind: null,
      category: '',
      description: 'ext-queues,999,1',
    })
  })

  it('should format a voicemail like an extension and keep its mode in the kind', () => {
    const [route] = parseInboundRoutes({
      destinations: {
        'ext-local,vmb200,1': {
          destination: 'ext-local,vmb200,1',
          description: '<200> Andrea (busy)',
          category: 'Voicemail',
          name: 'Voicemail',
        },
      },
      routes: [{ extension: '1', cidnum: '', destination: 'ext-local,vmb200,1' }],
    })

    expect(route.destination).toMatchObject({
      kind: 'voicemail_busy',
      description: 'Andrea (200)',
    })
  })

  it('should recognise languages and custom contexts', () => {
    const [language, context] = parseInboundRoutes({
      destinations: {
        'app-languages,1,1': {
          destination: 'app-languages,1,1',
          description: 'English',
          name: 'Languages',
        },
        'from-internal,${EXTEN},1': {
          destination: 'from-internal,${EXTEN},1',
          description: 'Full Internal Access',
          name: 'Custom Contexts',
        },
      },
      routes: [
        { extension: '1', cidnum: '', destination: 'app-languages,1,1' },
        { extension: '2', cidnum: '', destination: 'from-internal,${EXTEN},1' },
      ],
    })

    expect(language.destination).toMatchObject({ kind: 'language', description: 'English' })
    expect(context.destination).toMatchObject({
      kind: 'custom_context',
      description: 'Full Internal Access',
    })
  })

  it('should accept the empty array PHP sends for an empty destinations map', () => {
    expect(parseInboundRoutes({ destinations: [], routes: [] })).toEqual([])
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseInboundRoutes({ routes: {} })).toThrow()
    expect(() => parseInboundRoutes([])).toThrow()
  })
})

describe('getDestinationKind', () => {
  it('should recognise the FreePBX dialplan contexts', () => {
    expect(getDestinationKind('ext-group,600,1')).toBe('ring_group')
    expect(getDestinationKind('app-announcement-3,s,1')).toBe('announcement')
    expect(getDestinationKind('timeconditions,1,1')).toBe('time_condition')
    expect(getDestinationKind('app-blackhole,hangup,1')).toBe('terminate_call')
    expect(getDestinationKind('ext-local,vmb300,1')).toBe('voicemail_busy')
    expect(getDestinationKind('ext-local,vmu300,1')).toBe('voicemail_unavailable')
    expect(getDestinationKind('ext-local,vms300,1')).toBe('voicemail_no_message')
    expect(getDestinationKind('ext-local,vmi300,1')).toBe('voicemail_instructions')
    expect(getDestinationKind('ext-local,300,1')).toBe('voicemail')
    expect(getDestinationKind('app-languages,2,1')).toBe('language')
  })

  it('should return null for anything else', () => {
    expect(getDestinationKind('from-internal,${EXTEN},1')).toBeNull()
    expect(getDestinationKind('')).toBeNull()
  })
})

describe('getInboundRouteName', () => {
  it('should join number and caller ID', () => {
    expect(getInboundRouteName({ number: '123', cid: '345' })).toBe('123 / 345')
    expect(getInboundRouteName({ number: '123', cid: '' })).toBe('123')
  })

  it('should name the routes without a DID', () => {
    expect(getInboundRouteName({ number: '', cid: '' }, 'Any DID')).toBe('Any DID')
    expect(getInboundRouteName({ number: '', cid: '345' }, 'Any DID')).toBe('Any DID / 345')
    expect(getInboundRouteName({ number: '', cid: '345' })).toBe('345')
  })
})

describe('isInvalidDestination', () => {
  it('should flag only a target that does not exist anymore', () => {
    const [valid, missing, empty] = parseInboundRoutes({
      ...RESPONSE,
      routes: [
        { extension: '1', cidnum: '', destination: 'ext-queues,400,1' },
        { extension: '2', cidnum: '', destination: 'ext-queues,999,1' },
        { extension: '3', cidnum: '', destination: '' },
      ],
    })

    expect(isInvalidDestination(valid.destination)).toBe(false)
    expect(isInvalidDestination(missing.destination)).toBe(true)
    expect(isInvalidDestination(empty.destination)).toBe(false)
  })
})

describe('describeInboundDestination', () => {
  const describeKind = (kind: string) => `kind:${kind}`

  it('should prefix the description with the destination kind', () => {
    expect(
      describeInboundDestination(
        { target: 'ext-queues,400,1', kind: 'queue', category: 'Queues', description: 'Sales' },
        describeKind,
      ),
    ).toBe('kind:queue: Sales')
  })

  it('should fall back to the category when the kind is unknown', () => {
    expect(
      describeInboundDestination(
        { target: 'custom,1', kind: null, category: 'Custom', description: 'Night' },
        describeKind,
      ),
    ).toBe('Custom: Night')
  })

  it('should return an empty text without a description', () => {
    expect(
      describeInboundDestination(
        { target: '', kind: null, category: '', description: '' },
        describeKind,
      ),
    ).toBe('')
  })
})

describe('deleteInboundRoute', () => {
  const route = parseInboundRoutes(RESPONSE)[0]

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should report a route deleted in the meantime', async () => {
    vi.spyOn(api, 'POST').mockRejectedValue(
      new ApiError({ status: 404, method: 'POST', url: '/inboundroutes/delete', body: null }),
    )

    await expect(deleteInboundRoute(route)).resolves.toBe('not_found')
  })

  it('should rethrow any other error', async () => {
    vi.spyOn(api, 'POST').mockRejectedValue(
      new ApiError({ status: 500, method: 'POST', url: '/inboundroutes/delete', body: null }),
    )

    await expect(deleteInboundRoute(route)).rejects.toThrow()
  })
})

describe('filterInboundRoutes', () => {
  const routes = parseInboundRoutes(RESPONSE)

  it('should match number, caller ID, description and destination label', () => {
    const filter = (text: string) =>
      filterInboundRoutes(routes, text, describeDestination).map((route) => route.number)

    expect(filter('')).toHaveLength(3)
    expect(filter('5680')).toEqual(['0212345680'])
    expect(filter('333')).toEqual(['0212345680'])
    expect(filter('main OFFICE')).toEqual(['0212345670'])
    expect(filter('queue: customer')).toEqual(['0212345670'])
    expect(filter('nothing')).toEqual([])
  })
})

describe('sortInboundRoutes', () => {
  const route = (number: string, description: string, target: string): InboundRoute => ({
    id: `${number}/`,
    number,
    cid: '',
    description,
    destination: { target, kind: null, category: '', description: target },
  })
  const routes = [route('20', 'b', 'x'), route('3', 'c', 'z'), route('100', 'a', 'y')]
  const sort = (key: 'number' | 'description' | 'destination', descending = false) =>
    sortInboundRoutes(routes, key, descending, describeDestination).map((item) => item.number)

  it('should sort numbers naturally', () => {
    expect(sort('number')).toEqual(['3', '20', '100'])
    expect(sort('number', true)).toEqual(['100', '20', '3'])
  })

  it('should sort by description and destination', () => {
    expect(sort('description')).toEqual(['100', '20', '3'])
    expect(sort('destination')).toEqual(['20', '100', '3'])
  })

  it('should not change the given list', () => {
    sort('number')
    expect(routes.map((item) => item.number)).toEqual(['20', '3', '100'])
  })
})

describe('getVisualPlanRouteUrl', () => {
  it('should point to a new route when none is given', () => {
    expect(getVisualPlanRouteUrl()).toBe('/freepbx/visualplan/?did=new_route')
  })

  it('should identify a route by number and caller ID', () => {
    expect(getVisualPlanRouteUrl({ number: '0212345670', cid: '' })).toBe(
      '/freepbx/visualplan/?did=0212345670%20%2F%20',
    )
    expect(getVisualPlanRouteUrl({ number: '+39021234', cid: '333' })).toBe(
      '/freepbx/visualplan/?did=%2B39021234%20%2F%20333',
    )
  })
})
