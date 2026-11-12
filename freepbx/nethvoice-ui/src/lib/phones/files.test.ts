//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { isValidPhoneFileName, parsePhoneFiles } from './files'

describe('parsePhoneFiles', () => {
  it('should sort files by name', () => {
    expect(
      parsePhoneFiles([
        { name: 'b.png', size: 2, mtime: 1 },
        { name: 'a.png', size: 1, mtime: 1 },
      ]),
    ).toEqual([
      { name: 'a.png', size: 1 },
      { name: 'b.png', size: 2 },
    ])
  })
})

describe('isValidPhoneFileName', () => {
  it('should accept the characters Tancredi allows', () => {
    expect(isValidPhoneFileName('logo_(1).png')).toBe(true)
    expect(isValidPhoneFileName('my logo.png')).toBe(false)
  })
})
