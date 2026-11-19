<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeButton,
  NeDropdown,
  NeEmptyState,
  NeInlineNotification,
  NeTooltip,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCircleMinus,
  faCircleXmark,
  faTriangleExclamation,
  faCrosshairs,
  faDiagramProject,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { getOutputs } from '@/lib/visualplan/model'
import { useVisualPlanStore } from '@/stores/visualPlan'
import { useVisualPlanLabels } from '@/composables/useVisualPlanLabels'
import { FORM_FIELDS, NODE_META } from '@/components/visualplan/nodeMeta'
import NodeFields from '@/components/visualplan/NodeFields.vue'
import NodeOutputs from '@/components/visualplan/NodeOutputs.vue'

const { inDrawer = false } = defineProps<{ inDrawer?: boolean }>()

const emit = defineEmits<{ center: [id: string] }>()

const { t } = useI18n()
const store = useVisualPlanStore()
const { typeLabel, nodeTitle, issueText } = useVisualPlanLabels()

const node = computed(() => store.selectedNode)
const meta = computed(() => (node.value ? NODE_META[node.value.type] : null))
const isRoot = computed(() => node.value?.id === store.flow.rootId)
const generalIssues = computed(() =>
  (node.value ? (store.issues[node.value.id] ?? []) : []).filter((issue) => {
    if (issue.output) return issue.level === 'warning'
    return !issue.field || (!issue.field.startsWith('entry:') && !FORM_FIELDS.has(issue.field))
  }),
)

const form = useTemplateRef<HTMLElement>('form')

function focusFirstInvalid() {
  const container = form.value
  if (!container) return
  const target =
    container.querySelector<HTMLElement>('[aria-invalid="true"]') ??
    container.querySelector<HTMLElement>('.text-rose-700, .dark\\:text-rose-400')
  target?.scrollIntoView({ block: 'center' })
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.focus()
  }
}

watch(
  () => [store.focusRequest, node.value?.id],
  () => nextTick(focusFirstInvalid),
)
const hasOutputs = computed(() => (node.value ? getOutputs(node.value).length > 0 : false))
const hasEntries = computed(() => node.value?.type === 'ivr' || node.value?.type === 'cqr')

const menuItems = computed(() => {
  const current = node.value
  if (!current) return []
  return [
    {
      id: 'center',
      label: t('visual_plan.show_on_canvas'),
      icon: faCrosshairs,
      action: () => emit('center', current.id),
    },
    ...(isRoot.value || store.readOnly
      ? []
      : [
          {
            id: 'remove',
            label: t('visual_plan.remove_from_flow'),
            icon: faCircleMinus,
            danger: true,
            action: () => store.removeNode(current.id),
          },
        ]),
  ]
})
</script>

<template>
  <div class="flex h-full flex-col">
    <template v-if="node && meta">
      <div
        :class="[
          'flex items-start gap-3 border-b border-gray-200 dark:border-gray-700',
          inDrawer ? 'pb-4' : 'p-4',
        ]"
      >
        <div :class="['flex size-10 shrink-0 items-center justify-center rounded-md', meta.tone]">
          <FontAwesomeIcon :icon="meta.icon" class="size-5" aria-hidden="true" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-tertiary-neutral text-xs">{{ typeLabel(node.type) }}</p>
          <h2 class="text-primary-neutral truncate text-base font-medium">
            {{ nodeTitle(node) || t('visual_plan.untitled') }}
          </h2>
        </div>
        <NeDropdown :items="menuItems" align-to-right :open-menu-aria-label="t('common.actions')" />
        <NeTooltip v-if="!inDrawer" trigger-event="mouseenter focus" placement="bottom">
          <template #trigger>
            <NeButton kind="tertiary" class="py-2" @click="store.selectedId = null">
              <FontAwesomeIcon :icon="faXmark" class="h-5 w-5 shrink-0" aria-hidden="true" />
              <span class="sr-only">{{ t('visual_plan.close_inspector') }}</span>
            </NeButton>
          </template>
          <template #content>{{ t('visual_plan.close_inspector') }}</template>
        </NeTooltip>
      </div>
      <div
        ref="form"
        data-visual-plan-form
        :class="[
          'scrollbar-thin-neutral min-h-0 flex-1 space-y-8 overflow-y-auto',
          inDrawer ? 'pt-6' : 'p-4',
        ]"
      >
        <NeInlineNotification
          v-if="store.readOnly && !inDrawer"
          kind="info"
          :title="t('visual_plan.read_only_title')"
          :description="t('visual_plan.read_only_description')"
        />
        <NodeFields :key="node.id" :node="node" />
        <NodeOutputs v-if="hasOutputs || hasEntries" :key="`${node.id}-outputs`" :node="node" />
        <ul
          v-if="generalIssues.length"
          class="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700"
        >
          <li
            v-for="(issue, index) in generalIssues"
            :key="index"
            class="flex items-start gap-2 text-sm"
          >
            <FontAwesomeIcon
              :icon="issue.level === 'error' ? faCircleXmark : faTriangleExclamation"
              :class="[
                'mt-0.5 size-4 shrink-0',
                issue.level === 'error'
                  ? 'text-rose-700 dark:text-rose-500'
                  : 'text-amber-700 dark:text-amber-500',
              ]"
              aria-hidden="true"
            />
            <span class="text-secondary-neutral">
              <span class="sr-only">
                {{
                  issue.level === 'error'
                    ? t('visual_plan.has_errors')
                    : t('visual_plan.has_warnings')
                }}:
              </span>
              {{ issueText(node, issue) }}
            </span>
          </li>
        </ul>
      </div>
    </template>
    <div v-else class="flex h-full items-center justify-center p-6">
      <NeEmptyState
        :title="t('visual_plan.no_node_selected')"
        :description="t('visual_plan.no_node_selected_description')"
        :icon="faDiagramProject"
      />
    </div>
  </div>
</template>
