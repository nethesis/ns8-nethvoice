<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NeEmptyState } from '@nethesis/vue-components'
import { faPlug } from '@fortawesome/free-solid-svg-icons'

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-secondary-neutral max-w-2xl">
      {{ t('integrations.external.description') }}
    </p>
    <NeEmptyState
      :title="t('integrations.external.not_available_here')"
      :description="t('integrations.external.not_available_here_description')"
      :icon="faPlug"
      class="elevation-0"
    >
      <ul class="text-secondary-neutral mx-auto max-w-xl list-inside list-disc text-left text-sm">
        <li>{{ t('integrations.external.call_transcription') }}</li>
        <li>{{ t('integrations.external.voicemail_transcription') }}</li>
        <li>{{ t('integrations.external.call_summary') }}</li>
      </ul>
    </NeEmptyState>
  </div>
</template>
