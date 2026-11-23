//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { cloneDeep, isEqual } from 'lodash'
import type { VisualPlanChange, VisualPlanData } from '@/lib/visualplan/api'
import {
  buildCatalog,
  destinationOfNode,
  entryOutputId,
  getOutputs,
  nodeIdOf,
  parseDestination,
  parseVoicemailKey,
  voicemailKey,
  SAVED_TYPE_BY_NODE,
  type CatalogObject,
  type FlowEdge,
  type FlowNode,
  type NodeDataByType,
  type NodeType,
} from '@/lib/visualplan/model'
import type { TimeGroupData } from '@/lib/visualplan/api'

export type NewTimeGroup = { ref: string; data: TimeGroupData }

export type FlowState = {
  rootId: string
  nodes: Record<string, FlowNode>
  edges: FlowEdge[]
  timeGroups: NewTimeGroup[]
  counter: number
}

export type Baseline = Record<string, unknown>

export type LoadedFlow = {
  state: FlowState
  baseline: Baseline
  catalog: Map<string, CatalogObject>
}

const clone = <T>(value: T): T => cloneDeep(value)

export const NEW_ROUTE_DATA: NodeDataByType['inboundRoute'] = {
  extension: '',
  cidnum: '',
  description: '',
  alertinfo: '',
  grppre: '',
}

const resolveTarget = (
  catalog: Map<string, CatalogObject>,
  source: FlowNode,
  outputId: string,
  destination: string,
): FlowNode | null => {
  const parsed = parseDestination(destination)

  if (!parsed) {
    return null
  }
  if (parsed.type === 'voicemail') {
    return {
      id: nodeIdOf('voicemail', parsed.key),
      type: 'voicemail',
      key: parsed.key,
      isNew: false,
      data: parseVoicemailKey(parsed.key),
    }
  }
  if (parsed.type === 'hangup') {
    return {
      id: `hangup:${parsed.key}@${source.id}/${outputId}`,
      type: 'hangup',
      key: parsed.key,
      isNew: false,
      data: { variant: parsed.key },
    }
  }
  const known = catalog.get(nodeIdOf(parsed.type, parsed.key))

  if (known) {
    return clone(known.node)
  }
  return {
    id: nodeIdOf('other', destination),
    type: 'other',
    key: destination,
    isNew: false,
    data: { destination },
  }
}

const destinationsOf = (catalog: Map<string, CatalogObject>, node: FlowNode) =>
  catalog.get(node.id)?.destinations ?? {}

export const expandFrom = (
  state: FlowState,
  catalog: Map<string, CatalogObject>,
  startIds: string[],
): string[] => {
  const added: string[] = []
  const queue = [...startIds]
  const visited = new Set<string>()

  while (queue.length) {
    const id = queue.shift()
    const node = id ? state.nodes[id] : undefined

    if (!node || visited.has(node.id)) {
      continue
    }
    visited.add(node.id)

    const destinations = destinationsOf(catalog, node)

    for (const output of getOutputs(node)) {
      if (state.edges.some((edge) => edge.source === node.id && edge.output === output.id)) {
        continue
      }
      const target = resolveTarget(catalog, node, output.id, destinations[output.id] ?? '')

      if (!target) {
        continue
      }
      const existing = state.nodes[target.id]
      if (existing && destinationOfNode(existing) !== destinationOfNode(target)) {
        state.counter += 1
        target.id = `${target.id}#${state.counter}`
      }
      if (!state.nodes[target.id]) {
        state.nodes[target.id] = target
        added.push(target.id)
        queue.push(target.id)
      }
      state.edges.push({
        source: node.id,
        output: output.id,
        target: target.id,
        destination: destinations[output.id] ?? '',
      })
    }
  }
  return added
}

export type EdgeIndex = Map<string, Map<string, FlowEdge>>

export const indexEdges = (state: FlowState): EdgeIndex => {
  const index: EdgeIndex = new Map()
  for (const edge of state.edges) {
    let outputs = index.get(edge.source)
    if (!outputs) {
      outputs = new Map()
      index.set(edge.source, outputs)
    }
    outputs.set(edge.output, edge)
  }
  return index
}

