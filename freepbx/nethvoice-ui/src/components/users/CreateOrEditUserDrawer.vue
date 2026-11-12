<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as v from 'valibot'
import { useMutation } from '@pinia/colada'
import {
  NeButton,
  NeCombobox,
  NeFormItemLabel,
  NeInlineNotification,
  NeMultiselectCombobox,
  NePasswordRequirements,
  NeSideDrawer,
  NeTextInput,
  NeToggle,
  usePasswordRequirements,
  type NeMultiselectComboboxOption,
} from '@nethesis/vue-components'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import UserPhonesField from '@/components/users/UserPhonesField.vue'
import { isApiError } from '@/lib/api/errors'
import { isCsvImportError } from '@/lib/users/csv'
import {
  createUser,
  CreatedUserNotFoundError,
  getFullName,
  getNewUserConflicts,
  NewUserSchema,
  type NewUserField,
} from '@/lib/users/createUser'
import {
  findBaseProfile,
  isDirectoryPartAvailable,
  type UserRow,
  type UsersDirectory,
} from '@/lib/users/directory'
import { getExtensionErrorKind } from '@/lib/users/extensions'
import { getAssignedPhoneMacs, getMaxPhones, getPhonesWithoutMac } from '@/lib/users/userPhones'
import {
  applyUserSettingsSteps,
  getUserSettings,
  planUserSettingsUpdate,
  UserSettingsSchema,
  UserSettingsStepError,
  type UserSettings,
  type UserSettingsStep,
} from '@/lib/users/userSettings'
import {
  findUserByExtension,
  SOFTWARE_DEVICE_TYPES,
  type SoftwareDeviceType,
  type User,
} from '@/lib/users/users'
import { useInvalidateUsers } from '@/queries/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'

type Field = NewUserField | 'profileId'

const {
  isShown = false,
  user = undefined,
  users,
  directory,
  variant = 'admin',
  reservedExtensions = [],
} = defineProps<{
  isShown: boolean
  user?: UserRow
  users: User[]
  directory: UsersDirectory
  variant?: 'admin' | 'setup'
  reservedExtensions?: string[]
}>()

const emit = defineEmits<{ close: []; created: [username: string, extension: string] }>()

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const invalidateUsers = useInvalidateUsers()

const isEdit = computed(() => user !== undefined)
const isSetup = computed(() => variant === 'setup')
const showPhones = computed(() => isEdit.value && !isSetup.value)

const phonesField = useTemplateRef<InstanceType<typeof UserPhonesField>>('phonesField')

const username = ref('')
const name = ref('')
const surname = ref('')
const password = ref('')
const confirmPassword = ref('')
const extension = ref('')
const mobile = ref('')
const voicemail = ref(false)
const profileId = ref('')
const groups = ref<NeMultiselectComboboxOption[]>([])
const devices = ref<NeMultiselectComboboxOption[]>([])
const phoneMacs = ref<string[]>([])
const validationIssues = ref<Partial<Record<Field, string>>>({})
const showPasswordErrors = ref(false)
const initialSnapshot = ref('')
const isShownDiscardModal = ref(false)
const focusAfterSave = ref<'error' | 'extension' | null>(null)
const errorRef = useTemplateRef<HTMLElement>('errorRef')

const usernameRef = useTemplateRef<{ focus(): void }>('usernameRef')
const nameRef = useTemplateRef<{ focus(): void }>('nameRef')
const surnameRef = useTemplateRef<{ focus(): void }>('surnameRef')
const passwordRef = useTemplateRef<{ focus(): void }>('passwordRef')
const confirmPasswordRef = useTemplateRef<{ focus(): void }>('confirmPasswordRef')
const extensionRef = useTemplateRef<{ focus(): void }>('extensionRef')
const mobileRef = useTemplateRef<{ focus(): void }>('mobileRef')
const profileRef = useTemplateRef<{ focus(): void }>('profileRef')

const fieldRefs = computed<Partial<Record<Field, { focus(): void } | null>>>(() => ({
  username: usernameRef.value,
  name: nameRef.value,
  surname: surnameRef.value,
  password: passwordRef.value,
  confirmPassword: confirmPasswordRef.value,
  extension: extensionRef.value,
  mobile: mobileRef.value,
  profileId: profileRef.value,
}))

