<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeButton,
  NeInlineNotification,
  NeTextArea,
  NeTextInput,
  NeToggle,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCirclePlus, faPenToSquare } from '@fortawesome/free-solid-svg-icons'
import type { TimeGroupData } from '@/lib/visualplan/api'
import { QUEUE_STRATEGIES, RING_STRATEGIES } from '@/lib/visualplan/defaults'
import { VOICEMAIL_MODES, type FlowNode } from '@/lib/visualplan/model'
import { useVisualPlanLabels } from '@/composables/useVisualPlanLabels'
import { useVisualPlanStore } from '@/stores/visualPlan'
import SelectField from '@/components/visualplan/SelectField.vue'
import RecordingField from '@/components/visualplan/RecordingField.vue'
import TimeGroupDrawer from '@/components/visualplan/TimeGroupDrawer.vue'

const props = defineProps<{ node: FlowNode }>()

const { t } = useI18n()
const { issueMessage } = useVisualPlanLabels()
const store = useVisualPlanStore()

const HANGUP_VARIANTS = ['hangup', 'busy', 'congestion', 'musiconhold', 'ring', 'zapateller']

const disabled = computed(() => store.readOnly)
const issues = computed(() => store.issues[props.node.id])

const err = (field: string): string => {
  const issue = issues.value?.find((item) => item.level === 'error' && item.field === field)
  return issue ? issueMessage(issue) : ''
}

const set = (field: string, value: unknown) => store.patchNode(props.node.id, { [field]: value })

const toInt = (value: string): number => (value.trim() === '' ? Number.NaN : Number(value))

const numberText = (value: number): string => (Number.isNaN(value) ? '' : String(value))

const lines = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const option = (id: string, label: string) => ({ id, label })

const extensionOptions = computed(() =>
  (store.data?.extensions ?? []).map((item) =>
    option(item.extension, item.name ? `${item.name} (${item.extension})` : item.extension),
  ),
)
const ringStrategyOptions = computed(() =>
  RING_STRATEGIES.map((value) => option(value, t(`visual_plan.ring_strategies.${value}`))),
)
const queueStrategyOptions = computed(() =>
  QUEUE_STRATEGIES.map((value) => option(value, t(`visual_plan.queue_strategies.${value}`))),
)
const mohOptions = computed(() => [
  option('inherit', t('visual_plan.moh_inherit')),
  ...(store.data?.musicOnHold ?? []).map((name) => option(name, name)),
])
const ivrOptions = computed(() => [
  option('', t('common.none')),
  ...(store.data?.ivrs ?? []).map((ivr) => option(String(ivr.id), ivr.name)),
])
const voicemailModeOptions = computed(() =>
  VOICEMAIL_MODES.map((mode) => option(mode, t(`visual_plan.voicemail_modes.${mode}`))),
)
const hangupOptions = computed(() =>
  HANGUP_VARIANTS.map((variant) => option(variant, t(`visual_plan.hangup_variants.${variant}`))),
)
const callFlowCodeOptions = computed(() =>
  (store.data?.availableCallFlowCodes ?? []).map((code) => option(code, `*28${code}`)),
)
const timeGroupOptions = computed(() =>
  store.timeGroups.map((group) => option(group.ref, group.data.description)),
)

const timeGroupDrawer = ref<{ shown: boolean; ref: string | null; group: TimeGroupData | null }>({
  shown: false,
  ref: null,
  group: null,
})

const selectedTimeGroupRef = computed(() => {
  if (props.node.type !== 'timeCondition') return ''
  if (props.node.data.timeGroupRef) return props.node.data.timeGroupRef
  return props.node.data.timeGroup === null ? '' : String(props.node.data.timeGroup)
})

const timeGroupUsers = computed(() => {
  const id = timeGroupDrawer.value.group?.id
  if (id === null || id === undefined) return 0
  return (store.data?.timeConditions ?? []).filter(
    (condition) => condition.timeGroup === id && `timeCondition:${condition.id}` !== props.node.id,
  ).length
})

function selectTimeGroup(ref: string) {
  const group = store.timeGroups.find((item) => item.ref === ref)
  if (!group) return
  store.patchNode(props.node.id, {
    timeGroup: group.data.id,
    timeGroupRef: group.data.id === null ? group.ref : null,
  })
}

function openTimeGroup(create: boolean) {
  const current = store.timeGroups.find((item) => item.ref === selectedTimeGroupRef.value)
  timeGroupDrawer.value = {
    shown: true,
    ref: create ? null : (current?.ref ?? null),
    group: create ? null : (current?.data ?? null),
  }
}

