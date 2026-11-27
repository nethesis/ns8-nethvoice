<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeButton,
  NeInlineNotification,
  NeListbox,
  NeTextInput,
  NeTooltip,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faArrowDown,
  faArrowUp,
  faChevronDown,
  faChevronUp,
  faCircleInfo,
  faCirclePlus,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import type { Focusable } from '@/lib/common'
import type { FieldIssues } from '@/lib/integrations/validation'
import {
  gateIssueKey,
  isGateCodeLocked,
  issueParams,
  newGateForm,
  relayOfGate,
  syncDoorGates,
  type DoorRelay,
  type GateForm,
  type GateMethod,
  type GateType,
} from '@/lib/integrations/videoSources'

const {
  issues,
  relays = [],
  limit,
  disabled = false,
  cti,
} = defineProps<{
  issues: FieldIssues
  relays?: DoorRelay[]
  limit: number
  disabled?: boolean
  cti: string
}>()

const gates = defineModel<GateForm[]>({ required: true })

const emit = defineEmits<{ clearIssue: [key: string] }>()

const { t, te } = useI18n()
const expanded = ref<string[]>([])
const fieldRefs = new Map<string, Focusable>()
const sectionRef = useTemplateRef<HTMLElement>('sectionRef')

const typeOptions = computed(() => [
  { id: 'dtmf', label: t('integrations.video.gate_type_dtmf') },
  { id: 'url', label: t('integrations.video.gate_type_url') },
])

const methodOptions = [
  { id: 'GET', label: 'GET' },
  { id: 'POST', label: 'POST' },
]

const atLimit = computed(() => gates.value.length >= limit)

function issueText(key: string): string {
  const issue = issues[key]
  return issue ? (te(issue) ? t(issue, issueParams(issue)) : issue) : ''
}

function gateTitle(gate: GateForm, index: number): string {
  return gate.name.trim() || t('integrations.video.gate_n', { n: index + 1 })
}

function setFieldRef(uid: string, field: string, element: unknown) {
  const key = `${uid}.${field}`

  if (element && typeof element === 'object' && 'focus' in element) {
    fieldRefs.set(key, element as Focusable)
  } else {
    fieldRefs.delete(key)
  }
}

function isExpanded(uid: string) {
  return expanded.value.includes(uid)
}

function toggle(uid: string) {
  expanded.value = isExpanded(uid)
    ? expanded.value.filter((item) => item !== uid)
    : [...expanded.value, uid]
}

function expand(uids: string[]) {
  expanded.value = [...new Set([...expanded.value, ...uids])]
}

async function focusField(uid: string, field: string) {
  expand([uid])
  await nextTick()
  fieldRefs.get(`${uid}.${field}`)?.focus()
}

function update(index: number, changes: Partial<GateForm>) {
  const gate = gates.value[index]

  if (!gate) {
    return
  }
  for (const field of Object.keys(changes)) {
    emit('clearIssue', gateIssueKey(gate.uid, field))
  }
  const next = gates.value.map((item, position) =>
    position === index ? { ...item, ...changes } : item,
  )
  gates.value = 'type' in changes ? syncDoorGates(next, relays) : next
}

function addGate() {
  const gate = newGateForm()

  gates.value = syncDoorGates([...gates.value, gate], relays)
  emit('clearIssue', 'gates')
  void focusField(gate.uid, 'name')
}

async function focusControl(id: string) {
  await nextTick()
  sectionRef.value?.querySelector<HTMLElement>(`#${id}`)?.focus()
}

function removeGate(index: number) {
  const gate = gates.value[index]

  if (gate) {
    for (const field of ['name', 'code', 'url', 'method', 'username', 'password', 'type']) {
      emit('clearIssue', gateIssueKey(gate.uid, field))
    }
  }
  emit('clearIssue', 'gates')
  const next = syncDoorGates(
    gates.value.filter((_gate, position) => position !== index),
    relays,
  )
  const neighbour = next[index] ?? next[index - 1]

  gates.value = next

  void focusControl(neighbour ? `gate-toggle-${neighbour.uid}` : 'gate-add')
}

function move(index: number, delta: number) {
  const target = index + delta
  const next = [...gates.value]
  const [gate] = next.splice(index, 1)

  if (!gate || target < 0 || target > next.length) {
    return
  }
  next.splice(target, 0, gate)
  gates.value = syncDoorGates(next, relays)
  const atEdge = target === 0 || target === next.length - 1
  const direction = delta < 0 !== atEdge ? 'up' : 'down'

  void focusControl(`gate-${direction}-${gate.uid}`)
}

function usernameHelper(gate: GateForm): string {
  return relayOfGate(gate, relays)?.url ? t('integrations.video.relay_username_helper') : ''
}

function codeHelper(gate: GateForm): string {
  return isGateCodeLocked(gate, relays)
    ? t('integrations.video.relay_code_helper', { n: gate.relay })
    : t('integrations.video.dtmf_helper')
}

