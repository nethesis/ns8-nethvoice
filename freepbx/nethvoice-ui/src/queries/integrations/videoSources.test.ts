//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, effectScope, nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import {
  checkStoredVideoSource,
  VIDEO_STATUS_CONCURRENCY,
  type VideoSource,
  type VideoSourceCheck,
} from '@/lib/integrations/videoSources'
import { useVideoSourceChecks } from './videoSources'

vi.mock('@/lib/integrations/videoSources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/integrations/videoSources')>()),
  checkStoredVideoSource: vi.fn(),
}))

const source = (name: string, url = `rtsp://192.0.2.1/${name}`): VideoSource => ({
  name,
  type: 'rtsp',
  url,
  user: '',
  hasSecret: false,
  extension: '',
  gates: [],
  tlsSkipVerify: false,
  tlsUnpinned: false,
  doorPhone: '',
  profileIds: [],
})

const check = (success: boolean): VideoSourceCheck => ({
  success,
  type: 'rtsp',
  imageUrl: success ? 'data:image/jpeg;base64,AA==' : '',
  mime: success ? 'image/jpeg' : '',
  video: null,
  warnings: [],
  reason: success ? null : 'timeout',
  message: '',
})

const pending: ((value: VideoSourceCheck) => void)[] = []

const flush = async () => {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve()
  }
  await nextTick()
}

const setup = (initial: VideoSource[], enabled = true) => {
  const pinia = createPinia()
  createApp({}).use(pinia).use(PiniaColada)
  setActivePinia(pinia)
  const sources = ref(initial)
  const isEnabled = ref(enabled)
  const scope = effectScope()
  const checks = scope.run(() =>
    useVideoSourceChecks(
      () => sources.value,
      () => isEnabled.value,
    ),
  )!
  return { checks, sources, isEnabled, scope }
}

describe('useVideoSourceChecks', () => {
  afterEach(async () => {
    while (pending.length > 0) {
      pending.shift()?.(check(false))
      await flush()
    }
  })

  beforeEach(() => {
    pending.length = 0
    vi.mocked(checkStoredVideoSource).mockReset()
    vi.mocked(checkStoredVideoSource).mockImplementation(
      () => new Promise<VideoSourceCheck>((resolve) => pending.push(resolve)),
    )
  })

  it('tests every source once, with limited concurrency, and keeps the results', async () => {
    const { checks, sources } = setup(['a', 'b', 'c', 'd', 'e'].map((name) => source(name)))
    await flush()

    expect(checkStoredVideoSource).toHaveBeenCalledTimes(VIDEO_STATUS_CONCURRENCY)
    expect(checks.testingCount.value).toBe(5)
    expect(checks.statusOf('e')).toBe('testing')

    while (pending.length > 0) {
      pending.shift()?.(check(pending.length % 2 === 0))
      await flush()
    }
    expect(checkStoredVideoSource).toHaveBeenCalledTimes(5)
    expect(checks.testingCount.value).toBe(0)
    expect(['connected', 'notConnected']).toContain(checks.statusOf('a'))

    sources.value = [...sources.value]
    await flush()
    expect(checkStoredVideoSource).toHaveBeenCalledTimes(5)
  })

  it('waits until the sources are loaded', async () => {
    const { isEnabled } = setup([source('a')], false)
    await flush()
    expect(checkStoredVideoSource).not.toHaveBeenCalled()

    isEnabled.value = true
    await flush()
    expect(checkStoredVideoSource).toHaveBeenCalledTimes(1)
  })

  it('tests again a source whose connection changed', async () => {
    const { checks, sources } = setup([source('a'), source('b')])
    await flush()
    pending.splice(0).forEach((resolve) => resolve(check(true)))
    await flush()
    expect(checks.statusOf('a')).toBe('connected')

    sources.value = [source('a', 'rtsp://192.0.2.9/other')]
    await flush()

    expect(checks.statusOf('a')).toBe('testing')
    expect(checkStoredVideoSource).toHaveBeenCalledTimes(3)
    pending.splice(0).forEach((resolve) => resolve(check(false)))
    await flush()
    expect(checks.statusOf('a')).toBe('notConnected')
  })

  it('adopts a seeded result after a save without testing again', async () => {
    const { checks, sources } = setup([])
    checks.seed('Front door', check(true))
    sources.value = [source('Front door')]
    await flush()

    expect(checks.statusOf('Front door')).toBe('connected')
    expect(checks.checkOf('Front door')?.imageUrl).toBe('data:image/jpeg;base64,AA==')
    expect(checkStoredVideoSource).not.toHaveBeenCalled()

    sources.value = [source('Front door', 'rtsp://192.0.2.7/moved')]
    await flush()
    expect(checkStoredVideoSource).toHaveBeenCalledTimes(1)
  })

  it('tests a source again on request and returns the new result', async () => {
    const { checks } = setup([source('a')])
    await flush()
    pending.shift()?.(check(false))
    await flush()
    expect(checks.statusOf('a')).toBe('notConnected')

    const retest = checks.retest('a')
    await flush()
    expect(checks.statusOf('a')).toBe('testing')
    pending.shift()?.(check(true))

    await expect(retest).resolves.toMatchObject({ success: true })
    expect(checks.statusOf('a')).toBe('connected')
    await expect(checks.retest('missing')).resolves.toBeNull()
  })

  it('forgets a deleted source', async () => {
    const { checks, sources } = setup([source('a')])
    await flush()
    pending.shift()?.(check(true))
    await flush()

    checks.forget('a')
    sources.value = []
    await flush()
    expect(checks.checkOf('a')).toBeNull()

    sources.value = [source('a')]
    await flush()
    expect(checkStoredVideoSource).toHaveBeenCalledTimes(2)
  })
})
