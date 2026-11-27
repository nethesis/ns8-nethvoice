//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineStore } from 'pinia'
import { cloneDeep, isEqual } from 'lodash'
import { computed, ref, shallowRef, toRaw } from 'vue'
import type {
  RecordingData,
  SaveFieldError,
  TimeGroupData,
  VisualPlanData,
} from '@/lib/visualplan/api'
import { defaultNodeData } from '@/lib/visualplan/defaults'
import {
  analyzeFlow,
  computeBaseline,
  connect as connectEdge,
  createNode,
  expandFrom,
  reachableIds,
  loadFlow,
  pruneOrphanOutputs,
  removeNode as removeFlowNode,
  type Baseline,
  type FlowState,
} from '@/lib/visualplan/graph'
import {
  emptyHistory,
  record,
  redo as redoHistory,
  undo as undoHistory,
  type History,
} from '@/lib/visualplan/history'
import {
  layoutFlow,
  NODE_WIDTH,
  nodeHeight,
  offsetPositions,
  type NodeSize,
} from '@/lib/visualplan/layout'
import {
  destinationOfNode,
  entryOutputId,
  SAVED_TYPE_BY_NODE,
  getOutputs,
  parseDestination,
  inboundRouteKey,
  nodeIdOf,
  newEntryId,
  type CatalogObject,
  type FlowEdge,
  type FlowNode,
  type NodeType,
  type Position,
} from '@/lib/visualplan/model'
import { hasErrors, validateFlow, type Issue } from '@/lib/visualplan/validation'
import { hiddenByCollapse } from '@/lib/visualplan/collapse'
import { simulateCall, type SimulationOptions } from '@/lib/visualplan/simulation'

type Snapshot = {
  flow: FlowState
  positions: Record<string, Position>
  selectedIds: string[]
}

const COALESCE_MS = 1000

const emptyFlow = (): FlowState => ({
  rootId: '',
  nodes: {},
  edges: [],
  timeGroups: [],
  counter: 0,
})

