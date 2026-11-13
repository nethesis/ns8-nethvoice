<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeTooltip } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons'
import SetupSignOutButton from './SetupSignOutButton.vue'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'

const { placement = 'right' } = defineProps<{ placement?: 'right' | 'bottom' }>()

const runtimeConfigStore = useRuntimeConfigStore()
</script>

<template>
  <NeTooltip trigger-event="mouseenter focus" :placement="placement">
    <template #trigger>
      <a
        :href="runtimeConfigStore.config.docsUrl"
        target="_blank"
        rel="noreferrer"
        class="text-primary-700 hover:text-primary-800 dark:text-primary-500 dark:hover:text-primary-300 flex rounded-full p-2"
      >
        <span class="sr-only">{{ $t('common.need_help') }}</span>
        <FontAwesomeIcon :icon="faCircleQuestion" class="h-4 w-4" aria-hidden="true" />
      </a>
    </template>
    <template #content>{{ $t('common.need_help') }}</template>
  </NeTooltip>
  <SetupSignOutButton icon-only :tooltip-placement="placement" />
</template>
