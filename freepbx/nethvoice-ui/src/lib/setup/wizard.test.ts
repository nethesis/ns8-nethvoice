//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { parseWizardState } from './wizard'

describe('parseWizardState', () => {
  it('should consider an empty table as a wizard to start', () => {
    expect(parseWizardState([])).toEqual({ inProgress: true, legacyStep: 0 })
  })

  it('should read a wizard in progress', () => {
    expect(parseWizardState([{ step: 3, status: 'true' }])).toEqual({
      inProgress: true,
      legacyStep: 3,
    })
  })

  it('should read a completed wizard', () => {
    expect(parseWizardState([{ step: 13, status: 'false' }])).toEqual({
      inProgress: false,
      legacyStep: 13,
    })
  })

  it('should accept the step as a string and a null status', () => {
    expect(parseWizardState([{ step: '1', status: null }])).toEqual({
      inProgress: false,
      legacyStep: 1,
    })
  })

  it('should reject a payload that is not a list', () => {
    expect(() => parseWizardState({ step: 1 })).toThrow()
  })
})
