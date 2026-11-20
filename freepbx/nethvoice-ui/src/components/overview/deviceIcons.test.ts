//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { DEVICE_ICONS as USER_DEVICE_ICONS } from '@/lib/users/deviceIcons'
import { DEVICE_ICONS } from './deviceIcons'

describe('DEVICE_ICONS', () => {
  it('shows the software devices with the same icons as the Users tab', () => {
    expect(DEVICE_ICONS.mobile).toBe(USER_DEVICE_ICONS.mobile)
    expect(DEVICE_ICONS.webrtc).toBe(USER_DEVICE_ICONS.webrtc)
    expect(DEVICE_ICONS.nethlink).toBe(USER_DEVICE_ICONS.nethlink)
  })
})
