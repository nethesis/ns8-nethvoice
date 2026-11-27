<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeButton,
  NeEmptyState,
  NeHeading,
  NeInlineNotification,
  NeTooltip,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCrosshairs, faDiagramProject, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { routesReaching } from '@/lib/visualplan/graph'
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
const { typeLabel, nodeTitle, issueText, routeName } = useVisualPlanLabels()

const node = computed(() => store.selectedNode)
const meta = computed(() => (node.value ? NODE_META[node.value.type] : null))
const isRoot = computed(() => node.value?.id === store.flow.rootId)
const generalIssues = computed(() =>
  (node.value ? (store.issues[node.value.id] ?? []) : []).filter((issue) => {
    if (issue.output) return issue.level === 'warning'
    return !issue.field || (!issue.field.startsWith('entry:') && !FORM_FIELDS.has(issue.field))
  }),
)

// Errors that no field of the panel shows; warnings are on the card and in the bottom bar.
const otherErrors = computed(() => {
  const current = node.value
  if (!current) return []
  return generalIssues.value
    .filter((issue) => issue.level === 'error')
    .map((issue) => issueText(current, issue))
})

// An existing item changes for every inbound route that uses it.
const sharedWith = computed(() => {
  const current = node.value
  if (!current || current.isNew || isRoot.value || !store.data) return []
  return routesReaching(
    store.catalog,
    store.data.inboundRoutes,
    current.id,
    store.originalRouteKey,
  ).map((route) => routeName(route))
})

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
</script>

<template>
  <div class="flex h-full flex-col">
    <template v-if="node && meta">
      <div :class="inDrawer ? 'pb-4' : 'px-6 pt-6'">
        <div class="flex items-center gap-3">
          <span :class="['flex size-9 shrink-0 items-center justify-center rounded-md', meta.tone]">
            <FontAwesomeIcon :icon="meta.icon" class="size-4" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs text-gray-600 dark:text-gray-400">
              {{ typeLabel(node.type) }}
            </p>
            <NeHeading tag="h2" class="truncate text-base!">
              {{ nodeTitle(node) || t('visual_plan.untitled') }}
            </NeHeading>
          </div>
          <NeTooltip v-if="!inDrawer" trigger-event="mouseenter focus" placement="bottom">
            <template #trigger>
              <NeButton
                kind="tertiary"
                class="text-gray-900! dark:text-gray-50!"
                @click="store.selectedId = null"
              >
                <FontAwesomeIcon :icon="faXmark" class="size-4" aria-hidden="true" />
                <span class="sr-only">{{ t('visual_plan.close_inspector') }}</span>
              </NeButton>
            </template>
            <template #content>{{ t('visual_plan.close_inspector') }}</template>
          </NeTooltip>
        </div>
        <div class="mt-4 -ml-2.5 flex flex-wrap items-center gap-1">
          <NeButton kind="tertiary" size="sm" @click="emit('center', node.id)">
            <template #prefix>
              <FontAwesomeIcon :icon="faCrosshairs" class="size-4" aria-hidden="true" />
            </template>
            {{ t('visual_plan.show_on_canvas') }}
          </NeButton>
          <NeButton
            v-if="!isRoot && !store.readOnly"
            kind="tertiary"
            size="sm"
            @click="store.removeNode(node.id)"
          >
            <template #prefix>
              <FontAwesomeIcon :icon="faTrash" class="size-4" aria-hidden="true" />
            </template>
            {{ t('visual_plan.remove_from_flow') }}
          </NeButton>
        </div>
        <hr class="mt-4 border-gray-200 dark:border-gray-700" />
      </div>
      <div
        ref="form"
        data-visual-plan-form
        :class="[
          'scrollbar-thin-neutral min-h-0 flex-1 space-y-6 overflow-y-auto',
          inDrawer ? 'pt-6' : 'px-6 py-6',
        ]"
      >
        <NeInlineNotification
          v-if="store.readOnly && !inDrawer"
          kind="info"
          :title="t('visual_plan.read_only_title')"
          :description="t('visual_plan.read_only_description')"
        />
        <p v-if="sharedWith.length" class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('visual_plan.shared_with', { routes: sharedWith.join(', ') }, sharedWith.length) }}
        </p>
        <NeInlineNotification
          v-if="otherErrors.length"
          kind="error"
          :title="t('visual_plan.inspector_errors')"
        >
          <template #description>
            <p v-if="otherErrors.length === 1">{{ otherErrors[0] }}</p>
            <ul v-else class="list-disc space-y-1 pl-4">
              <li v-for="(text, index) in otherErrors" :key="index">{{ text }}</li>
            </ul>
          </template>
        </NeInlineNotification>
        <NodeFields :key="node.id" :node="node" />
        <NodeOutputs v-if="hasOutputs || hasEntries" :key="`${node.id}-outputs`" :node="node" />
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
