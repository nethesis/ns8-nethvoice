<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch, type ShallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  NeButton,
  NeCombobox,
  NeInlineNotification,
  NeMultiselectCombobox,
  NeSideDrawer,
  NeTextInput,
  NeToggle,
  NeTooltip,
  type NeMultiselectComboboxOption,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import {
  getAddedProviderCodecs,
  getEmptyVoipTrunkForm,
  getVoipTrunkForm,
  isEmptyUpdateTrunkRequest,
  normalizePhoneNumber,
  patchTrunk,
  postTrunk,
  toCreateTrunkRequest,
  toUpdateTrunkRequest,
  TRUNK_NAME_MAX_LENGTH,
  TRUNKS_KEY,
  usesNameAsUsername,
  validateVoipTrunkForm,
  type Trunk,
  type VoipTrunkField,
  type VoipTrunkForm,
  type VoipTrunkValidationIssues,
} from '@/lib/trunks/trunks'
import { getCodecLabel, getProviderName, getSelectableCodecs } from '@/lib/trunks/providers'
import { markTrunkChanged, TRUNKS_LIVE_STATE_KEY } from '@/lib/trunks/liveState'
import type { Focusable } from '@/lib/common'
import { useTrunkCodecs, useTrunkProviders } from '@/queries/trunks/trunks'
import { useFocusReturn } from '@/composables/useFocusReturn'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const {
  isShown = false,
  trunk = undefined,
  existingNames = [],
} = defineProps<{
  isShown: boolean
  trunk?: Trunk
  existingNames?: string[]
}>()

const emit = defineEmits<{ close: [] }>()

const FOCUS_DELAY = 300

const FIELD_ORDER: VoipTrunkField[] = [
  'provider',
  'name',
  'phoneNumber',
  'username',
  'password',
  'codecs',
]

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state: providersState, refetch: refetchProviders } = useTrunkProviders()
const { state: codecsState } = useTrunkCodecs()

const form = ref<VoipTrunkForm>(getEmptyVoipTrunkForm())
const validationIssues = ref<VoipTrunkValidationIssues>({})
const initialSnapshot = ref('')
const isShownDiscardModal = ref(false)

useFocusReturn(() => isShown)

const fieldRefs: Record<VoipTrunkField, Readonly<ShallowRef<Focusable | null>>> = {
  provider: useTemplateRef<Focusable>('providerRef'),
  name: useTemplateRef<Focusable>('nameRef'),
  phoneNumber: useTemplateRef<Focusable>('phoneNumberRef'),
  username: useTemplateRef<Focusable>('usernameRef'),
  password: useTemplateRef<Focusable>('passwordRef'),
  codecs: useTemplateRef<Focusable>('codecsRef'),
}

const isEditing = computed(() => trunk !== undefined)

const providers = computed(() => providersState.value.data ?? [])

const providerOptions = computed(() =>
  providers.value.map((provider) => ({ id: provider.id, label: provider.name })),
)

const selectedProvider = computed(() =>
  providers.value.find((provider) => provider.id === form.value.provider),
)

const providerDefaultCodecs = computed(() => selectedProvider.value?.defaultCodecs ?? [])

const isDirty = computed(() => JSON.stringify(form.value) !== initialSnapshot.value)

const codecsHelperText = computed(() => {
  const addedCodecs = getAddedProviderCodecs(form.value, providerDefaultCodecs.value)

  return addedCodecs.length > 0
    ? t('trunks.voip.provider_codecs_added', { codecs: addedCodecs.map(getCodecLabel).join(', ') })
    : t('trunks.voip.allowed_codecs_helper')
})

const currentProviderLabel = computed(() =>
  trunk ? getProviderName(trunk, providers.value) || trunk.sipServer : '',
)

const isUsernameShown = computed(() =>
  isEditing.value ? true : !usesNameAsUsername(form.value.provider),
)

const nameHelperText = computed(() => {
  if (isEditing.value) {
    return t('trunks.voip.name_cannot_be_changed')
  }
  return isUsernameShown.value
    ? t('trunks.voip.trunk_name_helper')
    : t('trunks.voip.trunk_name_username_helper')
})

const codecOptions = computed<NeMultiselectComboboxOption[]>(() =>
  getSelectableCodecs(codecsState.value.data ?? [], selectedProvider.value, form.value.codecs).map(
    (codec) => ({ id: codec, label: getCodecLabel(codec) }),
  ),
)

const selectedCodecs = computed<NeMultiselectComboboxOption[]>({
  get: () => form.value.codecs.map((codec) => ({ id: codec, label: getCodecLabel(codec) })),
  set: (options) => {
    form.value.codecs = options.map((option) => option.id)
  },
})

