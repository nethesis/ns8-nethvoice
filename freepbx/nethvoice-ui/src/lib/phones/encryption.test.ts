//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { parsePhoneEncryption } from './encryption'

describe('parsePhoneEncryption', () => {
  it('should map each extension to its SRTP flag', () => {
    expect(
      parsePhoneEncryption([
        {
          username: 'a.miller',
          devices: [
            { extension: '300', srtp: null },
            { extension: '91300', srtp: 1 },
            { extension: 92300, srtp: '0' },
          ],
        },
        { username: 'j.smith', devices: null },
      ]),
    ).toEqual({ '300': false, '91300': true, '92300': false })
  })

  it('should reject an unexpected shape', () => {
    expect(() => parsePhoneEncryption({})).toThrow()
  })
})
