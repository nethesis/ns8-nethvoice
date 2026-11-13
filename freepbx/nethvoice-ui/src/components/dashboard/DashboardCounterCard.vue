<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeCard, NeSkeleton } from '@nethesis/vue-components'
import { type IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

const {
  counterId,
  title,
  icon,
  counter = undefined,
  loading = false,
} = defineProps<{
  counterId: string
  title: string
  icon: IconDefinition
  counter?: number
  loading?: boolean
}>()

const { locale } = useI18n()

const formattedCounter = computed(() =>
  counter === undefined ? '' : new Intl.NumberFormat(locale.value).format(counter),
)
</script>

<template>
  <NeCard :data-testid="`counter-${counterId}`">
    <template #title>
      <span class="flex items-center gap-4">
        <FontAwesomeIcon
          :icon="icon"
          class="text-secondary-neutral size-5 shrink-0"
          aria-hidden="true"
        />
        <span class="text-secondary-neutral text-sm font-normal uppercase">{{ title }}</span>
      </span>
    </template>
    <div class="flex h-12 items-center justify-center">
      <NeSkeleton v-if="loading" :lines="1" size="lg" class="w-14" />
      <span
        v-else-if="counter === undefined"
        class="text-tertiary-neutral text-5xl leading-none font-medium"
      >
        <span aria-hidden="true">-</span>
        <span class="sr-only">{{ $t('dashboard.not_available') }}</span>
      </span>
      <span
        v-else
        class="text-5xl leading-none font-medium text-indigo-700 tabular-nums dark:text-indigo-500"
        data-testid="counter-value"
      >
        {{ formattedCounter }}
      </span>
    </div>
  </NeCard>
</template>
