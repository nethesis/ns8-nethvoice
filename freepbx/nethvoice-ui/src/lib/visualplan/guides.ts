//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export type Rect = { x: number; y: number; width: number; height: number }

export type GuideResult = {
  x: number
  y: number
  vertical: number | null
  horizontal: number | null
}

export const GUIDE_THRESHOLD = 6

const closest = (anchors: number[], targets: number[], threshold: number) => {
  let best: { delta: number; line: number } | null = null

  for (const anchor of anchors) {
    for (const target of targets) {
      const delta = target - anchor
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, line: target }
      }
    }
  }
  return best
}

export const alignToGuides = (
  dragged: Rect,
  others: Rect[],
  threshold = GUIDE_THRESHOLD,
): GuideResult => {
  const xs = (rect: Rect) => [rect.x, rect.x + rect.width / 2, rect.x + rect.width]
  const ys = (rect: Rect) => [rect.y, rect.y + rect.height / 2, rect.y + rect.height]
  const vertical = closest(xs(dragged), others.flatMap(xs), threshold)
  const horizontal = closest(ys(dragged), others.flatMap(ys), threshold)

  return {
    x: dragged.x + (vertical?.delta ?? 0),
    y: dragged.y + (horizontal?.delta ?? 0),
    vertical: vertical?.line ?? null,
    horizontal: horizontal?.line ?? null,
  }
}
