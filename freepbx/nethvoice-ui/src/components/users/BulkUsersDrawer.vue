<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@pinia/colada'
import {
  NeButton,
  NeCombobox,
  NeFormItemLabel,
  NeInlineNotification,
  NeModal,
  NeMultiselectCombobox,
  NeProgressBar,
  NeSideDrawer,
  NeToggle,
  type NeMultiselectComboboxOption,
} from '@nethesis/vue-components'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import {
  assignProfileToUsers,
  BulkUserError,
  exceedsDeviceLimit,
  getDisablingPlans,
  planDevicesForUsers,
  setDevicesForUsers,
  setVoicemailForUsers,
  type BulkDevicesPlan,
} from '@/lib/users/bulk'
import type { UsersDirectory } from '@/lib/users/directory'
import {
  hasMainExtension,
  MAX_DEVICES_PER_USER,
  SOFTWARE_DEVICE_TYPES,
  type User,
} from '@/lib/users/users'
import { useInvalidateUsers } from '@/queries/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'

export type BulkUsersAction = 'profile' | 'voicemail' | 'devices'

const {
  isShown = false,
  action,
  users,
  directory,
} = defineProps<{
  isShown: boolean
  action: BulkUsersAction
  users: User[]
  directory: UsersDirectory
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const invalidateUsers = useInvalidateUsers()

const selectedUsers = ref<NeMultiselectComboboxOption[]>([])
const profileId = ref('')
const voicemail = ref(true)
const devices = ref<NeMultiselectComboboxOption[]>([])
const progress = ref(0)
const usersIssue = ref('')
const profileIssue = ref('')
const disablingPlans = ref<BulkDevicesPlan[]>([])
const isShownDisableModal = ref(false)
const isShownDiscardModal = ref(false)
const usersRef = useTemplateRef<{ focus(): void }>('usersRef')
const profileRef = useTemplateRef<{ focus(): void }>('profileRef')

const selectableUsers = computed(() =>
  action === 'profile' ? users : users.filter(hasMainExtension),
)

const deviceOptions = computed<NeMultiselectComboboxOption[]>(() =>
  SOFTWARE_DEVICE_TYPES.map((device) => ({ id: device, label: t(`users.device_${device}`) })),
)

const TEXTS = {
  profile: {
    title: 'users.assign_profile',
    success: 'users.profile_assigned',
    failure: 'users.cannot_assign_profile',
  },
  voicemail: {
    title: 'users.set_voicemail',
    success: 'users.voicemail_updated',
    failure: 'users.cannot_set_voicemail',
  },
  devices: {
    title: 'users.set_devices',
    success: 'users.devices_updated',
    failure: 'users.cannot_set_devices',
  },
} as const

const texts = computed(() => TEXTS[action])

const targetUsers = () =>
  selectableUsers.value.filter((user) =>
    selectedUsers.value.some((option) => option.id === user.username),
  )

const devicePlans = () =>
  planDevicesForUsers(
    targetUsers(),
    SOFTWARE_DEVICE_TYPES.filter((device) => devices.value.some((option) => option.id === device)),
  )

const userOptions = computed<NeMultiselectComboboxOption[]>(() =>
  selectableUsers.value.map((user) => ({
    id: user.username,
    label: user.username,
    description: user.displayName,
  })),
)

const profileOptions = computed(() =>
  directory.profiles.map((profile) => ({ id: String(profile.id), label: profile.name })),
)

watch(
  () => isShown,
  (shown) => {
    if (shown) {
      selectedUsers.value = []
      profileId.value = ''
      voicemail.value = true
      devices.value = []
      progress.value = 0
      usersIssue.value = ''
      profileIssue.value = ''
      disablingPlans.value = []
      isShownDisableModal.value = false
      isShownDiscardModal.value = false
      reset()
      setTimeout(() => usersRef.value?.focus(), 300)
    }
  },
)

const {
  mutate,
  isLoading: saving,
  error,
  reset,
} = useMutation({
  mutation: async () => {
    const targets = targetUsers()
    const onProgress = (value: number) => {
      progress.value = value
    }
    progress.value = 0

    if (action === 'profile') {
      await assignProfileToUsers(targets, Number(profileId.value), onProgress)
    } else if (action === 'voicemail') {
      await setVoicemailForUsers(targets, voicemail.value, onProgress)
    } else {
      await setDevicesForUsers(devicePlans(), onProgress)
    }
    return targets.length
  },
  onSuccess(count) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t(texts.value.success),
        description: t('users.users_updated_description', { count }, count),
      })
    }, 500)
    emit('close')
  },
  onError(failure) {
    if (!isShown) {
      notificationsStore.createNotification({
        kind: 'error',
        title: t(texts.value.failure),
        description: describeBulkError(failure),
      })
    }
  },
  onSettled() {
    invalidateUsers()
  },
})

const describeBulkError = (failure: unknown): string => {
  if (!(failure instanceof BulkUserError)) {
    return describeError(failure)
  }
  const detail = t('users.bulk_failed_for', {
    username: failure.username,
    detail: describeError(failure.cause),
  })

  return failure.completed.length > 0
    ? `${detail} ${t(
        'users.bulk_completed_before_error',
        { count: failure.completed.length, users: failure.completed.join(', ') },
        failure.completed.length,
      )}`
    : detail
}

const errorDescription = computed(() => describeBulkError(error.value))

const isDirty = computed(
  () =>
    selectedUsers.value.length > 0 ||
    profileId.value !== '' ||
    !voicemail.value ||
    devices.value.length > 0,
)

const describeDevices = (plan: BulkDevicesPlan) =>
  plan.disable.map((device) => t(`users.device_${device}`)).join(', ')

