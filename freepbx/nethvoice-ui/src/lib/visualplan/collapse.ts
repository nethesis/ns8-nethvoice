//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { adjacency, reachFrom, type FlowState } from '@/lib/visualplan/graph'

export const hiddenByCollapse = (state: FlowState, collapsed: string[]): Map<string, string> => {
  const active = collapsed.filter((id) => state.nodes[id])
  if (!active.length) {
    return new Map()
  }
  const next = adjacency(state)
  const reachable = reachFrom(next, state.rootId)
  const visible = reachFrom(next, state.rootId, new Set(active))
  const owners = active
    .filter((id) => visible.has(id))
    .map((id) => ({ id, below: reachFrom(next, id) }))
  const hidden = new Map<string, string>()

  for (const id of reachable) {
    if (visible.has(id)) {
      continue
    }
    const owner = owners.find((candidate) => candidate.below.has(id))
    if (owner) {
      hidden.set(id, owner.id)
    }
  }
  return hidden
}

export const countHidden = (hidden: Map<string, string>, owner: string): number =>
  [...hidden.values()].filter((value) => value === owner).length
