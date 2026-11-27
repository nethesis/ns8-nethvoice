//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import dagre from '@dagrejs/dagre'
import type { FlowState } from '@/lib/visualplan/graph'
import { getOutputs, type FlowNode, type Position } from '@/lib/visualplan/model'

export const NODE_WIDTH = 240
const HEADER_HEIGHT = 76
const OUTPUT_HEIGHT = 32

export const nodeHeight = (node: FlowNode): number =>
  HEADER_HEIGHT + getOutputs(node).length * OUTPUT_HEIGHT

export type NodeSize = { width: number; height: number }

export const layoutFlow = (
  state: FlowState,
  ids?: string[],
  sizes: Record<string, NodeSize> = {},
): Record<string, Position> => {
  const sizeOf = (id: string, node: FlowNode): NodeSize =>
    sizes[id] ?? { width: NODE_WIDTH, height: nodeHeight(node) }
  const graph = new dagre.graphlib.Graph()
  const included = new Set(ids ?? Object.keys(state.nodes))

  graph.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 72, marginx: 24, marginy: 24 })
  graph.setDefaultEdgeLabel(() => ({}))

  for (const id of included) {
    const node = state.nodes[id]
    if (node) {
      graph.setNode(id, sizeOf(id, node))
    }
  }
  for (const edge of state.edges) {
    if (included.has(edge.source) && included.has(edge.target)) {
      graph.setEdge(edge.source, edge.target)
    }
  }
  dagre.layout(graph)

  const positions: Record<string, Position> = {}
  for (const id of graph.nodes()) {
    const point = graph.node(id)
    const node = state.nodes[id]
    if (point && node) {
      const size = sizeOf(id, node)
      positions[id] = {
        x: Math.round(point.x - size.width / 2),
        y: Math.round(point.y - size.height / 2),
      }
    }
  }
  return positions
}

export const offsetPositions = (
  positions: Record<string, Position>,
  anchorId: string,
  anchor: Position,
): Record<string, Position> => {
  const origin = positions[anchorId]

  if (!origin) {
    return positions
  }
  const dx = anchor.x - origin.x
  const dy = anchor.y - origin.y
  return Object.fromEntries(
    Object.entries(positions).map(([id, point]) => [id, { x: point.x + dx, y: point.y + dy }]),
  )
}