const { requirements: passwordRequirements } = usePasswordRequirements(password, {
  labels: () => ({
    minLength: t('users.password_rule_min_length', { min: 8 }),
    uppercase: t('users.password_rule_uppercase'),
    lowercase: t('users.password_rule_lowercase'),
    number: t('users.password_rule_number'),
    specialCharacter: t('users.password_rule_special'),
  }),
})

const deviceOptions = computed<NeMultiselectComboboxOption[]>(() =>
  SOFTWARE_DEVICE_TYPES.map((device) => ({ id: device, label: t(`users.device_${device}`) })),
)

const groupOptions = computed<NeMultiselectComboboxOption[]>(() =>
  directory.groups.map((group) => ({ id: String(group.id), label: group.name })),
)

const profileOptions = computed(() =>
  directory.profiles.map((profile) => ({ id: String(profile.id), label: profile.name })),
)

const savedExtension = computed(() => user?.mainExtension ?? '')

const groupsAvailable = computed(() => isDirectoryPartAvailable(directory, 'groups'))
const profilesAvailable = computed(() => isDirectoryPartAvailable(directory, 'profiles'))
const voicemailAvailable = computed(() => isDirectoryPartAvailable(directory, 'voicemails'))
const mobileAvailable = computed(() => isDirectoryPartAvailable(directory, 'mobiles'))

const phonesWithoutMac = computed(() => (user ? getPhonesWithoutMac(user.physicalPhones) : []))

const effectiveExtension = computed(() =>
  isSetup.value ? savedExtension.value : extension.value.trim(),
)

const needsSavedExtension = computed(() => isSetup.value && savedExtension.value === '')

const otherDevicesCount = computed(
  () =>
    devices.value.length +
    phonesWithoutMac.value.length +
    (user?.devices.filter(
      (device) =>
        device.type !== 'physical' &&
        device.type !== 'temporaryphysical' &&
        !SOFTWARE_DEVICE_TYPES.some((type) => type === device.type),
    ).length ?? 0),
)

const title = computed(() =>
  isEdit.value ? t('users.edit_user_name', { name: user?.username ?? '' }) : t('users.create_user'),
)

const toDeviceTypes = (options: NeMultiselectComboboxOption[]): SoftwareDeviceType[] =>
  SOFTWARE_DEVICE_TYPES.filter((type) => options.some((option) => option.id === type))

const nextSettings = (): UserSettings => ({
  extension: effectiveExtension.value,
  mobile: mobile.value,
  voicemail: voicemail.value,
  profileId: profileId.value ? Number(profileId.value) : null,
  groupIds: groups.value.map((group) => Number(group.id)),
  devices: toDeviceTypes(devices.value),
})

const formSnapshot = () =>
  JSON.stringify([
    username.value,
    name.value,
    surname.value,
    password.value,
    confirmPassword.value,
    extension.value.trim(),
    mobile.value,
    voicemail.value,
    profileId.value,
    groups.value.map((group) => group.id),
    devices.value.map((device) => device.id),
    phoneMacs.value,
  ])

const isDirty = computed(() => formSnapshot() !== initialSnapshot.value)

watch(
  () => isShown,
  (shown) => {
    if (!shown) {
      isShownDiscardModal.value = false
      return
    }
    reset()
    focusAfterSave.value = null
    showPasswordErrors.value = false
    password.value = ''
    confirmPassword.value = ''

    if (user) {
      const settings = getUserSettings(user)
      extension.value = settings.extension
      mobile.value = settings.mobile
      voicemail.value = settings.voicemail
      profileId.value = settings.profileId === null ? '' : String(settings.profileId)
      groups.value = groupOptions.value.filter((option) =>
        settings.groupIds.includes(Number(option.id)),
      )
      devices.value = deviceOptions.value.filter((option) =>
        settings.devices.some((device) => device === option.id),
      )
      phoneMacs.value = getAssignedPhoneMacs(user.physicalPhones)
    } else {
      username.value = ''
      name.value = ''
      surname.value = ''
      extension.value = ''
      mobile.value = ''
      voicemail.value = false
      const baseProfile = findBaseProfile(directory.profiles)
      profileId.value = baseProfile ? String(baseProfile.id) : ''
      groups.value = []
      devices.value = deviceOptions.value.filter((option) => option.id === 'webrtc')
      phoneMacs.value = []
    }
    validationIssues.value = {}
    initialSnapshot.value = formSnapshot()
    setTimeout(() => (isEdit.value ? extensionRef.value : usernameRef.value)?.focus(), 300)
  },
)

