<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeButton,
  NeInlineNotification,
  NeTextInput,
  NeToggle,
  NeTooltip,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faPhoneVolume, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { MenuChoice, SimulationStep } from '@/lib/visualplan/simulation'
import { getOutputs, type FlowNode } from '@/lib/visualplan/model'
import { useVisualPlanStore } from '@/stores/visualPlan'
import { useVisualPlanLabels } from '@/composables/useVisualPlanLabels'
import { NODE_META } from '@/components/visualplan/nodeMeta'
import SelectField from '@/components/visualplan/SelectField.vue'

const { inDrawer = false } = defineProps<{ inDrawer?: boolean }>()

const emit = defineEmits<{ center: [id: string]; close: [] }>()

const { t } = useI18n()
const store = useVisualPlanStore()
const { typeLabel, nodeTitle, outputLabel } = useVisualPlanLabels()

const pad = (value: number) => String(value).padStart(2, '0')

const dateValue = computed(() => {
  const date = store.simulation?.date
  if (!date) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
})

const dateError = ref('')

function setDate(value: string) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) {
    dateError.value = t('visual_plan.simulation.invalid_date')
    return
  }
  dateError.value = ''
  if (store.simulation) {
    store.simulation = { ...store.simulation, date }
  }
}

const stepsList = useTemplateRef<HTMLElement>('stepsList')

