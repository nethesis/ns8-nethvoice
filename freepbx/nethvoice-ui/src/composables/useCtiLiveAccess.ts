//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed } from 'vue'
import { canReadCtiLiveData } from '@/lib/dashboard/ctiClient'
import { useLoginStore } from '@/stores/login'

export const useCtiLiveAccess = () => {
  const loginStore = useLoginStore()

  return computed(() => canReadCtiLiveData(loginStore.username))
}
