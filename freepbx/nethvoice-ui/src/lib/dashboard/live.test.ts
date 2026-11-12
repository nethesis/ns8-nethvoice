//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  combineLiveCalls,
  formatCallDuration,
  getElapsedCallDuration,
  listCallsInProgress,
  parseCtiExtensions,
  parseCtiTrunks,
  parseCtiUsers,
  summarizeDevices,
  summarizePresence,
  summarizeTrunks,
  type CtiExtensions,
} from './live'

const extension = (exten: string, name: string, status = 'online', conversations = {}) => ({
  exten,
  name,
  status,
  conversations,
})

const user = (mainPresence: string, extensions: { id: string; type: string }[] = []) => ({
  mainPresence,
  endpoints: { extension: extensions },
})

describe('summarizePresence', () => {
  it('should group main presences into the four dashboard statuses', () => {
    const users = parseCtiUsers({
      a: user('online'),
      b: user('voicemail'),
      c: user('busy'),
      d: user('ringing'),
      e: user('dnd'),
      f: user('offline'),
      g: user('offline'),
    })

    expect(summarizePresence(users)).toEqual({ online: 2, busy: 2, dnd: 1, offline: 2 })
  })

  it('should count an unknown presence as offline', () => {
    expect(summarizePresence(parseCtiUsers({ a: user('away'), b: user('online') }))).toEqual({
      online: 1,
      busy: 0,
      dnd: 0,
      offline: 1,
    })
  })
})

describe('summarizeDevices', () => {
  it('should count only the connected devices by type', () => {
    const users = parseCtiUsers({
      a: user('online', [
        { id: '300', type: 'webrtc' },
        { id: '91300', type: 'mobile' },
        { id: '92300', type: 'nethlink' },
        { id: '93300', type: 'physical' },
      ]),
      b: user('offline', [
        { id: '301', type: 'webrtc' },
        { id: '92301', type: 'nethlink' },
      ]),
    })
    const extensions = parseCtiExtensions({
      '300': extension('300', 'Anna Miller'),
      '91300': extension('91300', 'Anna Miller', 'busy'),
      '92300': extension('92300', 'Anna Miller', 'offline'),
      '93300': extension('93300', 'Anna Miller'),
      '301': extension('301', 'Bob Smith', 'offline'),
    })

    expect(summarizeDevices(users, extensions)).toEqual({
      webPhone: 1,
      desktopPhone: 0,
      mobileApp: 1,
    })
  })
})

