<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeButton, NeTooltip } from '@nethesis/vue-components'
import { isDeviceCallable, type OverviewDevice } from '@/lib/overview/overview'
import { useAdminPhoneStore } from '@/stores/adminPhone'

const { device } = defineProps<{ device: OverviewDevice }>()

const { t } = useI18n()
const adminPhoneStore = useAdminPhoneStore()

const isCallable = computed(() => isDeviceCallable(device, adminPhoneStore.isCallBlocked))

function call() {
  void adminPhoneStore.call(device.extension)
}
</script>

<template>
  <span
    v-if="!isCallable"
    class="text-secondary-neutral inline-block px-2 py-1 text-sm font-medium"
    data-testid="call-number-text"
  >
    {{ device.extension }}
  </span>
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