const sameTarget = (a: string, b: string): boolean => {
  const left = parseDestination(a)
  const right = parseDestination(b)
  return Boolean(left && right && left.type === right.type && left.key === right.key)
}

export const outgoingDestinations = (
  state: FlowState,
  node: FlowNode,
  index?: EdgeIndex,
): Record<string, string> => {
  const result: Record<string, string> = {}
  const outputs = (index ?? indexEdges(state)).get(node.id)

  for (const output of getOutputs(node)) {
    const edge = outputs?.get(output.id)
    const target = edge ? state.nodes[edge.target] : undefined
    if (!target) {
      result[output.id] = ''
      continue
    }
    const current = destinationOfNode(target)
    result[output.id] =
      edge?.destination && sameTarget(edge.destination, current) ? edge.destination : current
  }
  return result
}

const sanitizeNumbers = (data: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === 'number' && Number.isNaN(value) ? 0 : value,
    ]),
  )

export const payloadOf = (
  state: FlowState,
  node: FlowNode,
  index?: EdgeIndex,
): Record<string, unknown> | null => {
  const destinations = outgoingDestinations(state, node, index)

  switch (node.type) {
    case 'ivr':
      return {
        id: node.data.id,
        name: node.data.name,
        description: node.data.description,
        announcement: node.data.announcement,
        directDial: node.data.directDial,
        invalidDestination: destinations.invalidDestination ?? '',
        timeoutDestination: destinations.timeoutDestination ?? '',
        entries: node.data.entries.map((entry) => ({
          selection: entry.value,
          destination: destinations[entryOutputId(entry)] ?? '',
        })),
      }
    case 'cqr':
      return {
        id: node.data.id,
        name: node.data.name,
        description: node.data.description,
        announcement: node.data.announcement,
        defaultDestination: destinations.defaultDestination ?? '',
        entries: node.data.entries.map((entry) => ({
          condition: entry.value,
          destination: destinations[entryOutputId(entry)] ?? '',
        })),
      }
    case 'timeCondition': {
      const { timeGroupRef, ...rest } = node.data
      return timeGroupRef
        ? { ...rest, timeGroupRef, ...destinations }
        : { ...rest, ...destinations }
    }
    default:
      return SAVED_TYPE_BY_NODE[node.type]
        ? sanitizeNumbers({ ...node.data, ...destinations })
        : null
  }
}

export const computeBaseline = (state: FlowState, ids?: string[]): Baseline => {
  const baseline: Baseline = {}

  for (const id of ids ?? Object.keys(state.nodes)) {
    const node = state.nodes[id]
    if (node && !node.isNew) {
      baseline[id] = clone(payloadOf(state, node))
    }
  }
  return baseline
}

export const createNode = <T extends NodeType>(
  state: FlowState,
  type: T,
  data: NodeDataByType[T],
): FlowNode => {
  state.counter += 1
  const key = `new-${state.counter}`
  const node = { id: nodeIdOf(type, key), type, key, isNew: true, data } as FlowNode
  state.nodes[node.id] = node
  return node
}

export const loadFlow = (data: VisualPlanData, routeKey: string | null): LoadedFlow => {
  const catalog = buildCatalog(data)
  const state: FlowState = { rootId: '', nodes: {}, edges: [], timeGroups: [], counter: 0 }

  const existing = routeKey === null ? undefined : catalog.get(nodeIdOf('inboundRoute', routeKey))
  const root = existing
    ? clone(existing.node)
    : createNode(state, 'inboundRoute', clone(NEW_ROUTE_DATA))

  state.nodes[root.id] = root
  state.rootId = root.id
  expandFrom(state, catalog, [root.id])

  return { state, baseline: computeBaseline(state), catalog }
}

export const adjacency = (state: FlowState): Map<string, string[]> => {
  const result = new Map<string, string[]>()
  for (const edge of state.edges) {
    const targets = result.get(edge.source)
    if (targets) {
      targets.push(edge.target)
    } else {
      result.set(edge.source, [edge.target])
    }
  }
  return result
}

