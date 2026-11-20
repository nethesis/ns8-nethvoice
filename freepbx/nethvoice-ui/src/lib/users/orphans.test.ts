//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api/client'
import {
  countOrphanPhones,
  getOrphanExtensions,
  getOrphanSoftwareDevices,
  parseOrphanExtensions,
  releaseOrphanExtensions,
} from './orphans'

vi.mock('@/lib/api/client', () => ({ api: { POST: vi.fn(), GET: vi.fn() } }))

const RAW = [
  {
    username: 'e.brown',
    displayname: 'Emma Brown',
    extension: '310',
    devices: [
      { extension: '92310', type: 'webrtc', mac: null },
      { extension: '91310', type: 'physical', mac: '00:15:65:AB:CD:09' },
      { extension: '93310', type: 'mobile', mac: null },
    ],
    removed_at: '2026-11-12T08:30:00Z',
  },
  { username: 'f.green', displayname: '', extension: 305, devices: [], removed_at: null },
]

describe('parseOrphanExtensions', () => {
  it('reads the removed users sorted by extension', () => {
    const orphans = parseOrphanExtensions(RAW)

    expect(orphans.map((orphan) => orphan.extension)).toEqual(['305', '310'])
    expect(orphans[0]).toEqual({
      username: 'f.green',
      displayName: 'f.green',
      extension: '305',
      devices: [],
      removedAt: null,
    })
    expect(orphans[1].displayName).toBe('Emma Brown')
    expect(orphans[1].devices[0]).toEqual({ extension: '92310', type: 'webrtc', mac: '' })
    expect(orphans[1].removedAt?.toISOString()).toBe('2026-11-12T08:30:00.000Z')
  })

  it('ignores an invalid removal date', () => {
    expect(parseOrphanExtensions([{ ...RAW[0], removed_at: 'never' }])[0].removedAt).toBeNull()
  })

  it('rejects a malformed response', () => {
    expect(() => parseOrphanExtensions({ username: 'e.brown' })).toThrow()
  })
})

describe('orphan devices', () => {
  it('lists the software devices and counts the physical phones', () => {
    const [, emma] = parseOrphanExtensions(RAW)

    expect(getOrphanSoftwareDevices(emma)).toEqual(['webrtc', 'mobile'])
    expect(countOrphanPhones(emma)).toBe(1)
  })
})

describe('orphan API', () => {
  beforeEach(() => vi.mocked(api.GET).mockReset())

  it('loads the orphans', async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: RAW } as never)

    expect(await getOrphanExtensions()).toHaveLength(2)
    expect(api.GET).toHaveBeenCalledWith('/mainextensions/orphans')
  })

  it('deletes the chosen extensions', async () => {
    vi.mocked(api.POST).mockResolvedValue({} as never)
    await releaseOrphanExtensions(['305', '310'])

    expect(api.POST).toHaveBeenCalledWith('/mainextensions/orphans/release', {
      body: { extensions: ['305', '310'] },
      parseAs: 'text',
    })
  })
})
