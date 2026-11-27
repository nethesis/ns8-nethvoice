<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Handle, Position } from '@vue-flow/core'
import { NeTooltip } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faChevronDown,
  faChevronUp,
  faCircleXmark,
  faFlagCheckered,
  faPlay,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { countHidden } from '@/lib/visualplan/collapse'
import { getOutputs } from '@/lib/visualplan/model'
import { useVisualPlanStore } from '@/stores/visualPlan'
import { useVisualPlanLabels } from '@/composables/useVisualPlanLabels'
import { NODE_META } from '@/components/visualplan/nodeMeta'

const props = defineProps<{ id: string; selected: boolean }>()

const { t } = useI18n()
const store = useVisualPlanStore()
const { typeLabel, nodeTitle, outputLabel, issueLine, simulationOutcome } = useVisualPlanLabels()

const node = computed(() => store.flow.nodes[props.id])
const meta = computed(() => (node.value ? NODE_META[node.value.type] : null))
const outputs = computed(() => (node.value ? getOutputs(node.value) : []))
const isRoot = computed(() => props.id === store.flow.rootId)
const issues = computed(() => store.issues[props.id] ?? [])
const errors = computed(() => issues.value.filter((issue) => issue.level === 'error'))
const level = computed(() => {
  if (errors.value.length) return 'error'
  return issues.value.length ? 'warning' : null
})

// Errors point to the properties, warnings say what happens to the calls.
const statusMessages = computed(() => {
  if (errors.value.length) {
    return [t('visual_plan.fields_to_fix', { count: errors.value.length }, errors.value.length)]
  }
  return node.value ? issues.value.map((issue) => issueLine(node.value!, issue)) : []
})

const connected = computed(
  () =>
    new Set(store.flow.edges.filter((edge) => edge.source === props.id).map((edge) => edge.output)),
)
const isHighlighted = computed(() => store.highlightedIds.includes(props.id))
const isCollapsed = computed(() => store.collapsedIds.includes(props.id))
const hiddenCount = computed(() => countHidden(store.hidden, props.id))
const canCollapse = computed(
  () => isCollapsed.value || store.flow.edges.some((edge) => edge.source === props.id),
)

const simulation = computed(() => {
  const steps = store.simulationResult?.steps ?? []
  const index = steps.findIndex((item) => item.nodeId === props.id)
  if (index < 0) return null
  const outcome = index === steps.length - 1 ? simulationOutcome(store.simulationResult) : null
  return { step: index + 1, start: index === 0, outcome }
})
</script>

