<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeButton, NeTooltip } from '@nethesis/vue-components'
import type { OverviewDevice } from '@/lib/overview/overview'
import { useAdminPhoneStore } from '@/stores/adminPhone'

const { device } = defineProps<{ device: OverviewDevice }>()

const { t } = useI18n()
const adminPhoneStore = useAdminPhoneStore()

const isCallable = computed(() => device.status === 'online' && !adminPhoneStore.isCallBlocked)

const unavailableLabel = computed(() =>
  device.status === 'online'
    ? t('user_overview.call_extension_blocked', { extension: device.extension })
    : t('user_overview.call_extension_unavailable', {
        extension: device.extension,
        status: t(`user_overview.status.${device.status}`).toLowerCase(),
      }),
)

function call() {
  void adminPhoneStore.call(device.extension)
}
</script>

<template>
  <NeButton
    v-if="!isCallable"
    kind="tertiary"
    size="sm"
    disabled
    :aria-label="unavailableLabel"
    data-testid="call-number"
  >
    {{ device.extension }}
  </NeButton>
  <NeTooltip v-else trigger-event="mouseenter focus" placement="top">
    <template #trigger>
      <NeButton
        kind="tertiary"
        size="sm"
        :aria-label="t('user_overview.call_extension', { extension: device.extension })"
        data-testid="call-number"
        @click="call"
      >
        {{ device.extension }}
      </NeButton>
    </template>
    <template #content>{{ t('user_overview.call') }}</template>
  </NeTooltip>
</template>
