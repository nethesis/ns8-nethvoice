//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { parseInboundRoutes } from '@/lib/routes/inbound'
import {
  describeInboundDestination,
  getDashboardTrunkStatus,
  listInboundRouteDestinations,
  listTrunkStatuses,
} from './routing'

const describeKind = (kind: string) => `kind:${kind}`

const TEXTS = { describeKind, anyDid: 'Any DID' }

describe('getDashboardTrunkStatus', () => {
  const live = {
    Offline: { status: 'offline', registration: 'registered' },
    Rejected: { status: 'online', registration: 'rejected' },
    Unregistered: { status: 'online', registration: 'unregistered' },
    Registered: { status: 'unmonitored', registration: 'registered' },
    Sent: { status: 'online', registration: 'sent' },
    Online: { status: 'online', registration: 'unmonitored' },
    Unmonitored: { status: 'unmonitored', registration: 'unmonitored' },
  }

  it('should put an offline provider before the registration', () => {
    expect(getDashboardTrunkStatus('Offline', live)).toBe('offline')
  })

  it('should report failed and missing registrations without calling them rejected', () => {
    expect(getDashboardTrunkStatus('Rejected', live)).toBe('rejected')
    expect(getDashboardTrunkStatus('Unregistered', live)).toBe('not_connected')
  })

  it('should report the registration when it is monitored', () => {
    expect(getDashboardTrunkStatus('Registered', live)).toBe('registered')
    expect(getDashboardTrunkStatus('Sent', live)).toBe('pending')
  })

  it('should fall back to the provider status without a monitored registration', () => {
    expect(getDashboardTrunkStatus('Online', live)).toBe('online')
    expect(getDashboardTrunkStatus('Unmonitored', live)).toBe('unmonitored')
  })

  it('should be pending for a trunk missing from the live state', () => {
    expect(getDashboardTrunkStatus('New', live)).toBe('pending')
  })

  it('should be unknown without live state', () => {
    expect(getDashboardTrunkStatus('Offline', undefined)).toBe('unknown')
  })
})

describe('listTrunkStatuses', () => {
  it('should pair each trunk with its status', () => {
    const trunks = [
      { id: 1, name: 'Provider' },
      { id: 2, name: 'Backup' },
    ]
    const live = {
      Provider: { status: 'online', registration: 'registered' },
      Backup: { status: 'offline', registration: 'rejected' },
    }

    expect(listTrunkStatuses(trunks, live)).toEqual([
      { id: '1', label: 'Provider', status: 'registered' },
      { id: '2', label: 'Backup', status: 'offline' },
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

    expect(listInboundRouteDestinations(routes, TEXTS)).toEqual([
      {
        id: '0612345678/',
        label: '0612345678',
        destination: 'kind:ring_group: Support (600)',
        invalidDestination: false,
      },
      {
        id: '0698765432/333',
        label: '0698765432 / 333',
        destination: '',
        invalidDestination: false,
      },
    ])
  })

  it('should name the routes without a DID and flag missing destinations', () => {
    const routes = parseInboundRoutes({
      destinations: [],
      routes: [
        { extension: '', cidnum: '', description: 'Any', destination: 'ivr-99,s,1' },
        { extension: '', cidnum: '333', description: 'Any VIP', destination: '' },
      ],
    })

    expect(listInboundRouteDestinations(routes, TEXTS)).toEqual([
      { id: '/', label: 'Any DID', destination: '', invalidDestination: true },
      { id: '/333', label: 'Any DID / 333', destination: '', invalidDestination: false },
    ])
  })
})
