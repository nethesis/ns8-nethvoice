//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { ModelVariables, ModelVariablesPatch } from './models'

const UNCHECKED_VARIABLE_PREFIXES = ['account_password_']

export class PhoneSettingsNotSavedError extends Error {
  constructor() {
    super('The phone provisioning service did not save the changes')
    this.name = 'PhoneSettingsNotSavedError'
  }
}

const isChecked = (name: string) =>
  !UNCHECKED_VARIABLE_PREFIXES.some((prefix) => name.startsWith(prefix))

export const getUnsavedVariables = (sent: ModelVariablesPatch, saved: ModelVariables): string[] =>
  Object.entries(sent)
    .filter(([name, value]) =>
      isChecked(name)
        ? value === null
          ? (saved[name] ?? '') !== ''
          : saved[name] !== value
        : false,
    )
    .map(([name]) => name)

export const assertVariablesSaved = (sent: ModelVariablesPatch, saved: ModelVariables): void => {
  if (getUnsavedVariables(sent, saved).length > 0) {
    throw new PhoneSettingsNotSavedError()
  }
}