const clearIssue = (...fields: Field[]) => {
  if (fields.some((field) => validationIssues.value[field])) {
    validationIssues.value = Object.fromEntries(
      Object.entries(validationIssues.value).filter(([key]) => !fields.some((f) => f === key)),
    )
  }
}

watch(username, () => clearIssue('username'))
watch(name, () => clearIssue('name'))
watch(surname, () => clearIssue('surname'))
watch(password, () => clearIssue('password'))
watch(confirmPassword, () => clearIssue('confirmPassword'))
watch(extension, () => clearIssue('extension'))
watch(mobile, () => clearIssue('mobile'))
watch(profileId, () => clearIssue('profileId'))

const {
  mutate,
  isLoading: saving,
  error: saveError,
  reset,
} = useMutation({
  mutation: async () => {
    if (user) {
      const current = getUserSettings(user)
      const next = nextSettings()
      await applyUserSettingsSteps(user, planUserSettingsUpdate(current, next))

      if (showPhones.value && next.extension !== '') {
        await phonesField.value?.save(
          getAssignedPhoneMacs(user.physicalPhones),
          next.extension,
          next.extension !== current.extension,
        )
      }
      return user.username
    }
    const newUser = v.parse(NewUserSchema, {
      username: username.value,
      name: name.value,
      surname: surname.value,
      password: password.value,
      confirmPassword: confirmPassword.value,
      extension: extension.value,
      mobile: mobile.value,
    })
    const settings = nextSettings()
    await createUser(
      newUser,
      isSetup.value ? { ...settings, extension: '', voicemail: false, devices: [] } : settings,
    )
    return newUser.username
  },
  onSuccess(savedUsername) {
    if (!user && isSetup.value) {
      emit('created', savedUsername, extension.value.trim())
    }
    const displayName = user
      ? user.displayName
      : getFullName({ name: name.value, surname: surname.value })
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: user ? t('users.user_updated') : t('users.user_created'),
        description: user
          ? t('common.object_saved_successfully', { name: displayName })
          : t('common.object_created_successfully', { name: displayName }),
      })
    }, 500)
    emit('close')
  },
  onError(error) {
    const cause = error instanceof UserSettingsStepError ? error.cause : error

    if (
      error instanceof UserSettingsStepError &&
      error.step.kind === 'extension' &&
      getExtensionErrorKind(cause) === 'in_use'
    ) {
      validationIssues.value = { extension: 'users.extension_in_use' }
      focusAfterSave.value = 'extension'
    } else {
      focusAfterSave.value = 'error'
    }

    if (!isShown) {
      notificationsStore.createNotification({
        kind: 'error',
        title: getErrorTitle(error),
        description: getErrorDescription(error),
      })
    }
  },
  onSettled() {
    return invalidateUsers()
  },
})

watch(saving, async (isSaving) => {
  if (isSaving || focusAfterSave.value === null) {
    return
  }
  const target = focusAfterSave.value
  focusAfterSave.value = null
  await nextTick()

  if (target === 'extension') {
    extensionRef.value?.focus()
  } else {
    errorRef.value?.focus()
  }
})

const describeStep = (step: UserSettingsStep): string => {
  switch (step.kind) {
    case 'enable_device':
      return t('users.step_done_enable_device', { device: t(`users.device_${step.device}`) })
    case 'disable_device':
      return t('users.step_done_disable_device', { device: t(`users.device_${step.device}`) })
    default:
      return t(`users.step_done_${step.kind}`)
  }
}

const getErrorTitle = (error: unknown): string => {
  if (error instanceof UserSettingsStepError) {
    return t(`users.step_failed_${error.step.kind}`)
  }
  return isEdit.value ? t('users.cannot_save_user') : t('users.cannot_create_user')
}

const errorTitle = computed(() => getErrorTitle(saveError.value))

const describeStepError = (error: UserSettingsStepError): string => {
  if (error.step.kind === 'extension') {
    const kind = getExtensionErrorKind(error.cause)

    if (kind !== 'unknown') {
      return t(`users.extension_error_${kind}`)
    }
  }
  return describeError(error.cause)
}

