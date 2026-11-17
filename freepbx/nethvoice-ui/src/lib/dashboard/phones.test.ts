//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { getPhoneStatusBars, parsePhoneStatusSummary } from './phones'

describe('parsePhoneStatusSummary', () => {
  const valid = { provisioned: 116, pending: 4, unassigned: 2, failed: 2, unknown: 1 }

  it('should read the phones of every status', () => {
    expect(parsePhoneStatusSummary(valid)).toEqual(valid)
  })

  it('should drop unexpected fields', () => {
    expect(parsePhoneStatusSummary({ ...valid, total: 125 })).toEqual(valid)
  })

  it('should reject missing, negative and fractional counts', () => {
    expect(() => parsePhoneStatusSummary({ ...valid, unknown: undefined })).toThrow()
    expect(() => parsePhoneStatusSummary({ ...valid, failed: -1 })).toThrow()
    expect(() => parsePhoneStatusSummary({ ...valid, pending: 1.5 })).toThrow()
    expect(() => parsePhoneStatusSummary('An error occurred')).toThrow()
  })
})

describe('getPhoneStatusBars', () => {
  const label = (status: string) => `label.${status}`

  it('should show a bar for every status except the unknown phones', () => {
    const bars = getPhoneStatusBars(
      { provisioned: 116, pending: 4, unassigned: 2, failed: 2, unknown: 3 },
      label,
    )

    expect(bars.map(({ id, label, value }) => ({ id, label, value }))).toEqual([
      { id: 'provisioned', label: 'label.provisioned', value: 116 },
      { id: 'pending', label: 'label.pending', value: 4 },
      { id: 'unassigned', label: 'label.unassigned', value: 2 },
      { id: 'failed', label: 'label.failed', value: 2 },
    ])
  })

  it('should color every status like the mockup and give it an icon', () => {
    const bars = getPhoneStatusBars(undefined, label)

    expect(bars.map((bar) => bar.color)).toEqual([
      'var(--accent-green)',
      'var(--accent-gray)',
      'var(--accent-amber)',
      'var(--accent-rose)',
    ])
    expect(bars.map((bar) => bar.icon?.iconName)).toEqual([
      'circle-check',
      'clock',
      'link-slash',
      'circle-xmark',
    ])
  })

  it('should show zeros while the summary is not loaded', () => {
    expect(getPhoneStatusBars(undefined, label).map((bar) => bar.value)).toEqual([0, 0, 0, 0])
  })
})
