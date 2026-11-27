<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeButton,
  NeHeading,
  NeInlineNotification,
  NeTextInput,
  NeTooltip,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faPlay, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { MenuChoice, SimulationStep } from '@/lib/visualplan/simulation'
import { getOutputs, type FlowNode } from '@/lib/visualplan/model'
import { useVisualPlanStore } from '@/stores/visualPlan'
import { useVisualPlanLabels } from '@/composables/useVisualPlanLabels'
import { NODE_META } from '@/components/visualplan/nodeMeta'
import SelectField from '@/components/visualplan/SelectField.vue'

const { inDrawer = false } = defineProps<{ inDrawer?: boolean }>()

const emit = defineEmits<{ center: [id: string]; close: [] }>()

const { t, te } = useI18n()
const store = useVisualPlanStore()
const { typeLabel, nodeTitle, outputLabel, recordingName, simulationOutcome } =
  useVisualPlanLabels()

const pad = (value: number) => String(value).padStart(2, '0')

const initial = store.simulation?.date ?? new Date()
const dateText = ref(
  `${pad(initial.getDate())}/${pad(initial.getMonth() + 1)}/${initial.getFullYear()}`,
)
const timeText = ref(`${pad(initial.getHours())}:${pad(initial.getMinutes())}`)

const parsedDate = computed(() => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateText.value.trim())
  if (!match) return null
  const [, day, month, year] = match.map(Number)
  const date = new Date(year!, month! - 1, day!)
  return date.getDate() === day && date.getMonth() === month! - 1 ? date : null
})

const parsedTime = computed(() => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeText.value.trim())
  if (!match) return null
  const [hours, minutes] = [Number(match[1]), Number(match[2])]
  return hours < 24 && minutes < 60 ? { hours, minutes } : null
})

const dateError = computed(() => (parsedDate.value ? '' : t('visual_plan.simulation.invalid_date')))
const timeError = computed(() => (parsedTime.value ? '' : t('visual_plan.simulation.invalid_time')))

watch([parsedDate, parsedTime], ([date, time]) => {
  if (!date || !time || !store.simulation) return
  const value = new Date(date)
  value.setHours(time.hours, time.minutes, 0, 0)
  store.simulation = { ...store.simulation, date: value }
})

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

const outcome = computed(() => simulationOutcome(store.simulationResult))

