<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import { useMediaQuery } from '@vueuse/core'
import {
  NeButton,
  NeCombobox,
  NeInlineNotification,
  NeModal,
  NeTextArea,
  NeTextInput,
  type NeComboboxOption,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import type { User } from '@/lib/users/users'
import { USERS_KEY } from '@/lib/users/users'
import {
  formatMac,
  getMacVendor,
  isUnicastMac,
  parseMacList,
  type MacVendors,
} from '@/lib/phones/mac'
import {
  filterModelsByVendor,
  getModelBrand,
  guessModelName,
  type PhoneModel,
} from '@/lib/phones/models'
import {
  addPhone,
  getAssignableUsers,
  getUserLabel,
  isPhoneAlreadyRegistered,
  isUserAtDeviceLimit,
  MAX_NEW_PHONES,
  MissingWebPasswordError,
  PhoneAssignmentError,
  PHONES_KEY,
  validateNewPhoneRows,
  type NewPhoneRowIssues,
} from '@/lib/phones/phones'
import { PHONE_ENCRYPTION_KEY } from '@/lib/phones/encryption'
import { PHONE_MODELS_KEY } from '@/lib/phones/models'
import { describeError, useNotificationsStore } from '@/stores/notifications'

type Row = {
  key: number
  mac: string
  model: string
  mainExtension: string
  issues: NewPhoneRowIssues
  error: string
  added: boolean
}

type AddResult = { added: number; rpsFailed: number; notAssigned: number; failed: number }

const {
  isShown = false,
  existingMacs = [],
  models = [],
  users = [],
  macVendors = {},
  webPassword = '',
  encrypted = true,
} = defineProps<{
  isShown?: boolean
  existingMacs?: string[]
  models?: PhoneModel[]
  users?: User[]
  macVendors?: MacVendors
  webPassword?: string
  encrypted?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const step = ref<1 | 2>(1)
const macsText = ref('')
const macsIssue = ref('')
const rows = ref<Row[]>([])
const modelForAll = ref('')
const appliedToAll = ref<{ applied: number; total: number } | null>(null)
const progress = ref({ current: 0, total: 0 })
const macsTextRef = useTemplateRef<InstanceType<typeof NeTextArea>>('macsTextRef')
const macRefs: (InstanceType<typeof NeTextInput> | null)[] = []
const isMediumScreen = useMediaQuery('(min-width: 768px)')
let nextKey = 0

const comboboxLabels = computed(() => ({
  noResultsLabel: t('ne_combobox.no_results'),
  limitedOptionsLabel: t('ne_combobox.limited_options_label'),
  noOptionsLabel: t('ne_combobox.no_options_label'),
  selectedLabel: t('ne_combobox.selected'),
  userInputLabel: t('ne_combobox.user_input_label'),
  optionalLabel: t('common.optional'),
}))

const toModelOptions = (list: PhoneModel[]): NeComboboxOption[] =>
  list.map((model) => ({ id: model.name, label: model.displayName }))

const allModelOptions = computed(() => toModelOptions(models))

const userOptions = computed<NeComboboxOption[]>(() =>
  getAssignableUsers(users).map((user) => {
    const atLimit = isUserAtDeviceLimit(user)

    return {
      id: user.mainExtension,
      label: getUserLabel(user),
      description: atLimit
        ? t('phones.inventory.user_device_limit_reached', { extension: user.mainExtension })
        : user.mainExtension,
      disabled: atLimit,
    }
  }),
)

const pendingRows = computed(() => rows.value.filter((row) => !row.added))

const vendorOf = (mac: string) => getMacVendor(mac, macVendors)

const modelOptionsByVendor = computed(() => {
  const options = new Map<string, NeComboboxOption[]>()

  for (const vendor of ['', ...new Set(Object.values(macVendors))]) {
    options.set(vendor, toModelOptions(filterModelsByVendor(models, vendor)))
  }
  return options
})

const modelOptionsFor = (row: Row): NeComboboxOption[] =>
  modelOptionsByVendor.value.get(vendorOf(row.mac)) ?? allModelOptions.value

const {
  mutate: addPhonesMutate,
  isLoading: adding,
  reset: addPhonesReset,
  error: addPhonesError,
} = useMutation({
  mutation: async (pending: Row[]): Promise<AddResult> => {
    const result: AddResult = { added: 0, rpsFailed: 0, notAssigned: 0, failed: 0 }

    if (!webPassword) {
      throw new MissingWebPasswordError()
    }
    progress.value = { current: 0, total: pending.length }

    for (const row of pending) {
      progress.value = { current: progress.value.current + 1, total: pending.length }

      try {
        const added = await addPhone(row, getModelBrand(row.model), { webPassword, encrypted })
        result.added += 1
        result.rpsFailed += added.rpsFailed ? 1 : 0
        rows.value = rows.value.filter((item) => item.key !== row.key)
      } catch (error) {
        if (error instanceof PhoneAssignmentError) {
          result.added += 1
          result.notAssigned += 1
        } else {
          result.failed += 1
        }
        markRowError(row.key, error)
      }
    }
    return result
  },
  onSuccess(result) {
    if (result.added > 0) {
      setTimeout(() => {
        notificationsStore.createNotification({
          kind: 'success',
          title: t('phones.inventory.phones_added', result.added),
          description: t('phones.inventory.phones_added_description', result.added),
        })

        if (result.rpsFailed > 0) {
          notificationsStore.createNotification({
            kind: 'warning',
            title: t('phones.inventory.rps_failed', result.rpsFailed),
            description: t('phones.inventory.rps_failed_description'),
          })
        }

        if (result.notAssigned > 0) {
          notificationsStore.createNotification({
            kind: 'warning',
            title: t('phones.inventory.phones_not_assigned', result.notAssigned),
            description: t('phones.inventory.phones_not_assigned_description', result.notAssigned),
          })
        }
      }, 500)
    }

    if (result.failed === 0) {
      emit('close')
    }
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [PHONES_KEY] })
    queryCache.invalidateQueries({ key: [PHONE_MODELS_KEY] })
    queryCache.invalidateQueries({ key: [USERS_KEY] })
    queryCache.invalidateQueries({ key: [PHONE_ENCRYPTION_KEY] })
  },
})