describe('listCallsInProgress', () => {
  const noTrunks = parseCtiTrunks({})

  it('should list each internal call once, from the caller side', () => {
    const extensions: CtiExtensions = parseCtiExtensions({
      '300': extension('300', 'Anna Miller', 'busy', {
        c1: {
          id: 'c1',
          linkedId: '1.1',
          duration: 30,
          direction: 'out',
          throughTrunk: false,
          throughQueue: false,
          counterpartNum: '301',
          counterpartName: 'Bob Smith',
        },
      }),
      '301': extension('301', 'Bob Smith', 'busy', {
        c2: {
          id: 'c2',
          linkedId: '1.1',
          duration: 29,
          direction: 'in',
          throughTrunk: false,
          throughQueue: false,
          counterpartNum: '300',
          counterpartName: 'Anna Miller',
        },
      }),
    })

    expect(listCallsInProgress(extensions, noTrunks)).toEqual([
      {
        id: 'internal:1.1',
        type: 'internal',
        source: 'Anna Miller',
        destination: 'Bob Smith',
        duration: 30,
        throughQueue: false,
      },
    ])
  })

  it('should take external calls from the trunks and skip their extension side', () => {
    const extensions = parseCtiExtensions({
      '300': extension('300', 'Anna Miller', 'busy', {
        c1: {
          id: 'c1',
          linkedId: '2.1',
          duration: 12,
          direction: 'in',
          throughTrunk: true,
          counterpartNum: '0612345678',
        },
      }),
    })
    const trunks = parseCtiTrunks({
      Provider: {
        name: 'Provider',
        conversations: {
          t1: {
            id: 't1',
            duration: 12,
            direction: 'in',
            internalNum: '300',
            internalName: 'Anna Miller',
            externalNum: '0612345678',
            externalName: '',
            throughQueue: true,
          },
          t2: {
            id: 't2',
            duration: 80,
            direction: 'out',
            internalNum: '301',
            internalName: '',
            externalNum: '0698765432',
            externalName: 'Acme',
          },
        },
      },
    })

    expect(listCallsInProgress(extensions, trunks)).toEqual([
      {
        id: 'trunk:Provider:t2',
        type: 'outgoing',
        source: '301',
        destination: 'Acme',
        duration: 80,
        throughQueue: false,
      },
      {
        id: 'trunk:Provider:t1',
        type: 'incoming',
        source: '0612345678',
        destination: 'Anna Miller',
        duration: 12,
        throughQueue: true,
      },
    ])
  })

  it('should skip ringing internal calls', () => {
    const extensions = parseCtiExtensions({
      '303': extension('303', 'Dario Bianchi', 'ringing', {
        d: {
          id: 'd',
          linkedId: '3.1',
          duration: 2,
          direction: 'out',
          connected: false,
          counterpartNum: '304',
        },
      }),
      '304': extension('304', 'Elena Neri', 'ringing', {
        e: {
          id: 'e',
          linkedId: '3.1',
          duration: 2,
          direction: 'in',
          connected: false,
          counterpartNum: '303',
        },
      }),
    })

    expect(listCallsInProgress(extensions, noTrunks)).toEqual([])
  })

  it('should keep internal calls to queues and feature codes', () => {
    const extensions = parseCtiExtensions({
      '302': extension('302', 'Carla Rossi', 'busy', {
        c: {
          id: 'c',
          linkedId: '2.1',
          duration: 45,
          direction: 'out',
          connected: true,
          counterpartNum: '401',
          counterpartName: 'Support queue',
        },
      }),
      '305': extension('305', 'Franco Gialli', 'busy', {
        f: {
          id: 'f',
          linkedId: '4.1',
          duration: 600,
          direction: 'out',
          connected: true,
          counterpartNum: '*43',
          counterpartName: '',
        },
      }),
    })

    expect(listCallsInProgress(extensions, noTrunks)).toEqual([
      {
        id: 'internal:4.1',
        type: 'internal',
        source: 'Franco Gialli',
        destination: '*43',
        duration: 600,
        throughQueue: false,
      },
      {
        id: 'internal:2.1',
        type: 'internal',
        source: 'Carla Rossi',
        destination: 'Support queue',
        duration: 45,
        throughQueue: false,
      },
    ])
  })

  it('should list an internal call once without a linked id', () => {
    const extensions = parseCtiExtensions({
      '300': extension('300', 'Anna Miller', 'busy', {
        c1: { id: 'c1', duration: 30, direction: 'out', counterpartNum: '301' },
      }),
      '301': extension('301', 'Bob Smith', 'busy', {
        c2: { id: 'c2', duration: 29, direction: 'in', counterpartNum: '300' },
      }),
    })

    expect(listCallsInProgress(extensions, noTrunks)).toEqual([
      {
        id: 'internal:300-301',
        type: 'internal',
        source: 'Anna Miller',
        destination: 'Bob Smith',
        duration: 30,
        throughQueue: false,
      },
    ])
  })

  it('should mark an internal call answered through a queue', () => {
    const extensions = parseCtiExtensions({
      '300': extension('300', 'Anna Miller', 'busy', {
        c1: {
          id: 'c1',
          linkedId: '5.1',
          duration: 30,
          direction: 'out',
          counterpartNum: '401',
          counterpartName: 'Sales',
        },
      }),
      '301': extension('301', 'Bob Smith', 'busy', {
        c2: {
          id: 'c2',
          linkedId: '5.1',
          duration: 20,
          direction: 'in',
          throughQueue: true,
          counterpartNum: '300',
        },
      }),
    })

    expect(listCallsInProgress(extensions, noTrunks)).toEqual([
      {
        id: 'internal:5.1',
        type: 'internal',
        source: 'Anna Miller',
        destination: 'Sales',
        duration: 30,
        throughQueue: true,
      },
    ])
  })

  it('should skip external calls that are ringing or waiting in a queue', () => {
    const up = { channelStatus: 'up' }
    const trunks = parseCtiTrunks({
      Provider: {
        name: 'Provider',
        conversations: {
          answered: {
            id: 'answered',
            duration: 60,
            direction: 'in',
            chSource: up,
            chDest: up,
            externalNum: '0612345678',
            internalNum: '300',
          },
          ringing: {
            id: 'ringing',
            duration: 3,
            direction: 'out',
            chSource: { channelStatus: 'ring' },
            chDest: { channelStatus: 'ringing' },
            externalNum: '0698765432',
            internalNum: '301',
          },
          queued: {
            id: 'queued',
            duration: 5,
            direction: 'in',
            chSource: up,
            chDest: null,
            externalNum: '0711111111',
            throughQueue: true,
          },
          flagged: {
            id: 'flagged',
            duration: 7,
            direction: 'in',
            connected: false,
            externalNum: '0722222222',
          },
        },
      },
    })

    expect(listCallsInProgress(parseCtiExtensions({}), trunks).map((call) => call.id)).toEqual([
      'trunk:Provider:answered',
    ])
  })

  it('should return no calls when nothing is in progress', () => {
    expect(
      listCallsInProgress(parseCtiExtensions({ '300': extension('300', 'Anna Miller') }), noTrunks),
    ).toEqual([])
  })
})