watch(
  () => store.simulationFocus,
  (id) => {
    if (!id) return
    nextTick(() => {
      stepsList.value
        ?.querySelector<HTMLElement>(`[data-step-node="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: 'center' })
      store.simulationFocus = null
    })
  },
)

const steps = computed(() =>
  (store.simulationResult?.steps ?? []).flatMap((step) => {
    const node = store.flow.nodes[step.nodeId]
    return node ? [{ step, node }] : []
  }),
)

const end = computed(() => store.simulationResult?.end ?? null)
const lastNode = computed(() => steps.value.at(-1)?.node ?? null)

const endKind = computed(() =>
  end.value === 'menu_repeats'
    ? 'info'
    : end.value === 'answered' || end.value === 'ended'
      ? 'success'
      : 'warning',
)

const choiceValue = (node: FlowNode): string => {
  const choice = store.simulation?.menuChoices[node.id]
  if (!choice) return node.type === 'cqr' ? 'default' : 'timeout'
  return choice.kind === 'entry' ? `entry:${choice.entryId}` : choice.kind
}

const choiceOptions = (node: FlowNode) => {
  if (node.type !== 'ivr' && node.type !== 'cqr') return []
  const entries = node.data.entries.map((entry) => ({
    id: `entry:${entry.id}`,
    label:
      node.type === 'ivr'
        ? t('visual_plan.outputs.ivr_entry', { value: entry.value })
        : t('visual_plan.outputs.cqr_entry', { value: entry.value }),
  }))
  return node.type === 'ivr'
    ? [
        ...entries,
        { id: 'timeout', label: t('visual_plan.simulation.no_digit') },
        { id: 'invalid', label: t('visual_plan.simulation.wrong_digit') },
      ]
    : [...entries, { id: 'default', label: t('visual_plan.simulation.no_condition_matches') }]
}

function setChoice(node: FlowNode, value: string) {
  if (!store.simulation) return
  let choice: MenuChoice
  if (value.startsWith('entry:')) {
    choice = { kind: 'entry', entryId: value.slice('entry:'.length) }
  } else {
    choice = value === 'invalid' ? { kind: 'invalid' } : { kind: 'timeout' }
  }
  store.simulation = {
    ...store.simulation,
    menuChoices: { ...store.simulation.menuChoices, [node.id]: choice },
  }
}

function setCallFlow(node: FlowNode, value: string) {
  if (!store.simulation) return
  store.simulation = {
    ...store.simulation,
    callFlowStates: {
      ...store.simulation.callFlowStates,
      [node.id]: value === 'NIGHT' ? 'NIGHT' : 'DAY',
    },
  }
}

function setAnswered(node: FlowNode, value: boolean) {
  if (!store.simulation) return
  store.simulation = {
    ...store.simulation,
    answered: { ...store.simulation.answered, [node.id]: value },
  }
}

const callFlowValue = (node: FlowNode): string =>
  store.simulation?.callFlowStates[node.id] ??
  (node.type === 'callFlowControl' ? node.data.state : 'DAY')

const outputText = (step: SimulationStep, node: FlowNode): string => {
  const output = getOutputs(node).find((item) => item.id === step.output)
  return output ? t('visual_plan.simulation.goes_through', { output: outputLabel(output) }) : ''
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      v-if="!inDrawer"
      :class="[
        'flex items-start gap-3 border-b border-gray-200 dark:border-gray-700',
        inDrawer ? 'pb-4' : 'p-4',
      ]"
    >
      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-700 dark:text-emerald-50"
      >
        <FontAwesomeIcon :icon="faPhoneVolume" class="size-5" aria-hidden="true" />
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="text-primary-neutral text-base font-medium">
          {{ t('visual_plan.simulation.title') }}
        </h2>
        <p class="text-tertiary-neutral text-xs">{{ t('visual_plan.simulation.description') }}</p>
      </div>
      <NeTooltip trigger-event="mouseenter focus" placement="bottom">
        <template #trigger>
          <NeButton kind="tertiary" class="py-2" @click="emit('close')">
            <FontAwesomeIcon :icon="faXmark" class="h-5 w-5 shrink-0" aria-hidden="true" />
            <span class="sr-only">{{ t('visual_plan.simulation.close') }}</span>
          </NeButton>
        </template>
        <template #content>{{ t('visual_plan.simulation.close') }}</template>
      </NeTooltip>
    </div>
    <div
      :class="[
        'scrollbar-thin-neutral min-h-0 flex-1 space-y-6 overflow-y-auto',
        inDrawer ? '' : 'p-4',
      ]"
    >
      <NeTextInput
        :model-value="dateValue"
        type="datetime-local"
        :label="t('visual_plan.simulation.call_time')"
        :helper-text="t('visual_plan.simulation.call_time_helper')"
        :invalid-message="dateError"
        @update:model-value="setDate"
      />
      <h3 class="text-primary-neutral text-sm font-medium">
        {{ t('visual_plan.simulation.path') }}
      </h3>
      <ol ref="stepsList" class="space-y-4">
        <li
          v-for="({ step, node }, index) in steps"
          :key="node.id"
          :data-step-node="node.id"
          class="flex gap-3"
        >
          <div class="flex flex-col items-center">
            <span
              class="bg-primary-active text-primary-inverted-neutral flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium"
            >
              {{ index + 1 }}
            </span>
            <span
              v-if="index < steps.length - 1"
              class="mt-1 w-px flex-1 bg-gray-200 dark:bg-gray-700"
              aria-hidden="true"
            />
          </div>
          <div class="min-w-0 flex-1 space-y-2 pb-1">
            <button
              type="button"
              class="focus-visible:ring-primary-focus flex w-full items-center gap-2 rounded-md text-left focus:outline-hidden focus-visible:ring-2"
              @click="emit('center', node.id)"
            >
              <span
                :class="[
                  'flex size-6 shrink-0 items-center justify-center rounded-md',
                  NODE_META[node.type].tone,
                ]"
              >
                <FontAwesomeIcon
                  :icon="NODE_META[node.type].icon"
                  class="size-3"
                  aria-hidden="true"
                />
              </span>
              <span class="min-w-0">
                <span class="text-primary-neutral block truncate text-sm font-medium">
                  {{ nodeTitle(node) || t('visual_plan.untitled') }}
                </span>
                <span class="text-tertiary-neutral block truncate text-xs">
                  {{ typeLabel(node.type) }}
                </span>
              </span>
            </button>
            <p class="text-secondary-neutral text-sm">
              {{ t(`visual_plan.simulation.reasons.${step.reason}`) }}
              <span v-if="outputText(step, node)" class="text-tertiary-neutral">
                · {{ outputText(step, node) }}
              </span>
            </p>
            <SelectField
              v-if="node.type === 'ivr' || node.type === 'cqr'"
              :model-value="choiceValue(node)"
              :label="
                node.type === 'ivr'
                  ? t('visual_plan.simulation.caller_presses')
                  : t('visual_plan.simulation.matching_condition')
              "
              :options="choiceOptions(node)"
              @update:model-value="setChoice(node, $event)"
            />
            <SelectField
              v-else-if="node.type === 'callFlowControl'"
              :model-value="callFlowValue(node)"
              :label="t('visual_plan.fields.current_mode')"
              :options="[
                { id: 'DAY', label: t('visual_plan.call_flow_states.DAY') },
                { id: 'NIGHT', label: t('visual_plan.call_flow_states.NIGHT') },
              ]"
              @update:model-value="setCallFlow(node, $event)"
            />
            <NeToggle
              v-else-if="node.type === 'queue' || node.type === 'ringGroup'"
              :model-value="store.simulation?.answered[node.id] ?? true"
              :label="t('visual_plan.simulation.someone_answers')"
              @update:model-value="setAnswered(node, $event)"
            />
          </div>
        </li>
      </ol>
      <NeInlineNotification
        v-if="end && lastNode"
        :kind="endKind"
        :title="t(`visual_plan.simulation.ends.${end}`)"
        :description="
          t(`visual_plan.simulation.ends.${end}_description`, {
            name: nodeTitle(lastNode) || typeLabel(lastNode.type),
          })
        "
      />
    </div>
  </div>
</template>