const {
  mutate: createTrunk,
  isLoading: creating,
  reset: resetCreate,
  error: createError,
} = useMutation({
  mutation: (values: VoipTrunkForm) => postTrunk(toCreateTrunkRequest(values)),
  onSuccess(_data, values) {
    markTrunkChanged(values.name.trim())
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('trunks.trunk_created'),
        description: t('common.object_created_successfully', { name: values.name.trim() }),
      })
    }, 500)
    emit('close')
  },
  onError(error) {
    notifyErrorIfClosed(t('trunks.cannot_create_trunk'), error)
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [TRUNKS_KEY] })
    queryCache.invalidateQueries({ key: [TRUNKS_LIVE_STATE_KEY] })
  },
})

const {
  mutate: updateTrunk,
  isLoading: updating,
  reset: resetUpdate,
  error: updateError,
} = useMutation({
  mutation: ({
    item,
    values,
    defaultCodecs,
  }: {
    item: Trunk
    values: VoipTrunkForm
    defaultCodecs: string[]
  }) => patchTrunk(item.id, toUpdateTrunkRequest(values, item, defaultCodecs)),
  onSuccess(_data, { item }) {
    markTrunkChanged(item.name)
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('trunks.trunk_saved'),
        description: t('common.object_saved_successfully', { name: item.name }),
      })
    }, 500)
    emit('close')
  },
  onError(error) {
    notifyErrorIfClosed(t('trunks.cannot_save_trunk'), error)
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [TRUNKS_KEY] })
    queryCache.invalidateQueries({ key: [TRUNKS_LIVE_STATE_KEY] })
  },
})

const saving = computed(() => creating.value || updating.value)

const saveError = computed(() => createError.value ?? updateError.value)

function notifyErrorIfClosed(title: string, error: unknown) {
  if (!isShown) {
    notificationsStore.createNotificationFromError(error, title)
  }
}

function getTrunkDefaultCodecs(item: Trunk): string[] {
  return providers.value.find((provider) => provider.id === item.provider)?.defaultCodecs ?? []
}

function initForm() {
  form.value = trunk
    ? getVoipTrunkForm(trunk, getTrunkDefaultCodecs(trunk))
    : getEmptyVoipTrunkForm()
  initialSnapshot.value = JSON.stringify(form.value)
}

watch(
  () => isShown,
  (shown) => {
    if (!shown) {
      isShownDiscardModal.value = false
      return
    }
    resetCreate()
    resetUpdate()
    validationIssues.value = {}
    initForm()
    setTimeout(() => fieldRefs[trunk ? 'phoneNumber' : 'provider'].value?.focus(), FOCUS_DELAY)
  },
)

watch(providers, () => {
  if (isShown && trunk && !isDirty.value) {
    initForm()
  }
})

watch(
  () => form.value.provider,
  (provider, previousProvider) => {
    if (!isEditing.value && provider !== previousProvider) {
      form.value.codecs = []
    }
  },
)

function validate(): boolean {
  validationIssues.value = validateVoipTrunkForm(form.value, {
    trunk,
    existingNames,
  })
  const firstInvalidField = FIELD_ORDER.find((field) => validationIssues.value[field])

  if (firstInvalidField) {
    fieldRefs[firstInvalidField].value?.focus()
    return false
  }
  return true
}

function save() {
  resetCreate()
  resetUpdate()

  if (!validate()) {
    return
  }

  if (!trunk) {
    createTrunk({ ...form.value })
    return
  }

  const defaultCodecs = getTrunkDefaultCodecs(trunk)

  if (isEmptyUpdateTrunkRequest(toUpdateTrunkRequest(form.value, trunk, defaultCodecs))) {
    emit('close')
    return
  }
  updateTrunk({ item: trunk, values: { ...form.value }, defaultCodecs })
}

function requestClose() {
  if (saving.value || isShownDiscardModal.value) {
    return
  }

  if (isDirty.value) {
    isShownDiscardModal.value = true
    return
  }
  emit('close')
}

function discardChanges() {
  isShownDiscardModal.value = false
  emit('close')
}

function normalizePhoneNumberField() {
  const phoneNumber = form.value.phoneNumber.trim()

  if (!trunk || phoneNumber !== trunk.phoneNumber) {
    form.value.phoneNumber = normalizePhoneNumber(phoneNumber)
  } else {
    form.value.phoneNumber = phoneNumber
  }
}