describe('combineLiveCalls', () => {
  it('should align the durations of sources fetched at different times', () => {
    const extensions = parseCtiExtensions({
      '300': extension('300', 'Anna Miller', 'busy', {
        c1: { id: 'c1', linkedId: '1.1', duration: 10, direction: 'out', counterpartNum: '301' },
      }),
    })
    const trunks = parseCtiTrunks({
      Provider: {
        name: 'Provider',
        conversations: {
          t1: { id: 't1', duration: 20, direction: 'in', externalNum: '0612345678' },
        },
      },
    })

    const live = combineLiveCalls(
      { data: extensions, fetchedAt: 1_000 },
      { data: trunks, fetchedAt: 4_000 },
    )

    expect(live.fetchedAt).toBe(4_000)
    expect(live.calls.map(({ id, duration }) => ({ id, duration }))).toEqual([
      { id: 'trunk:Provider:t1', duration: 20 },
      { id: 'internal:1.1', duration: 13 },
    ])
  })
})

describe('summarizeTrunks', () => {
  it('should keep the status and the registration of each trunk', () => {
    const trunks = parseCtiTrunks({
      Provider: {
        name: 'Provider',
        status: 'online',
        registration: 'registered',
        conversations: {},
      },
      Agent: { name: 'Agent', status: null, conversations: {} },
    })

    expect(summarizeTrunks(trunks)).toEqual({
      Provider: { status: 'online', registration: 'registered' },
      Agent: { status: 'unmonitored', registration: 'unmonitored' },
    })
  })
})

describe('formatCallDuration', () => {
  it('should format minutes and seconds', () => {
    expect(formatCallDuration(0)).toBe('0:00')
    expect(formatCallDuration(82)).toBe('1:22')
    expect(formatCallDuration(723)).toBe('12:03')
  })

  it('should add hours when needed', () => {
    expect(formatCallDuration(3725)).toBe('1:02:05')
    expect(formatCallDuration(3702)).toBe('1:01:42')
  })

  it('should clamp negative values', () => {
    expect(formatCallDuration(-5)).toBe('0:00')
  })
})

describe('getElapsedCallDuration', () => {
  it('should add the seconds passed since the data was fetched', () => {
    const call = {
      id: 'c',
      type: 'internal' as const,
      source: '',
      destination: '',
      duration: 10,
      throughQueue: false,
    }

    expect(getElapsedCallDuration(call, 1_000, 4_500)).toBe(13)
    expect(getElapsedCallDuration(call, 5_000, 1_000)).toBe(10)
  })
})
