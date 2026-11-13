<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import {
  NeButton,
  NeCombobox,
  NeInlineNotification,
  NeMultiselectCombobox,
  NeSideDrawer,
  NeSkeleton,
  NeTextInput,
  type NeComboboxOption,
  type NeMultiselectComboboxOption,
} from '@nethesis/vue-components'
import LoadError from '@/components/common/LoadError.vue'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import {
  BULK_DESTINATIONS_KEY,
  BULK_SETTINGS_KEY,
  buildBulkRequest,
  DEFAULT_DESTINATION,
  EMPTY_ADVANCED_BULK_FORM,
  getBulkSettings,
  getDestinations,
  postBulkSettings,
  validateAdvancedBulk,
  type AdvancedBulkField,
  type AdvancedBulkForm,
  type AdvancedBulkIssues,
} from '@/lib/users/bulk'
import { hasMainExtension, type User } from '@/lib/users/users'
import { useInvalidateUsers } from '@/queries/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { isShown = false, users } = defineProps<{
  isShown: boolean
  users: User[]
}>()

const emit = defineEmits<{ close: [] }>()

const DESTINATION_FIELDS = [
  { field: 'noanswerdest', label: 'users.no_answer_destination' },
  { field: 'busydest', label: 'users.busy_destination' },
  { field: 'notreachabledest', label: 'users.not_reachable_destination' },
] as const

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const queryCache = useQueryCache()
const invalidateUsers = useInvalidateUsers()

const selectedUsers = ref<NeMultiselectComboboxOption[]>([])
const edits = ref<Partial<AdvancedBulkForm>>({})
const issues = ref<AdvancedBulkIssues>({})
const usersIssue = ref('')
const noChanges = ref(false)
const isShownDiscardModal = ref(false)
const usersRef = useTemplateRef<{ focus(): void }>('usersRef')
const ringtimeRef = useTemplateRef<{ focus(): void }>('ringtimeRef')
const outboundcidRef = useTemplateRef<{ focus(): void }>('outboundcidRef')
const digitsRef = useTemplateRef<{ focus(): void }>('digitsRef')

const selectableUsers = computed(() => users.filter(hasMainExtension))

const userOptions = computed<NeMultiselectComboboxOption[]>(() =>
  selectableUsers.value.map((user) => ({
    id: user.username,
    label: user.username,
    description: user.displayName,
  })),
)

const mainExtensions = computed(() =>
  selectableUsers.value
    .filter((user) => selectedUsers.value.some((option) => option.id === user.username))
    .map((user) => user.mainExtension)
    .sort(),
)

const { state: settingsState, refetch: refetchSettings } = useQuery({
  key: () => [BULK_SETTINGS_KEY, mainExtensions.value.join(',')],
  enabled: () => isShown && mainExtensions.value.length > 0,
  query: () => getBulkSettings(mainExtensions.value),
})

const { state: destinationsState } = useQuery({
  key: () => [BULK_DESTINATIONS_KEY],
  enabled: () => isShown,
  query: () => getDestinations(),
})

const initial = computed(() => settingsState.value.data ?? EMPTY_ADVANCED_BULK_FORM)
const form = computed<AdvancedBulkForm>(() => ({ ...initial.value, ...edits.value }))
const settingsReady = computed(
  () => mainExtensions.value.length > 0 && settingsState.value.status === 'success',
)

const callWaitingOptions = computed<NeComboboxOption[]>(() => [
  { id: 'enabled', label: t('common.enabled') },
  { id: 'disabled', label: t('common.disabled') },
])

const destinationOptions = computed<NeComboboxOption[]>(() => [
  { id: DEFAULT_DESTINATION, label: t('users.bulk_default_destination') },
  ...(destinationsState.value.data ?? []).map((destination) => ({
    id: destination.id,
    label: destination.label,
    description: destination.category,
  })),
])

const optionsFor = (field: AdvancedBulkField): NeComboboxOption[] => {
  const value = initial.value[field]

  if (value === '' || destinationOptions.value.some((option) => option.id === value)) {
    return destinationOptions.value
  }
  return [...destinationOptions.value, { id: value, label: value }]
}

