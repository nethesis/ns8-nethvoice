<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeButton,
  NeFormItemLabel,
  NeHeading,
  NeTextInput,
  NeTooltip,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCirclePlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { NODE_WIDTH } from '@/lib/visualplan/layout'
import { entryOutputId, EXISTING_TYPES, getOutputs, type FlowNode } from '@/lib/visualplan/model'
import { useVisualPlanStore } from '@/stores/visualPlan'
import { useVisualPlanLabels } from '@/composables/useVisualPlanLabels'
import SelectField from '@/components/visualplan/SelectField.vue'

const props = defineProps<{ node: FlowNode }>()

const { t } = useI18n()
const store = useVisualPlanStore()
const { typeLabel, nodeTitle, outputLabel, issueMessage } = useVisualPlanLabels()

const outputs = computed(() => getOutputs(props.node))
const entries = computed(() =>
  props.node.type === 'ivr' || props.node.type === 'cqr' ? props.node.data.entries : null,
)
const fixedOutputs = computed(() =>
  outputs.value.filter((output) => !output.id.startsWith('entry:')),
)

const isIvr = computed(() => props.node.type === 'ivr')

const CATALOG_PREFIX = 'catalog:'

const headingId = `destinations-${useId()}`

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)

const targetOptions = computed(() => {
  const inFlow = store.nodes
    .filter((node) => node.id !== store.flow.rootId && !store.hidden.has(node.id))
    .map((node) => ({
      id: node.id,
      label:
        node.id === props.node.id
          ? `${nodeTitle(node) || t('visual_plan.untitled')} (${t('visual_plan.this_item')})`
          : nodeTitle(node) || t('visual_plan.untitled'),
      description: typeLabel(node.type),
    }))
    .sort(byLabel)
  const others = [...store.catalog.values()]
    .map((entry) => entry.node)
    .filter(
      (node) =>
        EXISTING_TYPES.includes(node.type) &&
        node.type !== 'extension' &&
        !store.flow.nodes[node.id],
    )
    .map((node) => ({
      id: `${CATALOG_PREFIX}${node.id}`,
      label: nodeTitle(node) || t('visual_plan.untitled'),
      description: `${typeLabel(node.type)} · ${t('visual_plan.not_in_flow_group')}`,
    }))
    .sort(byLabel)
  return [{ id: '', label: t('visual_plan.not_connected') }, ...inFlow, ...others]
})

function setTarget(outputId: string, value: string) {
  if (!value.startsWith(CATALOG_PREFIX)) {
    store.connect(props.node.id, outputId, value)
    return
  }
  const origin = store.positions[props.node.id] ?? { x: 0, y: 0 }
  const id = store.addExisting(
    value.slice(CATALOG_PREFIX.length),
    { x: origin.x + NODE_WIDTH + 96, y: origin.y },
    { source: props.node.id, output: outputId },
  )
  if (id) {
    store.selectedId = props.node.id
  }
}

const targetOf = (outputId: string): string =>
  store.flow.edges.find((edge) => edge.source === props.node.id && edge.output === outputId)
    ?.target ?? ''

const entryError = (entryId: string): string => {
  const issue = store.issues[props.node.id]?.find(
    (item) => item.level === 'error' && item.field === `entry:${entryId}`,
  )
  return issue ? issueMessage(issue) : ''
}

const outputError = (outputId: string): string => {
  const issue = store.issues[props.node.id]?.find(
    (item) => item.level === 'error' && item.output === outputId,
  )
  if (!issue) return ''
  return issueMessage(issue)
}

const removeLabel = (value: string) =>
  isIvr.value
    ? t('visual_plan.remove_option', { value })
    : t('visual_plan.remove_condition', { value })

const updateEntry = (entryId: string, value: string) => {
  if (!entries.value) return
  store.touch(props.node.id, `entry:${entryId}`)
  store.patchNode(
    props.node.id,
    {
      entries: entries.value.map((entry) => (entry.id === entryId ? { ...entry, value } : entry)),
    },
    `${props.node.id}:entry:${entryId}`,
  )
}
</script>

<template>
  <section
    v-if="entries"
    class="space-y-2"
    :aria-label="isIvr ? t('visual_plan.options') : t('visual_plan.conditions')"
  >
    <NeFormItemLabel class="mb-0!">
      {{ isIvr ? t('visual_plan.options') : t('visual_plan.conditions') }}
    </NeFormItemLabel>
    <div v-if="entries.length" class="flex gap-3" aria-hidden="true">
      <NeFormItemLabel class="mb-0! w-20 shrink-0">
        {{ isIvr ? t('visual_plan.fields.digit') : t('visual_plan.fields.condition') }}
      </NeFormItemLabel>
      <NeFormItemLabel class="mb-0! min-w-0 flex-1">
        {{ t('visual_plan.fields.goes_to') }}
      </NeFormItemLabel>
      <span v-if="!store.readOnly" class="w-9 shrink-0" />
    </div>
    <div v-for="entry in entries" :key="entry.id" class="flex items-start gap-3">
      <NeTextInput
        :model-value="entry.value"
        :label="isIvr ? t('visual_plan.fields.digit') : t('visual_plan.fields.condition')"
        :invalid-message="entryError(entry.id)"
        :disabled="store.readOnly"
        class="w-20 shrink-0 [&_label]:sr-only"
        @update:model-value="updateEntry(entry.id, $event)"
      />
      <SelectField
        :model-value="targetOf(entryOutputId(entry))"
        :label="t('visual_plan.fields.goes_to')"
        :options="targetOptions"
        :invalid-message="outputError(entryOutputId(entry))"
        :disabled="store.readOnly"
        searchable
        class="min-w-0 flex-1 [&_label]:sr-only"
        options-width="22rem"
        @update:model-value="setTarget(entryOutputId(entry), $event)"
      />
      <NeTooltip v-if="!store.readOnly" trigger-event="mouseenter focus" placement="top">
        <template #trigger>
          <NeButton
            kind="tertiary"
            :disabled="isIvr && entries.length < 2"
            class="shrink-0"
            @click="store.removeEntry(node.id, entry.id)"
          >
            <FontAwesomeIcon :icon="faTrash" class="size-4" aria-hidden="true" />
            <span class="sr-only">{{ removeLabel(entry.value) }}</span>
          </NeButton>
        </template>
        <template #content>{{ removeLabel(entry.value) }}</template>
      </NeTooltip>
    </div>
    <NeButton
      v-if="!store.readOnly"
      kind="tertiary"
      class="-ml-2.5"
      @click="store.addEntry(node.id)"
    >
      <template #prefix>
        <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
      </template>
      {{ isIvr ? t('visual_plan.add_option') : t('visual_plan.add_condition') }}
    </NeButton>
  </section>
  <section v-if="fixedOutputs.length" class="space-y-6" :aria-labelledby="headingId">
    <NeHeading :id="headingId" tag="h3" class="pt-2 text-sm!">
      {{ t('visual_plan.destinations') }}
    </NeHeading>
    <SelectField
      v-for="output in fixedOutputs"
      :key="output.id"
      :model-value="targetOf(output.id)"
      :label="outputLabel(output)"
      :options="targetOptions"
      :invalid-message="outputError(output.id)"
      :disabled="store.readOnly"
      searchable
      options-width="22rem"
      @update:model-value="setTarget(output.id, $event)"
    />
  </section>
</template>
