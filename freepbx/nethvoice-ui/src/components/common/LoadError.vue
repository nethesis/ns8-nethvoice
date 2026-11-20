<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeInlineNotification } from '@nethesis/vue-components'
import { describeError } from '@/stores/notifications'

const {
  error,
  title = '',
  serverDetail = true,
} = defineProps<{
  error: unknown
  title?: string
  serverDetail?: boolean
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <NeInlineNotification
    kind="error"
    :title="title || $t('common.cannot_load_data')"
    :description="describeError(error, { serverDetail })"
    :primary-button-label="$t('common.retry')"
    @primary-click="emit('retry')"
  />
</template>
