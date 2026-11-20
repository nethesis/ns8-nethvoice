//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkAdminPhone,
  checkExtensionsLimit,
  checkLiveService,
  checkTrunks,
  forgetNotifiedAlerts,
  getTrunkCondition,
  readNotifiedAlerts,
  reconcileAlerts,
  writeNotifiedAlerts,
} from './systemAlerts'

const LIVE = {
  main: { status: 'online', registration: 'registered' },
  backup: { status: 'offline', registration: 'unmonitored' },
  rejected: { status: 'online', registration: 'rejected' },
  unregistered: { status: 'unmonitored', registration: 'unregistered' },
  starting: { status: 'online', registration: 'sent' },
  unmonitored: { status: 'unmonitored', registration: 'unmonitored' },
}

describe('system alerts', () => {
  it('classifies the trunks like the dashboard', () => {
    expect(getTrunkCondition('main', LIVE)).toBe('ok')
    expect(getTrunkCondition('backup', LIVE)).toBe('problem')
    expect(getTrunkCondition('rejected', LIVE)).toBe('problem')
    expect(getTrunkCondition('unregistered', LIVE)).toBe('problem')
    expect(getTrunkCondition('starting', LIVE)).toBe('unknown')
    expect(getTrunkCondition('unmonitored', LIVE)).toBe('ok')
  })

  it('raises the trunks already down on the first check', () => {
    const result = reconcileAlerts([], checkTrunks([], LIVE))

    expect(result.raised).toEqual(['trunk:backup', 'trunk:rejected', 'trunk:unregistered'])
    expect(result.recovered).toEqual([])
    expect(result.notified).toEqual(result.raised)
  })

  it('does not repeat an alert already notified', () => {
    const notified = ['trunk:backup', 'trunk:rejected', 'trunk:unregistered']

    expect(reconcileAlerts(notified, checkTrunks(notified, LIVE))).toEqual({
      raised: [],
      recovered: [],
      notified,
    })
  })

  it('reports the recovery and alerts again when the problem comes back', () => {
    const live = { backup: { status: 'online', registration: 'registered' } }
    const recovered = reconcileAlerts(['trunk:backup'], checkTrunks(['trunk:backup'], live))

    expect(recovered).toEqual({ raised: [], recovered: ['trunk:backup'], notified: [] })

    const down = { backup: { status: 'offline', registration: 'registered' } }
    expect(reconcileAlerts(recovered.notified, checkTrunks([], down)).raised).toEqual([
      'trunk:backup',
    ])
  })

  it('keeps the alert while the state is unknown and forgets a removed trunk', () => {
    const pending = { backup: { status: 'online', registration: 'sent' } }

    expect(reconcileAlerts(['trunk:backup'], checkTrunks(['trunk:backup'], pending))).toEqual({
      raised: [],
      recovered: [],
      notified: ['trunk:backup'],
    })
    expect(reconcileAlerts(['trunk:backup', 'live'], checkTrunks(['trunk:backup'], {}))).toEqual({
      raised: [],
      recovered: [],
      notified: ['live'],
    })
  })

  it('alerts on the live service only after consecutive failures', () => {
    expect(reconcileAlerts([], [checkLiveService(1)]).raised).toEqual([])
    expect(reconcileAlerts([], [checkLiveService(2)]).raised).toEqual(['live'])
    expect(reconcileAlerts(['live'], [checkLiveService(3)]).raised).toEqual([])
    expect(reconcileAlerts(['live'], [checkLiveService(0)]).recovered).toEqual(['live'])
  })

  it('warns once about the extension limit and forgets it silently', () => {
    expect(reconcileAlerts([], [checkExtensionsLimit(true)]).raised).toEqual(['extensionsLimit'])
    expect(reconcileAlerts(['extensionsLimit'], [checkExtensionsLimit(true)]).raised).toEqual([])
    expect(reconcileAlerts(['extensionsLimit'], [checkExtensionsLimit(false)])).toEqual({
      raised: [],
      recovered: [],
      notified: [],
    })
  })

  it('alerts when the enabled administrator phone fails and recovers when ready', () => {
    expect(checkAdminPhone('error', true).condition).toBe('problem')
    expect(checkAdminPhone('error', false).condition).toBe('unknown')
    expect(checkAdminPhone('registering', true).condition).toBe('unknown')
    expect(checkAdminPhone('ready', true).condition).toBe('ok')
  })

  describe('storage', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('keeps the alerts of each user', () => {
      writeNotifiedAlerts('admin', ['trunk:backup'])
      writeNotifiedAlerts('operator', ['live'])

      expect(readNotifiedAlerts('admin')).toEqual(['trunk:backup'])
      expect(readNotifiedAlerts('operator')).toEqual(['live'])

      forgetNotifiedAlerts('admin')
      expect(readNotifiedAlerts('admin')).toEqual([])
      expect(readNotifiedAlerts('operator')).toEqual(['live'])
    })

    it('ignores invalid or unavailable storage', () => {
      localStorage.setItem('nethvoiceSystemAlerts:admin', '{"broken"')
      expect(readNotifiedAlerts('admin')).toEqual([])

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
      expect(() => writeNotifiedAlerts('admin', ['live'])).not.toThrow()
    })
  })
})
