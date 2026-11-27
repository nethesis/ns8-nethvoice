<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  focusElement,
  NeInlineNotification,
  NeModal,
  NeRadioSelection,
  NeTextInput,
} from '@nethesis/vue-components'
import {
  getGatewayLinePort,
  getTrunkCallDestination,
  getTrunkCallStatus,
  isTrunkCallBlocked,
  TRUNK_CALL_NUMBER_MAX_LENGTH,
  validateTrunkCallNumber,
  type TrunkCallLine,
} from '@/lib/trunks/trunkCall'
import { stripTrailingPeriod, type Focusable } from '@/lib/common'
import { useFocusReturn } from '@/composables/useFocusReturn'
import { useAdminPhoneStore } from '@/stores/adminPhone'

const {
  visible = false,
  name = '',
  lines = [],
} = defineProps<{
  visible: boolean
  name: string
  lines: TrunkCallLine[]
}>()

const emit = defineEmits<{ close: [] }>()

const FOCUS_DELAY = 300

const { t } = useI18n()
const adminPhoneStore = useAdminPhoneStore()

const number = ref('')
const lineId = ref('')
const numberIssue = ref('')
const numberRef = useTemplateRef<Focusable>('numberRef')

useFocusReturn(() => visible)

const lineOptions = computed(() =>
  lines.map((line) => {
    const port = getGatewayLinePort(line.name)

    return {
      id: String(line.trunkId),
      label: port ? t('trunks.call.line_port', port) : line.name,
    }
  }),
)

const status = computed(() =>
  getTrunkCallStatus({
    phoneState: adminPhoneStore.state,
    phoneEnabled: adminPhoneStore.isEnabled,
    inCall: adminPhoneStore.inCall,
    otherTabInCall: adminPhoneStore.otherTabInCall,
  }),
)

const isBlocked = computed(() => isTrunkCallBlocked(status.value))

const phoneNotice = computed(() => {
  switch (status.value) {
    case 'in_call':
      return t('trunks.call.phone_in_call')
    case 'in_call_elsewhere':
      return t('admin_phone.status_elsewhere_in_call')
    case 'connection_lost':
      return t('admin_phone.status_connection_lost')
    case 'phone_error':
      return t('admin_phone.status_error', {
        error: stripTrailingPeriod(adminPhoneStore.errorMessage),
      })
    case 'elsewhere':
      return t('admin_phone.status_elsewhere')
    default:
      return ''
  }
})

watch(
  () => visible,
  (isVisible) => {
    if (!isVisible) {
      return
    }
    number.value = ''
    numberIssue.value = ''
    lineId.value = lines[0] ? String(lines[0].trunkId) : ''
    setTimeout(() => focusElement(numberRef), FOCUS_DELAY)
  },
)

function call() {
  if (isBlocked.value || !lineId.value) {
    return
  }
  const issue = validateTrunkCallNumber(number.value)
  numberIssue.value = issue ? t(issue, { max: TRUNK_CALL_NUMBER_MAX_LENGTH }) : ''

  if (issue) {
    focusElement(numberRef)
    return
  }
  void adminPhoneStore.call(getTrunkCallDestination(Number(lineId.value), number.value))
  emit('close')
}
</script>

<template>
  <NeModal
    :visible="visible"
    :title="t('trunks.call.title')"
    :primary-label="t('trunks.call.call')"
    :cancel-label="t('common.cancel')"
    :primary-button-disabled="isBlocked"
    :close-aria-label="t('common.close')"
    @close="emit('close')"
    @primary-click="call"
  >
    <form class="flex flex-col gap-6" novalidate @submit.prevent="call">
      <p>{{ t('trunks.call.description', { name }) }}</p>
      <NeInlineNotification
        v-if="phoneNotice"
        :kind="isBlocked ? 'warning' : 'info'"
        :title="isBlocked ? t('trunks.call.cannot_call') : t('trunks.call.administrator_phone')"
        :description="phoneNotice"
        data-testid="trunk-call-phone-notice"
      />
      <NeRadioSelection
        v-if="lineOptions.length > 1"
        v-model="lineId"
        :label="t('trunks.call.line')"
        :options="lineOptions"
      />
      <NeTextInput
        ref="numberRef"
        v-model="number"
        :label="t('trunks.call.phone_number')"
        :placeholder="t('trunks.voip.phone_number_placeholder')"
        :invalid-message="numberIssue"
        inputmode="tel"
        autocomplete="off"
        @blur="number = number.trim()"
      />
    </form>
  </NeModal>
</template>
