<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  focusElement,
  NeButton,
  NeCombobox,
  NeInlineNotification,
  NeSideDrawer,
  NeTextInput,
  NeToggle,
  type NeComboboxOption,
} from '@nethesis/vue-components'
import { USERS_KEY, type User } from '@/lib/users/users'
import { formatMac } from '@/lib/phones/mac'
import { filterModelsByVendor, PHONE_MODELS_KEY, type PhoneModel } from '@/lib/phones/models'
import { PHONE_ENCRYPTION_KEY } from '@/lib/phones/encryption'
import {
  getAssignableUsers,
  getUserLabel,
  PHONES_KEY,
  updatePhone,
  type Phone,
  type PhoneChanges,
} from '@/lib/phones/phones'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const {
  isShown = false,
  phone = undefined,
  models = [],
  users = [],
  webPassword = '',
  defaultEncrypted = true,
} = defineProps<{
  isShown?: boolean
  phone?: Phone
  models?: PhoneModel[]
  users?: User[]
  webPassword?: string
  defaultEncrypted?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const model = ref('')
const mainExtension = ref('')
const encrypted = ref(false)
const modelIssue = ref('')
const modelRef = useTemplateRef<InstanceType<typeof NeCombobox>>('modelRef')

const comboboxLabels = computed(() => ({
  noResultsLabel: t('ne_combobox.no_results'),
  limitedOptionsLabel: t('ne_combobox.limited_options_label'),
  noOptionsLabel: t('ne_combobox.no_options_label'),
  selectedLabel: t('ne_combobox.selected'),
  userInputLabel: t('ne_combobox.user_input_label'),
  optionalLabel: t('common.optional'),
}))

const modelOptions = computed<NeComboboxOption[]>(() =>
  filterModelsByVendor(models, phone?.vendor ?? '').map((item) => ({
    id: item.name,
    label: item.displayName,
  })),
)

const userOptions = computed<NeComboboxOption[]>(() =>
  getAssignableUsers(users).map((user) => ({
    id: user.mainExtension,
    label: getUserLabel(user),
    description: user.mainExtension,
  })),
)

const userChanged = computed(
  () => !!phone && mainExtension.value !== (phone.user?.mainExtension ?? ''),
)

const {
  mutate: savePhoneMutate,
  isLoading: saving,
  reset: savePhoneReset,
  error: savePhoneError,
} = useMutation({
  mutation: ({ target, changes }: { target: Phone; changes: PhoneChanges }) =>
    updatePhone(target, changes, webPassword),
  onSuccess(_data, { target, changes }) {
    const modelLabel = models.find((item) => item.name === changes.model)?.displayName
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('phones.inventory.phone_updated'),
        description: t('phones.inventory.phone_updated_description', {
          name: modelLabel ?? formatMac(target.mac),
        }),
      })
    }, 500)
    emit('close')
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
    if (!shown || !phone) {
      return
    }
    savePhoneReset()
    model.value = phone.model
    mainExtension.value = phone.user?.mainExtension ?? ''
    encrypted.value = phone.user ? phone.encrypted : defaultEncrypted
    modelIssue.value = ''
    focusElement(modelRef)
  },
)

watch(mainExtension, (current, previous) => {
  if (phone && !previous && current && !phone.user) {
    encrypted.value = defaultEncrypted
  }
})

function save() {
  if (!phone) {
    return
  }
  savePhoneReset()

  if (!model.value) {
    modelIssue.value = 'phones.inventory.model_required'
    focusElement(modelRef)
    return
  }
  modelIssue.value = ''
  savePhoneMutate({
    target: phone,
    changes: { model: model.value, mainExtension: mainExtension.value, encrypted: encrypted.value },
  })
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="$t('phones.inventory.edit_phone')"
    :close-aria-label="$t('shell.close_side_drawer')"
    @close="emit('close')"
  >
    <form novalidate @submit.prevent="save">
      <div class="flex flex-col gap-8">
        <NeTextInput
          :model-value="phone ? formatMac(phone.mac) : ''"
          :label="$t('phones.mac_address')"
          :helper-text="$t('phones.inventory.mac_read_only')"
          readonly
          disabled
        />
        <NeCombobox
          ref="modelRef"
          v-model="model"
          :label="$t('phones.model')"
          :options="modelOptions"
          :placeholder="$t('phones.inventory.choose_model')"
          :invalid-message="modelIssue ? $t(modelIssue) : ''"
          :disabled="saving"
          v-bind="comboboxLabels"
        />
        <NeCombobox
          v-model="mainExtension"
          :label="$t('phones.user')"
          :options="userOptions"
          :placeholder="$t('phones.inventory.choose_user')"
          :helper-text="userChanged && phone?.user ? $t('phones.inventory.user_change_helper') : ''"
          :disabled="saving"
          optional
          :show-selected-label="false"
          v-bind="comboboxLabels"
        />
        <NeToggle
          v-model="encrypted"
          :top-label="$t('phones.inventory.encryption')"
          :label="encrypted ? $t('common.enabled') : $t('common.disabled')"
          :disabled="saving || !mainExtension"
        />
        <p v-if="!mainExtension" class="text-tertiary-neutral -mt-6 text-sm">
          {{ $t('phones.inventory.encryption_requires_user') }}
        </p>
        <NeInlineNotification
          v-if="savePhoneError"
          kind="error"
          :title="$t('phones.inventory.cannot_save_phone')"
          :description="describeError(savePhoneError)"
        />
      </div>
      <hr class="my-8 border-gray-200 dark:border-gray-700" />
      <div class="flex justify-end gap-6">
        <NeButton kind="tertiary" size="lg" :disabled="saving" @click.prevent="emit('close')">
          {{ $t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="saving" :loading="saving">
          {{ $t('common.save') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
