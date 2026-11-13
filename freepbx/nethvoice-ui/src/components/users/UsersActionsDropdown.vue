<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeButton, NeDropdown, type NeDropdownItem } from '@nethesis/vue-components'
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
      <NeButton :kind="kind" tabindex="-1" aria-hidden="true">
        <template #suffix>
          <FontAwesomeIcon :icon="faChevronDown" class="size-4" aria-hidden="true" />
        </template>
        {{ $t('common.actions') }}
      </NeButton>
    </template>
  </NeDropdown>
</template>
