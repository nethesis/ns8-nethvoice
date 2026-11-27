<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeSpinner } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleCheck, faCircleXmark } from '@fortawesome/free-solid-svg-icons'
import type { VideoSourceStatus } from '@/lib/integrations/videoSources'

const { status } = defineProps<{ status: VideoSourceStatus }>()
</script>

<template>
  <span v-if="status === 'testing'" role="status" class="flex items-center gap-2">
    <NeSpinner size="4" />
    <span>{{ $t('integrations.video.testing_connection') }}</span>
  </span>
  <span v-else class="flex items-center gap-2">
    <FontAwesomeIcon
      :icon="status === 'connected' ? faCircleCheck : faCircleXmark"
      :class="['size-4 shrink-0', status === 'connected' ? 'text-icon-enabled' : 'text-danger']"
      aria-hidden="true"
    />
    <span>
      {{
        status === 'connected'
          ? $t('integrations.video.connected')
          : $t('integrations.video.not_connected')
      }}
    </span>
  </span>
</template>
