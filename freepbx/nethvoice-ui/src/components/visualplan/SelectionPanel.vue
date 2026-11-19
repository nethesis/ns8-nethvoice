<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeButton, NeTooltip } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleMinus, faObjectGroup, faSitemap, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useVisualPlanStore } from '@/stores/visualPlan'
import { useVisualPlanLabels } from '@/composables/useVisualPlanLabels'
import { NODE_META } from '@/components/visualplan/nodeMeta'

const { inDrawer = false } = defineProps<{ inDrawer?: boolean }>()

const emit = defineEmits<{ arrange: [] }>()

const { t } = useI18n()
const store = useVisualPlanStore()
const { typeLabel, nodeTitle } = useVisualPlanLabels()

const nodes = computed(() =>
  store.selectedIds.flatMap((id) => {
    const node = store.flow.nodes[id]
    return node ? [node] : []
  }),
)

const removable = computed(() => nodes.value.filter((node) => node.id !== store.flow.rootId))
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      :class="[
        'flex items-start gap-3 border-b border-gray-200 dark:border-gray-700',
        inDrawer ? 'pb-4' : 'p-4',
      ]"
    >
      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-700 dark:text-indigo-50"
      >
        <FontAwesomeIcon :icon="faObjectGroup" class="size-5" aria-hidden="true" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-tertiary-neutral text-xs">{{ t('visual_plan.selection.title') }}</p>
        <h2 class="text-primary-neutral text-base font-medium">
          {{ t('visual_plan.selection.count', { count: nodes.length }, nodes.length) }}
        </h2>
      </div>
      <NeTooltip v-if="!inDrawer" trigger-event="mouseenter focus" placement="bottom">
        <template #trigger>
          <NeButton kind="tertiary" class="py-2" @click="store.selectedIds = []">
            <FontAwesomeIcon :icon="faXmark" class="h-5 w-5 shrink-0" aria-hidden="true" />
            <span class="sr-only">{{ t('visual_plan.selection.clear') }}</span>
          </NeButton>
        </template>
        <template #content>{{ t('visual_plan.selection.clear') }}</template>
      </NeTooltip>
    </div>
    <div
      :class="[
        'scrollbar-thin-neutral min-h-0 flex-1 space-y-6 overflow-y-auto',
        inDrawer ? 'pt-6' : 'p-4',
      ]"
    >
      <div v-if="!store.readOnly" class="flex flex-wrap gap-2">
        <NeButton kind="secondary" size="sm" @click="store.alignSelected('left')">
          {{ t('visual_plan.selection.align_left') }}
        </NeButton>
        <NeButton kind="secondary" size="sm" @click="store.alignSelected('top')">
          {{ t('visual_plan.selection.align_top') }}
        </NeButton>
        <NeButton kind="secondary" size="sm" @click="emit('arrange')">
          <template #prefix>
            <FontAwesomeIcon :icon="faSitemap" aria-hidden="true" />
          </template>
          {{ t('visual_plan.selection.arrange') }}
        </NeButton>
        <NeButton
          kind="secondary"
          size="sm"
          :disabled="!removable.length"
          @click="store.removeNodes(removable.map((node) => node.id))"
        >
          <template #prefix>
            <FontAwesomeIcon :icon="faCircleMinus" aria-hidden="true" />
          </template>
          {{ t('visual_plan.remove_from_flow') }}
        </NeButton>
      </div>
      <h3 class="text-primary-neutral text-sm font-medium">
        {{ t('visual_plan.selection.items') }}
      </h3>
      <ul class="space-y-1">
        <li v-for="node in nodes" :key="node.id">
          <button
            type="button"
            class="focus-visible:ring-primary-focus flex w-full items-center gap-3 rounded-md px-1 py-1.5 text-left hover:bg-gray-100 focus:outline-hidden focus-visible:ring-2 dark:hover:bg-gray-800"
            @click="store.selectedId = node.id"
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
              <span class="text-primary-neutral block truncate text-sm">
                {{ nodeTitle(node) || t('visual_plan.untitled') }}
              </span>
              <span class="text-tertiary-neutral block truncate text-xs">
                {{ typeLabel(node.type) }}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
