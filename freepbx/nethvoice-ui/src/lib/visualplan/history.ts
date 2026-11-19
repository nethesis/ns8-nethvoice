//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export const HISTORY_LIMIT = 100

export type History<T> = { past: T[]; future: T[] }

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [] })

export const record = <T>(history: History<T>, snapshot: T): History<T> => ({
  past: [...history.past, snapshot].slice(-HISTORY_LIMIT),
  future: [],
})

export const undo = <T>(history: History<T>, current: T): [History<T>, T] | null => {
  const previous = history.past.at(-1)

  if (previous === undefined) {
    return null
  }
  return [{ past: history.past.slice(0, -1), future: [current, ...history.future] }, previous]
}

export const redo = <T>(history: History<T>, current: T): [History<T>, T] | null => {
  const next = history.future[0]

  if (next === undefined) {
    return null
  }
  return [{ past: [...history.past, current], future: history.future.slice(1) }, next]
}
