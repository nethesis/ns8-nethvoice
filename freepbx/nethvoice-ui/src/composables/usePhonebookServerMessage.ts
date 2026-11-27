//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from 'vue-i18n'
import { getLegacyStatusMessage } from '@/lib/integrations/errors'
import { getPhonebookServerText } from '@/lib/integrations/phonebookSources'

export const usePhonebookServerMessage = () => {
  const { t } = useI18n()

  const translate = (message: string): string => {
    const text = getPhonebookServerText(message)
    return text ? t(text.key, text.params ?? {}) : message
  }

  return {
    translate,
    describeStatus: (error: unknown): string => translate(getLegacyStatusMessage(error)),
  }
}
