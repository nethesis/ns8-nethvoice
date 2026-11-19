//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { emptyHistory, HISTORY_LIMIT, record, redo, undo } from './history'

describe('history', () => {
  it('undoes and redoes snapshots', () => {
    let history = record(emptyHistory<number>(), 1)
    history = record(history, 2)

    const undone = undo(history, 3)
    expect(undone?.[1]).toBe(2)
    const redone = undone ? redo(undone[0], 2) : null
    expect(redone?.[1]).toBe(3)
    expect(undo(emptyHistory<number>(), 1)).toBeNull()
  })
})

describe('history limit', () => {
  it('keeps only the last snapshots', () => {
    let history = emptyHistory<number>()
    for (let index = 0; index < HISTORY_LIMIT + 5; index += 1) {
      history = record(history, index)
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT)
    expect(history.past[0]).toBe(5)
  })
})
