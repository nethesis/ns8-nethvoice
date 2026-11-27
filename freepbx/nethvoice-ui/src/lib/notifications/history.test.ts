//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import type { NeNotificationV2 } from '@nethesis/vue-components'
import { parseStoredNotifications, serializeNotifications } from './history'

const notification = (id: number): NeNotificationV2 => ({
  id: `notification-${id}`,
  kind: 'error',
  title: 'Trunk unreachable',
  description: 'Calls through trunk backup cannot be placed or received.',
  timestamp: new Date('2026-11-17T10:00:00.000Z'),
  isShown: true,
  payload: { secret: 'not stored' },
})

describe('notification history', () => {
  it('restores the notifications hidden', () => {
    const [restored] = parseStoredNotifications(serializeNotifications([notification(1)]))

    expect(restored).toEqual({
      id: 'notification-1',
      kind: 'error',
      title: 'Trunk unreachable',
      description: 'Calls through trunk backup cannot be placed or received.',
      timestamp: new Date('2026-11-17T10:00:00.000Z'),
      isShown: false,
      firstButtonLabel: '',
      secondButtonLabel: '',
    })
  })

  it('keeps the 30 most recent notifications', () => {
    const stored = serializeNotifications(Array.from({ length: 40 }, (_, id) => notification(id)))
    const restored = parseStoredNotifications(stored)

    expect(restored).toHaveLength(30)
    expect(restored[0]?.id).toBe('notification-0')
  })

  it('skips invalid entries', () => {
    expect(parseStoredNotifications(null)).toEqual([])
    expect(parseStoredNotifications('not json')).toEqual([])
    expect(parseStoredNotifications('{"id":"x"}')).toEqual([])

    const restored = parseStoredNotifications(
      JSON.stringify([
        { id: 'a', kind: 'unknown', title: 'Bad kind' },
        { id: 'b', kind: 'info', title: 'No date', timestamp: 'yesterday' },
      ]),
    )
    expect(restored.map((item) => [item.id, item.timestamp])).toEqual([['b', undefined]])
  })
})