const choiceValue = (node: FlowNode): string => {
  const choice = store.simulation?.menuChoices[node.id]
  if (!choice) {
    if (node.type === 'cqr') return 'default'
    const first = node.type === 'ivr' ? node.data.entries[0] : undefined
    return first ? `entry:${first.id}` : 'timeout'
  }
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

function setAnswered(node: FlowNode, value: string) {
  if (!store.simulation) return
  store.simulation = {
    ...store.simulation,
    answered: { ...store.simulation.answered, [node.id]: value === 'answered' },
  }
}

const callFlowValue = (node: FlowNode): string =>
  store.simulation?.callFlowStates[node.id] ??
  (node.type === 'callFlowControl' ? node.data.state : 'DAY')

// What happens at a step, in the words of the caller.
const stepText = (step: SimulationStep, node: FlowNode): string => {
  const key = 'visual_plan.simulation.reasons'
  switch (step.reason) {
    case 'menu_choice': {
      if (node.type !== 'ivr') return t(`${key}.menu_choice`)
      const entry = node.data.entries.find((item) => `entry:${item.id}` === step.output)
      return t(`${key}.menu_digit`, { digit: entry?.value ?? '' })
    }
    case 'answered':
      return t(
        `${key}.${node.type === 'queue' ? 'agent_answers' : node.type === 'ringGroup' ? 'member_answers' : 'answered'}`,
      )
    case 'next':
      return node.type === 'announcement' && node.data.recording !== null
        ? t(`${key}.hears`, { recording: recordingName(node.data.recording) })
        : t(`${key}.next`)
    case 'ends_call':
      if (node.type === 'voicemail') return t(`${key}.leaves_message`)
      if (node.type === 'conference') return t(`${key}.joins_conference`)
      if (node.type === 'queueExit') return t(`${key}.leaves_queue`)
      if (node.type === 'hangup') {
        const variant = `visual_plan.hangup_variants.${node.data.variant}`
        return t(`${key}.ends_with`, { termination: te(variant) ? t(variant) : node.data.variant })
      }
      return t(`${key}.ends_call`)
    default:
      return t(`${key}.${step.reason}`)
  }
}

const outputText = (step: SimulationStep, node: FlowNode): string => {
  const output = getOutputs(node).find((item) => item.id === step.output)
  return output ? t('visual_plan.simulation.goes_through', { output: outputLabel(output) }) : ''
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div v-if="!inDrawer" class="px-6 pt-6">
      <div class="flex items-center gap-3">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-50"
        >
          <FontAwesomeIcon :icon="faPlay" class="size-4" aria-hidden="true" />
        </span>
        <div class="min-w-0 flex-1">
          <NeHeading tag="h2" class="truncate text-base!">
            {{ t('visual_plan.simulation.title') }}
          </NeHeading>
          <p class="truncate text-xs text-gray-600 dark:text-gray-400">
            {{ t('visual_plan.simulation.description') }}
          </p>
        </div>
        <NeTooltip trigger-event="mouseenter focus" placement="bottom">
          <template #trigger>
            <NeButton
              kind="tertiary"
              class="text-gray-900! dark:text-gray-50!"
              @click="emit('close')"
            >
              <FontAwesomeIcon :icon="faXmark" class="size-4" aria-hidden="true" />
              <span class="sr-only">{{ t('visual_plan.simulation.close') }}</span>
            </NeButton>
          </template>
          <template #content>{{ t('visual_plan.simulation.close') }}</template>
        </NeTooltip>
      </div>
      <hr class="mt-4 border-gray-200 dark:border-gray-700" />
    </div>
    <div
      :class="[
        'scrollbar-thin-neutral min-h-0 flex-1 space-y-6 overflow-y-auto',
        inDrawer ? '' : 'px-6 py-6',
      ]"
    >
      <div>
        <div class="flex gap-3">
          <NeTextInput
            v-model="dateText"
            :label="t('visual_plan.simulation.date')"
            :placeholder="t('visual_plan.simulation.date_placeholder')"
            :invalid-message="dateError"
            class="min-w-0 flex-1"
          />
          <NeTextInput
            v-model="timeText"
            :label="t('visual_plan.simulation.time')"
            :placeholder="t('visual_plan.simulation.time_placeholder')"
            :invalid-message="timeError"
            class="w-28 shrink-0"
          />
        </div>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ t('visual_plan.simulation.call_time_helper') }}
        </p>
      </div>
      <div>
        <NeHeading tag="h3" class="mb-4 text-sm!">{{ t('visual_plan.simulation.path') }}</NeHeading>
        <ol ref="stepsList">
          <li
            v-for="({ step, node }, index) in steps"
            :key="node.id"
            :data-step-node="node.id"
            class="relative flex gap-3 pb-6 last:pb-0"
          >
            <span
              v-if="index < steps.length - 1"
              class="absolute top-7 bottom-1 left-2.75 w-0.5 bg-indigo-500 dark:bg-indigo-400"
              aria-hidden="true"
            />
            <span
              class="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-medium text-white"
              aria-hidden="true"
            >
              {{ index + 1 }}
            </span>
            <div class="min-w-0 flex-1 space-y-3">
              <button
                type="button"
                class="focus:ring-primary-500 dark:focus:ring-primary-200 -m-1 flex w-full items-center gap-3 rounded-md p-1 text-left hover:bg-gray-100 focus:ring-2 focus:outline-hidden dark:hover:bg-gray-800"
                :aria-label="
                  t('visual_plan.simulation.step_label', {
                    step: index + 1,
                    name: `${typeLabel(node.type)} ${nodeTitle(node) || t('visual_plan.untitled')}`,
                  })
                "
                @click="emit('center', node.id)"
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
                  <span class="block truncate text-sm font-medium text-gray-900 dark:text-gray-50">
                    {{ nodeTitle(node) || t('visual_plan.untitled') }}
                  </span>
                  <span class="block truncate text-xs text-gray-600 dark:text-gray-400">
                    {{ typeLabel(node.type) }}
                  </span>
                </span>
              </button>
              <p class="text-sm text-gray-700 dark:text-gray-200">
                {{ stepText(step, node) }}
                <span v-if="outputText(step, node)" class="text-gray-600 dark:text-gray-400">
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
                  { id: 'DAY', label: t('visual_plan.outputs.normal_destination') },
                  { id: 'NIGHT', label: t('visual_plan.outputs.override_destination') },
                ]"
                @update:model-value="setCallFlow(node, $event)"
              />
              <SelectField
                v-else-if="node.type === 'queue' || node.type === 'ringGroup'"
                :model-value="
                  (store.simulation?.answered[node.id] ?? true) ? 'answered' : 'no_answer'
                "
                :label="t('visual_plan.simulation.call_result')"
                :options="[
                  { id: 'answered', label: t('visual_plan.simulation.result_answered') },
                  { id: 'no_answer', label: t('visual_plan.simulation.result_no_answer') },
                ]"
                @update:model-value="setAnswered(node, $event)"
              />
            </div>
          </li>
        </ol>
      </div>
      <NeInlineNotification
        v-if="outcome"
        :kind="outcome.kind"
        :title="outcome.title"
        :description="outcome.description"
      />
    </div>
  </div>
</template>