watch(
  () => isShown,
  (shown) => {
    if (shown) {
      selectedUsers.value = []
      edits.value = {}
      issues.value = {}
      usersIssue.value = ''
      noChanges.value = false
      isShownDiscardModal.value = false
      reset()
      setTimeout(() => usersRef.value?.focus(), 300)
    }
  },
)

function setField(field: AdvancedBulkField, value: string) {
  edits.value = { ...edits.value, [field]: value }
  noChanges.value = false
  issues.value = Object.fromEntries(Object.entries(issues.value).filter(([key]) => key !== field))
}

const issueFor = (field: AdvancedBulkField) => {
  const issue = issues.value[field]
  return issue ? t(issue) : ''
}

const {
  mutate,
  isLoading: saving,
  error,
  reset,
} = useMutation({
  mutation: async (body: ReturnType<typeof buildBulkRequest>) => {
    await postBulkSettings(mainExtensions.value, body)
    return mainExtensions.value.length
  },
  onSuccess(count) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('users.settings_updated'),
        description: t('users.users_updated_description', { count }, count),
      })
    }, 500)
    emit('close')
  },
  onError(failure) {
    if (!isShown) {
      notificationsStore.createNotification({
        kind: 'error',
        title: t('users.cannot_update_settings'),
        description: describeError(failure),
      })
    }
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [BULK_SETTINGS_KEY] })
    invalidateUsers()
  },
})

const isDirty = computed(
  () => selectedUsers.value.length > 0 || Object.keys(edits.value).length > 0,
)

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

watch(mainExtensions, (extensions) => {
  if (extensions.length > 0) {
    usersIssue.value = ''
  }
})

function save() {
  reset()
  usersIssue.value = mainExtensions.value.length === 0 ? t('users.choose_at_least_one_user') : ''

  if (usersIssue.value) {
    usersRef.value?.focus()
    return
  }

  if (!settingsReady.value) {
    return
  }
  issues.value = validateAdvancedBulk(form.value)

  if (issues.value.ringtime) {
    ringtimeRef.value?.focus()
  } else if (issues.value.outboundcid) {
    outboundcidRef.value?.focus()
  } else if (issues.value.outboundcidDigits) {
    digitsRef.value?.focus()
  }

  if (Object.keys(issues.value).length > 0) {
    return
  }
  const body = buildBulkRequest(initial.value, form.value)
  noChanges.value = Object.keys(body).length === 0

  if (!noChanges.value) {
    mutate(body)
  }
}

