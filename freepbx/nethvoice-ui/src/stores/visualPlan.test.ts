//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { parseVisualPlanData } from '@/lib/visualplan/api'
import { useVisualPlanStore } from './visualPlan'

const DATA = parseVisualPlanData({
  inboundRoutes: [
    {
      extension: '100',
      cidnum: '',
      description: '',
      alertinfo: '',
      grppre: '',
      destination: 'ivr-3,s,1',
    },
  ],
  extensions: [{ extension: '201', name: 'Alice', voicemail: true }],
  conferences: [],
  ringGroups: [],
  queues: [],
  ivrs: [
    {
      id: 3,
      name: 'Menu',
      description: '',
      announcement: null,
      directDial: false,
      invalidDestination: '',
      timeoutDestination: '',
      entries: [{ selection: '1', destination: 'app-announcement-3,s,1' }],
    },
  ],
  cqrs: [],
  announcements: [
    { id: 3, description: 'Hello', recording: 1, destination: 'from-did-direct,201,1' },
  ],
  timeConditions: [],
  timeGroups: [],
  callFlowControls: [],
  availableCallFlowCodes: [],
  setCallerIds: [],
  directDids: [],
  queueExits: [],
  queueOptions: [],
  queuePriorities: [],
  recordings: [{ id: 1, name: 'hello', description: '' }],
  musicOnHold: [],
  destinations: [],
  unavailable: [],
})

