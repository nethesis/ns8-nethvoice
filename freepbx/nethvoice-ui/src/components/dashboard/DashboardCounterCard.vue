<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { NeCard, NeSkeleton } from '@nethesis/vue-components'
import { type IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

const {
  counterId,
  title,
  icon,
  counter = undefined,
  loading = false,
  to = undefined,
} = defineProps<{
  counterId: string
  title: string
  icon: IconDefinition
  counter?: number
  loading?: boolean
  to?: RouteLocationRaw
}>()

const { locale } = useI18n()

const formattedCounter = computed(() =>
  counter === undefined ? '' : new Intl.NumberFormat(locale.value).format(counter),
)

const linkTag = computed(() => (to ? RouterLink : 'span'))
const linkAttrs = computed(() => (to ? { to } : {}))
const titleLinkAttrs = computed(() => (to ? { to, tabindex: -1, 'aria-hidden': 'true' } : {}))
</script>

<template>
  <NeCard :data-testid="`counter-${counterId}`" class="flex flex-col">
    <template #title>
      <div class="flex items-start gap-3">
        <FontAwesomeIcon
          :icon="icon"
          class="text-secondary-neutral size-5 shrink-0"
          aria-hidden="true"
        />
        <component
          :is="linkTag"
          v-bind="titleLinkAttrs"
          :class="['text-secondary-neutral min-w-0', to && 'hover:underline']"
          data-testid="counter-title"
        >
          <span class="text-sm font-normal uppercase">{{ title }}</span>
        </component>
      </div>
    </template>
    <template #topRight>
      <NeSkeleton v-if="loading" :lines="1" size="lg" class="w-14" />
      <span
        v-else-if="counter === undefined"
        class="text-tertiary-neutral text-5xl leading-none font-medium"
      >
        <span aria-hidden="true">-</span>
        <span class="sr-only">{{ $t('dashboard.not_available') }}</span>
      </span>
      <component
        :is="linkTag"
        v-else
        v-bind="linkAttrs"
        :aria-label="to ? `${title}: ${formattedCounter}` : undefined"
        :class="[
          'text-secondary text-5xl leading-none font-medium tabular-nums',
          to &&
            'focus-visible:ring-primary-500 dark:focus-visible:ring-primary-300 rounded-sm focus:outline-hidden focus-visible:ring-2',
        ]"
        data-testid="counter-value"
      >
        {{ formattedCounter }}
      </component>
    </template>
  </NeCard>
</template>