export const reachFrom = (
  next: Map<string, string[]>,
  start: string,
  blocked: Set<string> = new Set(),
): Set<string> => {
  const seen = new Set<string>([start])
  const queue = [start]

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor]
    if (id === undefined || blocked.has(id)) {
      continue
    }
    for (const target of next.get(id) ?? []) {
      if (!seen.has(target)) {
        seen.add(target)
        queue.push(target)
      }
    }
  }
  return seen
}

export const reachableIds = (state: FlowState): Set<string> =>
  reachFrom(adjacency(state), state.rootId)

export const isNodeDirty = (state: FlowState, baseline: Baseline, node: FlowNode): boolean =>
  node.isNew || !isEqual(payloadOf(state, node), baseline[node.id])

export type FlowAnalysis = { changes: VisualPlanChange[]; dirtyIds: Set<string> }

const usedTimeGroupRefs = (state: FlowState, reachable: Set<string>): Set<string> =>
  new Set(
    Object.values(state.nodes).flatMap((node) =>
      node.type === 'timeCondition' && node.data.timeGroupRef && reachable.has(node.id)
        ? [node.data.timeGroupRef]
        : [],
    ),
  )

export const analyzeFlow = (
  state: FlowState,
  baseline: Baseline,
  data: VisualPlanData,
): FlowAnalysis => {
  const index = indexEdges(state)
  const reachable = reachableIds(state)
  const usedGroups = usedTimeGroupRefs(state, reachable)
  const dirtyIds = new Set<string>()
  const changes: VisualPlanChange[] = state.timeGroups
    .filter((group) => group.data.id !== null || usedGroups.has(group.ref))
    .map((group) => ({
      type: 'timeGroup',
      ref: group.ref,
      isNew: group.data.id === null,
      data: { ...group.data },
    }))
  const mailboxes = new Set(
    data.extensions.filter((ext) => ext.voicemail).map((ext) => ext.extension),
  )

  for (const node of Object.values(state.nodes)) {
    if (node.type === 'voicemail') {
      const changed = node.isNew || voicemailKey(node.data) !== node.key
      if (changed) {
        dirtyIds.add(node.id)
      }
      if (changed && reachable.has(node.id) && !mailboxes.has(node.data.extension)) {
        mailboxes.add(node.data.extension)
        changes.push({
          type: 'voicemail',
          ref: `vm:${node.data.extension}`,
          isNew: true,
          data: { extension: node.data.extension },
        })
      }
      continue
    }
    const type = SAVED_TYPE_BY_NODE[node.type]
    const payload = type ? payloadOf(state, node, index) : null
    const dirty = node.isNew || (payload !== null && !isEqual(payload, baseline[node.id]))

    if (dirty) {
      dirtyIds.add(node.id)
    }
    if (!type || !payload || !dirty || (node.isNew && !reachable.has(node.id))) {
      continue
    }
    changes.push({ type, ref: node.key, isNew: node.isNew, data: payload })
  }
  return { changes, dirtyIds }
}

export const buildChanges = (
  state: FlowState,
  baseline: Baseline,
  data: VisualPlanData,
): VisualPlanChange[] => analyzeFlow(state, baseline, data).changes

export const removeNode = (state: FlowState, id: string): void => {
  if (id === state.rootId) {
    return
  }
  state.edges = state.edges.filter((edge) => edge.source !== id && edge.target !== id)
  delete state.nodes[id]
  for (const other of Object.values(state.nodes)) {
    if (
      other.type === 'hangup' &&
      other.id.includes(`@${id}/`) &&
      !state.edges.some((edge) => edge.target === other.id)
    ) {
      delete state.nodes[other.id]
    }
  }
}

export const connect = (state: FlowState, source: string, output: string, target: string): void => {
  state.edges = state.edges.filter((edge) => !(edge.source === source && edge.output === output))
  if (target) {
    state.edges.push({ source, output, target })
  }
}

export const pruneOrphanOutputs = (state: FlowState, node: FlowNode): void => {
  const valid = new Set(getOutputs(node).map((item) => item.id))
  state.edges = state.edges.filter((edge) => edge.source !== node.id || valid.has(edge.output))
}