defineExpose({ expand, focusField })
</script>

<template>
  <section ref="sectionRef">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="flex items-center gap-2 text-sm font-medium">
        {{ t('integrations.video.gates') }}
        <NeTooltip trigger-event="mouseenter focus">
          <template #trigger>
            <button
              type="button"
              class="focus:ring-primary-500 dark:focus:ring-primary-300 inline-flex rounded-sm focus:ring-2 focus:outline-hidden"
              :aria-label="t('integrations.video.gates_info_label')"
            >
              <FontAwesomeIcon
                :icon="faCircleInfo"
                class="text-secondary size-4"
                aria-hidden="true"
              />
            </button>
          </template>
          <template #content>
            {{ t('integrations.video.gates_info', { cti }) }}
          </template>
        </NeTooltip>
      </h3>
      <span class="text-secondary-neutral text-sm">{{ t('common.optional') }}</span>
    </div>
    <NeInlineNotification
      v-if="relays.length > 0"
      kind="info"
      :title="t('integrations.video.door_phone_relays')"
      class="mb-4"
    >
      <template #description>
        <div v-for="relay in relays" :key="relay.relay" class="not-first:mt-2">
          <div class="font-medium">{{ t('integrations.video.relay_n', { n: relay.relay }) }}</div>
          <div v-if="relay.code">
            {{ t('integrations.video.relay_dtmf_code', { code: relay.code }) }}
          </div>
          <div v-if="relay.url" class="break-all">
            {{ t('integrations.video.relay_url', { url: relay.url }) }}
          </div>
        </div>
      </template>
    </NeInlineNotification>
    <div v-if="gates.length > 0" class="mb-4 space-y-2">
      <div
        v-for="(gate, index) in gates"
        :key="gate.uid"
        class="border-secondary bg-elevation-2 rounded-md border px-4 py-3"
      >
        <div class="flex items-center justify-between gap-2">
          <button
            :id="`gate-toggle-${gate.uid}`"
            type="button"
            class="focus:ring-primary-500 dark:focus:ring-primary-300 min-w-0 flex-1 truncate rounded-sm text-left text-sm font-medium focus:ring-2 focus:outline-hidden"
            :aria-expanded="isExpanded(gate.uid)"
            :aria-controls="`gate-body-${gate.uid}`"
            @click="toggle(gate.uid)"
          >
            {{ gateTitle(gate, index) }}
          </button>
          <div class="flex shrink-0 items-center">
            <NeTooltip trigger-event="mouseenter focus">
              <template #trigger>
                <NeButton
                  :id="`gate-up-${gate.uid}`"
                  kind="tertiary"
                  :disabled="disabled || index === 0"
                  @click="move(index, -1)"
                >
                  <FontAwesomeIcon :icon="faArrowUp" class="size-4" aria-hidden="true" />
                  <span class="sr-only">
                    {{ t('integrations.video.move_up_name', { name: gateTitle(gate, index) }) }}
                  </span>
                </NeButton>
              </template>
              <template #content>{{ t('integrations.video.move_up') }}</template>
            </NeTooltip>
            <NeTooltip trigger-event="mouseenter focus">
              <template #trigger>
                <NeButton
                  :id="`gate-down-${gate.uid}`"
                  kind="tertiary"
                  :disabled="disabled || index === gates.length - 1"
                  @click="move(index, 1)"
                >
                  <FontAwesomeIcon :icon="faArrowDown" class="size-4" aria-hidden="true" />
                  <span class="sr-only">
                    {{ t('integrations.video.move_down_name', { name: gateTitle(gate, index) }) }}
                  </span>
                </NeButton>
              </template>
              <template #content>{{ t('integrations.video.move_down') }}</template>
            </NeTooltip>
            <NeTooltip trigger-event="mouseenter focus">
              <template #trigger>
                <NeButton
                  kind="tertiary"
                  :aria-expanded="isExpanded(gate.uid)"
                  :aria-controls="`gate-body-${gate.uid}`"
                  @click="toggle(gate.uid)"
                >
                  <FontAwesomeIcon
                    :icon="isExpanded(gate.uid) ? faChevronUp : faChevronDown"
                    class="size-4"
                    aria-hidden="true"
                  />
                  <span class="sr-only">
                    {{
                      isExpanded(gate.uid)
                        ? t('integrations.video.collapse_name', { name: gateTitle(gate, index) })
                        : t('integrations.video.expand_name', { name: gateTitle(gate, index) })
                    }}
                  </span>
                </NeButton>
              </template>
              <template #content>
                {{
                  isExpanded(gate.uid)
                    ? t('integrations.video.collapse_name', { name: gateTitle(gate, index) })
                    : t('integrations.video.expand_name', { name: gateTitle(gate, index) })
                }}
              </template>
            </NeTooltip>
          </div>
        </div>
        <div v-show="isExpanded(gate.uid)" :id="`gate-body-${gate.uid}`" class="space-y-6 pt-3">
          <NeTextInput
            :id="`gate-name-${gate.uid}`"
            :ref="(element) => setFieldRef(gate.uid, 'name', element)"
            :model-value="gate.name"
            :label="t('integrations.name')"
            :placeholder="t('integrations.video.gate_name_placeholder')"
            :invalid-message="issueText(gateIssueKey(gate.uid, 'name'))"
            :disabled="disabled"
            @update:model-value="update(index, { name: String($event) })"
          />
          <NeListbox
            :ref="(element) => setFieldRef(gate.uid, 'type', element)"
            :model-value="gate.type"
            :label="t('integrations.video.gate_type')"
            :options="typeOptions"
            :invalid-message="issueText(gateIssueKey(gate.uid, 'type'))"
            :disabled="disabled"
            :no-options-label="t('ne_combobox.no_options_label')"
            :optional-label="t('common.optional')"
            @update:model-value="update(index, { type: $event as GateType })"
          />
          <NeTextInput
            v-if="gate.type === 'dtmf'"
            :ref="(element) => setFieldRef(gate.uid, 'code', element)"
            :model-value="gate.code"
            :label="t('integrations.video.dtmf_code')"
            :placeholder="t('integrations.video.dtmf_placeholder')"
            :helper-text="codeHelper(gate)"
            :invalid-message="issueText(gateIssueKey(gate.uid, 'code'))"
            :readonly="isGateCodeLocked(gate, relays)"
            :disabled="disabled"
            @update:model-value="update(index, { code: String($event) })"
          />
          <template v-else>
            <NeListbox
              :ref="(element) => setFieldRef(gate.uid, 'method', element)"
              :model-value="gate.method"
              :label="t('integrations.video.request_method')"
              :options="methodOptions"
              :invalid-message="issueText(gateIssueKey(gate.uid, 'method'))"
              :disabled="disabled"
              :no-options-label="t('ne_combobox.no_options_label')"
              :optional-label="t('common.optional')"
              @update:model-value="update(index, { method: $event as GateMethod })"
            />
            <NeTextInput
              :ref="(element) => setFieldRef(gate.uid, 'url', element)"
              :model-value="gate.url"
              :label="t('integrations.url')"
              :placeholder="t('integrations.video.gate_url_placeholder')"
              :helper-text="t('integrations.video.gate_url_helper')"
              :invalid-message="issueText(gateIssueKey(gate.uid, 'url'))"
              :disabled="disabled"
              @update:model-value="update(index, { url: String($event) })"
            />
            <NeTextInput
              :ref="(element) => setFieldRef(gate.uid, 'username', element)"
              :model-value="gate.username"
              :label="t('integrations.video.username')"
              :placeholder="t('integrations.video.username_placeholder')"
              :helper-text="usernameHelper(gate)"
              :invalid-message="issueText(gateIssueKey(gate.uid, 'username'))"
              :disabled="disabled"
              optional
              :optional-label="t('common.optional')"
              @update:model-value="update(index, { username: String($event) })"
            />
            <NeTextInput
              :ref="(element) => setFieldRef(gate.uid, 'password', element)"
              :model-value="gate.password"
              :label="t('integrations.password')"
              :helper-text="gate.hasPassword ? t('integrations.password_keep_helper') : ''"
              :invalid-message="issueText(gateIssueKey(gate.uid, 'password'))"
              :disabled="disabled"
              is-password
              optional
              :optional-label="t('common.optional')"
              :show-password-label="t('ne_text_input.show_password')"
              :hide-password-label="t('ne_text_input.hide_password')"
              autocomplete="new-password"
              @update:model-value="update(index, { password: String($event) })"
            />
          </template>
          <NeButton kind="tertiary" class="-ml-2.5" :disabled="disabled" @click="removeGate(index)">
            <template #prefix>
              <FontAwesomeIcon :icon="faTrash" class="size-4" aria-hidden="true" />
            </template>
            {{ t('integrations.video.delete_gate') }}
            <span class="sr-only">{{ gateTitle(gate, index) }}</span>
          </NeButton>
        </div>
      </div>
    </div>
    <p v-if="issues.gates" class="text-danger mb-4 text-sm">{{ issueText('gates') }}</p>
    <NeTooltip v-if="atLimit" trigger-event="mouseenter focus">
      <template #trigger>
        <span
          tabindex="0"
          class="focus:ring-primary-500 dark:focus:ring-primary-300 inline-block rounded-md focus:ring-2 focus:outline-hidden"
        >
          <NeButton kind="secondary" disabled>
            <template #prefix>
              <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
            </template>
            {{ t('integrations.video.add_gate') }}
          </NeButton>
        </span>
      </template>
      <template #content>{{ t('integrations.video.gate_limit', { max: limit }) }}</template>
    </NeTooltip>
    <NeButton v-else id="gate-add" kind="secondary" :disabled="disabled" @click="addGate">
      <template #prefix>
        <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
      </template>
      {{ t('integrations.video.add_gate') }}
    </NeButton>
  </section>
</template>