export const useVisualPlanStore = defineStore('visualPlan', () => {
  const data = shallowRef<VisualPlanData | null>(null)
  const catalog = shallowRef<Map<string, CatalogObject>>(new Map())
  const originalRouteKey = ref<string | null>(null)
  const flow = ref<FlowState>(emptyFlow())
  const baseline = shallowRef<Baseline>({})
  const positions = ref<Record<string, Position>>({})
  const history = shallowRef<History<Snapshot>>(emptyHistory())
  const selectedIds = ref<string[]>([])
  const selectedId = computed<string | null>({
    get: () => (selectedIds.value.length === 1 ? (selectedIds.value[0] ?? null) : null),
    set: (value) => {
      selectedIds.value = value ? [value] : []
    },
  })
  const collapsedIds = ref<string[]>([])
  const simulation = ref<Omit<SimulationOptions, 'timeGroups'> | null>(null)
  const serverErrors = ref<Record<string, Issue[]>>({})
  const fitRequest = ref(0)
  const readOnly = ref(false)
  const highlightedIds = ref<string[]>([])
  const focusRequest = ref(0)
  const simulationFocus = ref<string | null>(null)
  const revision = ref(0)
  const revealErrors = ref(false)
  const touched = shallowRef<Set<string>>(new Set())
  const layoutBaseline = shallowRef<Record<string, Position>>({})

  let lastCoalesce: { key: string; at: number } | null = null

  const snapshot = (): Snapshot =>
    cloneDeep({
      flow: toRaw(flow.value),
      positions: toRaw(positions.value),
      selectedIds: [...selectedIds.value],
    })

  const keepExisting = <T>(record: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(record).filter(([id]) => flow.value.nodes[id]))

  const restore = (value: Snapshot) => {
    flow.value = value.flow
    positions.value = value.positions
    selectedIds.value = value.selectedIds.filter((id) => flow.value.nodes[id])
    serverErrors.value = keepExisting(serverErrors.value)
    collapsedIds.value = collapsedIds.value.filter((id) => flow.value.nodes[id])
    revision.value += 1
  }

  const commit = (mutate: () => void, coalesceKey?: string, touched: string[] | null = null) => {
    const now = Date.now()
    const coalesce =
      coalesceKey !== undefined &&
      lastCoalesce?.key === coalesceKey &&
      now - lastCoalesce.at < COALESCE_MS

    if (!coalesce) {
      history.value = record(history.value, snapshot())
    }
    lastCoalesce = coalesceKey === undefined ? null : { key: coalesceKey, at: now }
    serverErrors.value =
      touched === null
        ? {}
        : Object.fromEntries(
            Object.entries(serverErrors.value).filter(([id]) => !touched.includes(id)),
          )
    mutate()
    revision.value += 1
  }

  const mappedId = (node: FlowNode, refs: Record<string, string>): string | null => {
    if (node.type === 'other') {
      return node.id
    }
    if (node.type === 'extension' || node.type === 'voicemail') {
      const parsed = parseDestination(destinationOfNode(node))
      return parsed ? nodeIdOf(parsed.type, parsed.key) : null
    }
    if (node.type === 'hangup') {
      return null
    }
    const key = refs[node.key] ?? (node.isNew ? undefined : node.key)
    return key === undefined ? null : nodeIdOf(node.type, key)
  }

  const keptPositions = (refs: Record<string, string>): Record<string, Position> => {
    const current = toRaw(flow.value)
    const kept: Record<string, Position> = {}
    for (const node of Object.values(current.nodes)) {
      const position = positions.value[node.id]
      if (!position) {
        continue
      }
      if (node.type === 'hangup') {
        const edge = current.edges.find((item) => item.target === node.id)
        const source = edge ? current.nodes[edge.source] : undefined
        const sourceId = source ? mappedId(source, refs) : null
        if (edge && sourceId) {
          kept[`hangup:${node.data.variant}@${sourceId}/${edge.output}`] = position
        }
        continue
      }
      const id = mappedId(node, refs)
      if (id) {
        kept[id] = position
      }
    }
    return kept
  }

  const carryFloating = (
    state: FlowState,
    nextCatalog: Map<string, CatalogObject>,
    refs: Record<string, string>,
  ): string[] => {
    const previous = toRaw(flow.value)
    const reachable = reachableIds(previous)
    const mapId = (id: string): string => {
      const node = previous.nodes[id]
      return (node && mappedId(node, refs)) ?? id
    }
    const carried: string[] = []
    state.counter = Math.max(state.counter, previous.counter)

    for (const node of Object.values(previous.nodes)) {
      if (reachable.has(node.id) || state.nodes[node.id]) {
        continue
      }
      if (node.isNew && refs[node.key] === undefined) {
        const copy = cloneDeep(node)
        if (copy.type === 'timeCondition' && copy.data.timeGroupRef) {
          const saved = refs[copy.data.timeGroupRef]
          if (saved !== undefined) {
            copy.data.timeGroup = Number(saved)
            copy.data.timeGroupRef = null
          }
        }
        state.nodes[node.id] = copy
        carried.push(node.id)
        continue
      }
      const id = mapId(node.id)
      const fresh = nextCatalog.get(id)
      if (fresh && !state.nodes[id]) {
        state.nodes[id] = cloneDeep(fresh.node)
        carried.push(id, ...expandFrom(state, nextCatalog, [id]))
      }
    }
    state.timeGroups = cloneDeep(
      previous.timeGroups.filter(
        (group) => group.data.id === null && refs[group.ref] === undefined,
      ),
    )
    for (const edge of previous.edges) {
      const target = mapId(edge.target)
      const source = state.nodes[edge.source]
      if (source?.isNew && carried.includes(edge.source) && state.nodes[target]) {
        state.edges.push({ source: edge.source, output: edge.output, target })
      }
    }
    return carried
  }

  const initialPositions = (
    state: FlowState,
    routeKey: string | null,
    kept: Record<string, Position>,
  ): Record<string, Position> => {
    const saved = routeKey === null ? {} : (data.value?.layouts[routeKey] ?? {})
    const known = { ...saved, ...kept }
    const ids = Object.keys(state.nodes)
    const all = layoutFlow(state)
    const result: Record<string, Position> = {}
    for (const id of ids) {
      const point = known[id] ?? all[id]
      if (point) {
        result[id] = { x: Math.round(point.x), y: Math.round(point.y) }
      }
    }
    return result
  }

  const load = (value: VisualPlanData, routeKey: string | null, refs?: Record<string, string>) => {
    const previous = refs ? keptPositions(refs) : {}
    const loaded = loadFlow(value, routeKey)
    if (refs) {
      const carried = carryFloating(loaded.state, loaded.catalog, refs)
      for (const id of carried) {
        const point = positions.value[id]
        if (point) previous[id] = point
      }
      loaded.baseline = { ...loaded.baseline, ...computeBaseline(loaded.state, carried) }
    }

    data.value = value
    catalog.value = loaded.catalog
    originalRouteKey.value = routeKey
    flow.value = loaded.state
    baseline.value = loaded.baseline
    positions.value = initialPositions(loaded.state, routeKey, previous)
    layoutBaseline.value = refs && routeKey ? {} : cloneDeep(positions.value)
    revealErrors.value = false
    touched.value = new Set()
    revision.value += 1
    history.value = emptyHistory()
    serverErrors.value = {}
    selectedId.value = routeKey === null ? loaded.state.rootId : null
    highlightedIds.value = []
    collapsedIds.value = []
    simulation.value = null
    if (!refs) {
      fitRequest.value += 1
    }
  }

  const nodes = computed(() => Object.values(flow.value.nodes))

  const analysis = computed(() => {
    void revision.value
    return data.value
      ? analyzeFlow(toRaw(flow.value), baseline.value, data.value)
      : { changes: [], dirtyIds: new Set<string>() }
  })

  const changes = computed(() => analysis.value.changes)

  const dirtyIds = computed(() => analysis.value.dirtyIds)

  const allIssues = computed(() => {
    void revision.value
    if (!data.value) {
      return {}
    }
    const result = validateFlow(
      toRaw(flow.value),
      data.value,
      originalRouteKey.value,
      analysis.value.dirtyIds,
    )
    for (const [id, list] of Object.entries(serverErrors.value)) {
      result[id] = [...(result[id] ?? []), ...list]
    }
    return result
  })

  // Errors show once a save was tried, so a new flow is not covered in red while it is built.
  const isVisible = (issue: Issue): boolean => issue.level === 'warning' || revealErrors.value

  const issues = computed(() => {
    const result: Record<string, Issue[]> = {}
    for (const [id, list] of Object.entries(allIssues.value)) {
      const visible = list.filter((issue) => isVisible(issue))
      if (visible.length) result[id] = visible
    }
    return result
  })

  const errorNodeIds = computed(() =>
    Object.entries(allIssues.value)
      .filter(([, list]) => list.some((issue) => issue.level === 'error'))
      .map(([id]) => id),
  )

  const layoutDirty = computed(() => {
    const base = layoutBaseline.value
    return Object.entries(positions.value).some(([id, point]) => {
      const before = base[id]
      return !before || before.x !== point.x || before.y !== point.y
    })
  })

  const hasUnsavedItems = computed(() => {
    void revision.value
    const raw = toRaw(flow.value)
    return Object.values(raw.nodes).some((node) => node.isNew)
  })

  const isDirty = computed(
    () => changes.value.length > 0 || layoutDirty.value || hasUnsavedItems.value,
  )

  const canSave = computed(() => isDirty.value && !hasErrors(allIssues.value))

  const selectedNode = computed(() =>
    selectedId.value ? (flow.value.nodes[selectedId.value] ?? null) : null,
  )

  const reservedNumbers = () =>
    new Set(
      nodes.value.flatMap((node) => {
        if (node.type === 'conference' || node.type === 'ringGroup' || node.type === 'queue') {
          return [node.data.id]
        }
        return node.type === 'callFlowControl' ? [`cf:${node.data.id}`] : []
      }),
    )

  const addNode = (
    type: NodeType,
    position: Position,
    from?: { source: string; output: string },
  ): string | null => {
    if (!data.value) {
      return null
    }
    const nodeData = defaultNodeData(type, { data: data.value, reserved: reservedNumbers() })

    if (!nodeData) {
      return null
    }
    let id = ''
    commit(() => {
      const node = createNode(flow.value, type, nodeData)
      id = node.id
      positions.value[node.id] = position
      if (from) {
        connectEdge(flow.value, from.source, from.output, node.id)
      }
    })
    selectedId.value = id
    return id
  }

  const dropOnLink = (id: string, position: Position, source: string, output: string) => {
    if (!flow.value.nodes[id] || !flow.value.nodes[source]) {
      return
    }
    commit(() => {
      positions.value[id] = position
      connectEdge(flow.value, source, output, id)
    })
  }

  const dropOnEdge = (id: string, position: Position, edge: FlowEdge) => {
    const node = flow.value.nodes[id]
    const first = node ? getOutputs(node)[0] : undefined
    if (!node || !flow.value.nodes[edge.source] || !flow.value.nodes[edge.target]) {
      return
    }
    commit(() => {
      positions.value[id] = position
      connectEdge(flow.value, edge.source, edge.output, id)
      if (first) {
        connectEdge(flow.value, id, first.id, edge.target)
      }
    })
  }

  const addExisting = (
    catalogId: string,
    position: Position,
    from?: { source: string; output: string },
  ): string | null => {
    const entry = catalog.value.get(catalogId)

    if (!entry) {
      return null
    }
    const present = flow.value.nodes[catalogId]
    if (present && destinationOfNode(present) === destinationOfNode(entry.node)) {
      if (from) {
        connect(from.source, from.output, catalogId)
      }
      selectedId.value = catalogId
      return catalogId
    }
    if (present) {
      return null
    }
    commit(() => {
      flow.value.nodes[catalogId] = cloneDeep(entry.node)
      const added = expandFrom(flow.value, catalog.value, [catalogId])
      const local = layoutFlow(flow.value, [catalogId, ...added])
      const placed = offsetPositions(local, catalogId, position)
      for (const [id, point] of Object.entries(placed)) {
        if (id === catalogId || !positions.value[id]) {
          positions.value[id] = point
        }
      }
      const extra = computeBaseline(
        flow.value,
        [catalogId, ...added].filter((id) => !(id in baseline.value)),
      )
      baseline.value = { ...baseline.value, ...extra }
      if (from) {
        connectEdge(flow.value, from.source, from.output, catalogId)
      }
    })
    selectedId.value = catalogId
    return catalogId
  }

  const removeNodes = (ids: string[]) => {
    const removable = ids.filter((id) => id !== flow.value.rootId && flow.value.nodes[id])
    if (!removable.length) {
      return
    }
    commit(() => {
      for (const id of removable) {
        removeFlowNode(flow.value, id)
        delete positions.value[id]
      }
    })
    selectedIds.value = selectedIds.value.filter((id) => !removable.includes(id))
    collapsedIds.value = collapsedIds.value.filter((id) => !removable.includes(id))
  }

  const removeNode = (id: string) => removeNodes([id])

  const selectAll = () => {
    selectedIds.value = Object.keys(flow.value.nodes).filter((id) => !hidden.value.has(id))
  }

  const hidden = computed(() => hiddenByCollapse(flow.value, collapsedIds.value))

  const toggleCollapse = (id: string) => {
    collapsedIds.value = collapsedIds.value.includes(id)
      ? collapsedIds.value.filter((item) => item !== id)
      : [...collapsedIds.value, id]
    selectedIds.value = selectedIds.value.filter((item) => !hidden.value.has(item))
  }

  const reveal = (id: string) => {
    let owner = hidden.value.get(id)
    while (owner) {
      const current: string = owner
      collapsedIds.value = collapsedIds.value.filter((item) => item !== current)
      owner = hidden.value.get(id)
    }
  }

  const simulationResult = computed(() =>
    simulation.value
      ? simulateCall(flow.value, { ...simulation.value, timeGroups: timeGroups.value })
      : null,
  )

  const connect = (source: string, output: string, target: string) => {
    commit(() => connectEdge(flow.value, source, output, target))
  }

  const patchNode = (id: string, patch: Record<string, unknown>, coalesceKey?: string) => {
    const node = flow.value.nodes[id]

    if (!node) {
      return
    }
    touched.value = new Set([
      ...touched.value,
      ...Object.keys(patch).map((field) => `${id}:${field}`),
    ])
    commit(
      () => {
        Object.assign(node.data, patch)
      },
      coalesceKey ?? `${id}:${Object.keys(patch).join(',')}`,
      [id],
    )
  }

  const addRecording = (recording: RecordingData) => {
    if (data.value) {
      data.value = { ...data.value, recordings: [...data.value.recordings, recording] }
    }
  }

  const timeGroups = computed(() => {
    const pending = flow.value.timeGroups
    const existing = (data.value?.timeGroups ?? []).map((group) => {
      const edited = pending.find((item) => item.data.id !== null && item.data.id === group.id)
      return { ref: String(group.id), data: edited?.data ?? group }
    })
    return [...existing, ...pending.filter((item) => item.data.id === null)]
  })

  const addEntry = (id: string) => {
    const node = flow.value.nodes[id]

    if (node?.type !== 'ivr' && node?.type !== 'cqr') {
      return
    }
    commit(() => {
      // the first digit not used yet, in keypad order
      const values = new Set(node.data.entries.map((entry) => entry.value.trim()))
      const next =
        node.type === 'ivr'
          ? (['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].find(
              (digit) => !values.has(digit),
            ) ?? '')
          : ''
      node.data.entries.push({ id: newEntryId(), value: next })
    })
  }

  const removeEntry = (id: string, entryId: string) => {
    const node = flow.value.nodes[id]

    if (node?.type !== 'ivr' && node?.type !== 'cqr') {
      return
    }
    commit(() => {
      node.data.entries = node.data.entries.filter((entry) => entry.id !== entryId)
      pruneOrphanOutputs(flow.value, node)
    })
  }

  const moveNodes = (moves: Record<string, Position>) => {
    const changed = Object.entries(moves).filter(([id, position]) => {
      const current = positions.value[id]
      return !current || current.x !== position.x || current.y !== position.y
    })
    if (!changed.length) {
      return
    }
    commit(
      () => {
        for (const [id, position] of changed) {
          positions.value[id] = position
        }
      },
      undefined,
      [],
    )
  }

  const moveNode = (id: string, position: Position) => moveNodes({ [id]: position })

  const selectionPositions = () =>
    selectedIds.value.flatMap((id) => {
      const position = positions.value[id]
      return position ? [{ id, position }] : []
    })

  const alignSelected = (side: 'left' | 'top') => {
    const items = selectionPositions()
    if (items.length < 2) {
      return
    }
    const axis = side === 'left' ? 'x' : 'y'
    const other = side === 'left' ? 'y' : 'x'
    const edge = Math.min(...items.map((item) => item.position[axis]))
    const sorted = [...items].sort((a, b) => a.position[other] - b.position[other])
    const gap = 24
    let cursor = Number.NEGATIVE_INFINITY
    const moves: Record<string, Position> = {}
    for (const item of sorted) {
      const node = flow.value.nodes[item.id]
      const size = side === 'left' ? (node ? nodeHeight(node) : 120) : NODE_WIDTH
      const start = Math.max(item.position[other], cursor)
      moves[item.id] = { ...item.position, [axis]: edge, [other]: start }
      cursor = start + size + gap
    }
    moveNodes(moves)
  }

  const arrangeSelected = (sizes?: Record<string, NodeSize>) => {
    const items = selectionPositions()
    if (items.length < 2) {
      return
    }
    const local = layoutFlow(
      flow.value,
      items.map((item) => item.id),
      sizes,
    )
    const minX = Math.min(...items.map((item) => item.position.x))
    const minY = Math.min(...items.map((item) => item.position.y))
    const localX = Math.min(...Object.values(local).map((point) => point.x))
    const localY = Math.min(...Object.values(local).map((point) => point.y))
    moveNodes(
      Object.fromEntries(
        Object.entries(local).map(([id, point]) => [
          id,
          { x: point.x - localX + minX, y: point.y - localY + minY },
        ]),
      ),
    )
  }

  const autoLayout = (sizes?: Record<string, NodeSize>) => {
    commit(() => {
      positions.value = layoutFlow(flow.value, undefined, sizes)
    })
  }

  const addTimeGroup = (group: TimeGroupData): string => {
    const ref = `tg-${flow.value.counter + 1}`
    commit(() => {
      flow.value.counter += 1
      flow.value.timeGroups.push({ ref, data: group })
    })
    return ref
  }

  const updateTimeGroup = (ref: string, group: TimeGroupData) => {
    const original = data.value?.timeGroups.find((item) => String(item.id) === ref)
    const pending = flow.value.timeGroups.find((item) => item.ref === ref)
    if (original && isEqual(original, group)) {
      if (pending) {
        commit(() => {
          flow.value.timeGroups = flow.value.timeGroups.filter((item) => item.ref !== ref)
        })
      }
      return
    }
    if (pending && isEqual(toRaw(pending.data), group)) {
      return
    }
    commit(() => {
      const current = flow.value.timeGroups.find((item) => item.ref === ref)
      if (current) {
        current.data = group
      } else {
        flow.value.timeGroups.push({ ref, data: group })
      }
    })
  }

  const undo = () => {
    const result = undoHistory(history.value, snapshot())
    if (result) {
      history.value = result[0]
      restore(result[1])
      lastCoalesce = null
    }
  }

  const redo = () => {
    const result = redoHistory(history.value, snapshot())
    if (result) {
      history.value = result[0]
      restore(result[1])
      lastCoalesce = null
    }
  }

  const canUndo = computed(() => history.value.past.length > 0)
  const canRedo = computed(() => history.value.future.length > 0)

  const localIssue = (id: string, field: string, code: string): Issue => {
    const node = flow.value.nodes[id]
    const entry = /^entries\.(\d+)(\.destination)?/.exec(field)
    if (entry && (node?.type === 'ivr' || node?.type === 'cqr')) {
      const target = node.data.entries[Number(entry[1])]
      if (target) {
        return entry[2]
          ? { level: 'error', code, output: entryOutputId(target) }
          : { level: 'error', code, field: `entry:${target.id}` }
      }
    }
    const name = field.split('.')[0] ?? ''
    if (node && getOutputs(node).some((output) => output.id === name)) {
      return { level: 'error', code, output: name }
    }
    return { level: 'error', code, field: name || undefined }
  }

  const ownerOf = (item: SaveFieldError): string | null => {
    if (item.type === 'timeGroup') {
      const user = nodes.value.find(
        (node) =>
          node.type === 'timeCondition' &&
          (node.data.timeGroupRef === item.ref || String(node.data.timeGroup) === item.ref),
      )
      return user?.id ?? null
    }
    if (item.type === 'voicemail') {
      const extension = item.ref.replace(/^vm:/, '')
      return (
        nodes.value.find((node) => node.type === 'voicemail' && node.data.extension === extension)
          ?.id ?? null
      )
    }
    const match = nodes.value.find(
      (node) =>
        node.key === item.ref && (!item.type || SAVED_TYPE_BY_NODE[node.type] === item.type),
    )
    return match?.id ?? null
  }

  const generalErrors = ref<SaveFieldError[]>([])

  const setServerErrors = (errors: SaveFieldError[]) => {
    const result: Record<string, Issue[]> = {}
    const general: SaveFieldError[] = []

    for (const item of errors) {
      const owner = ownerOf(item)
      if (owner === null) {
        general.push(item)
        continue
      }
      const issue: Issue =
        item.type === 'timeGroup'
          ? { level: 'error', code: item.message, field: 'timeGroup' }
          : localIssue(owner, item.field, item.message)
      result[owner] = [...(result[owner] ?? []), issue]
    }
    serverErrors.value = result
    generalErrors.value = general
    revealErrors.value = true
    const first = Object.keys(result)[0]
    if (first) {
      reveal(first)
      selectedId.value = first
    }
  }

  const savedRouteKey = computed(() => {
    const root = flow.value.nodes[flow.value.rootId]
    return root?.type === 'inboundRoute' ? inboundRouteKey(root.data) : null
  })

  const freeSpot = (candidate: Position): Position => {
    const gap = 24
    const height = 120
    const boxes = Object.entries(positions.value).map(([id, point]) => {
      const node = flow.value.nodes[id]
      return { ...point, height: node ? nodeHeight(node) : height }
    })
    const spot = { ...candidate }
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const hit = boxes.find(
        (box) =>
          spot.x < box.x + NODE_WIDTH + gap &&
          spot.x + NODE_WIDTH + gap > box.x &&
          spot.y < box.y + box.height + gap &&
          spot.y + height + gap > box.y,
      )
      if (!hit) {
        return spot
      }
      spot.y = hit.y + hit.height + gap
    }
    return spot
  }

  const placementFor = (fallback: Position): Position => {
    const selected = selectedId.value ? positions.value[selectedId.value] : undefined
    return freeSpot(selected ? { x: selected.x + NODE_WIDTH + 72, y: selected.y } : fallback)
  }

  const nextPosition = (): Position => {
    const values = Object.values(positions.value)
    const maxX = values.reduce((max, point) => Math.max(max, point.x), 0)
    return { x: maxX + NODE_WIDTH + 96, y: 24 }
  }

  return {
    data,
    catalog,
    originalRouteKey,
    flow,
    positions,
    selectedId,
    selectedIds,
    selectedNode,
    collapsedIds,
    hidden,
    simulation,
    simulationResult,
    fitRequest,
    readOnly,
    highlightedIds,
    focusRequest,
    simulationFocus,
    revision,
    timeGroups,
    nodes,
    issues,
    allIssues,
    errorNodeIds,
    generalErrors,
    revealErrors,
    layoutDirty,
    changes,
    isDirty,
    canSave,
    dirtyIds,
    canUndo,
    canRedo,
    savedRouteKey,
    load,
    addNode,
    dropOnLink,
    dropOnEdge,
    addExisting,
    removeNode,
    removeNodes,
    selectAll,
    toggleCollapse,
    reveal,
    moveNodes,
    alignSelected,
    arrangeSelected,
    connect,
    patchNode,
    addRecording,
    addEntry,
    removeEntry,
    moveNode,
    autoLayout,
    addTimeGroup,
    updateTimeGroup,
    undo,
    redo,
    setServerErrors,
    markLayoutSaved: (saved?: Record<string, Position>) => {
      const sent = cloneDeep(saved ?? toRaw(positions.value))
      layoutBaseline.value = sent
      const route = originalRouteKey.value
      if (data.value && route !== null) {
        data.value = { ...data.value, layouts: { ...data.value.layouts, [route]: sent } }
      }
    },
    touch: (id: string, field: string) => {
      touched.value = new Set([...touched.value, `${id}:${field}`])
    },
    nextPosition,
    placementFor,
  }
})
