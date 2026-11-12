<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NeModal } from '@nethesis/vue-components'

const { visible = false } = defineProps<{ visible: boolean }>()

const emit = defineEmits<{ close: []; discard: [] }>()

const { t } = useI18n()
</script>

<template>
  <NeModal
    :visible="visible"
    :title="t('common.unsaved_changes')"
    kind="warning"
    :primary-label="t('common.discard_changes')"
    primary-button-kind="danger"
    :cancel-label="t('common.keep_editing')"
    :close-aria-label="t('common.close')"
    @close="emit('close')"
    @primary-click="emit('discard')"
  >
    <p>{{ t('common.unsaved_changes_description') }}</p>
  </NeModal>
</template>
