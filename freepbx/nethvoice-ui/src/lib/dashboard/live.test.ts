//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
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

  it('should reject an unknown presence', () => {
    expect(() => parseCtiUsers({ a: user('away') })).toThrow()
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

  it('should return no calls when nothing is in progress', () => {
    expect(
      listCallsInProgress(parseCtiExtensions({ '300': extension('300', 'Anna Miller') }), noTrunks),
    ).toEqual([])
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
    expect(formatCallDuration(0)).toBe('00:00')
    expect(formatCallDuration(723)).toBe('12:03')
  })

  it('should add hours when needed', () => {
    expect(formatCallDuration(3725)).toBe('1:02:05')
  })

  it('should clamp negative values', () => {
    expect(formatCallDuration(-5)).toBe('00:00')
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
