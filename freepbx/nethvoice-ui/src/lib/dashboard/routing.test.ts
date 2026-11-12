//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { parseInboundRoutes } from '@/lib/routes/inbound'
import {
  describeInboundDestination,
  listInboundRouteDestinations,
  listTrunkRegistrations,
} from './routing'

const describeKind = (kind: string) => `kind:${kind}`

describe('listTrunkRegistrations', () => {
  const trunks = [
    { id: 1, name: 'Provider' },
    { id: 2, name: 'Backup' },
    { id: 3, name: 'Gateway' },
    { id: 4, name: 'Agent' },
  ]

  it('should read the registration of each trunk from the live state', () => {
    const live = {
      Provider: { status: 'online', registration: 'registered' },
      Backup: { status: 'offline', registration: 'rejected' },
      Agent: { status: 'online', registration: 'unmonitored' },
    }

    expect(listTrunkRegistrations(trunks, live)).toEqual([
      { id: '1', label: 'Provider', registration: 'registered' },
      { id: '2', label: 'Backup', registration: 'rejected' },
      { id: '3', label: 'Gateway', registration: 'pending' },
      { id: '4', label: 'Agent', registration: 'unmonitored' },
    ])
  })

  it('should report an unknown registration without live state', () => {
    expect(listTrunkRegistrations(trunks.slice(0, 1), undefined)).toEqual([
      { id: '1', label: 'Provider', registration: 'unknown' },
    ])
  })
})

describe('describeInboundDestination', () => {
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

describe('listInboundRouteDestinations', () => {
  it('should pair each DID with its destination', () => {
    const routes = parseInboundRoutes({
      destinations: {
        'ext-group,600,1': {
          destination: 'ext-group,600,1',
          description: '600 Support',
          name: 'Ring Groups',
        },
      },
      routes: [
        {
          extension: '0612345678',
          cidnum: '',
          description: 'Main',
          destination: 'ext-group,600,1',
        },
        { extension: '0698765432', cidnum: '333', description: 'VIP', destination: '' },
      ],
    })

    expect(listInboundRouteDestinations(routes, describeKind)).toEqual([
      {
        id: '0612345678/',
        label: '0612345678',
        destination: 'kind:ring_group: Support (600)',
      },
      { id: '0698765432/333', label: '0698765432 / 333', destination: '' },
    ])
  })
})
