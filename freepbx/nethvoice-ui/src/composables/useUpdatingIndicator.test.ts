//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useUpdatingIndicator } from './useUpdatingIndicator'

describe('useUpdatingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const setup = () => {
    const updating = ref(false)
    const scope = effectScope()
    const visible = scope.run(() => useUpdatingIndicator(() => updating.value))!
    return { updating, visible, scope }
  }

  it('should stay hidden for a refresh shorter than 500 ms', async () => {
    const { updating, visible } = setup()

    updating.value = true
    await nextTick()
    vi.advanceTimersByTime(400)
    updating.value = false
    await nextTick()
    vi.advanceTimersByTime(1000)

    expect(visible.value).toBe(false)
  })

  it('should appear after 500 ms and stay at least 500 ms', async () => {
    const { updating, visible } = setup()

    updating.value = true
    await nextTick()
    vi.advanceTimersByTime(500)
    expect(visible.value).toBe(true)

    vi.advanceTimersByTime(100)
    updating.value = false
    await nextTick()
    vi.advanceTimersByTime(399)
    expect(visible.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(visible.value).toBe(false)
  })

  it('should stop its timers when the scope ends', async () => {
    const { updating, visible, scope } = setup()

    updating.value = true
    await nextTick()
    scope.stop()
    vi.advanceTimersByTime(1000)

    expect(visible.value).toBe(false)
  })
})
