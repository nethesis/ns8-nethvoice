<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons'
import { matchesText } from '@/lib/common'
import { useVisualPlanStore } from '@/stores/visualPlan'
import { useVisualPlanLabels } from '@/composables/useVisualPlanLabels'
import { NODE_META } from '@/components/visualplan/nodeMeta'

const emit = defineEmits<{ pick: [id: string] }>()

const { t } = useI18n()
const store = useVisualPlanStore()
const { typeLabel, nodeTitle, nodeSubtitle } = useVisualPlanLabels()

const query = ref('')

const results = computed(() =>
  query.value.trim()
    ? store.nodes.filter((node) =>
        matchesText(query.value, nodeTitle(node), nodeSubtitle(node), typeLabel(node.type)),
      )
    : [],
)

watch(results, (nodes) => {
  store.highlightedIds = nodes.map((node) => node.id)
})

onBeforeUnmount(() => {
  store.highlightedIds = []
})

function pick(id: string | null) {
  if (id) {
    emit('pick', id)
    query.value = ''
  }
}

function onInput(event: Event) {
  if (event.target instanceof HTMLInputElement) {
    query.value = event.target.value
  }
}

function clear() {
  query.value = ''
}
</script>

<template>
  <Combobox as="div" class="relative w-full" nullable @update:model-value="pick">
    <div class="relative">
      <FontAwesomeIcon
        :icon="faMagnifyingGlass"
        class="text-tertiary-neutral pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <ComboboxInput
        :aria-label="t('visual_plan.search_nodes')"
        :placeholder="t('visual_plan.search_nodes')"
        :display-value="() => query"
        class="focus:ring-primary-focus bg-elevation-0 text-primary-neutral placeholder:text-placeholder block w-full rounded-md border-0 py-1.5 pr-9 pl-9 text-sm shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:outline-hidden focus:ring-inset dark:ring-gray-500"
        @change="onInput"
        @keydown.escape="clear"
      />
      <button
        v-if="query"
        type="button"
        class="text-tertiary-neutral hover:text-primary-neutral focus-visible:ring-primary-focus absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 focus:outline-hidden focus-visible:ring-2"
        @click="clear"
      >
        <FontAwesomeIcon :icon="faXmark" class="size-3.5" aria-hidden="true" />
        <span class="sr-only">{{ t('ne_text_input.clear_search') }}</span>
      </button>
    </div>
    <ComboboxOptions
      v-if="query.trim()"
      class="scrollbar-thin-neutral bg-elevation-0 absolute right-0 z-50 mt-2.5 max-h-80 w-full min-w-72 overflow-y-auto rounded-md py-2 text-sm shadow-lg ring-1 ring-gray-900/5 focus:outline-hidden dark:ring-gray-500/50"
    >
      <li class="text-tertiary-neutral px-4 pb-2 text-xs" role="presentation" aria-live="polite">
        {{ t('visual_plan.search_results', { count: results.length }, results.length) }}
      </li>
      <ComboboxOption
        v-for="node in results"
        :key="node.id"
        v-slot="{ active }"
        :value="node.id"
        as="template"
      >
        <li
          :class="[
            'flex cursor-pointer items-center gap-3 px-4 py-2',
            active ? 'bg-gray-100 dark:bg-gray-800' : '',
          ]"
        >
          <span
            :class="[
              'flex size-7 shrink-0 items-center justify-center rounded-md',
              NODE_META[node.type].tone,
            ]"
          >
            <FontAwesomeIcon
              :icon="NODE_META[node.type].icon"
              class="size-3.5"
              aria-hidden="true"
            />
          </span>
          <span class="min-w-0">
            <span class="text-primary-neutral block truncate">
              {{ nodeTitle(node) || t('visual_plan.untitled') }}
            </span>
            <span class="text-tertiary-neutral block truncate text-xs">
              {{ [typeLabel(node.type), nodeSubtitle(node)].filter(Boolean).join(' · ') }}
            </span>
          </span>
        </li>
      </ComboboxOption>
    </ComboboxOptions>
  </Combobox>
</template>
