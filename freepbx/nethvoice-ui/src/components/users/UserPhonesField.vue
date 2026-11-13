<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeButton,
  NeCombobox,
  NeFormItemLabel,
  NeInlineNotification,
  NeSkeleton,
  NeTooltip,
  type NeComboboxOption,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCirclePlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { faOfficePhone } from '@nethesis/nethesis-solid-svg-icons'
import { getPhoneWebPassword } from '@/lib/phones/defaults'
import { formatMac } from '@/lib/phones/mac'
import { applyPhoneChanges, planPhoneChanges } from '@/lib/users/userPhones'
import { MAX_DEVICES_PER_USER, type UserDevice } from '@/lib/users/users'
import { usePhoneDefaults } from '@/queries/phones/defaults'
import { usePhones } from '@/queries/phones/phones'
import { describeError } from '@/stores/notifications'

const {
  username,
  maxPhones,
  disabled = false,
  disabledReason = '',
  phonesWithoutMac = [],
} = defineProps<{
  username: string
  maxPhones: number
  disabled?: boolean
  disabledReason?: string
  phonesWithoutMac?: UserDevice[]
}>()

const selectedMacs = defineModel<string[]>({ required: true })

const { t } = useI18n()
const { phones: phonesList, loading, error } = usePhones()
const { state: phoneDefaultsState } = usePhoneDefaults()

const phones = computed(() => phonesList.value)

let lastRowId = 0
const nextRowId = () => (lastRowId += 1)
const rowIds = ref<number[]>([])

watch(
  () => selectedMacs.value.length,
  (length) => {
    if (rowIds.value.length !== length) {
      rowIds.value = Array.from({ length }, nextRowId)
    }
  },
  { immediate: true },
)

const save = async (currentMacs: string[], mainExtension: string, extensionChanged: boolean) => {
  const plan = planPhoneChanges(phones.value, currentMacs, selectedMacs.value, extensionChanged)

  if (plan.assign.length === 0 && plan.unassign.length === 0) {
    return
  }
  await applyPhoneChanges(
    plan,
    mainExtension,
    getPhoneWebPassword(phoneDefaultsState.value.data),
    phoneDefaultsState.value.data?.encryptionByDefault ?? false,
  )
}

defineExpose({ save })

const limitReached = computed(() => selectedMacs.value.length >= maxPhones)

const phoneOptions = computed<NeComboboxOption[]>(() =>
  phones.value
    .filter((phone) => phone.user === null || phone.user.username === username)
    .map((phone) => ({
      id: phone.mac,
      label: formatMac(phone.mac),
      description: phone.modelLabel || phone.vendor,
    })),
)

const optionsByRow = computed<NeComboboxOption[][]>(() =>
  selectedMacs.value.map((_, index) =>
    phoneOptions.value.filter(
      (option) => !selectedMacs.value.some((mac, other) => other !== index && mac === option.id),
    ),
  ),
)

function setPhone(index: number, mac: string | NeComboboxOption[]) {
  if (typeof mac !== 'string' || selectedMacs.value[index] === mac) {
    return
  }
  selectedMacs.value = selectedMacs.value.map((current, position) =>
    position === index && typeof mac === 'string' ? mac : current,
  )
}

function addPhone() {
  rowIds.value = [...rowIds.value, nextRowId()]
  selectedMacs.value = [...selectedMacs.value, '']
}

function removePhone(index: number) {
  rowIds.value = rowIds.value.filter((_, position) => position !== index)
  selectedMacs.value = selectedMacs.value.filter((_, position) => position !== index)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <NeFormItemLabel class="!mb-0 flex justify-between">
      {{ t('users.physical_phones') }}
      <span class="text-secondary-neutral font-normal">{{ t('common.optional') }}</span>
    </NeFormItemLabel>
    <NeSkeleton v-if="loading" :lines="2" />
    <NeInlineNotification
      v-else-if="error"
      kind="error"
      :title="t('users.cannot_load_phones')"
      :description="describeError(error)"
    />
    <template v-else>
      <p v-if="disabled && disabledReason" class="text-secondary-neutral text-sm">
        {{ disabledReason }}
      </p>
      <template v-if="phonesWithoutMac.length > 0">
        <p
          v-for="device in phonesWithoutMac"
          :key="device.id"
          class="text-primary-neutral flex items-center gap-2"
          data-testid="user-phone-without-mac"
        >
          <FontAwesomeIcon :icon="faOfficePhone" class="size-4 shrink-0" aria-hidden="true" />
          {{ t('users.phone_without_mac', { extension: device.extension }) }}
        </p>
        <p class="text-secondary-neutral text-sm">{{ t('users.phones_without_mac_helper') }}</p>
      </template>
      <div
        v-for="(mac, index) in selectedMacs"
        :key="rowIds[index] ?? `row-${index}`"
        class="flex items-start gap-2"
        data-testid="user-phone-row"
      >
        <NeCombobox
          :model-value="mac"
          :options="optionsByRow[index] ?? []"
          :placeholder="t('users.choose_phone')"
          :disabled="disabled"
          :aria-label="t('users.physical_phone_n', { n: index + 1 })"
          class="grow"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('users.no_phones_available')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
          @update:model-value="setPhone(index, $event)"
        />
        <NeTooltip trigger-event="mouseenter focus" placement="top">
          <template #trigger>
            <NeButton
              kind="tertiary"
              size="sm"
              class="mt-1"
              :disabled="disabled"
              @click="removePhone(index)"
            >
              <FontAwesomeIcon :icon="faTrash" class="size-4" aria-hidden="true" />
              <span class="sr-only">{{ t('users.remove_phone_n', { n: index + 1 }) }}</span>
            </NeButton>
          </template>
          <template #content>{{ t('common.remove') }}</template>
        </NeTooltip>
      </div>
      <div>
        <NeTooltip v-if="limitReached && !disabled" trigger-event="mouseenter focus">
          <template #trigger>
            <span tabindex="0" class="inline-flex rounded-md" data-testid="add-phone-limit">
              <NeButton kind="tertiary" size="sm" disabled>
                <template #prefix>
                  <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
                </template>
                {{ t('users.add_phone') }}
              </NeButton>
            </span>
          </template>
          <template #content>
            {{ t('users.device_limit_reached', { max: MAX_DEVICES_PER_USER }) }}
          </template>
        </NeTooltip>
        <NeButton v-else kind="tertiary" size="sm" :disabled="disabled" @click="addPhone">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
          </template>
          {{ t('users.add_phone') }}
        </NeButton>
      </div>
    </template>
  </div>
</template>
