//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { parsePhoneRegistrations } from './registration'

describe('parsePhoneRegistrations', () => {
  it('should read status, address and user agent of each extension', () => {
    expect(
      parsePhoneRegistrations({
        '91300': {
          exten: '91300',
          status: 'online',
          ip: '192.0.2.10',
          port: 5060,
          sipuseragent: 'Yealink SIP-T46U 108.86.0.45',
        },
        '91301': { exten: '91301', status: 'offline', ip: '', port: '', sipuseragent: '' },
        '91302': { exten: '91302', status: 'busy' },
      }),
    ).toEqual({
      '91300': {
        registered: true,
        ip: '192.0.2.10',
        port: '5060',
        userAgent: 'Yealink SIP-T46U 108.86.0.45',
      },
      '91301': { registered: false, ip: '', port: '', userAgent: '' },
      '91302': { registered: true, ip: '', port: '', userAgent: '' },
    })
  })

  it('should reject an unexpected shape', () => {
    expect(() => parsePhoneRegistrations('broken')).toThrow()
  })
})
