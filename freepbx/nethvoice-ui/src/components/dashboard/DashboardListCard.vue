<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts" generic="TItem extends { id: string; label: string }">
import { NeCard, NeEmptyState, NeSkeleton } from '@nethesis/vue-components'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'

const {
  title,
  items,
  emptyTitle,
  emptyIcon,
  loading = false,
} = defineProps<{
  title: string
  items: TItem[]
  emptyTitle: string
  emptyIcon: IconDefinition
  loading?: boolean
}>()

defineSlots<{ value(props: { item: TItem }): unknown }>()
</script>

<template>
  <NeCard>
    <template #title>
      <span class="text-secondary-neutral text-sm font-normal">{{ title }}</span>
    </template>
    <NeSkeleton v-if="loading" :lines="6" class="w-full" />
    <NeEmptyState v-else-if="items.length === 0" :title="emptyTitle" :icon="emptyIcon" />
    <dl v-else class="max-h-96 overflow-y-auto">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-gray-200 py-3 last:border-b-0 dark:border-gray-700"
        data-testid="list-row"
      >
        <dt class="text-primary-neutral font-medium wrap-anywhere">
          {{ item.label || '-' }}
        </dt>
        <dd class="text-tertiary-neutral ml-auto text-right wrap-anywhere">
          <slot name="value" :item="item" />
        </dd>
      </div>
    </dl>
  </NeCard>
</template>