function issue(field: VoipTrunkField): string {
  const key = validationIssues.value[field]
  return key ? t(key) : ''
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="isEditing ? t('trunks.voip.edit_trunk') : t('trunks.voip.add_voip_trunk')"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="requestClose"
  >
    <form novalidate @submit.prevent="save">
      <div class="flex flex-col gap-6">
        <NeInlineNotification
          v-if="providersState.status === 'error'"
          kind="error"
          :title="t('trunks.voip.cannot_load_providers')"
          :description="describeError(providersState.error)"
          :primary-button-label="t('common.retry')"
          @primary-click="refetchProviders()"
        />
        <NeTextInput
          v-if="isEditing"
          :label="t('trunks.voip.provider')"
          :model-value="currentProviderLabel || '-'"
          :helper-text="t('trunks.voip.provider_cannot_be_changed')"
          disabled
        />
        <NeCombobox
          v-else
          ref="providerRef"
          v-model="form.provider"
          :label="t('trunks.voip.provider')"
          :options="providerOptions"
          :placeholder="t('trunks.voip.choose_provider')"
          :invalid-message="issue('provider')"
          :disabled="saving || providersState.status === 'pending'"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
        />
        <NeTextInput
          ref="nameRef"
          v-model="form.name"
          :label="t('trunks.voip.trunk_name')"
          :helper-text="nameHelperText"
          :invalid-message="issue('name')"
          :disabled="saving || isEditing"
          :maxlength="TRUNK_NAME_MAX_LENGTH"
          @blur="form.name = form.name.trim()"
        />
        <NeTextInput
          ref="phoneNumberRef"
          v-model="form.phoneNumber"
          :label="t('trunks.voip.phone_number')"
          :helper-text="t('trunks.voip.phone_number_helper')"
          :invalid-message="issue('phoneNumber')"
          :disabled="saving"
          @blur="normalizePhoneNumberField"
        />
        <NeTextInput
          v-if="isUsernameShown"
          ref="usernameRef"
          v-model="form.username"
          :label="t('trunks.voip.username')"
          :helper-text="t('trunks.voip.username_helper')"
          :invalid-message="issue('username')"
          :disabled="saving"
          autocomplete="off"
          @blur="form.username = form.username.trim()"
        />
        <NeTextInput
          ref="passwordRef"
          v-model="form.password"
          is-password
          :label="t('trunks.voip.password')"
          :helper-text="
            isEditing ? t('trunks.voip.password_edit_helper') : t('trunks.voip.password_helper')
          "
          :optional="isEditing"
          :optional-label="t('common.optional')"
          :show-password-label="t('ne_text_input.show_password')"
          :hide-password-label="t('ne_text_input.hide_password')"
          :invalid-message="issue('password')"
          :disabled="saving"
          autocomplete="new-password"
        />
        <NeMultiselectCombobox
          ref="codecsRef"
          v-model="selectedCodecs"
          :label="t('trunks.voip.allowed_codecs')"
          :helper-text="codecsHelperText"
          :options="codecOptions"
          :placeholder="t('ne_combobox.choose_multiple')"
          :invalid-message="issue('codecs')"
          :disabled="saving"
          optional
          :optional-label="t('common.optional')"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :remove-label="t('common.remove')"
        />
        <NeToggle
          v-model="form.forceCodec"
          role="group"
          :aria-label="t('trunks.voip.force_codec')"
          :top-label="t('trunks.voip.force_codec')"
          :label="form.forceCodec ? t('common.enabled') : t('common.disabled')"
          :disabled="saving"
        >
          <template #topTooltip>
            <NeTooltip>
              <template #trigger>
                <button
                  type="button"
                  class="inline-flex text-indigo-500 dark:text-indigo-300"
                  :aria-label="t('trunks.voip.force_codec_info')"
                >
                  <FontAwesomeIcon :icon="faCircleInfo" class="size-4" aria-hidden="true" />
                </button>
              </template>
              <template #content>{{ t('trunks.voip.force_codec_tooltip') }}</template>
            </NeTooltip>
          </template>
        </NeToggle>
        <NeInlineNotification
          v-if="saveError"
          kind="error"
          :title="isEditing ? t('trunks.cannot_save_trunk') : t('trunks.cannot_create_trunk')"
          :description="describeError(saveError)"
        />
      </div>
      <hr class="my-8" />
      <div class="flex justify-end gap-3">
        <NeButton kind="tertiary" size="lg" :disabled="saving" @click.prevent="requestClose">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="saving" :loading="saving">
          {{ isEditing ? t('common.save') : t('trunks.add_trunk') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
  <DiscardChangesModal
    :visible="isShownDiscardModal"
    @close="isShownDiscardModal = false"
    @discard="discardChanges"
  />
</template>
