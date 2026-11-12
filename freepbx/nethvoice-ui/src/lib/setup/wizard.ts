//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'

export const WIZARD_STATE_KEY = 'wizardState'

const WizardRowSchema = v.object({
  step: v.pipe(v.union([v.number(), v.string()]), v.transform(Number)),
  status: v.nullable(v.union([v.string(), v.boolean(), v.number()])),
})

const WizardRowsSchema = v.array(WizardRowSchema)

export type WizardState = {
  inProgress: boolean
  legacyStep: number
}

export const parseWizardState = (raw: unknown): WizardState => {
  const rows = v.parse(WizardRowsSchema, raw)

  if (rows.length === 0) {
    return { inProgress: true, legacyStep: 0 }
  }
  const [row] = rows

  return {
    inProgress: row.status === true || row.status === 'true' || row.status === 1,
    legacyStep: Number.isFinite(row.step) ? row.step : 0,
  }
}

export const getWizardState = async (): Promise<WizardState> => {
  const { data } = await api.GET('/configuration/wizard')
  return parseWizardState(data)
}

export const postWizardState = async (legacyStep: number, inProgress: boolean): Promise<void> => {
  await api.POST('/configuration/wizard', {
    body: { step: legacyStep, status: inProgress ? 'true' : 'false' },
  })
}