const comboboxLabels = computed(() => ({
  noResultsLabel: t('ne_combobox.no_results'),
  limitedOptionsLabel: t('ne_combobox.limited_options_label'),
  noOptionsLabel: t('ne_combobox.no_options_label'),
  selectedLabel: t('ne_combobox.selected'),
  userInputLabel: t('ne_combobox.user_input_label'),
  optionalLabel: t('common.optional'),
}))
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="t('users.advanced_bulk_actions')"
    :close-aria-label="t('common.close')"
    @close="requestClose"
  >
    <form class="flex flex-col gap-6" novalidate @submit.prevent="save">
      <p class="text-secondary-neutral text-sm">{{ t('users.advanced_bulk_description') }}</p>
      <NeMultiselectCombobox
        ref="usersRef"
        v-model="selectedUsers"
        :label="t('users.users')"
        :options="userOptions"
        :placeholder="t('users.choose_users')"
        :helper-text="t('users.voicemail_needs_extension')"
        :invalid-message="usersIssue"
        :disabled="saving"
        :no-results-label="t('ne_combobox.no_results')"
        :limited-options-label="t('ne_combobox.limited_options_label')"
        :no-options-label="t('ne_combobox.no_options_label')"
        :user-input-label="t('ne_combobox.user_input_label')"
        :optional-label="t('common.optional')"
        :remove-label="t('common.remove')"
      />
      <LoadError
        v-if="mainExtensions.length > 0 && settingsState.status === 'error'"
        :error="settingsState.error"
        :title="t('users.cannot_load_settings')"
        @retry="refetchSettings()"
      />
      <NeSkeleton
        v-else-if="mainExtensions.length > 0 && !settingsReady"
        :lines="8"
        data-testid="bulk-settings-loading"
      />
      <template v-else-if="settingsReady">
        <NeTextInput
          :model-value="form.displayname"
          :label="t('users.display_name')"
          :helper-text="t('users.bulk_display_name_helper')"
          :placeholder="t('users.keep_current_values')"
          :disabled="saving"
          @update:model-value="setField('displayname', $event)"
        />
        <NeCombobox
          :model-value="form.callwaiting"
          :label="t('users.call_waiting')"
          :options="callWaitingOptions"
          :placeholder="t('users.keep_current_values')"
          :disabled="saving"
          v-bind="comboboxLabels"
          @update:model-value="setField('callwaiting', String($event))"
        />
        <NeTextInput
          ref="ringtimeRef"
          :model-value="form.ringtime"
          :label="t('users.ring_time')"
          :helper-text="t('users.bulk_ringtime_helper')"
          :placeholder="t('users.keep_current_values')"
          :invalid-message="issueFor('ringtime')"
          :disabled="saving"
          inputmode="numeric"
          @update:model-value="setField('ringtime', $event)"
        />
        <NeTextInput
          :model-value="form.callgroup"
          :label="t('users.call_groups')"
          :helper-text="t('users.bulk_groups_helper')"
          :placeholder="t('users.keep_current_values')"
          :disabled="saving"
          @update:model-value="setField('callgroup', $event)"
        />
        <NeTextInput
          :model-value="form.pickupgroup"
          :label="t('users.pickup_groups')"
          :helper-text="t('users.bulk_groups_helper')"
          :placeholder="t('users.keep_current_values')"
          :disabled="saving"
          @update:model-value="setField('pickupgroup', $event)"
        />
        <div class="flex flex-col gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
          <h3 class="text-primary-neutral text-sm font-medium">
            {{ t('users.call_destinations') }}
          </h3>
          <NeCombobox
            v-for="item in DESTINATION_FIELDS"
            :key="item.field"
            :model-value="form[item.field]"
            :label="t(item.label)"
            :options="optionsFor(item.field)"
            :placeholder="t('users.keep_current_values')"
            :disabled="saving || destinationsState.status === 'pending'"
            :loading-options="destinationsState.status === 'pending'"
            show-options-type
            v-bind="comboboxLabels"
            @update:model-value="setField(item.field, String($event))"
          />
        </div>
        <div class="flex flex-col gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
          <h3 class="text-primary-neutral text-sm font-medium">
            {{ t('users.outbound_caller_id') }}
          </h3>
          <NeTextInput
            ref="outboundcidRef"
            :model-value="form.outboundcid"
            :label="t('users.caller_id')"
            :helper-text="t('users.bulk_outboundcid_helper')"
            :placeholder="t('users.keep_current_values')"
            :invalid-message="issueFor('outboundcid')"
            :disabled="saving"
            @update:model-value="setField('outboundcid', $event)"
          />
          <NeTextInput
            ref="digitsRef"
            :model-value="form.outboundcidDigits"
            :label="t('users.extension_digits')"
            :helper-text="t('users.bulk_outboundcid_digits_helper')"
            :invalid-message="issueFor('outboundcidDigits')"
            :disabled="saving"
            :optional-label="t('common.optional')"
            optional
            inputmode="numeric"
            @update:model-value="setField('outboundcidDigits', $event)"
          />
        </div>
      </template>
      <NeInlineNotification v-if="noChanges" kind="warning" :title="t('users.bulk_no_changes')" />
      <NeInlineNotification
        v-if="error"
        kind="error"
        :title="t('users.cannot_update_settings')"
        :description="describeError(error)"
      />
      <div class="flex justify-end gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
        <NeButton kind="tertiary" :disabled="saving" @click="requestClose">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton kind="primary" type="submit" :loading="saving" :disabled="saving">
          {{ t('common.save') }}
        </NeButton>
      </div>
    </form>
    <DiscardChangesModal
      :visible="isShownDiscardModal"
      @close="isShownDiscardModal = false"
      @discard="discardChanges"
    />
  </NeSideDrawer>
</template>
