<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { NeTooltip } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faChevronDown,
  faChevronUp,
  faCircleXmark,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { countHidden } from '@/lib/visualplan/collapse'
import { getOutputs } from '@/lib/visualplan/model'
import { useVisualPlanStore } from '@/stores/visualPlan'
import { useVisualPlanLabels } from '@/composables/useVisualPlanLabels'
import { NODE_META } from '@/components/visualplan/nodeMeta'

const props = defineProps<{ id: string; selected: boolean }>()

const store = useVisualPlanStore()
const { typeLabel, nodeTitle, nodeSubtitle, outputLabel } = useVisualPlanLabels()

const node = computed(() => store.flow.nodes[props.id])
const meta = computed(() => (node.value ? NODE_META[node.value.type] : null))
const outputs = computed(() => (node.value ? getOutputs(node.value) : []))
const isRoot = computed(() => props.id === store.flow.rootId)
const issues = computed(() => store.issues[props.id] ?? [])
const level = computed(() => {
  if (issues.value.some((issue) => issue.level === 'error')) return 'error'
  return issues.value.length ? 'warning' : null
})
const connected = computed(
  () =>
    new Set(store.flow.edges.filter((edge) => edge.source === props.id).map((edge) => edge.output)),
)
const isDirty = computed(() => store.dirtyIds.has(props.id))
const isHighlighted = computed(() => store.highlightedIds.includes(props.id))
const isCollapsed = computed(() => store.collapsedIds.includes(props.id))
const hiddenCount = computed(() => countHidden(store.hidden, props.id))
const canCollapse = computed(
  () => isCollapsed.value || store.flow.edges.some((edge) => edge.source === props.id),
)
const step = computed(() => {
  const index = store.simulationResult?.steps.findIndex((item) => item.nodeId === props.id) ?? -1
  return index < 0 ? null : index + 1
})
</script>

<template>
  <div
    v-if="node && meta"
    :class="[
      'bg-elevation-0 relative w-60 rounded-lg shadow-sm ring-1 transition-shadow duration-(--duration-small)',
      selected || step
        ? 'ring-primary-active ring-2'
        : isHighlighted
          ? 'shadow-lg ring-2 ring-indigo-500 dark:ring-indigo-400'
          : level === 'error'
            ? 'ring-rose-700 dark:ring-rose-500'
            : 'ring-gray-300 hover:shadow-md dark:ring-gray-700',
    ]"
  >
    <span
      v-if="step"
      class="bg-primary-active text-primary-inverted-neutral absolute -top-2.5 -left-2.5 flex size-6 items-center justify-center rounded-full text-xs font-medium shadow"
    >
      {{ step }}
      <span class="sr-only">{{ $t('visual_plan.simulation.step', { step }) }}</span>
    </span>
    <Handle
      v-if="!isRoot"
      id="in"
      type="target"
      :position="Position.Left"
      :connectable="!store.readOnly"
      class="size-3! border-2! border-white! bg-gray-400! dark:border-gray-950! dark:bg-gray-500!"
    />
    <div class="flex items-start gap-3 p-3">
      <div :class="['flex size-9 shrink-0 items-center justify-center rounded-md', meta.tone]">
        <FontAwesomeIcon :icon="meta.icon" class="size-4" aria-hidden="true" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <p class="text-tertiary-neutral truncate text-xs">{{ typeLabel(node.type) }}</p>
          <span
            v-if="isDirty"
            class="shrink-0 rounded-sm bg-indigo-100 px-1 text-xs leading-4 font-medium text-indigo-700 dark:bg-indigo-700 dark:text-indigo-50"
          >
            {{ $t('visual_plan.unsaved_node') }}
          </span>
        </div>
        <p class="text-primary-neutral truncate text-sm font-medium" :title="nodeTitle(node)">
          {{ nodeTitle(node) || $t('visual_plan.untitled') }}
        </p>
        <p
          v-if="nodeSubtitle(node)"
          class="text-tertiary-neutral truncate text-xs"
          :title="nodeSubtitle(node)"
        >
          {{ nodeSubtitle(node) }}
        </p>
      </div>
      <NeTooltip v-if="canCollapse" trigger-event="mouseenter focus" placement="top">
        <template #trigger>
          <button
            type="button"
            class="nodrag text-tertiary-neutral hover:text-primary-neutral focus-visible:ring-primary-focus -mt-1 -mr-1 flex size-6 shrink-0 items-center justify-center rounded-sm focus:outline-hidden focus-visible:ring-2"
            @click.stop="store.toggleCollapse(id)"
          >
            <FontAwesomeIcon
              :icon="isCollapsed ? faChevronDown : faChevronUp"
              class="size-3.5"
              aria-hidden="true"
            />
            <span class="sr-only">
              {{
                isCollapsed
                  ? $t('visual_plan.collapse.expand')
                  : $t('visual_plan.collapse.collapse')
              }}
            </span>
          </button>
        </template>
        <template #content>
          {{
            isCollapsed ? $t('visual_plan.collapse.expand') : $t('visual_plan.collapse.collapse')
          }}
        </template>
      </NeTooltip>
      <FontAwesomeIcon
        v-if="level"
        :icon="level === 'error' ? faCircleXmark : faTriangleExclamation"
        :class="[
          'mt-0.5 size-4 shrink-0',
          level === 'error'
            ? 'text-rose-700 dark:text-rose-500'
            : 'text-amber-700 dark:text-amber-500',
        ]"
        aria-hidden="true"
      />
    </div>
    <span v-if="level" class="sr-only">
      {{ level === 'error' ? $t('visual_plan.has_errors') : $t('visual_plan.has_warnings') }}
    </span>
    <ul v-if="outputs.length" class="border-t border-gray-200 dark:border-gray-700">
      <li
        v-for="output in outputs"
        :key="output.id"
        class="relative flex h-8 items-center justify-end px-4 text-xs"
      >
        <span
          :class="[
            'truncate',
            connected.has(output.id) ? 'text-secondary-neutral' : 'text-tertiary-neutral italic',
          ]"
        >
          {{ outputLabel(output) }}
        </span>
        <Handle
          :id="output.id"
          type="source"
          :position="Position.Right"
          :connectable="!store.readOnly"
          :class="[
            'size-3! border-2! border-white! dark:border-gray-950!',
            connected.has(output.id)
              ? 'bg-primary-active!'
              : 'bg-white! ring-1! ring-gray-400! dark:bg-gray-950! dark:ring-gray-500!',
          ]"
        />
      </li>
    </ul>
    <button
      v-if="isCollapsed && hiddenCount"
      type="button"
      class="nodrag bg-elevation-2 text-secondary-neutral hover:text-primary-neutral focus-visible:ring-primary-focus absolute -bottom-3.5 left-1/2 min-h-6 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap shadow ring-1 ring-gray-300 focus:outline-hidden focus-visible:ring-2 dark:ring-gray-700"
      @click.stop="store.toggleCollapse(id)"
    >
      {{ $t('visual_plan.collapse.hidden_count', { count: hiddenCount }, hiddenCount) }}
    </button>
  </div>
</template>
