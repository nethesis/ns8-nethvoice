<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeDropdown, type NeDropdownItem } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'

const { items, kind = 'secondary' } = defineProps<{
  items: NeDropdownItem[]
  kind?: 'secondary' | 'tertiary'
}>()
</script>

<template>
  <NeDropdown
    :items="items"
    :align-to-right="true"
    :open-menu-aria-label="$t('common.actions')"
    menu-classes="min-w-56"
  >
    <template #button>
      <span
        aria-hidden="true"
        class="text-primary-700 dark:text-primary-500 inline-flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium"
        :class="
          kind === 'secondary'
            ? 'border-primary-700 dark:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950 border shadow-xs'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        "
      >
        {{ $t('common.actions') }}
        <FontAwesomeIcon :icon="faChevronDown" class="size-3" />
      </span>
    </template>
  </NeDropdown>
</template>
