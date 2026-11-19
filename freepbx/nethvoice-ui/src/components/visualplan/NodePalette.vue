<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMediaQuery } from '@vueuse/core'
import { NeTabs, NeTextInput } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { matchesText } from '@/lib/common'
import { vKeyboardTabs } from '@/lib/keyboardTabs'
import { EXISTING_TYPES, type FlowNode } from '@/lib/visualplan/model'
import { useVisualPlanStore } from '@/stores/visualPlan'
import { useVisualPlanLabels } from '@/composables/useVisualPlanLabels'
import {
  NODE_META,
  PALETTE_GROUPS,
  PALETTE_MIME,
  type PaletteItem,
} from '@/components/visualplan/nodeMeta'

const emit = defineEmits<{ add: [item: PaletteItem] }>()

const { t } = useI18n()
const isTouch = useMediaQuery('(pointer: coarse)')
const store = useVisualPlanStore()
const { typeLabel, nodeTitle, nodeSubtitle } = useVisualPlanLabels()

const MAX_EXISTING = 60

const tab = ref<'new' | 'existing'>('new')
const filter = ref('')

const tabs = computed(() => [
  { name: 'new', label: t('visual_plan.palette.new') },
  { name: 'existing', label: t('visual_plan.palette.existing') },
])

const existing = computed(() => {
  const items: FlowNode[] = []
  for (const entry of store.catalog.values()) {
    const node = entry.node
    if (
      EXISTING_TYPES.includes(node.type) &&
      matchesText(filter.value, nodeTitle(node), nodeSubtitle(node), typeLabel(node.type))
    ) {
      items.push(node)
    }
  }
  return items
})

const existingGroups = computed(() =>
  EXISTING_TYPES.map((type) => ({
    type,
    items: existing.value.filter((node) => node.type === type).slice(0, MAX_EXISTING),
  })).filter((group) => group.items.length),
)

function onDragStart(event: DragEvent, item: PaletteItem) {
  event.dataTransfer?.setData(PALETTE_MIME, JSON.stringify(item))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
  }
}

function selectTab(name: string) {
  tab.value = name === 'existing' ? 'existing' : 'new'
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="px-4 pt-3">
      <NeTabs
        v-keyboard-tabs
        :tabs="tabs"
        :selected="tab"
        :sr-tabs-label="t('ne_tabs.tabs')"
        :sr-select-tab-label="t('ne_tabs.select_a_tab')"
        @select-tab="selectTab"
      />
    </div>
    <div class="scrollbar-thin-neutral min-h-0 flex-1 overflow-y-auto px-3 py-4">
      <template v-if="tab === 'new'">
        <p class="text-tertiary-neutral mb-4 px-1 text-xs">
          {{ isTouch ? t('visual_plan.palette.tap_helper') : t('visual_plan.palette.new_helper') }}
        </p>
        <div v-for="group in PALETTE_GROUPS" :key="group.labelKey" class="mb-5">
          <p class="text-tertiary-neutral mb-1 px-1 text-xs font-medium tracking-wide uppercase">
            {{ t(group.labelKey) }}
          </p>
          <ul>
            <li v-for="type in group.types" :key="type">
              <button
                type="button"
                draggable="true"
                class="text-secondary-neutral focus-visible:ring-primary-focus flex w-full cursor-grab items-center gap-3 rounded-md px-1 py-1.5 text-left text-sm hover:bg-gray-100 focus:outline-none focus-visible:ring-2 active:cursor-grabbing dark:hover:bg-gray-800"
                @dragstart="onDragStart($event, { kind: 'new', type })"
                @click="emit('add', { kind: 'new', type })"
              >
                <span
                  :class="[
                    'flex size-7 shrink-0 items-center justify-center rounded-md',
                    NODE_META[type].tone,
                  ]"
                >
                  <FontAwesomeIcon
                    :icon="NODE_META[type].icon"
                    class="size-3.5"
                    aria-hidden="true"
                  />
                </span>
                <span class="truncate">{{ typeLabel(type) }}</span>
              </button>
            </li>
          </ul>
        </div>
      </template>
      <template v-else>
        <NeTextInput
          v-model="filter"
          is-search
          :placeholder="t('visual_plan.palette.search_existing')"
          :aria-label="t('visual_plan.palette.search_existing')"
          :clear-search-label="t('ne_text_input.clear_search')"
          class="mb-4"
        />
        <p v-if="!existingGroups.length" class="text-tertiary-neutral px-1 text-sm">
          {{ t('visual_plan.palette.no_existing') }}
        </p>
        <div v-for="group in existingGroups" :key="group.type" class="mb-5">
          <p class="text-tertiary-neutral mb-1 px-1 text-xs font-medium tracking-wide uppercase">
            {{ typeLabel(group.type) }}
          </p>
          <ul>
            <li v-for="node in group.items" :key="node.id">
              <button
                type="button"
                draggable="true"
                class="focus-visible:ring-primary-focus flex w-full cursor-grab items-center gap-3 rounded-md px-1 py-1.5 text-left hover:bg-gray-100 focus:outline-none focus-visible:ring-2 active:cursor-grabbing dark:hover:bg-gray-800"
                @dragstart="onDragStart($event, { kind: 'existing', id: node.id })"
                @click="emit('add', { kind: 'existing', id: node.id })"
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
                  <span class="text-secondary-neutral block truncate text-sm">
                    {{ nodeTitle(node) || t('visual_plan.untitled') }}
                  </span>
                  <span
                    v-if="store.flow.nodes[node.id]"
                    class="text-tertiary-neutral block truncate text-xs"
                  >
                    {{ t('visual_plan.palette.already_in_flow') }}
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>