<template>
  <div
    v-if="node && meta"
    :class="[
      'relative w-64 rounded-lg border bg-white text-sm shadow-sm dark:bg-gray-950',
      simulation
        ? 'border-indigo-500 ring-1 ring-indigo-500 dark:border-indigo-400 dark:ring-indigo-400'
        : selected
          ? 'border-primary-active ring-primary-active ring-1'
          : isHighlighted
            ? 'border-indigo-500 shadow-lg ring-1 ring-indigo-500 dark:border-indigo-400 dark:ring-indigo-400'
            : 'border-gray-300 dark:border-gray-600',
    ]"
  >
    <template v-if="simulation">
      <span
        class="absolute -top-3 -left-3 z-10 flex size-6 items-center justify-center rounded-full bg-indigo-500 text-xs font-medium text-white"
      >
        {{ simulation.step }}
        <span class="sr-only">{{
          t('visual_plan.simulation.step', { step: simulation.step })
        }}</span>
      </span>
      <div
        v-if="simulation.start || simulation.outcome"
        class="absolute -top-9 left-5 flex gap-1.5"
      >
        <span
          v-if="simulation.start"
          class="flex items-center gap-1.5 rounded-md bg-indigo-500 px-2 py-1 text-xs font-medium whitespace-nowrap text-white"
        >
          <FontAwesomeIcon :icon="faPlay" class="size-3" aria-hidden="true" />
          {{ t('visual_plan.simulation.start_badge') }}
        </span>
        <span
          v-if="simulation.outcome"
          class="flex items-center gap-1.5 rounded-md bg-indigo-500 px-2 py-1 text-xs font-medium whitespace-nowrap text-white"
        >
          <FontAwesomeIcon
            :icon="simulation.outcome.kind === 'warning' ? faTriangleExclamation : faFlagCheckered"
            class="size-3"
            aria-hidden="true"
          />
          {{ simulation.outcome.title }}
        </span>
      </div>
    </template>
    <Handle
      v-if="!isRoot"
      id="in"
      type="target"
      :position="Position.Left"
      :connectable="!store.readOnly"
    />
    <div class="flex items-center gap-3 p-3">
      <span :class="['flex size-9 shrink-0 items-center justify-center rounded-md', meta.tone]">
        <FontAwesomeIcon :icon="meta.icon" class="size-4" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs text-gray-600 dark:text-gray-400">
          {{ typeLabel(node.type) }}
        </p>
        <p class="truncate font-medium text-gray-900 dark:text-gray-50" :title="nodeTitle(node)">
          {{ nodeTitle(node) || t('visual_plan.untitled') }}
        </p>
      </div>
      <NeTooltip v-if="level" trigger-event="mouseenter focus" placement="top">
        <template #trigger>
          <button
            type="button"
            class="nodrag focus-visible:ring-primary-focus flex shrink-0 rounded-sm focus:outline-hidden focus-visible:ring-2"
            :aria-label="statusMessages.join(' ')"
          >
            <FontAwesomeIcon
              :icon="level === 'error' ? faCircleXmark : faTriangleExclamation"
              :class="[
                'size-4',
                level === 'error'
                  ? 'text-rose-700 dark:text-rose-500'
                  : 'text-amber-700 dark:text-amber-500',
              ]"
              aria-hidden="true"
            />
          </button>
        </template>
        <template #content>
          <div v-for="message in statusMessages" :key="message">{{ message }}</div>
        </template>
      </NeTooltip>
      <NeTooltip v-if="canCollapse" trigger-event="mouseenter focus" placement="top">
        <template #trigger>
          <button
            type="button"
            class="nodrag focus-visible:ring-primary-focus -mr-1 flex size-6 shrink-0 items-center justify-center rounded-sm text-gray-600 hover:text-gray-900 focus:outline-hidden focus-visible:ring-2 dark:text-gray-400 dark:hover:text-gray-50"
            @click.stop="store.toggleCollapse(id)"
          >
            <FontAwesomeIcon
              :icon="isCollapsed ? faChevronDown : faChevronUp"
              class="size-3.5"
              aria-hidden="true"
            />
            <span class="sr-only">
              {{
                isCollapsed ? t('visual_plan.collapse.expand') : t('visual_plan.collapse.collapse')
              }}
            </span>
          </button>
        </template>
        <template #content>
          {{ isCollapsed ? t('visual_plan.collapse.expand') : t('visual_plan.collapse.collapse') }}
        </template>
      </NeTooltip>
    </div>
    <ul v-if="outputs.length" class="border-t border-gray-200 py-1 dark:border-gray-700">
      <li
        v-for="output in outputs"
        :key="output.id"
        class="relative py-1.5 pr-5 pl-3 text-right text-xs text-gray-600 dark:text-gray-400"
      >
        <span class="block truncate">{{ outputLabel(output) }}</span>
        <Handle
          :id="output.id"
          type="source"
          :position="Position.Right"
          :connectable="!store.readOnly"
          :class="{ connected: connected.has(output.id) }"
        />
      </li>
    </ul>
    <button
      v-if="isCollapsed && hiddenCount"
      type="button"
      class="nodrag focus-visible:ring-primary-focus absolute -bottom-3.5 left-1/2 min-h-6 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-medium whitespace-nowrap text-gray-700 shadow-sm ring-1 ring-gray-300 hover:text-gray-900 focus:outline-hidden focus-visible:ring-2 dark:bg-gray-950 dark:text-gray-200 dark:ring-gray-600 dark:hover:text-gray-50"
      @click.stop="store.toggleCollapse(id)"
    >
      {{ t('visual_plan.collapse.hidden_count', { count: hiddenCount }, hiddenCount) }}
    </button>
  </div>
</template>