function findUsersIssue(): string {
  if (selectedUsers.value.length === 0) {
    return t('users.choose_at_least_one_user')
  }

  if (action === 'devices') {
    const overLimit = devicePlans().filter(exceedsDeviceLimit)

    if (overLimit.length > 0) {
      return t('users.devices_limit_exceeded', {
        max: MAX_DEVICES_PER_USER,
        users: overLimit.map((plan) => plan.user.username).join(', '),
      })
    }
  }
  return ''
}

watch([selectedUsers, devices], () => {
  if (usersIssue.value) {
    usersIssue.value = findUsersIssue()
  }
})

watch(profileId, (id) => {
  if (id !== '') {
    profileIssue.value = ''
  }
})

function save() {
  reset()
  usersIssue.value = findUsersIssue()
  profileIssue.value =
    action === 'profile' && profileId.value === '' ? t('users.profile_required') : ''

  if (usersIssue.value) {
    usersRef.value?.focus()
  } else if (profileIssue.value) {
    profileRef.value?.focus()
  } else if (action === 'devices' && getDisablingPlans(devicePlans()).length > 0) {
    disablingPlans.value = getDisablingPlans(devicePlans())
    isShownDisableModal.value = true
  } else {
    mutate()
  }
}

function confirmDisable() {
  isShownDisableModal.value = false
  mutate()
}

function requestClose() {
  if (saving.value || isShownDiscardModal.value || isShownDisableModal.value) {
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
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="t(texts.title)"
    :close-aria-label="t('common.close')"
    @close="requestClose"
  >
    <form class="flex flex-col gap-6" novalidate @submit.prevent="save">
      <NeMultiselectCombobox
        ref="usersRef"
        v-model="selectedUsers"
        :label="t('users.users')"
        :options="userOptions"
        :placeholder="t('users.choose_users')"
        :helper-text="action === 'profile' ? '' : t('users.voicemail_needs_extension')"
        :invalid-message="usersIssue"
        :disabled="saving"
        :no-results-label="t('ne_combobox.no_results')"
        :limited-options-label="t('ne_combobox.limited_options_label')"
        :no-options-label="t('ne_combobox.no_options_label')"
        :user-input-label="t('ne_combobox.user_input_label')"
        :optional-label="t('common.optional')"
        :remove-label="t('common.remove')"
      />
      <NeCombobox
        v-if="action === 'profile'"
        ref="profileRef"
        v-model="profileId"
        :label="t('users.profile')"
        :options="profileOptions"
        :placeholder="t('users.choose_profile')"
        :invalid-message="profileIssue"
        :disabled="saving"
        :no-results-label="t('ne_combobox.no_results')"
        :limited-options-label="t('ne_combobox.limited_options_label')"
        :no-options-label="t('ne_combobox.no_options_label')"
        :selected-label="t('ne_combobox.selected')"
        :user-input-label="t('ne_combobox.user_input_label')"
        :optional-label="t('common.optional')"
      />
      <div v-else-if="action === 'voicemail'" class="flex flex-col gap-2">
        <NeFormItemLabel class="!mb-0">{{ t('users.voicemail') }}</NeFormItemLabel>
        <NeToggle
          v-model="voicemail"
          :label="voicemail ? t('common.enabled') : t('common.disabled')"
          :disabled="saving"
        />
      </div>
      <NeMultiselectCombobox
        v-else
        v-model="devices"
        :label="t('users.devices')"
        :options="deviceOptions"
        :placeholder="t('users.choose_devices')"
        :helper-text="t('users.bulk_devices_helper')"
        :disabled="saving"
        :no-results-label="t('ne_combobox.no_results')"
        :limited-options-label="t('ne_combobox.limited_options_label')"
        :no-options-label="t('ne_combobox.no_options_label')"
        :user-input-label="t('ne_combobox.user_input_label')"
        :optional-label="t('common.optional')"
        :remove-label="t('common.remove')"
      />
      <NeProgressBar
        v-if="saving"
        :progress="progress"
        :label="t('users.updating_users')"
        show-progress
      />
      <NeInlineNotification
        v-if="error"
        kind="error"
        :title="t(texts.failure)"
        :description="errorDescription"
      />
      <div class="flex justify-end gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
        <NeButton kind="tertiary" :disabled="saving" @click="requestClose">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton kind="primary" type="submit" :loading="saving" :disabled="saving">
          {{ action === 'profile' ? t('users.assign') : t('common.save') }}
        </NeButton>
      </div>
    </form>
    <DiscardChangesModal
      :visible="isShownDiscardModal"
      @close="isShownDiscardModal = false"
      @discard="discardChanges"
    />
    <NeModal
      :visible="isShownDisableModal"
      :title="t('users.disable_devices')"
      kind="warning"
      :primary-label="t('users.disable_devices')"
      primary-button-kind="danger"
      :cancel-label="t('common.cancel')"
      :close-aria-label="t('common.close')"
      @close="isShownDisableModal = false"
      @primary-click="confirmDisable"
    >
      <p>
        {{
          t(
            'users.disable_devices_confirmation',
            { count: disablingPlans.length },
            disablingPlans.length,
          )
        }}
      </p>
      <ul class="mt-3 flex max-h-60 flex-col gap-1 overflow-y-auto" data-testid="disabling-devices">
        <li v-for="plan in disablingPlans" :key="plan.user.username">
          <span class="text-primary-neutral font-medium">{{ plan.user.displayName }}</span>
          ({{ plan.user.username }}): {{ describeDevices(plan) }}
        </li>
      </ul>
      <p class="mt-3">{{ t('users.disable_devices_credentials') }}</p>
    </NeModal>
  </NeSideDrawer>
</template>