watch(
  () => isShown,
  (shown) => {
    if (!shown || adding.value) {
      return
    }
    addPhonesReset()
    step.value = 1
    macsText.value = ''
    macsIssue.value = ''
    rows.value = []
    modelForAll.value = ''
    appliedToAll.value = null
    nextTick(() => macsTextRef.value?.focus())
  },
)

function markRowError(key: number, error: unknown) {
  const row = rows.value.find((item) => item.key === key)

  if (!row) {
    return
  }

  if (isPhoneAlreadyRegistered(error)) {
    row.issues = { ...row.issues, mac: 'phones.inventory.mac_already_exists' }
  } else if (error instanceof PhoneAssignmentError) {
    row.error = t('phones.inventory.added_but_not_assigned', {
      error: describeError(error.reason),
    })
    row.added = true
  } else if (error instanceof MissingWebPasswordError) {
    row.error = t('phones.inventory.admin_password_missing_description')
  } else {
    row.error = describeError(error)
  }
}

function setMacRef(index: number, element: unknown) {
  macRefs[index] = element ? (element as InstanceType<typeof NeTextInput>) : null
}

function buildRow(mac: string): Row {
  nextKey += 1
  return {
    key: nextKey,
    mac: formatMac(mac),
    model: guessModelName(mac, vendorOf(mac), models),
    mainExtension: '',
    issues: {},
    error: '',
    added: false,
  }
}

function goToStep2() {
  const macs = parseMacList(macsText.value)

  const invalidMacs = macs.filter((mac) => !isUnicastMac(mac))

  if (macs.length === 0) {
    macsIssue.value = t('phones.inventory.enter_at_least_one_mac')
  } else if (macs.length > MAX_NEW_PHONES) {
    macsIssue.value = t('phones.inventory.too_many_macs', { max: MAX_NEW_PHONES, n: macs.length })
  } else if (invalidMacs.length > 0) {
    macsIssue.value = t(
      'phones.inventory.invalid_macs',
      { macs: invalidMacs.join(', ') },
      invalidMacs.length,
    )
  } else {
    macsIssue.value = ''
  }

  if (macsIssue.value) {
    macsTextRef.value?.focus()
    return
  }
  rows.value = macs.map(buildRow)
  appliedToAll.value = null
  step.value = 2
  validateRows(false)
}

