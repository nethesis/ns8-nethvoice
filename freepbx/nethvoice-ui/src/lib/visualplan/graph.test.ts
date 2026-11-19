//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { parseVisualPlanData, type VisualPlanData } from './api'
import {
  buildChanges,
  connect,
  createNode,
  expandFrom,
  loadFlow,
  reachableIds,
  removeNode,
} from './graph'
import { buildDestination, destinationOfNode, parseDestination } from './model'
import { hasErrors, validateFlow } from './validation'
import { countHidden, hiddenByCollapse } from './collapse'

const empty = {
  inboundRoutes: [],
  extensions: [],
  conferences: [],
  ringGroups: [],
  queues: [],
  ivrs: [],
  cqrs: [],
  announcements: [],
  timeConditions: [],
  timeGroups: [],
  callFlowControls: [],
  availableCallFlowCodes: ['1', '2'],
  setCallerIds: [],
  directDids: [],
  queueExits: [],
  queueOptions: [],
  queuePriorities: [],
  recordings: [],
  musicOnHold: ['default'],
  destinations: [],
  unavailable: [],
}

const DATA: VisualPlanData = parseVisualPlanData({
  ...empty,
  inboundRoutes: [
    {
      extension: '0721405516',
      cidnum: '',
      description: 'Main',
      alertinfo: '',
      grppre: '',
      destination: 'timeconditions,1,1',
    },
  ],
  extensions: [
    { extension: '201', name: 'Alice', voicemail: true },
    { extension: '202', name: 'Bob', voicemail: false },
  ],
  timeConditions: [
    {
      id: 1,
      name: 'Office hours',
      timeGroup: 3,
      trueDestination: 'ivr-4,s,1',
      falseDestination: 'ext-local,vmu201,1',
    },
  ],
  ivrs: [
    {
      id: '4',
      name: 'Main menu',
      description: '',
      announcement: null,
      directDial: true,
      invalidDestination: '',
      timeoutDestination: 'ivr-4,s,1',
      entries: [
        { selection: '1', destination: 'ext-queues,401,1' },
        { selection: '2', destination: 'app-blackhole,busy,1' },
        { selection: '3', destination: 'ext-trunk,1,1' },
      ],
    },
  ],
  queues: [
    {
      id: '401',
      name: 'Sales',
      staticMembers: [{ extension: '201', penalty: 0 }],
      dynamicMembers: [],
      strategy: 'ringall',
      agentTimeout: 15,
      maxWait: '',
      destination: '',
      ringing: 'moh',
      cidPrefix: '',
      joinAnnouncement: null,
      positionAnnouncement: false,
      announceFrequency: 0,
      breakoutIvr: null,
      musicOnHold: 'inherit',
    },
  ],
  destinations: [{ destination: 'ext-trunk,1,1', category: 'Trunks', description: 'Provider' }],
})

describe('destinations', () => {
  it('parses and builds goto strings', () => {
    expect(parseDestination('ivr-4,s,1')).toEqual({ type: 'ivr', key: '4' })
    expect(parseDestination('ext-local,vmb201,1')).toEqual({ type: 'voicemail', key: 'vmb201' })
    expect(parseDestination('voice-agent-x,s,1')).toEqual({
      type: 'other',
      key: 'voice-agent-x,s,1',
    })
    expect(parseDestination('  ')).toBeNull()
    expect(buildDestination('queuePriority', '2')).toBe('app-queueprio,2,1')
    expect(buildDestination('directDid', '5')).toBe('directdid-5,${EXTEN},1')
  })
})