const getErrorDescription = (error: unknown): string => {
  if (error instanceof UserSettingsStepError) {
    const detail = describeStepError(error)

    return error.completed.length > 0
      ? `${detail} ${t('users.steps_already_applied', {
          steps: error.completed.map(describeStep).join(', '),
        })}`
      : detail
  }

  if (isCsvImportError(error)) {
    return error.code === 'import_failed' && error.message
      ? error.message
      : t(`users.import_error_${error.code}`)
  }

  if (error instanceof CreatedUserNotFoundError) {
    return t('users.created_user_not_found')
  }
  return isApiError(error) || error instanceof Error ? describeError(error) : ''
}

const errorDescription = computed(() => getErrorDescription(saveError.value))

function collectIssues(issues: v.BaseIssue<unknown>[], target: Partial<Record<Field, string>>) {
  for (const issue of issues) {
    const key = issue.path?.[0]?.key

    if (typeof key === 'string' && !(key in target)) {
      target[key as Field] = issue.message
    }
  }
}

function validate(): boolean {
  const issues: Partial<Record<Field, string>> = {}
  const settings = v.safeParse(UserSettingsSchema, {
    ...nextSettings(),
    extension: isSetup.value ? extension.value : effectiveExtension.value,
    profileId: isSetup.value && !isEdit.value ? 1 : nextSettings().profileId,
  })

  if (!isEdit.value) {
    const newUser = v.safeParse(NewUserSchema, {
      username: username.value,
      name: name.value,
      surname: surname.value,
      password: password.value,
      confirmPassword: confirmPassword.value,
      extension: extension.value,
      mobile: mobile.value,
    })

    if (!newUser.success) {
      collectIssues(newUser.issues, issues)
      showPasswordErrors.value = true
    }
    const conflicts = getNewUserConflicts(
      { username: username.value.trim().toLowerCase(), extension: extension.value.trim() },
      users,
      isSetup.value ? reservedExtensions : [],
    )

    for (const [field, message] of Object.entries(conflicts)) {
      if (!(field in issues)) {
        issues[field as Field] = message
      }
    }
  } else if (!isSetup.value) {
    const owner = findUserByExtension(users, extension.value.trim())

    if (savedExtension.value !== '' && extension.value.trim() === '') {
      issues.extension = 'users.extension_required_to_keep'
    } else if (owner && owner.username !== user?.username) {
      issues.extension = 'users.extension_already_assigned'
    }
  }

  if (!settings.success) {
    collectIssues(settings.issues, issues)
  }

  const ordered: Field[] = [
    'username',
    'name',
    'surname',
    'password',
    'confirmPassword',
    'extension',
    'mobile',
    'profileId',
  ]
  validationIssues.value = Object.fromEntries(
    ordered.filter((field) => issues[field]).map((field) => [field, issues[field]]),
  )
  const firstInvalid = ordered.find((field) => validationIssues.value[field])

  if (firstInvalid) {
    fieldRefs.value[firstInvalid]?.focus()
    return false
  }
  return true
}

