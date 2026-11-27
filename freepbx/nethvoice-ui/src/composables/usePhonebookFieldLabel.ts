//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from 'vue-i18n'

export const usePhonebookFieldLabel = () => {
  const { t, te } = useI18n()

  return (field: string): string => {
    const key = `integrations.phonebook.fields.${field}`
    return te(key) ? t(key) : field
  }
}