describe('visual plan store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('undoes and redoes edits, merging quick edits of the same field', () => {
    vi.useFakeTimers()
    const store = useVisualPlanStore()
    store.load(DATA, '100/')

    store.patchNode('ivr:3', { name: 'M' })
    store.patchNode('ivr:3', { name: 'Ma' })
    vi.advanceTimersByTime(2000)
    store.patchNode('ivr:3', { name: 'Main' })

    expect(store.isDirty).toBe(true)
    store.undo()
    expect(store.flow.nodes['ivr:3']?.data).toMatchObject({ name: 'Ma' })
    store.undo()
    expect(store.flow.nodes['ivr:3']?.data).toMatchObject({ name: 'Menu' })
    expect(store.isDirty).toBe(false)
    store.redo()
    expect(store.flow.nodes['ivr:3']?.data).toMatchObject({ name: 'Ma' })
    vi.useRealTimers()
  })

  it('puts server errors on the node of the right type', () => {
    const store = useVisualPlanStore()
    store.load(DATA, '100/')

    store.setServerErrors([
      { ref: '3', type: 'announcement', field: 'description', message: 'required' },
      { ref: '3', type: 'ivr', field: 'entries.0.destination', message: 'invalid' },
      { ref: '', type: '', field: '', message: 'invalid' },
    ])

    expect(store.issues['announcement:3']).toContainEqual({
      level: 'error',
      code: 'required',
      field: 'description',
    })
    expect(store.issues['ivr:3']).toContainEqual({
      level: 'error',
      code: 'invalid',
      output: expect.stringMatching(/^entry:/),
    })
    expect(store.generalErrors).toEqual([{ ref: '', type: '', field: '', message: 'invalid' }])
    expect(store.issues['inboundRoute:100/']?.some((issue) => issue.level === 'error')).toBeFalsy()

    store.moveNode('ivr:3', { x: 1, y: 1 })
    expect(store.issues['announcement:3']).toHaveLength(1)
    store.patchNode('announcement:3', { description: 'Hi' })
    expect(store.issues['announcement:3']).toBeUndefined()
  })

  it('inserts a dropped item into a link', () => {
    const store = useVisualPlanStore()
    store.load(DATA, '100/')
    const id = store.addNode('setCallerId', { x: 0, y: 0 })
    if (!id) throw new Error('not created')

    store.dropOnEdge(
      id,
      { x: 10, y: 10 },
      {
        source: 'inboundRoute:100/',
        output: 'destination',
        target: 'ivr:3',
      },
    )

    expect(store.flow.edges).toContainEqual({
      source: 'inboundRoute:100/',
      output: 'destination',
      target: id,
    })
    expect(store.flow.edges).toContainEqual({ source: id, output: 'destination', target: 'ivr:3' })
    store.undo()
    expect(store.flow.edges).toContainEqual({
      source: 'inboundRoute:100/',
      output: 'destination',
      target: 'ivr:3',
      destination: 'ivr-3,s,1',
    })
  })

  it('removes several items at once and never the inbound route', () => {
    const store = useVisualPlanStore()
    store.load(DATA, '100/')
    store.selectAll()

    store.removeNodes(store.selectedIds)

    expect(Object.keys(store.flow.nodes)).toEqual(['inboundRoute:100/'])
    expect(store.selectedIds).toEqual(['inboundRoute:100/'])
  })

  it('keeps the positions of saved items after reloading', () => {
    const store = useVisualPlanStore()
    store.load(DATA, '100/')
    const id = store.addNode('announcement', { x: 500, y: 700 })
    if (!id) throw new Error('not created')
    const key = store.flow.nodes[id]?.key ?? ''
    store.moveNode('ivr:3', { x: 42, y: 24 })

    store.load(
      {
        ...DATA,
        announcements: [
          ...DATA.announcements,
          { id: 9, description: '', recording: 1, destination: '' },
        ],
      },
      '100/',
      { [key]: '9' },
    )

    expect(store.positions['ivr:3']).toEqual({ x: 42, y: 24 })
    expect(store.changes).toEqual([])
    expect(store.layoutDirty).toBe(true)
    store.markLayoutSaved()
    expect(store.isDirty).toBe(false)
  })

  it('restores the selection on undo and drops errors of removed items', () => {
    const store = useVisualPlanStore()
    store.load(DATA, '100/')
    const id = store.addNode('cqr', { x: 0, y: 0 })
    if (!id) throw new Error('not created')
    const key = store.flow.nodes[id]?.key ?? ''
    store.setServerErrors([{ ref: key, type: 'cqr', field: 'name', message: 'invalid' }])
    expect(store.issues[id]).toBeDefined()

    store.undo()
    expect(store.flow.nodes[id]).toBeUndefined()
    expect(store.allIssues[id]).toBeUndefined()
  })

  it('shows errors only after a save was tried', () => {
    const store = useVisualPlanStore()
    store.load(DATA, '100/')
    const id = store.addNode('announcement', { x: 0, y: 0 })
    if (!id) throw new Error('not created')
    store.connect('inboundRoute:100/', 'destination', id)

    expect(store.allIssues[id]?.some((issue) => issue.level === 'error')).toBe(true)
    expect(store.issues[id]?.some((issue) => issue.level === 'error')).toBeFalsy()
    store.patchNode(id, { description: '' })
    expect(store.issues[id]?.some((issue) => issue.level === 'error')).toBeFalsy()
    store.revealErrors = true
    expect(store.issues[id]).toContainEqual({
      level: 'error',
      code: 'name_required',
      field: 'description',
    })
    expect(store.issues[id]).toContainEqual({
      level: 'error',
      code: 'recording_required',
      field: 'recording',
    })
  })

  it('keeps unsaved items that are not linked yet and their errors as warnings', () => {
    const store = useVisualPlanStore()
    store.load(DATA, '100/')
    const id = store.addNode('announcement', { x: 300, y: 300 })
    if (!id) throw new Error('not created')

    expect(store.changes).toEqual([])
    expect(store.isDirty).toBe(true)
    expect(store.allIssues[id]?.every((issue) => issue.level === 'warning')).toBe(true)

    store.load(DATA, '100/', {})
    expect(store.flow.nodes[id]).toBeDefined()
    expect(store.positions[id]).toEqual({ x: 300, y: 300 })
  })

  it('does not mark the plan dirty when a time group is saved unchanged', () => {
    const store = useVisualPlanStore()
    store.load(
      {
        ...DATA,
        timeGroups: [{ id: 3, description: 'Office', times: ['09:00-18:00|mon-fri|*|*'] }],
      },
      '100/',
    )
    store.updateTimeGroup('3', { id: 3, description: 'Office', times: ['09:00-18:00|mon-fri|*|*'] })
    expect(store.isDirty).toBe(false)
    expect(store.canUndo).toBe(false)
  })

  it('collapses a branch and reveals a hidden item', () => {
    const store = useVisualPlanStore()
    store.load(DATA, '100/')

    store.toggleCollapse('ivr:3')
    expect(store.hidden.has('announcement:3')).toBe(true)
    store.reveal('extension:201')
    expect(store.collapsedIds).toEqual([])
  })
})