function save() {
  reset()

  if (validate()) {
    mutate()
  }
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

const issue = (field: Field) =>
  validationIssues.value[field] ? t(validationIssues.value[field]) : ''

const extensionChangeWarning = computed(
  () =>
    isEdit.value &&
    !isSetup.value &&
    savedExtension.value !== '' &&
    extension.value.trim() !== '' &&
    extension.value.trim() !== savedExtension.value,
)
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="title"
    :close-aria-label="t('common.close')"
    @close="requestClose"
  >
    <form class="flex flex-col gap-6" novalidate @submit.prevent="save">
      <template v-if="!isEdit">
        <NeTextInput
          ref="usernameRef"
          v-model.trim="username"
          :label="t('users.username')"
          :invalid-message="issue('username')"
          :disabled="saving"
          autocomplete="off"
        />
        <NeTextInput
          ref="nameRef"
          v-model="name"
          :label="t('users.name')"
          :invalid-message="issue('name')"
          :disabled="saving"
        />
        <NeTextInput
          ref="surnameRef"
          v-model="surname"
          :label="t('users.surname')"
          :invalid-message="issue('surname')"
          :disabled="saving"
        />
        <div class="flex flex-col gap-2">
          <NeTextInput
            ref="passwordRef"
            v-model="password"
            is-password
            :label="t('users.password')"
            :invalid-message="issue('password')"
            :disabled="saving"
            :show-password-label="t('ne_text_input.show_password')"
            :hide-password-label="t('ne_text_input.hide_password')"
            autocomplete="new-password"
          />
          <NePasswordRequirements
            :requirements="passwordRequirements"
            :show-errors="showPasswordErrors"
            :met-label="t('users.password_rule_met')"
            :unmet-label="t('users.password_rule_unmet')"
          />
        </div>
        <NeTextInput
          ref="confirmPasswordRef"
          v-model="confirmPassword"
          is-password
          :label="t('users.confirm_password')"
          :invalid-message="issue('confirmPassword')"
          :disabled="saving"
          :show-password-label="t('ne_text_input.show_password')"
          :hide-password-label="t('ne_text_input.hide_password')"
          autocomplete="new-password"
        />
      </template>
      <div v-if="!(isEdit && isSetup)" class="flex flex-col gap-2">
        <NeTextInput
          ref="extensionRef"
          v-model.trim="extension"
          :label="t('users.extension')"
          :placeholder="t('users.extension_placeholder')"
          :helper-text="t('users.extension_helper')"
          :invalid-message="issue('extension')"
          :optional="isSetup || !isEdit"
          :optional-label="t('common.optional')"
          :disabled="saving"
          inputmode="numeric"
        />
        <NeInlineNotification
          v-if="extensionChangeWarning"
          kind="warning"
          :title="t('users.extension_change_warning_title')"
          :description="t('users.extension_change_warning_description')"
        />
      </div>
      <NeTextInput
        ref="mobileRef"
        v-model="mobile"
        :label="t('users.mobile_number')"
        :invalid-message="issue('mobile')"
        :helper-text="mobileAvailable ? '' : t('users.cannot_load_mobile')"
        optional
        :optional-label="t('common.optional')"
        :disabled="saving || !mobileAvailable"
        inputmode="tel"
      />
      <template v-if="!isSetup || isEdit">
        <div class="flex flex-col gap-2">
          <NeFormItemLabel class="!mb-0">{{ t('users.voicemail') }}</NeFormItemLabel>
          <NeToggle
            v-model="voicemail"
            :label="voicemail ? t('common.enabled') : t('common.disabled')"
            :disabled="
              saving || needsSavedExtension || effectiveExtension === '' || !voicemailAvailable
            "
          />
          <p v-if="!voicemailAvailable" class="text-secondary-neutral text-sm">
            {{ t('users.cannot_load_voicemail') }}
          </p>
        </div>
        <NeCombobox
          ref="profileRef"
          v-model="profileId"
          :label="t('users.profile')"
          :options="profileOptions"
          :placeholder="t('users.choose_profile')"
          :helper-text="
            profilesAvailable ? t('users.profile_helper') : t('users.cannot_load_profiles')
          "
          :invalid-message="issue('profileId')"
          :disabled="saving || !profilesAvailable"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
        />
        <NeMultiselectCombobox
          v-model="groups"
          :label="t('users.groups')"
          :options="groupOptions"
          :placeholder="t('users.choose_groups')"
          :helper-text="groupsAvailable ? t('users.groups_helper') : t('users.cannot_load_groups')"
          optional
          :disabled="saving || !groupsAvailable"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('users.no_groups_available')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
          :remove-label="t('common.remove')"
        />
        <NeMultiselectCombobox
          v-model="devices"
          :label="t('users.devices')"
          :options="deviceOptions"
          :placeholder="t('users.choose_devices')"
          :helper-text="
            needsSavedExtension || effectiveExtension === ''
              ? t('users.devices_need_extension')
              : t('users.devices_helper')
          "
          optional
          :disabled="saving || needsSavedExtension || effectiveExtension === ''"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
          :remove-label="t('common.remove')"
        />
        <UserPhonesField
          v-if="isShown && showPhones && user"
          ref="phonesField"
          v-model="phoneMacs"
          :username="user.username"
          :max-phones="getMaxPhones(otherDevicesCount)"
          :phones-without-mac="phonesWithoutMac"
          :disabled="saving || effectiveExtension === ''"
          :disabled-reason="effectiveExtension === '' ? t('users.phones_need_extension') : ''"
        />
      </template>
      <div v-if="saveError" ref="errorRef" tabindex="-1" data-testid="user-save-error">
        <NeInlineNotification kind="error" :title="errorTitle" :description="errorDescription" />
      </div>
      <div class="flex justify-end gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
        <NeButton kind="tertiary" :disabled="saving" @click="requestClose">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton kind="primary" type="submit" :loading="saving" :disabled="saving">
          {{ isEdit ? t('common.save') : t('users.create') }}
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