describe('loadFlow', () => {
  it('walks every destination from the inbound route, cycles included', () => {
    const { state } = loadFlow(DATA, '0721405516/')

    expect(state.rootId).toBe('inboundRoute:0721405516/')
    expect(Object.keys(state.nodes).sort()).toEqual(
      [
        'inboundRoute:0721405516/',
        'timeCondition:1',
        'ivr:4',
        'voicemail:vmu201',
        'queue:401',
        'hangup:busy@ivr:4/entry:e2',
        'other:ext-trunk,1,1',
      ]
        .map((id) => (id.startsWith('hangup') ? expect.stringMatching(/^hangup:busy@ivr:4\//) : id))
        .sort(),
    )
    expect(state.edges.filter((edge) => edge.source === 'ivr:4')).toHaveLength(4)
  })

  it('creates a new inbound route as root when there is no route', () => {
    const { state } = loadFlow(DATA, null)
    const root = state.nodes[state.rootId]

    expect(root?.isNew).toBe(true)
    expect(state.edges).toHaveLength(0)
  })
})

describe('buildChanges', () => {
  it('sends nothing when the flow did not change', () => {
    const { state, baseline } = loadFlow(DATA, '0721405516/')
    expect(buildChanges(state, baseline, DATA)).toEqual([])
  })

  it('sends only the changed objects, with new references and mailboxes', () => {
    const { state, baseline } = loadFlow(DATA, '0721405516/')
    const announcement = createNode(state, 'announcement', {
      id: null,
      description: 'Closed',
      recording: 7,
    })
    const mailbox = createNode(state, 'voicemail', { extension: '202', mode: 'vmb' })
    connect(state, 'timeCondition:1', 'falseDestination', announcement.id)
    connect(state, announcement.id, 'destination', mailbox.id)

    const changes = buildChanges(state, baseline, DATA)

    expect(changes).toEqual([
      {
        type: 'timeCondition',
        ref: '1',
        isNew: false,
        data: expect.objectContaining({
          trueDestination: 'ivr-4,s,1',
          falseDestination: `new:${announcement.key}`,
        }),
      },
      {
        type: 'announcement',
        ref: announcement.key,
        isNew: true,
        data: { id: null, description: 'Closed', recording: 7, destination: 'ext-local,vmb202,1' },
      },
      { type: 'voicemail', ref: 'vm:202', isNew: true, data: { extension: '202' } },
    ])
  })

  it('keeps the menu entries of an IVR in order', () => {
    const { state, baseline } = loadFlow(DATA, '0721405516/')
    const ivr = state.nodes['ivr:4']
    if (ivr?.type !== 'ivr') throw new Error('missing ivr')
    ivr.data.entries.push({ id: 'x', value: '9' })

    const [change] = buildChanges(state, baseline, DATA)
    expect(change?.data.entries).toEqual([
      { selection: '1', destination: 'ext-queues,401,1' },
      { selection: '2', destination: 'app-blackhole,busy,1' },
      { selection: '3', destination: 'ext-trunk,1,1' },
      { selection: '9', destination: '' },
    ])
    expect(change?.data.invalidDestination).toBe('')
  })
})

describe('graph edits', () => {
  it('removes a node and unlinks its sources', () => {
    const { state } = loadFlow(DATA, '0721405516/')
    removeNode(state, 'queue:401')

    expect(state.nodes['queue:401']).toBeUndefined()
    expect(state.edges.some((edge) => edge.target === 'queue:401')).toBe(false)
    removeNode(state, state.rootId)
    expect(state.nodes[state.rootId]).toBeDefined()
  })

  it('expands the subtree of an existing object added to the canvas', () => {
    const { state, catalog } = loadFlow(DATA, null)
    const ivr = catalog.get('ivr:4')?.node
    if (!ivr) throw new Error('missing ivr')
    state.nodes[ivr.id] = structuredClone(ivr)

    const added = expandFrom(state, catalog, [ivr.id])
    expect(added).toContain('queue:401')
    expect(reachableIds(state).has('ivr:4')).toBe(false)
    expect(destinationOfNode(ivr)).toBe('ivr-4,s,1')
  })
})

describe('validateFlow', () => {
  it('flags a new route without destination and a duplicated number', () => {
    const { state } = loadFlow(DATA, null)
    createNode(state, 'queue', {
      id: '401',
      name: '',
      staticMembers: [],
      dynamicMembers: [],
      strategy: 'ringall',
      agentTimeout: 15,
      maxWait: 0,
      ringing: 'moh',
      cidPrefix: '',
      joinAnnouncement: null,
      positionAnnouncement: false,
      announceFrequency: 0,
      breakoutIvr: null,
      musicOnHold: 'inherit',
    })
    const issues = validateFlow(state, DATA, null)

    expect(issues[state.rootId]).toEqual([
      { level: 'error', code: 'output_not_connected', output: 'destination' },
      { level: 'warning', code: 'catch_all' },
    ])
    expect(issues['queue:new-2']).toEqual([
      { level: 'warning', code: 'number_in_use', field: 'id' },
      { level: 'warning', code: 'required', field: 'name' },
      { level: 'warning', code: 'not_in_flow_new' },
    ])
    expect(hasErrors(issues)).toBe(true)

    connect(state, state.rootId, 'destination', 'queue:new-2')
    expect(validateFlow(state, DATA, null)['queue:new-2']).toEqual([
      { level: 'error', code: 'number_in_use', field: 'id' },
      { level: 'error', code: 'required', field: 'name' },
    ])
  })

  it('accepts the loaded flow and warns about unknown destinations only', () => {
    const { state } = loadFlow(DATA, '0721405516/')
    const issues = validateFlow(state, DATA, '0721405516/')

    expect(hasErrors(issues)).toBe(false)
    expect(issues['other:ext-trunk,1,1']).toBeUndefined()
  })

  it('rejects an inbound route that already exists', () => {
    const { state } = loadFlow(DATA, null)
    const root = state.nodes[state.rootId]
    if (root?.type !== 'inboundRoute') throw new Error('missing root')
    root.data.extension = '0721405516'

    expect(validateFlow(state, DATA, null)[state.rootId]).toContainEqual({
      level: 'error',
      code: 'route_exists',
      field: 'extension',
    })
  })
})

describe('hiddenByCollapse', () => {
  it('hides only what is reached through the collapsed node', () => {
    const { state } = loadFlow(DATA, '0721405516/')
    const hidden = hiddenByCollapse(state, ['ivr:4'])

    expect(hidden.has('queue:401')).toBe(true)
    expect(hidden.has('other:ext-trunk,1,1')).toBe(true)
    expect(hidden.has('voicemail:vmu201')).toBe(false)
    expect(hidden.has('ivr:4')).toBe(false)
    expect(countHidden(hidden, 'ivr:4')).toBe(3)
    expect(hiddenByCollapse(state, [state.rootId]).size).toBe(Object.keys(state.nodes).length - 1)
  })
})

describe('reference nodes', () => {
  it('does not reuse an extension node whose target was changed', () => {
    const { state, catalog } = loadFlow(DATA, '0721405516/')
    const mailbox = state.nodes['voicemail:vmu201']
    if (mailbox?.type !== 'voicemail') throw new Error('missing mailbox')
    mailbox.data.extension = '202'
    const condition = catalog.get('timeCondition:1')?.node
    if (!condition) throw new Error('missing time condition')
    removeNode(state, 'timeCondition:1')
    state.nodes['timeCondition:1'] = structuredClone(condition)

    expandFrom(state, catalog, ['timeCondition:1'])
    const target = state.edges.find(
      (edge) => edge.source === 'timeCondition:1' && edge.output === 'falseDestination',
    )?.target
    expect(target).toBeDefined()
    expect(target).not.toBe('voicemail:vmu201')
    expect(target && state.nodes[target]?.data).toEqual({ extension: '201', mode: 'vmu' })
  })

  it('does not send new time groups that no time condition uses', () => {
    const { state, baseline } = loadFlow(DATA, '0721405516/')
    state.timeGroups.push({ ref: 'tg-1', data: { id: null, description: 'Unused', times: [] } })
    expect(buildChanges(state, baseline, DATA)).toEqual([])
  })
})

describe('analysis of untouched and new objects', () => {
  it('turns errors of untouched objects into warnings', () => {
    const data = parseVisualPlanData({
      ...empty,
      inboundRoutes: [
        {
          extension: '1',
          cidnum: '',
          description: '',
          alertinfo: '',
          grppre: '',
          destination: 'app-announcement-3,s,1',
        },
      ],
      announcements: [{ id: 3, description: 'Hi', recording: null, destination: '' }],
    })
    const { state } = loadFlow(data, '1/')
    expect(hasErrors(validateFlow(state, data, '1/'))).toBe(false)
    expect(hasErrors(validateFlow(state, data, '1/', new Set(['announcement:3'])))).toBe(true)
  })

  it('creates a mailbox only for a voicemail the user added or changed', () => {
    const data = parseVisualPlanData({
      ...empty,
      inboundRoutes: [
        {
          extension: '1',
          cidnum: '',
          description: '',
          alertinfo: '',
          grppre: '',
          destination: 'ext-local,vmu202,1',
        },
      ],
      extensions: [{ extension: '202', name: 'Bob', voicemail: false }],
    })
    const { state, baseline } = loadFlow(data, '1/')
    expect(buildChanges(state, baseline, data)).toEqual([])
  })

  it('keeps the original form of an unchanged destination', () => {
    const data = parseVisualPlanData({
      ...empty,
      inboundRoutes: [
        {
          extension: '1',
          cidnum: '',
          description: 'Old',
          alertinfo: '',
          grppre: '',
          destination: 'ivr-4,1,1',
        },
      ],
      ivrs: [
        {
          id: 4,
          name: 'Menu',
          description: '',
          announcement: null,
          directDial: false,
          invalidDestination: '',
          timeoutDestination: '',
          entries: [],
        },
      ],
    })
    const { state, baseline } = loadFlow(data, '1/')
    const root = state.nodes[state.rootId]
    if (root?.type !== 'inboundRoute') throw new Error('missing root')
    root.data.description = 'New'
    expect(buildChanges(state, baseline, data)[0]?.data.destination).toBe('ivr-4,1,1')
  })

  it('does not create new items that are not connected to the flow', () => {
    const { state, baseline } = loadFlow(DATA, '0721405516/')
    createNode(state, 'announcement', { id: null, description: 'Alone', recording: 1 })
    expect(buildChanges(state, baseline, DATA)).toEqual([])
  })
})