function saveTimeGroup(group: TimeGroupData) {
  const editing = timeGroupDrawer.value.ref
  if (editing) {
    store.updateTimeGroup(editing, group)
  } else {
    selectTimeGroup(store.addTimeGroup(group))
  }
  timeGroupDrawer.value.shown = false
}

function selectExtension(extension: string) {
  const found = store.data?.extensions.find((item) => item.extension === extension)
  store.patchNode(props.node.id, {
    extension,
    name: found?.name ?? '',
    voicemail: found?.voicemail ?? false,
  })
}

const queueStaticMembers = computed(() =>
  props.node.type === 'queue'
    ? props.node.data.staticMembers
        .map((member) =>
          member.penalty ? `${member.extension},${member.penalty}` : member.extension,
        )
        .join('\n')
    : '',
)

function setStaticMembers(value: string) {
  set(
    'staticMembers',
    lines(value).map((line) => {
      const [extension = '', penalty = '0'] = line.split(',')
      const value = penalty.trim()
      return {
        extension: extension.trim(),
        penalty: /^\d+$/.test(value) ? Number(value) : Number.NaN,
      }
    }),
  )
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="node.type === 'inboundRoute'">
      <NeTextInput
        :model-value="node.data.extension"
        :label="t('visual_plan.fields.did')"
        :helper-text="t('visual_plan.fields.did_helper')"
        :invalid-message="err('extension')"
        :disabled="disabled"
        @update:model-value="set('extension', $event)"
      />
      <NeTextInput
        :model-value="node.data.cidnum"
        :label="t('visual_plan.fields.cid')"
        :helper-text="t('visual_plan.fields.cid_helper')"
        :invalid-message="err('cidnum')"
        :disabled="disabled"
        @update:model-value="set('cidnum', $event)"
      />
      <NeTextInput
        :model-value="node.data.description"
        :label="t('visual_plan.fields.description')"
        :disabled="disabled"
        optional
        :optional-label="t('common.optional')"
        :invalid-message="err('description')"
        @update:model-value="set('description', $event)"
      />
      <NeTextInput
        :model-value="node.data.alertinfo"
        :label="t('visual_plan.fields.alert_info')"
        :helper-text="t('visual_plan.fields.alert_info_helper')"
        :disabled="disabled"
        optional
        :optional-label="t('common.optional')"
        :invalid-message="err('alertinfo')"
        @update:model-value="set('alertinfo', $event)"
      />
      <NeTextInput
        :model-value="node.data.grppre"
        :label="t('visual_plan.fields.cid_prefix')"
        :helper-text="t('visual_plan.fields.cid_prefix_helper')"
        :disabled="disabled"
        optional
        :optional-label="t('common.optional')"
        :invalid-message="err('grppre')"
        @update:model-value="set('grppre', $event)"
      />
    </template>

    <template v-else-if="node.type === 'extension'">
      <SelectField
        :model-value="node.data.extension"
        :label="t('visual_plan.fields.extension')"
        :options="extensionOptions"
        :disabled="disabled"
        :invalid-message="err('extension')"
        @update:model-value="selectExtension"
      />
    </template>

    <template v-else-if="node.type === 'voicemail'">
      <SelectField
        :model-value="node.data.extension"
        :label="t('visual_plan.fields.mailbox')"
        :options="extensionOptions"
        :helper-text="t('visual_plan.fields.mailbox_helper')"
        :invalid-message="err('extension')"
        :disabled="disabled"
        @update:model-value="set('extension', $event)"
      />
      <SelectField
        :model-value="node.data.mode"
        :label="t('visual_plan.fields.voicemail_message')"
        :options="voicemailModeOptions"
        :disabled="disabled"
        :invalid-message="err('mode')"
        @update:model-value="set('mode', $event)"
      />
    </template>

    <template v-else-if="node.type === 'hangup'">
      <SelectField
        :model-value="node.data.variant"
        :label="t('visual_plan.fields.hangup_mode')"
        :options="hangupOptions"
        :disabled="disabled"
        :invalid-message="err('variant')"
        @update:model-value="set('variant', $event)"
      />
    </template>

    <template v-else-if="node.type === 'conference'">
      <NeTextInput
        :model-value="node.data.id"
        :label="t('visual_plan.fields.number')"
        :invalid-message="err('id')"
        :disabled="disabled || !node.isNew"
        @update:model-value="set('id', $event)"
      />
      <NeTextInput
        :model-value="node.data.name"
        :label="t('visual_plan.fields.name')"
        :invalid-message="err('name')"
        :disabled="disabled"
        @update:model-value="set('name', $event)"
      />
    </template>

    <template v-else-if="node.type === 'ringGroup'">
      <NeTextInput
        :model-value="node.data.id"
        :label="t('visual_plan.fields.number')"
        :invalid-message="err('id')"
        :disabled="disabled || !node.isNew"
        @update:model-value="set('id', $event)"
      />
      <NeTextInput
        :model-value="node.data.description"
        :label="t('visual_plan.fields.name')"
        :invalid-message="err('description')"
        :disabled="disabled"
        @update:model-value="set('description', $event)"
      />
      <NeTextArea
        :model-value="node.data.members.join('\n')"
        :label="t('visual_plan.fields.members')"
        :helper-text="t('visual_plan.fields.ring_group_members_helper')"
        :invalid-message="err('members')"
        :rows="4"
        :disabled="disabled"
        @update:model-value="set('members', lines($event))"
      />
      <SelectField
        :model-value="node.data.strategy"
        :label="t('visual_plan.fields.strategy')"
        :options="ringStrategyOptions"
        :disabled="disabled"
        :invalid-message="err('strategy')"
        @update:model-value="set('strategy', $event)"
      />
      <NeTextInput
        :model-value="numberText(node.data.ringTime)"
        type="number"
        :label="t('visual_plan.fields.ring_time')"
        :helper-text="t('visual_plan.fields.ring_time_helper')"
        :invalid-message="err('ringTime')"
        :disabled="disabled"
        @update:model-value="set('ringTime', toInt($event))"
      />
    </template>

    <template v-else-if="node.type === 'queue'">
      <NeTextInput
        :model-value="node.data.id"
        :label="t('visual_plan.fields.number')"
        :invalid-message="err('id')"
        :disabled="disabled || !node.isNew"
        @update:model-value="set('id', $event)"
      />
      <NeTextInput
        :model-value="node.data.name"
        :label="t('visual_plan.fields.name')"
        :invalid-message="err('name')"
        :disabled="disabled"
        @update:model-value="set('name', $event)"
      />
      <NeTextArea
        :model-value="queueStaticMembers"
        :label="t('visual_plan.fields.static_members')"
        :helper-text="t('visual_plan.fields.static_members_helper')"
        :rows="3"
        :disabled="disabled"
        optional
        :optional-label="t('common.optional')"
        :invalid-message="err('staticMembers')"
        @update:model-value="setStaticMembers($event)"
      />
      <NeTextArea
        :model-value="node.data.dynamicMembers.join('\n')"
        :label="t('visual_plan.fields.dynamic_members')"
        :helper-text="t('visual_plan.fields.dynamic_members_helper')"
        :rows="3"
        :disabled="disabled"
        optional
        :optional-label="t('common.optional')"
        :invalid-message="err('dynamicMembers')"
        @update:model-value="set('dynamicMembers', lines($event))"
      />
      <SelectField
        :model-value="node.data.strategy"
        :label="t('visual_plan.fields.strategy')"
        :options="queueStrategyOptions"
        :disabled="disabled"
        :invalid-message="err('strategy')"
        @update:model-value="set('strategy', $event)"
      />
      <div class="grid grid-cols-2 gap-4">
        <NeTextInput
          :model-value="numberText(node.data.agentTimeout)"
          type="number"
          :label="t('visual_plan.fields.agent_timeout')"
          :helper-text="t('visual_plan.fields.agent_timeout_helper')"
          :invalid-message="err('agentTimeout')"
          :disabled="disabled"
          @update:model-value="set('agentTimeout', toInt($event))"
        />
        <NeTextInput
          :model-value="numberText(node.data.maxWait)"
          type="number"
          :label="t('visual_plan.fields.max_wait')"
          :helper-text="t('visual_plan.fields.max_wait_helper')"
          :invalid-message="err('maxWait')"
          :disabled="disabled"
          @update:model-value="set('maxWait', toInt($event))"
        />
      </div>
      <h3 class="text-primary-neutral text-sm font-medium">
        {{ t('visual_plan.caller_experience') }}
      </h3>
      <SelectField
        :model-value="node.data.ringing"
        :label="t('visual_plan.fields.while_waiting')"
        :options="[
          { id: 'moh', label: t('visual_plan.fields.music_on_hold') },
          { id: 'ring', label: t('visual_plan.fields.ringing') },
        ]"
        :disabled="disabled"
        :invalid-message="err('ringing')"
        @update:model-value="set('ringing', $event)"
      />
      <SelectField
        v-if="node.data.ringing === 'moh'"
        :model-value="node.data.musicOnHold"
        :label="t('visual_plan.fields.music_class')"
        :options="mohOptions"
        :disabled="disabled"
        :invalid-message="err('musicOnHold')"
        @update:model-value="set('musicOnHold', $event)"
      />
      <NeTextInput
        :model-value="node.data.cidPrefix"
        :label="t('visual_plan.fields.cid_prefix')"
        :helper-text="t('visual_plan.fields.cid_prefix_helper')"
        :disabled="disabled"
        optional
        :optional-label="t('common.optional')"
        :invalid-message="err('cidPrefix')"
        @update:model-value="set('cidPrefix', $event)"
      />
      <RecordingField
        :model-value="node.data.joinAnnouncement"
        :label="t('visual_plan.fields.join_announcement')"
        optional
        :disabled="disabled"
        :invalid-message="err('joinAnnouncement')"
        @update:model-value="set('joinAnnouncement', $event)"
      />
      <NeToggle
        :model-value="node.data.positionAnnouncement"
        :top-label="t('visual_plan.fields.position_announcement')"
        :label="node.data.positionAnnouncement ? t('common.enabled') : t('common.disabled')"
        :disabled="disabled"
        :invalid-message="err('positionAnnouncement')"
        @update:model-value="set('positionAnnouncement', $event)"
      />
      <NeTextInput
        v-if="node.data.positionAnnouncement"
        :model-value="numberText(node.data.announceFrequency)"
        type="number"
        :label="t('visual_plan.fields.announce_frequency')"
        :helper-text="t('visual_plan.fields.announce_frequency_helper')"
        :disabled="disabled"
        :invalid-message="err('announceFrequency')"
        @update:model-value="set('announceFrequency', toInt($event))"
      />
      <SelectField
        :model-value="node.data.breakoutIvr === null ? '' : String(node.data.breakoutIvr)"
        :label="t('visual_plan.fields.breakout_ivr')"
        :helper-text="t('visual_plan.fields.breakout_ivr_helper')"
        :options="ivrOptions"
        :disabled="disabled"
        :invalid-message="err('breakoutIvr')"
        @update:model-value="set('breakoutIvr', $event ? Number($event) : null)"
      />
    </template>

    <template v-else-if="node.type === 'ivr' || node.type === 'cqr'">
      <NeTextInput
        :model-value="node.data.name"
        :label="t('visual_plan.fields.name')"
        :invalid-message="err('name')"
        :disabled="disabled"
        @update:model-value="set('name', $event)"
      />
      <NeTextInput
        :model-value="node.data.description"
        :label="t('visual_plan.fields.description')"
        :disabled="disabled"
        optional
        :optional-label="t('common.optional')"
        :invalid-message="err('description')"
        @update:model-value="set('description', $event)"
      />
      <RecordingField
        :model-value="node.data.announcement"
        :label="t('visual_plan.fields.announcement')"
        optional
        :disabled="disabled"
        :invalid-message="err('announcement')"
        @update:model-value="set('announcement', $event)"
      />
      <NeToggle
        v-if="node.type === 'ivr'"
        :model-value="node.data.directDial"
        :top-label="t('visual_plan.fields.direct_dial')"
        :label="node.data.directDial ? t('common.enabled') : t('common.disabled')"
        :disabled="disabled"
        :invalid-message="err('directDial')"
        @update:model-value="set('directDial', $event)"
      />
    </template>

    <template v-else-if="node.type === 'announcement'">
      <NeTextInput
        :model-value="node.data.description"
        :label="t('visual_plan.fields.name')"
        :invalid-message="err('description')"
        :disabled="disabled"
        @update:model-value="set('description', $event)"
      />
      <RecordingField
        :model-value="node.data.recording"
        :label="t('visual_plan.fields.recording')"
        :invalid-message="err('recording')"
        :disabled="disabled"
        @update:model-value="set('recording', $event)"
      />
    </template>

    <template v-else-if="node.type === 'timeCondition'">
      <NeTextInput
        :model-value="node.data.name"
        :label="t('visual_plan.fields.name')"
        :invalid-message="err('name')"
        :disabled="disabled"
        @update:model-value="set('name', $event)"
      />
      <SelectField
        :model-value="selectedTimeGroupRef"
        :label="t('visual_plan.fields.time_group')"
        :options="timeGroupOptions"
        :invalid-message="err('timeGroup')"
        :disabled="disabled"
        @update:model-value="selectTimeGroup($event)"
      />
      <div v-if="!disabled" class="flex flex-wrap gap-2">
        <NeButton kind="tertiary" size="sm" @click="openTimeGroup(true)">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" aria-hidden="true" />
          </template>
          {{ t('visual_plan.time_group.create') }}
        </NeButton>
        <NeButton
          v-if="selectedTimeGroupRef"
          kind="tertiary"
          size="sm"
          @click="openTimeGroup(false)"
        >
          <template #prefix>
            <FontAwesomeIcon :icon="faPenToSquare" aria-hidden="true" />
          </template>
          {{ t('visual_plan.time_group.edit') }}
        </NeButton>
      </div>
      <TimeGroupDrawer
        :is-shown="timeGroupDrawer.shown"
        :group="timeGroupDrawer.group"
        :used-by="timeGroupUsers"
        @close="timeGroupDrawer.shown = false"
        @save="saveTimeGroup"
      />
    </template>

    <template v-else-if="node.type === 'callFlowControl'">
      <SelectField
        v-if="node.isNew"
        :model-value="node.data.id"
        :label="t('visual_plan.fields.control_code')"
        :options="callFlowCodeOptions"
        :invalid-message="err('id')"
        :disabled="disabled"
        @update:model-value="set('id', $event)"
      />
      <NeTextInput
        v-else
        :model-value="`*28${node.data.id}`"
        :label="t('visual_plan.fields.control_code')"
        disabled
      />
      <NeTextInput
        :model-value="node.data.name"
        :label="t('visual_plan.fields.name')"
        :invalid-message="err('name')"
        :disabled="disabled"
        @update:model-value="set('name', $event)"
      />
    </template>

    <template v-else-if="node.type === 'setCallerId'">
      <NeTextInput
        :model-value="node.data.description"
        :label="t('visual_plan.fields.name')"
        :invalid-message="err('description')"
        :disabled="disabled"
        @update:model-value="set('description', $event)"
      />
      <NeTextInput
        :model-value="node.data.cidName"
        :label="t('visual_plan.fields.cid_name')"
        :helper-text="
          t('visual_plan.fields.cid_variables_helper', { example: '${CALLERID(name)}' })
        "
        :disabled="disabled"
        :invalid-message="err('cidName')"
        @update:model-value="set('cidName', $event)"
      />
      <NeTextInput
        :model-value="node.data.cidNum"
        :label="t('visual_plan.fields.cid_number')"
        :disabled="disabled"
        :invalid-message="err('cidNum')"
        @update:model-value="set('cidNum', $event)"
      />
    </template>

    <template v-else-if="node.type === 'directDid'">
      <NeTextInput
        :model-value="node.data.prefix"
        :label="t('visual_plan.fields.direct_did_prefix')"
        :helper-text="t('visual_plan.fields.direct_did_prefix_helper')"
        :invalid-message="err('prefix')"
        :disabled="disabled"
        @update:model-value="set('prefix', $event)"
      />
      <NeTextInput
        :model-value="node.data.root"
        :label="t('visual_plan.fields.direct_did_root')"
        :helper-text="t('visual_plan.fields.direct_did_root_helper')"
        :invalid-message="err('root')"
        :disabled="disabled"
        @update:model-value="set('root', $event)"
      />
      <div class="grid grid-cols-2 gap-4">
        <NeTextInput
          :model-value="numberText(node.data.varlength)"
          type="number"
          :label="t('visual_plan.fields.direct_did_length')"
          :helper-text="t('visual_plan.fields.direct_did_length_helper')"
          :invalid-message="err('varlength')"
          :disabled="disabled"
          @update:model-value="set('varlength', toInt($event))"
        />
        <NeTextInput
          :model-value="numberText(node.data.timeout)"
          type="number"
          :label="t('visual_plan.fields.ring_time')"
          :helper-text="t('visual_plan.fields.direct_did_timeout_helper')"
          :invalid-message="err('timeout')"
          :disabled="disabled"
          @update:model-value="set('timeout', toInt($event))"
        />
      </div>
    </template>

    <template v-else-if="node.type === 'queueExit'">
      <NeTextInput
        :model-value="node.data.name"
        :label="t('visual_plan.fields.name')"
        :invalid-message="err('name')"
        :disabled="disabled"
        @update:model-value="set('name', $event)"
      />
    </template>

    <template v-else-if="node.type === 'queueOptions'">
      <NeTextInput
        :model-value="node.data.name"
        :label="t('visual_plan.fields.name')"
        :invalid-message="err('name')"
        :disabled="disabled"
        @update:model-value="set('name', $event)"
      />
      <NeTextInput
        :model-value="node.data.cidPrefix"
        :label="t('visual_plan.fields.cid_prefix')"
        :disabled="disabled"
        optional
        :optional-label="t('common.optional')"
        :invalid-message="err('cidPrefix')"
        @update:model-value="set('cidPrefix', $event)"
      />
      <NeTextInput
        :model-value="node.data.alertInfo"
        :label="t('visual_plan.fields.alert_info')"
        :disabled="disabled"
        optional
        :optional-label="t('common.optional')"
        :invalid-message="err('alertInfo')"
        @update:model-value="set('alertInfo', $event)"
      />
      <RecordingField
        :model-value="node.data.joinAnnouncement"
        :label="t('visual_plan.fields.join_announcement')"
        optional
        :disabled="disabled"
        :invalid-message="err('joinAnnouncement')"
        @update:model-value="set('joinAnnouncement', $event)"
      />
      <SelectField
        :model-value="node.data.musicOnHold"
        :label="t('visual_plan.fields.music_class')"
        :options="[{ id: '', label: t('common.none') }, ...mohOptions]"
        :disabled="disabled"
        :invalid-message="err('musicOnHold')"
        @update:model-value="set('musicOnHold', $event)"
      />
      <NeToggle
        :model-value="node.data.positionEnabled"
        :top-label="t('visual_plan.fields.position_override')"
        :label="node.data.positionEnabled ? t('common.enabled') : t('common.disabled')"
        :disabled="disabled"
        :invalid-message="err('positionEnabled')"
        @update:model-value="set('positionEnabled', $event)"
      />
      <NeTextInput
        v-if="node.data.positionEnabled"
        :model-value="numberText(node.data.position)"
        type="number"
        :label="t('visual_plan.fields.position')"
        :helper-text="t('visual_plan.fields.position_helper')"
        :disabled="disabled"
        :invalid-message="err('position')"
        @update:model-value="set('position', toInt($event))"
      />
      <NeToggle
        :model-value="node.data.maxWaitEnabled"
        :top-label="t('visual_plan.fields.max_wait_override')"
        :label="node.data.maxWaitEnabled ? t('common.enabled') : t('common.disabled')"
        :disabled="disabled"
        :invalid-message="err('maxWaitEnabled')"
        @update:model-value="set('maxWaitEnabled', $event)"
      />
      <NeTextInput
        v-if="node.data.maxWaitEnabled"
        :model-value="numberText(node.data.maxWait)"
        type="number"
        :label="t('visual_plan.fields.max_wait')"
        :helper-text="t('visual_plan.fields.max_wait_helper')"
        :disabled="disabled"
        :invalid-message="err('maxWait')"
        @update:model-value="set('maxWait', toInt($event))"
      />
      <NeToggle
        :model-value="node.data.failoverEnabled"
        :top-label="t('visual_plan.fields.failover_override')"
        :label="node.data.failoverEnabled ? t('common.enabled') : t('common.disabled')"
        :disabled="disabled"
        :invalid-message="err('failoverEnabled')"
        @update:model-value="set('failoverEnabled', $event)"
      />
    </template>

    <template v-else-if="node.type === 'queuePriority'">
      <NeTextInput
        :model-value="node.data.description"
        :label="t('visual_plan.fields.name')"
        :invalid-message="err('description')"
        :disabled="disabled"
        @update:model-value="set('description', $event)"
      />
      <NeTextInput
        :model-value="numberText(node.data.priority)"
        type="number"
        :label="t('visual_plan.fields.priority')"
        :helper-text="t('visual_plan.fields.priority_helper')"
        :invalid-message="err('priority')"
        :disabled="disabled"
        @update:model-value="set('priority', toInt($event))"
      />
    </template>

    <template v-else-if="node.type === 'other'">
      <NeInlineNotification
        kind="info"
        :title="t('visual_plan.other_destination_title')"
        :description="t('visual_plan.other_destination_description')"
      />
      <NeTextInput
        :model-value="node.data.destination"
        :label="t('visual_plan.fields.destination')"
        disabled
      />
    </template>
  </div>
</template>
