<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeTooltip } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faPhone, faPhoneSlash } from '@fortawesome/free-solid-svg-icons'
import { useAdminPhoneStore } from '@/stores/adminPhone'

const { buttonClasses } = defineProps<{ buttonClasses: string }>()

const { t } = useI18n()
const adminPhoneStore = useAdminPhoneStore()

const buttonLabel = computed(() =>
  adminPhoneStore.isEnabled ? t('admin_phone.disable_phone') : t('admin_phone.enable_phone'),
)

const statusText = computed(() => {
  const extension = adminPhoneStore.extension

  switch (adminPhoneStore.state) {
    case 'starting':
      return t('admin_phone.status_starting')
    case 'registering':
      return t('admin_phone.status_registering')
    case 'ready':
      return adminPhoneStore.inCall
        ? t('admin_phone.status_in_call', { extension })
        : t('admin_phone.status_ready', { extension })
    case 'error':
      return adminPhoneStore.isEnabled
        ? t('admin_phone.status_connection_lost')
        : t('admin_phone.status_error', { error: adminPhoneStore.errorMessage })
    default:
      return t('admin_phone.status_inactive')
  }
})

const dotClasses = computed(() => {
  switch (adminPhoneStore.state) {
    case 'starting':
    case 'registering':
      return 'animate-pulse bg-amber-500'
    case 'ready':
      return adminPhoneStore.inCall ? 'bg-rose-500' : 'bg-green-500'
    case 'error':
      return 'bg-rose-500'
    default:
      return ''
  }
})
</script>

<template>
  <NeTooltip trigger-event="mouseenter focus" placement="bottom" class="flex">
    <template #trigger>
      <button
        type="button"
        :class="[buttonClasses, 'relative']"
        :data-state="adminPhoneStore.state"
        data-testid="admin-phone-toggle"
        @click="adminPhoneStore.toggle()"
      >
        <span class="sr-only">{{ buttonLabel }}</span>
        <FontAwesomeIcon
          :icon="adminPhoneStore.isEnabled ? faPhone : faPhoneSlash"
          class="h-6 w-6 shrink-0"
          aria-hidden="true"
        />
        <span
          v-if="dotClasses"
          :class="[
            'absolute top-1.5 right-1.5 size-2.5 rounded-full ring-2 ring-white dark:ring-gray-950',
            dotClasses,
          ]"
          aria-hidden="true"
        />
      </button>
    </template>
    <template #content>
      {{ statusText }}
    </template>
  </NeTooltip>
  <span class="sr-only" aria-live="polite" data-testid="admin-phone-status">{{ statusText }}</span>
</template>
