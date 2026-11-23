//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { parseVisualPlanData } from './api'
import { connect, loadFlow } from './graph'
import {
  matchesTimeGroup,
  matchesTimeSpec,
  simulateCall,
  type SimulationOptions,
} from './simulation'

const DATA = parseVisualPlanData({
  inboundRoutes: [
    {
      extension: '100',
      cidnum: '',
      description: '',
      alertinfo: '',
      grppre: '',
      destination: 'timeconditions,1,1',
    },
  ],
  extensions: [{ extension: '201', name: 'Alice', voicemail: true }],
  conferences: [],
  ringGroups: [],
  queues: [
    {
      id: '401',
      name: 'Sales',
      staticMembers: [],
      dynamicMembers: [],
      strategy: 'ringall',
      agentTimeout: 15,
      maxWait: 0,
      destination: 'ext-local,vmu201,1',
      ringing: 'moh',
      cidPrefix: '',
      joinAnnouncement: null,
      positionAnnouncement: false,
      announceFrequency: 0,
      breakoutIvr: null,
      musicOnHold: 'inherit',
    },
  ],
  ivrs: [
    {
      id: 4,
      name: 'Menu',
      description: '',
      announcement: null,
      directDial: false,
      invalidDestination: 'app-blackhole,hangup,1',
      timeoutDestination: 'ivr-4,s,1',
      entries: [{ selection: '1', destination: 'ext-queues,401,1' }],
    },
  ],
  cqrs: [],
  announcements: [],
  timeConditions: [
    {
      id: 1,
      name: 'Office',
      timeGroup: 7,
      trueDestination: 'ivr-4,s,1',
      falseDestination: 'app-daynight,1,1',
    },
  ],
  timeGroups: [{ id: 7, description: 'Weekdays', times: ['09:00-18:00|mon-fri|*|*'] }],
  callFlowControls: [
    {
      id: '1',
      name: 'Holidays',
      state: 'DAY',
      normalDestination: 'ext-local,vmu201,1',
      overrideDestination: 'app-blackhole,hangup,1',
    },
  ],
  availableCallFlowCodes: [],
  setCallerIds: [],
  directDids: [],
  queueExits: [],
  queueOptions: [],
  queuePriorities: [],
  recordings: [],
  musicOnHold: [],
  destinations: [],
  unavailable: [],
})

const WEDNESDAY_10 = new Date(2026, 10, 18, 10, 30)
const SATURDAY_10 = new Date(2026, 10, 21, 10, 30)

const options = (overrides: Partial<SimulationOptions> = {}): SimulationOptions => ({
  date: WEDNESDAY_10,
  timeGroups: DATA.timeGroups.map((group) => ({ ref: String(group.id), data: group })),
  callFlowStates: {},
  menuChoices: {},
  answered: {},
  ...overrides,
})

describe('matchesTimeSpec', () => {
  it('matches time, weekday, day and month ranges', () => {
    expect(matchesTimeSpec('09:00-18:00|mon-fri|*|*', WEDNESDAY_10)).toBe(true)
    expect(matchesTimeSpec('09:00-18:00|mon-fri|*|*', SATURDAY_10)).toBe(false)
    expect(matchesTimeSpec('11:00-18:00|*|*|*', WEDNESDAY_10)).toBe(false)
    expect(matchesTimeSpec('22:00-06:00|*|*|*', new Date(2026, 0, 1, 23, 0))).toBe(true)
    expect(matchesTimeSpec('*|fri-mon|*|*', SATURDAY_10)).toBe(true)
    expect(matchesTimeSpec('*|*|18|nov', WEDNESDAY_10)).toBe(true)
    expect(matchesTimeSpec('*|*|25|dec', WEDNESDAY_10)).toBe(false)
    expect(matchesTimeSpec('*|*|*|*', WEDNESDAY_10)).toBe(true)
    expect(matchesTimeSpec('9-18|*|*|*', new Date(2026, 0, 1, 3, 0))).toBe(false)
    expect(matchesTimeSpec('*|SAT|*|*', SATURDAY_10)).toBe(true)
    expect(matchesTimeGroup({ id: 1, description: '', times: ['*|*|*|*'] }, WEDNESDAY_10)).toBe(
      false,
    )
  })
})

describe('simulateCall', () => {
  it('follows the time condition and the menu choice to the queue', () => {
    const { state } = loadFlow(DATA, '100/')
    const ivr = state.nodes['ivr:4']
    if (ivr?.type !== 'ivr' || !ivr.data.entries[0]) throw new Error('missing ivr')

    const result = simulateCall(
      state,
      options({ menuChoices: { 'ivr:4': { kind: 'entry', entryId: ivr.data.entries[0].id } } }),
    )
    expect(result.steps.map((step) => [step.nodeId, step.reason])).toEqual([
      ['inboundRoute:100/', 'start'],
      ['timeCondition:1', 'time_matches'],
      ['ivr:4', 'menu_choice'],
      ['queue:401', 'answered'],
    ])
    expect(result.end).toBe('answered')
  })

  it('goes to the fail over of an unanswered queue', () => {
    const { state } = loadFlow(DATA, '100/')
    const ivr = state.nodes['ivr:4']
    if (ivr?.type !== 'ivr' || !ivr.data.entries[0]) throw new Error('missing ivr')

    const result = simulateCall(
      state,
      options({
        menuChoices: { 'ivr:4': { kind: 'entry', entryId: ivr.data.entries[0].id } },
        answered: { 'queue:401': false },
      }),
    )
    expect(result.steps.at(-1)).toEqual({
      nodeId: 'voicemail:vmu201',
      output: null,
      reason: 'ends_call',
    })
    expect(result.end).toBe('ended')
  })

  it('takes the override mode out of office hours and detects loops', () => {
    const { state } = loadFlow(DATA, '100/')

    const closed = simulateCall(
      state,
      options({ date: SATURDAY_10, callFlowStates: { 'callFlowControl:1': 'NIGHT' } }),
    )
    expect(closed.steps.map((step) => step.reason)).toEqual([
      'start',
      'time_does_not_match',
      'override_mode',
      'ends_call',
    ])

    expect(
      simulateCall(state, options({ menuChoices: { 'ivr:4': { kind: 'timeout' } } })).end,
    ).toBe('menu_repeats')
  })

  it('stops where a destination is not connected', () => {
    const { state } = loadFlow(DATA, '100/')
    connect(state, 'timeCondition:1', 'trueDestination', '')

    expect(simulateCall(state, options())).toEqual({
      steps: [
        { nodeId: 'inboundRoute:100/', output: 'destination', reason: 'start' },
        { nodeId: 'timeCondition:1', output: 'trueDestination', reason: 'time_matches' },
      ],
      end: 'not_connected',
    })
  })
})
