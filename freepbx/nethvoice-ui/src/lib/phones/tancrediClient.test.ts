//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  buildTancrediUrl,
  getTancrediProblemType,
  isTancrediAuthenticationFailure,
} from './tancrediClient'

describe('buildTancrediUrl', () => {
  it('should prefix the API path and encode the query', () => {
    expect(buildTancrediUrl('/models')).toBe('/tancredi/api/v1/models')
    expect(buildTancrediUrl('/phones/AA', { inherit: 1, skip: undefined })).toBe(
      '/tancredi/api/v1/phones/AA?inherit=1',
    )
  })
})

describe('isTancrediAuthenticationFailure', () => {
  const forbidden = {
    type: 'https://nethesis.github.io/tancredi/problems#forbidden',
    title: 'Access to resource is forbidden with current client privileges',
  }

  it('should treat 401 and the forbidden problem of the admin user as credential errors', () => {
    expect(isTancrediAuthenticationFailure(401, null)).toBe(true)
    expect(isTancrediAuthenticationFailure(401, null, 'operator')).toBe(true)
    expect(isTancrediAuthenticationFailure(403, forbidden, 'admin')).toBe(true)
  })

  it('should not sign out another administrator on the forbidden problem', () => {
    expect(isTancrediAuthenticationFailure(403, forbidden, 'operator')).toBe(false)
    expect(isTancrediAuthenticationFailure(403, forbidden)).toBe(false)
  })

  it('should not sign out on other 403 problems', () => {
    expect(
      isTancrediAuthenticationFailure(
        403,
        { type: 'https://nethesis.github.io/tancredi/problems/#read-only-attribute' },
        'admin',
      ),
    ).toBe(false)
  })
})

describe('getTancrediProblemType', () => {
  it('should read the fragment of the problem type', () => {
    expect(
      getTancrediProblemType({ type: 'https://nethesis.github.io/tancredi/problems/#not-found' }),
    ).toBe('not-found')
    expect(getTancrediProblemType('text')).toBe('')
  })
})
