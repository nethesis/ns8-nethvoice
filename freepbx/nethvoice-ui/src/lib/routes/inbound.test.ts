//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  filterInboundRoutes,
  getDestinationKind,
  getInboundRouteName,
  getVisualPlanRouteUrl,
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
    expect(getDestinationKind('ext-local,vmb300,1')).toBe('voicemail')
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
