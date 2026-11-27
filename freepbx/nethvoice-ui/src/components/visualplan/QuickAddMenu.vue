<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { onClickOutside } from '@vueuse/core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { matchesText } from '@/lib/common'
import {
  CREATABLE_TYPES,
  EXISTING_TYPES,
  type FlowNode,
  type NodeType,
} from '@/lib/visualplan/model'
import { useVisualPlanStore } from '@/stores/visualPlan'
import { useVisualPlanLabels } from '@/composables/useVisualPlanLabels'
import { NODE_META } from '@/components/visualplan/nodeMeta'

const props = defineProps<{ x: number; y: number }>()

const emit = defineEmits<{ pick: [type: NodeType]; pickExisting: [id: string]; close: [] }>()

const { t } = useI18n()
const store = useVisualPlanStore()
const { typeLabel, nodeTitle } = useVisualPlanLabels()

const MENU_WIDTH = 288
const MENU_HEIGHT = 420
const MAX_EXISTING = 8

type Option =
  | { kind: 'new'; id: string; type: NodeType; label: string; description: string }
  | { kind: 'existing'; id: string; node: FlowNode; label: string; description: string }

const panel = useTemplateRef<HTMLElement>('panel')
const input = useTemplateRef<HTMLInputElement>('input')
const filter = ref('')
const active = ref(0)

const newOptions = computed<Option[]>(() =>
  CREATABLE_TYPES.filter((type) => matchesText(filter.value, typeLabel(type))).map((type) => ({
    kind: 'new',
    id: `new-${type}`,
    type,
    label: typeLabel(type),
    description: '',
  })),
)

const existingOptions = computed<Option[]>(() => {
  if (!filter.value.trim()) return []
  const result: Option[] = []
  for (const entry of store.catalog.values()) {
    const node = entry.node
    if (!EXISTING_TYPES.includes(node.type) || node.type === 'extension') continue
    const label = nodeTitle(node)
    if (!matchesText(filter.value, label, typeLabel(node.type))) continue
    result.push({
      kind: 'existing',
      id: `existing-${node.id}`,
      node,
      label: label || t('visual_plan.untitled'),
      description: typeLabel(node.type),
    })
    if (result.length >= MAX_EXISTING) break
  }
  return result
})

const options = computed(() => [...newOptions.value, ...existingOptions.value])

const position = computed(() => ({
  left: `${Math.max(8, Math.min(props.x, window.innerWidth - MENU_WIDTH - 8))}px`,
  top: `${Math.max(8, Math.min(props.y, window.innerHeight - MENU_HEIGHT - 8))}px`,
}))

const optionId = (option: Option) => `visual-plan-quick-add-${option.id}`

const typeOf = (option: Option): NodeType =>
  option.kind === 'new' ? option.type : option.node.type

onClickOutside(panel, () => emit('close'))

onMounted(() => nextTick(() => input.value?.focus()))

function choose(option: Option | undefined) {
  if (!option) return
  if (option.kind === 'new') {
    emit('pick', option.type)
  } else {
    emit('pickExisting', option.node.id)
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    active.value = Math.min(active.value + 1, options.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    active.value = Math.max(active.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    choose(options.value[active.value])
  }
}
</script>

<template>
  <div
    ref="panel"
    role="dialog"
    :aria-label="t('visual_plan.quick_add')"
    class="nodrag nowheel fixed z-50 flex w-72 flex-col rounded-md bg-white py-2 text-sm shadow-lg ring-1 ring-gray-200 dark:bg-gray-950 dark:ring-gray-700"
    :style="position"
    @keydown="onKeydown"
  >
    <p class="px-4 pb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
      {{ t('visual_plan.quick_add') }}
    </p>
    <div class="px-4 pb-2">
      <input
        ref="input"
        v-model="filter"
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-autocomplete="list"
        aria-controls="visual-plan-quick-add-list"
        :aria-activedescendant="options[active] ? optionId(options[active]) : undefined"
        :aria-label="t('visual_plan.quick_add_filter')"
        :placeholder="t('visual_plan.quick_add_filter')"
        class="bg-elevation-0 text-primary-neutral placeholder:text-placeholder focus:ring-primary-focus block w-full rounded-md border-0 px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:outline-hidden focus:ring-inset dark:ring-gray-500"
        @input="active = 0"
      />
    </div>
    <p v-if="!options.length" class="text-tertiary-neutral px-4 py-2">
      {{ t('visual_plan.quick_add_no_results') }}
    </p>
    <ul
      v-else
      id="visual-plan-quick-add-list"
      role="listbox"
      :aria-label="t('visual_plan.quick_add')"
      class="scrollbar-thin-neutral max-h-72 overflow-y-auto"
    >
      <li
        v-if="existingOptions.length"
        role="presentation"
        class="text-tertiary-neutral px-4 pt-1 pb-1 text-xs font-medium"
      >
        {{ t('visual_plan.quick_add_new') }}
      </li>
      <template v-for="(option, index) in options" :key="option.id">
        <li
          v-if="option.kind === 'existing' && index === newOptions.length"
          role="presentation"
          class="text-tertiary-neutral px-4 pt-3 pb-1 text-xs font-medium"
        >
          {{ t('visual_plan.quick_add_existing') }}
        </li>
        <li role="presentation">
          <button
            :id="optionId(option)"
            type="button"
            role="option"
            tabindex="-1"
            :aria-selected="index === active"
            :class="[
              'flex w-full items-center gap-3 px-4 py-2 text-left',
              index === active
                ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-50'
                : 'text-gray-700 dark:text-gray-50',
            ]"
            @mouseenter="active = index"
            @click="choose(option)"
          >
            <span
              :class="[
                'flex size-7 shrink-0 items-center justify-center rounded-md',
                NODE_META[typeOf(option)].tone,
              ]"
            >
              <FontAwesomeIcon
                :icon="NODE_META[typeOf(option)].icon"
                class="size-3.5"
                aria-hidden="true"
              />
            </span>
            <span class="min-w-0">
              <span class="block truncate">{{ option.label }}</span>
              <span v-if="option.description" class="text-tertiary-neutral block truncate text-xs">
                {{ option.description }}
              </span>
            </span>
          </button>
        </li>
      </template>
    </ul>
  </div>
</template>
