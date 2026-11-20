<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeInlineNotification, NeModal } from '@nethesis/vue-components'

const {
  visible = false,
  title = '',
  primaryLabel = '',
  deleting = false,
  confirmationMessage = '',
  errorTitle = '',
  errorDescription = '',
} = defineProps<{
  visible: boolean
  title: string
  primaryLabel: string
  deleting: boolean
  confirmationMessage?: string
  errorTitle?: string
  errorDescription?: string
}>()

const emit = defineEmits<{ close: []; primaryClick: [] }>()

function requestClose() {
  if (!deleting) {
    emit('close')
  }
}
</script>

<template>
  <NeModal
    :visible="visible"
    :title="title"
    kind="warning"
    :primary-label="primaryLabel"
    :cancel-label="$t('common.cancel')"
    primary-button-kind="danger"
    :primary-button-disabled="deleting"
    :primary-button-loading="deleting"
    :close-aria-label="$t('common.close')"
    @close="requestClose"
    @primary-click="emit('primaryClick')"
  >
    <p v-if="confirmationMessage">{{ confirmationMessage }}</p>
    <slot v-else />
    <NeInlineNotification
      v-if="errorTitle"
      kind="error"
      :title="errorTitle"
      :description="errorDescription"
      class="mt-4"
    />
  </NeModal>
</template>
