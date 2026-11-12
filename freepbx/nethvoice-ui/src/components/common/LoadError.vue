<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeInlineNotification } from '@nethesis/vue-components'
import { describeError } from '@/stores/notifications'

const { error, title = '' } = defineProps<{
  error: unknown
  title?: string
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <NeInlineNotification
    kind="error"
    :title="title || $t('common.cannot_load_data')"
    :description="describeError(error)"
    :primary-button-label="$t('common.retry')"
    @primary-click="emit('retry')"
  />
</template>
