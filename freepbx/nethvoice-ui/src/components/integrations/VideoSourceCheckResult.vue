<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeInlineNotification } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import {
  formatVideoInfo,
  getFailureKey,
  type VideoSourceCheck,
} from '@/lib/integrations/videoSources'

const {
  check,
  name,
  showVerified = false,
  tlsSkipVerify = false,
  tlsRelevant = false,
} = defineProps<{
  check: VideoSourceCheck
  name: string
  showVerified?: boolean
  tlsSkipVerify?: boolean
  tlsRelevant?: boolean
}>()

const { t } = useI18n()
const naturalSize = ref<{ width: number; height: number } | undefined>()

watch(
  () => check.imageUrl,
  () => {
    naturalSize.value = undefined
  },
)

const videoInfo = computed(() => formatVideoInfo(check, naturalSize.value))

const certificateChanged = computed(() => check.warnings.includes('tls_certificate_changed'))

const failureDescription = computed(() => {
  const parts = [t(getFailureKey(check))]

  if (check.reason === 'tls_error' && certificateChanged.value) {
    parts.push(t('integrations.video.certificate_changed_password_not_sent'))
  } else if (check.reason === 'tls_error' && tlsRelevant && !tlsSkipVerify) {
    parts.push(t('integrations.video.tls_error_hint'))
  }
  return parts.join(' ')
})

function readSize(event: Event) {
  const image = event.target

  if (image instanceof HTMLImageElement) {
    naturalSize.value = { width: image.naturalWidth, height: image.naturalHeight }
  }
}
</script>

<template>
  <div v-if="check.success" class="space-y-4">
    <p v-if="showVerified" tabindex="-1" class="flex items-center gap-2 outline-none">
      <FontAwesomeIcon :icon="faCircleCheck" class="text-icon-enabled size-4" aria-hidden="true" />
      {{ t('integrations.video.connection_verified') }}
    </p>
    <img
      v-if="check.imageUrl"
      :src="check.imageUrl"
      :alt="
        name
          ? t('integrations.video.snapshot_alt', { name })
          : t('integrations.video.snapshot_alt_unnamed')
      "
      class="aspect-video w-full rounded-md object-contain"
      @load="readSize"
    />
    <p v-if="videoInfo" class="flex gap-2 text-sm">
      <span class="font-medium">{{ t('integrations.video.video') }}</span>
      <span>{{ videoInfo }}</span>
    </p>
    <NeInlineNotification
      v-if="certificateChanged"
      kind="warning"
      :description="t('integrations.video.certificate_changed_refused')"
    />
    <NeInlineNotification
      v-if="check.warnings.includes('h265')"
      kind="warning"
      :description="t('integrations.video.h265_warning')"
    />
    <NeInlineNotification
      v-else-if="check.warnings.includes('codec_not_supported_by_webrtc')"
      kind="warning"
      :description="t('integrations.video.codec_warning')"
    />
  </div>
  <NeInlineNotification
    v-else
    kind="error"
    :title="t('integrations.video.cannot_connect')"
    :description="failureDescription"
    :show-details-label="t('common.show_details')"
  >
    <template v-if="check.message" #details>
      <pre class="font-mono text-xs wrap-anywhere whitespace-pre-wrap">{{ check.message }}</pre>
    </template>
  </NeInlineNotification>
</template>
