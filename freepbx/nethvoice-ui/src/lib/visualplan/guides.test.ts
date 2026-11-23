//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { alignToGuides } from './guides'

describe('alignToGuides', () => {
  it('snaps to the closest edge or center within the threshold', () => {
    const other = { x: 100, y: 100, width: 200, height: 80 }

    expect(alignToGuides({ x: 104, y: 300, width: 200, height: 80 }, [other])).toEqual({
      x: 100,
      y: 300,
      vertical: 100,
      horizontal: null,
    })
    expect(alignToGuides({ x: 500, y: 143, width: 200, height: 80 }, [other])).toEqual({
      x: 500,
      y: 140,
      vertical: null,
      horizontal: 140,
    })
    expect(alignToGuides({ x: 500, y: 500, width: 200, height: 80 }, [other])).toEqual({
      x: 500,
      y: 500,
      vertical: null,
      horizontal: null,
    })
  })
})
