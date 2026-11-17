//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  USERS_SYNC_MAX_POLLS,
  USERS_SYNC_POLL_INTERVAL,
  USERS_SYNC_START_GRACE,
  waitForUsersSync,
} from './usersSync'

const run = (answers: boolean[], cancelAfter = Number.POSITIVE_INFINITY) => {
  let clock = 0
  let polls = 0
  const waits: number[] = []

  return waitForUsersSync({
    isRunning: async () => answers[Math.min(polls++, answers.length - 1)],
    wait: async (milliseconds) => {
      waits.push(milliseconds)
      clock += milliseconds
    },
    now: () => clock,
    isCancelled: () => polls >= cancelAfter,
  }).then((completed) => ({ completed, polls, elapsed: clock, waits }))
}

describe('waitForUsersSync', () => {
  it('waits for the sync to start before accepting that it ended', async () => {
    const result = await run([false, true, true, false])

    expect(result.completed).toBe(true)
    expect(result.polls).toBe(4)
  })

  it('ends when the grace period is over and the sync was never seen running', async () => {
    const result = await run([false])

    expect(result.completed).toBe(true)
    expect(result.elapsed).toBe(USERS_SYNC_START_GRACE)
    expect(result.waits.every((wait) => wait <= USERS_SYNC_POLL_INTERVAL)).toBe(true)
  })

  it('ends at the first idle answer after the sync was seen running', async () => {
    const result = await run([true, false])

    expect(result).toMatchObject({ completed: true, polls: 2 })
    expect(result.waits).toEqual([USERS_SYNC_POLL_INTERVAL])
  })

  it('stops when cancelled', async () => {
    expect(await run([true], 2)).toMatchObject({ completed: false, polls: 2 })
  })

  it('gives up after the maximum number of polls', async () => {
    expect(await run([true])).toMatchObject({ completed: false, polls: USERS_SYNC_MAX_POLLS })
  })
})