function goToStep1() {
  macsText.value = rows.value.map((row) => row.mac).join('\n')
  step.value = 1
  nextTick(() => macsTextRef.value?.focus())
}

function validateRows(includeModels: boolean): boolean {
  const issues = validateNewPhoneRows(rows.value, existingMacs)
  let firstInvalid = -1

  rows.value.forEach((row, index) => {
    if (row.added) {
      row.issues = {}
      return
    }
    row.issues = includeModels ? issues[index] : { mac: issues[index].mac }

    if (firstInvalid < 0 && (row.issues.mac || row.issues.model)) {
      firstInvalid = index
    }
  })

  if (firstInvalid >= 0 && includeModels) {
    macRefs[firstInvalid]?.focus()
  }
  return firstInvalid < 0
}

function clearModelIssue(row: Row) {
  if (row.issues.model) {
    row.issues = { ...row.issues, model: undefined }
  }
}

function onMacChanged(row: Row) {
  if (row.issues.mac) {
    row.issues = { ...row.issues, mac: undefined }
  }

  if (row.error) {
    row.error = ''
  }

  if (!row.model) {
    row.model = guessModelName(row.mac, vendorOf(row.mac), models)
  }
}

function applyModelToAll() {
  if (!modelForAll.value) {
    return
  }
  let applied = 0

  for (const row of pendingRows.value) {
    if (modelOptionsFor(row).some((option) => option.id === modelForAll.value)) {
      row.model = modelForAll.value
      clearModelIssue(row)
      applied += 1
    }
  }
  appliedToAll.value = { applied, total: pendingRows.value.length }
}

function removeRow(key: number) {
  rows.value = rows.value.filter((row) => row.key !== key)

  if (rows.value.length === 0) {
    goToStep1()
  }
}

function submit() {
  if (step.value === 1) {
    goToStep2()
    return
  }
  addPhonesReset()

  for (const row of pendingRows.value) {
    row.error = ''
  }

  if (!validateRows(true)) {
    return
  }

  if (pendingRows.value.length === 0) {
    emit('close')
    return
  }
  addPhonesMutate(pendingRows.value.map((row) => ({ ...row })))
}

function requestClose() {
  if (adding.value) {
    return
  }
  emit('close')
}

const isLabelShown = (index: number) => index === 0 || !isMediumScreen.value

const rowIssue = (issue: string | undefined) => (issue ? t(issue) : '')
</script>

