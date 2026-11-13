//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

export const useSetupStore = defineStore('setup', () => {
  const country = useStorage('nethvoiceSetupCountry', '')

  const reset = () => {
    country.value = ''
  }

  return { country, reset }
})
