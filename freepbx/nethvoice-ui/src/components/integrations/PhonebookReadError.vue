<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NeInlineNotification } from '@nethesis/vue-components'

const {
  title,
  description,
  details = '',
} = defineProps<{
  title: string
  description: string
  details?: string
}>()

const { t } = useI18n()
</script>

<template>
  <NeInlineNotification
    kind="error"
    :title="title"
    :description="description"
    :show-details-label="t('common.show_details')"
  >
    <template v-if="details" #details>
      <pre class="font-mono text-xs wrap-anywhere whitespace-pre-wrap">{{ details }}</pre>
    </template>
  </NeInlineNotification>
</template>