<template>
  <NeModal
    :visible="isShown"
    :title="
      step === 1 ? $t('phones.inventory.add_phones') : $t('phones.inventory.configure_phones')
    "
    :size="step === 1 ? 'md' : 'xxl'"
    :primary-label="step === 1 ? $t('common.next') : $t('common.add')"
    :secondary-label="step === 2 ? $t('common.previous') : ''"
    secondary-button-kind="tertiary"
    :cancel-label="$t('common.cancel')"
    :primary-button-loading="adding"
    :primary-button-disabled="adding"
    :secondary-button-disabled="adding"
    :close-aria-label="$t('common.close')"
    @close="requestClose"
    @primary-click="submit"
    @secondary-click="goToStep1"
  >
    <form novalidate @submit.prevent="submit">
      <template v-if="step === 1">
        <p class="mb-6">{{ $t('phones.inventory.add_phones_description') }}</p>
        <NeTextArea
          ref="macsTextRef"
          v-model="macsText"
          :label="$t('phones.inventory.mac_addresses')"
          :helper-text="$t('phones.inventory.mac_addresses_helper')"
          :invalid-message="macsIssue"
          :rows="5"
        />
      </template>
      <template v-else>
        <p class="mb-6">{{ $t('phones.inventory.configure_phones_description') }}</p>
        <div class="mb-8 flex flex-wrap items-end gap-4">
          <NeCombobox
            v-model="modelForAll"
            :label="$t('phones.inventory.apply_model_to_all')"
            :options="allModelOptions"
            :placeholder="$t('phones.inventory.choose_model')"
            :disabled="adding"
            class="w-full max-w-sm"
            v-bind="comboboxLabels"
          />
          <NeButton
            kind="secondary"
            :disabled="adding || !modelForAll"
            @click.prevent="applyModelToAll"
          >
            {{ $t('phones.inventory.apply_to_all') }}
          </NeButton>
        </div>
        <NeInlineNotification
          v-if="appliedToAll && appliedToAll.applied < appliedToAll.total"
          kind="info"
          :title="
            $t('phones.inventory.model_applied_to_some', {
              applied: appliedToAll.applied,
              total: appliedToAll.total,
            })
          "
          :description="$t('phones.inventory.model_applied_to_some_description')"
          class="-mt-4 mb-8"
        />
        <h4 class="text-primary-neutral mb-4 text-base font-medium">
          {{ $t('phones.inventory.n_phones_to_configure', rows.length) }}
        </h4>
        <p v-if="adding" class="text-secondary-neutral mb-4 text-sm" role="status">
          {{
            $t('phones.inventory.adding_progress', {
              current: progress.current,
              total: progress.total,
            })
          }}
        </p>
        <NeInlineNotification
          v-if="addPhonesError"
          kind="error"
          :title="$t('phones.inventory.cannot_add_phones')"
          :description="describeError(addPhonesError)"
          class="mb-4"
        />
        <ul class="flex flex-col gap-4 pb-44">
          <li
            v-for="(row, index) in rows"
            :key="row.key"
            class="grid grid-cols-1 items-start gap-4 border-gray-200 md:grid-cols-[1fr_1fr_1fr_auto] dark:border-gray-700"
            :class="index > 0 ? 'border-t pt-4 md:border-t-0 md:pt-0' : ''"
            :data-testid="`phone-row-${index}`"
          >
            <NeTextInput
              :ref="(element) => setMacRef(index, element)"
              v-model="row.mac"
              :label="isLabelShown(index) ? $t('phones.mac_address') : ''"
              :aria-label="$t('phones.mac_address')"
              :invalid-message="rowIssue(row.issues.mac)"
              :disabled="adding || row.added"
              @update:model-value="onMacChanged(row)"
            />
            <NeCombobox
              v-model="row.model"
              :label="isLabelShown(index) ? $t('phones.model') : ''"
              :aria-label="$t('phones.model')"
              :options="modelOptionsFor(row)"
              :placeholder="$t('phones.inventory.choose_model')"
              :invalid-message="rowIssue(row.issues.model)"
              :disabled="adding || row.added"
              v-bind="comboboxLabels"
              @update:model-value="clearModelIssue(row)"
            />
            <NeCombobox
              v-model="row.mainExtension"
              :label="isLabelShown(index) ? $t('phones.user') : ''"
              :aria-label="$t('phones.user')"
              :options="userOptions"
              :placeholder="$t('phones.inventory.choose_user')"
              :disabled="adding || row.added"
              optional
              :show-selected-label="false"
              v-bind="comboboxLabels"
            />
            <NeButton
              kind="tertiary"
              :class="isLabelShown(index) ? 'md:mt-8' : ''"
              :disabled="adding"
              @click.prevent="removeRow(row.key)"
            >
              <FontAwesomeIcon :icon="faTrash" class="size-4" aria-hidden="true" />
              <span class="sr-only">{{
                $t('phones.inventory.remove_phone', { mac: row.mac })
              }}</span>
            </NeButton>
            <p
              v-if="row.error"
              class="text-sm md:col-span-4"
              :class="
                row.added
                  ? 'text-amber-700 dark:text-amber-500'
                  : 'text-rose-700 dark:text-rose-400'
              "
            >
              {{ row.error }}
            </p>
          </li>
        </ul>
      </template>
      <button type="submit" class="hidden" aria-hidden="true" tabindex="-1" />
    </form>
  </NeModal>
</template>
