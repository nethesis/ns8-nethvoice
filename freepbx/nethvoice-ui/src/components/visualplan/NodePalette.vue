<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMediaQuery } from '@vueuse/core'
import { NeEmptyState, NeTabs, NeTextInput } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faDiagramProject, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { faSidebarLeft } from '@nethesis/nethesis-solid-svg-icons'
import IconButton from '@/components/visualplan/IconButton.vue'
import { matchesText } from '@/lib/common'
import { vKeyboardTabs } from '@/lib/keyboardTabs'
import type { FlowNode, NodeType } from '@/lib/visualplan/model'
import { useVisualPlanStore } from '@/stores/visualPlan'
import { useVisualPlanLabels } from '@/composables/useVisualPlanLabels'
import {
  NODE_META,
  PALETTE_GROUPS,
  PALETTE_MIME,
  type PaletteItem,
} from '@/components/visualplan/nodeMeta'

const { collapsible = false } = defineProps<{ collapsible?: boolean }>()

const emit = defineEmits<{ add: [item: PaletteItem]; focus: [id: string]; collapse: [] }>()

const { t } = useI18n()
const isTouch = useMediaQuery('(pointer: coarse)')
const store = useVisualPlanStore()
const { typeLabel, nodeTitle, nodeSubtitle } = useVisualPlanLabels()

const tab = ref<'new' | 'existing'>('new')
const filter = ref('')

const tabs = computed(() => [
  { name: 'new', label: t('visual_plan.palette.new') },
  { name: 'existing', label: t('visual_plan.palette.existing') },
])

// The items on the canvas, to find them again.
const inFlow = computed(() => store.nodes.filter((node) => node.id !== store.flow.rootId))

const existing = computed(() =>
  inFlow.value.filter((node) =>
    matchesText(filter.value, nodeTitle(node), nodeSubtitle(node), typeLabel(node.type)),
  ),
)

const existingGroups = computed(() =>
  (Object.keys(NODE_META) as NodeType[])
    .map((type) => ({
      type,
      items: existing.value
        .filter((node: FlowNode) => node.type === type)
        .sort((a, b) => nodeTitle(a).localeCompare(nodeTitle(b))),
    }))
    .filter((group) => group.items.length),
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
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex items-center gap-2 px-4 pt-3 sm:px-6 lg:px-8">
      <NeTabs
        v-keyboard-tabs
        :tabs="tabs"
        :selected="tab"
        :sr-tabs-label="t('visual_plan.palette.title')"
        :sr-select-tab-label="t('ne_tabs.select_a_tab')"
        class="min-w-0 flex-1"
        @select-tab="selectTab"
      />
      <IconButton
        v-if="collapsible"
        :icon="faSidebarLeft"
        :label="t('visual_plan.palette.hide')"
        placement="right"
        tool
        @click="emit('collapse')"
      />
    </div>
    <div
      class="scrollbar-thin-neutral min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-6 sm:px-6 lg:px-8"
    >
      <template v-if="tab === 'new'">
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {{ isTouch ? t('visual_plan.palette.tap_helper') : t('visual_plan.palette.new_helper') }}
        </p>
        <section
          v-for="group in PALETTE_GROUPS"
          :key="group.labelKey"
          :aria-labelledby="`palette-${group.labelKey}`"
          class="mb-5"
        >
          <h3
            :id="`palette-${group.labelKey}`"
            class="mb-1 text-xs font-medium tracking-wide text-gray-600 uppercase dark:text-gray-400"
          >
            {{ t(group.labelKey) }}
          </h3>
          <ul class="-mx-2">
            <li v-for="type in group.types" :key="type">
              <button
                type="button"
                draggable="true"
                class="focus:ring-primary-500 dark:focus:ring-primary-200 flex w-full cursor-grab items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 focus:ring-2 focus:outline-hidden active:cursor-grabbing dark:text-gray-200 dark:hover:bg-gray-800"
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
        </section>
      </template>
      <template v-else>
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {{ t('visual_plan.palette.existing_helper') }}
        </p>
        <NeTextInput
          v-if="inFlow.length"
          v-model="filter"
          is-search
          :placeholder="t('visual_plan.palette.search_existing')"
          :aria-label="t('visual_plan.palette.search_existing')"
          :clear-search-label="t('ne_text_input.clear_search')"
          class="mb-4"
        />
        <NeEmptyState
          v-if="!inFlow.length"
          :title="t('visual_plan.palette.no_items_in_flow')"
          :description="t('visual_plan.palette.no_items_in_flow_description')"
          :icon="faDiagramProject"
          class="text-center"
        />
        <NeEmptyState
          v-else-if="!existingGroups.length"
          :title="t('visual_plan.palette.no_existing')"
          :description="t('visual_plan.palette.no_existing_description')"
          :icon="faMagnifyingGlass"
          class="text-center"
        />
        <section
          v-for="group in existingGroups"
          :key="group.type"
          :aria-labelledby="`existing-${group.type}`"
          class="mb-5"
        >
          <h3
            :id="`existing-${group.type}`"
            class="mb-1 text-xs font-medium tracking-wide text-gray-600 uppercase dark:text-gray-400"
          >
            {{ typeLabel(group.type) }}
          </h3>
          <ul class="-mx-2">
            <li v-for="node in group.items" :key="node.id">
              <button
                type="button"
                class="focus:ring-primary-500 dark:focus:ring-primary-200 flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 focus:ring-2 focus:outline-hidden dark:text-gray-200 dark:hover:bg-gray-800"
                @click="emit('focus', node.id)"
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
                <span class="min-w-0 flex-1 truncate">
                  {{ nodeTitle(node) || t('visual_plan.untitled') }}
                </span>
              </button>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>
