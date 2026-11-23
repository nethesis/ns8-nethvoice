<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NeSpinner } from '@nethesis/vue-components'

const { t } = useI18n()
</script>

<template>
  <div role="status" class="text-tertiary-neutral flex items-center gap-2 text-sm">
    <NeSpinner color="gray" size="4" />
    <span>{{ t('integrations.phonebook.updating') }}</span>
  </div>
</template>
