//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { defineQuery, useQuery } from '@pinia/colada'
import { getVideoSources, VIDEO_SOURCES_KEY } from '@/lib/integrations/videoSources'
import { useLoginStore } from '@/stores/login'

export const useVideoSources = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [VIDEO_SOURCES_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getVideoSources(),
  })

  return { state, asyncStatus, ...rest }
})
