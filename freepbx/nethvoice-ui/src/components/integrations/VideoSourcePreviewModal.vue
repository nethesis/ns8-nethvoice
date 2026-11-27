<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NeEmptyState, NeModal, NeSkeleton } from '@nethesis/vue-components'
import { faVideoSlash } from '@fortawesome/free-solid-svg-icons'
import { useFocusReturn } from '@/composables/useFocusReturn'
import {
  getFailureKey,
  type VideoSourceCheck,
  type VideoSourceStatus,
} from '@/lib/integrations/videoSources'

const {
  visible = false,
  name,
  status,
  check,
} = defineProps<{
  visible: boolean
  name: string
  status: VideoSourceStatus
  check: VideoSourceCheck | null
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

useFocusReturn(() => visible)
</script>

<template>
  <NeModal
    :visible="visible"
    :title="name"
    size="xxl"
    :primary-label="t('common.close')"
    primary-button-kind="primary"
    :close-aria-label="t('common.close')"
    @close="emit('close')"
    @primary-click="emit('close')"
  >
    <div class="min-w-72">
      <div v-if="status === 'testing'" role="status">
        <span class="sr-only">{{ t('integrations.video.testing_connection') }}</span>
        <NeSkeleton :lines="8" size="lg" />
      </div>
      <img
        v-else-if="check?.success && check.imageUrl"
        :src="check.imageUrl"
        :alt="t('integrations.video.snapshot_alt', { name })"
        class="block aspect-video w-full rounded-md object-contain"
      />
      <NeEmptyState
        v-else
        :title="t('integrations.video.preview_unavailable')"
        :description="
          check && !check.success
            ? t(getFailureKey(check))
            : t('integrations.video.preview_unavailable_description')
        "
        :icon="faVideoSlash"
        class="elevation-0"
      />
    </div>
  </NeModal>
</template>
