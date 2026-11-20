//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api/client'
import { getPhoneRegistrations, parsePhoneRegistrations } from './registration'

vi.mock('@/lib/api/client', () => ({ api: { GET: vi.fn() } }))

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

describe('getPhoneRegistrations', () => {
  it('should read the registrations from the live extensions route', async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: {
        '201': {
          exten: '201',
          name: 'Alice Example',
          status: 'online',
          conversations: {},
          dnd: false,
          cf: '',
          codecs: ['alaw'],
          ip: '192.0.2.10',
          port: '5060',
          sipuseragent: 'Yealink T46U',
        },
      },
      response: new Response(),
    } as never)

    await expect(getPhoneRegistrations()).resolves.toEqual({
      '201': { registered: true, ip: '192.0.2.10', port: '5060', userAgent: 'Yealink T46U' },
    })
    expect(api.GET).toHaveBeenCalledWith('/dashboard/live/extensions', { signal: undefined })
  })
})
