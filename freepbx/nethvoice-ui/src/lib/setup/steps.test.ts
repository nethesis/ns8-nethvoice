//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  getNextStep,
  getPreviousStep,
  getStepForLegacyStep,
  getStepProgress,
  LEGACY_FINAL_STEP,
  LEGACY_SUMMARY_STEP,
  SETUP_STEPS,
} from './steps'

describe('setup steps', () => {
  it('should never reach the legacy final step before completion, since saving it restarts the PBX', () => {
    expect(SETUP_STEPS.every((step) => step.legacyStep < LEGACY_FINAL_STEP)).toBe(true)
  })

  it('should have seven steps ending with the summary', () => {
    expect(SETUP_STEPS).toHaveLength(7)
    expect(SETUP_STEPS[6].id).toBe('summary')
    expect(SETUP_STEPS[6].legacyStep).toBe(LEGACY_SUMMARY_STEP)
  })

  it('should keep legacy step numbers strictly increasing', () => {
    const legacySteps = SETUP_STEPS.map((step) => step.legacyStep)

    expect([...legacySteps].sort((a, b) => a - b)).toEqual(legacySteps)
    expect(new Set(legacySteps).size).toBe(legacySteps.length)
  })

  it('should navigate between adjacent steps', () => {
    expect(getPreviousStep('system')).toBeUndefined()
    expect(getNextStep('system')?.id).toBe('users')
    expect(getPreviousStep('summary')?.id).toBe('outbound-routes')
    expect(getNextStep('summary')).toBeUndefined()
  })

  it('should compute the progress of each step', () => {
    expect(getStepProgress('system')).toBe(14)
    expect(getStepProgress('summary')).toBe(100)
  })
})

describe('getStepForLegacyStep', () => {
  it('should map the steps shared with the legacy wizard', () => {
    expect(getStepForLegacyStep(0).id).toBe('system')
    expect(getStepForLegacyStep(1).id).toBe('users')
    expect(getStepForLegacyStep(3).id).toBe('voip-trunks')
    expect(getStepForLegacyStep(5).id).toBe('outbound-routes')
    expect(getStepForLegacyStep(13).id).toBe('summary')
  })

  it('should resume at the last shared step when the legacy wizard went further', () => {
    expect(getStepForLegacyStep(6).id).toBe('outbound-routes')
    expect(getStepForLegacyStep(11).id).toBe('outbound-routes')
    expect(getStepForLegacyStep(12).id).toBe('summary')
  })

  it('should start from the first step on an unknown value', () => {
    expect(getStepForLegacyStep(-1).id).toBe('system')
  })
})
