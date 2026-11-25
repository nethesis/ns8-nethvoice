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
  focusElement,
  NeButton,
  NeCheckboxCards,
  NeCombobox,
  NeInlineNotification,
  NeModal,
  NePasswordRequirements,
  NeRadioSelection,
  NeSideDrawer,
  NeTextInput,
  usePasswordRequirements,
  type NeComboboxOption,
} from '@nethesis/vue-components'
import {
  AdminFormSchema,
  buildNewAdmin,
  buildPermissions,
  createAdmin,
  getAdminCandidates,
  getAdminErrorCode,
  getAdminSections,
  getNewAdminConflict,
  getNewAdminFieldIssue,
  isFullAccess,
  NewAdminAccountSchema,
  setAdminPermissions,
  type AdminAccess,
  type AdminAccount,
  type NewAdmin,
  type NewAdminField,
} from '@/lib/admins/admins'
import type { Focusable } from '@/lib/common'
import { SECTIONS, type Permission } from '@/lib/permissions/permissions'
import { PASSWORD_MIN_LENGTH } from '@/lib/users/createUser'
import { DISPLAY_NAME_MAX_LENGTH, USERNAME_MAX_LENGTH } from '@/lib/users/csv'
import { useFocusReturn } from '@/composables/useFocusReturn'
import { useInvalidateAdmins } from '@/queries/admins/admins'
import { useUserAccounts, useUsersDomain } from '@/queries/users/accounts'
import { useLoginStore } from '@/stores/login'
import { describeError, useNotificationsStore } from '@/stores/notifications'

type UserMode = 'existing' | 'new'

type SaveRequest =
  { kind: 'existing'; name: string; granted: Permission[] } | { kind: 'new'; newAdmin: NewAdmin }

const NEW_FIELDS: NewAdminField[] = [
  'username',
  'name',
  'surname',
  'password',
  'confirmPassword',
  'email',
]

const ISSUE_PARAMS: Record<string, Record<string, number>> = {
  'users.username_too_long': { max: USERNAME_MAX_LENGTH },
  'users.full_name_too_long': { max: DISPLAY_NAME_MAX_LENGTH },
}

const emptyAccount = (): Record<NewAdminField, string> => ({
  username: '',
  name: '',
  surname: '',
  password: '',
  confirmPassword: '',
  email: '',
})

const {
  isShown = false,
  currentAdmin = undefined,
  admins,
} = defineProps<{
  isShown: boolean
  currentAdmin: AdminAccount | undefined
  admins: AdminAccount[]
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const loginStore = useLoginStore()
const notificationsStore = useNotificationsStore()
const invalidateAdmins = useInvalidateAdmins()
const { state: accountsState } = useUserAccounts()
const { state: domainState } = useUsersDomain()

useFocusReturn(() => isShown)

const mode = ref<UserMode>('existing')
const username = ref('')
const newAccount = ref(emptyAccount())
const access = ref<AdminAccess>('sections')
const sections = ref<string[]>([])
const usernameIssue = ref('')
const sectionsIssue = ref('')
const newIssues = ref<Partial<Record<NewAdminField, string>>>({})
const showPasswordErrors = ref(false)
const focusAfterSave = ref<NewAdminField | null>(null)
const isShownUnsavedModal = ref(false)
const usernameRef = useTemplateRef<Focusable>('usernameRef')
const accessRef = useTemplateRef<Focusable>('accessRef')
const sectionsRef = useTemplateRef<Focusable>('sectionsRef')
const newUsernameRef = useTemplateRef<Focusable>('newUsernameRef')
const nameRef = useTemplateRef<Focusable>('nameRef')
const surnameRef = useTemplateRef<Focusable>('surnameRef')
const passwordRef = useTemplateRef<Focusable>('passwordRef')
const confirmPasswordRef = useTemplateRef<Focusable>('confirmPasswordRef')
const emailRef = useTemplateRef<Focusable>('emailRef')

const newFieldRefs: Record<NewAdminField, typeof newUsernameRef> = {
  username: newUsernameRef,
  name: nameRef,
  surname: surnameRef,
  password: passwordRef,
  confirmPassword: confirmPasswordRef,
  email: emailRef,
}

const isEdit = computed(() => currentAdmin !== undefined)

const isNew = computed(() => !isEdit.value && mode.value === 'new')

const domain = computed(() => domainState.value.data)

const newPassword = computed(() => newAccount.value.password)

const { requirements: passwordRequirements } = usePasswordRequirements(newPassword, {
  labels: () => ({
    minLength: t('users.password_rule_min_length', { min: PASSWORD_MIN_LENGTH }),
    uppercase: t('users.password_rule_uppercase'),
    lowercase: t('users.password_rule_lowercase'),
    number: t('users.password_rule_number'),
    specialCharacter: t('users.password_rule_special'),
  }),
})

const newUserUnavailableReason = computed(() => {
  if (domain.value?.manageable !== false) {
    return ''
  }
  return domain.value.reason === 'external'
    ? t('admin_control.new_user_unavailable_external')
    : t('admin_control.new_user_unavailable')
})

const modeOptions = computed(() => [
  {
    id: 'existing',
    label: t('admin_control.existing_user'),
    description: t('admin_control.existing_user_description'),
  },
  {
    id: 'new',
    label: t('admin_control.new_user'),
    description: newUserUnavailableReason.value || t('admin_control.new_user_description'),
    disabled: domain.value?.manageable !== true,
  },
])

const modeValue = computed({
  get: () => mode.value,
  set: (value: string) => {
    mode.value = value === 'new' ? 'new' : 'existing'
    usernameIssue.value = ''
  },
})

const candidateOptions = computed<NeComboboxOption[]>(() =>
  getAdminCandidates(accountsState.value.data ?? [], admins, loginStore.username).map(
    (candidate) => ({
      id: candidate.username,
      label: candidate.username,
      description: candidate.unavailable
        ? t(`admin_control.candidate_${candidate.unavailable}`)
        : candidate.displayName || undefined,
      disabled: candidate.unavailable !== null,
    }),
  ),
)

const selectedOption = computed<NeComboboxOption | undefined>(() =>
  currentAdmin
    ? {
        id: currentAdmin.username,
        label: currentAdmin.username,
        description: currentAdmin.displayName || undefined,
      }
    : undefined,
)

const accessOptions = computed(() => [
  {
    id: 'full',
    label: t('admin_control.full_access'),
    description: t('admin_control.full_access_description'),
  },
  {
    id: 'sections',
    label: t('admin_control.selected_sections'),
    description: t('admin_control.selected_sections_description'),
  },
])

const accessValue = computed({
  get: () => access.value,
  set: (value: string) => {
    access.value = value === 'full' ? 'full' : 'sections'
    sectionsIssue.value = ''
  },
})

const sectionOptions = computed(() =>
  SECTIONS.map((section) => ({
    id: section,
    label: t(`${section}.title`),
    description: t(`admin_control.section_description_${section}`),
  })),
)

const comboboxLabels = computed(() => ({
  noResultsLabel: t('ne_combobox.no_results'),
  limitedOptionsLabel: t('ne_combobox.limited_options_label'),
  noOptionsLabel: t('admin_control.no_domain_users'),
  selectedLabel: t('ne_combobox.selected'),
  userInputLabel: t('ne_combobox.user_input_label'),
  optionalLabel: t('common.optional'),
}))

const initialPermissions = computed<Permission[]>(() => currentAdmin?.permissions ?? [])

const permissions = computed(() => buildPermissions(access.value, sections.value))

const isDirty = computed(() => {
  if (!isEdit.value) {
    return (
      mode.value !== 'existing' ||
      username.value !== '' ||
      NEW_FIELDS.some((field) => newAccount.value[field] !== '') ||
      sections.value.length > 0 ||
      access.value !== 'sections'
    )
  }
  const initial = initialPermissions.value
  return (
    permissions.value.length !== initial.length ||
    permissions.value.some((permission) => !initial.includes(permission))
  )
})

const newIssue = (field: NewAdminField) => {
  const key = newIssues.value[field]
  return key ? t(key, ISSUE_PARAMS[key] ?? {}) : ''
}

const { mutate, isLoading, error, reset } = useMutation({
  mutation: (request: SaveRequest) =>
    request.kind === 'new'
      ? createAdmin(request.newAdmin)
      : setAdminPermissions(request.name, request.granted),
  onSuccess(_data, request) {
    const added = !isEdit.value
    const name = request.kind === 'new' ? request.newAdmin.username : request.name
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: added ? t('admin_control.admin_added') : t('admin_control.admin_updated'),
        description: added
          ? t('admin_control.admin_added_description', { name })
          : t('admin_control.admin_updated_description', { name }),
      })
    }, 500)
    emit('close')
  },
  onError(failure, request) {
    const issue = request.kind === 'new' ? getNewAdminFieldIssue(failure) : null

    if (issue) {
      newIssues.value = { [issue.field]: issue.message }
      focusAfterSave.value = issue.field
    }
  },
  onSettled: () => invalidateAdmins(),
})

const isErrorShown = computed(
  () => error.value !== null && !(isNew.value && getNewAdminFieldIssue(error.value)),
)

const errorDescription = computed(() => {
  const code = getAdminErrorCode(error.value)
  return code ? t(`admin_control.error_${code}`) : describeError(error.value)
})

watch(isLoading, async (loading) => {
  const field = focusAfterSave.value

  if (loading || field === null) {
    return
  }
  focusAfterSave.value = null
  await nextTick()
  focusElement(newFieldRefs[field])
})

watch(
  () => isShown,
  () => {
    if (!isShown) {
      return
    }
    reset()
    usernameIssue.value = ''
    sectionsIssue.value = ''
    newIssues.value = {}
    showPasswordErrors.value = false
    focusAfterSave.value = null
    isShownUnsavedModal.value = false
    mode.value = 'existing'
    newAccount.value = emptyAccount()
    username.value = currentAdmin?.username ?? ''
    access.value = currentAdmin && isFullAccess(currentAdmin.permissions) ? 'full' : 'sections'
    sections.value = currentAdmin ? getAdminSections(currentAdmin.permissions) : []
    focusElement(currentAdmin ? accessRef : usernameRef)
  },
)

watch(sections, () => {
  sectionsIssue.value = ''
})

watch(
  () => domain.value?.manageable,
  (manageable) => {
    if (manageable !== true) {
      mode.value = 'existing'
    }
  },
)

for (const field of NEW_FIELDS) {
  watch(
    () => newAccount.value[field],
    () => {
      if (newIssues.value[field]) {
        newIssues.value = Object.fromEntries(
          Object.entries(newIssues.value).filter(([key]) => key !== field),
        )
      }
    },
  )
}

function sectionsMessage(): string {
  const result = v.safeParse(AdminFormSchema, {
    username: '-',
    access: access.value,
    sections: sections.value,
  })
  const issue = result.success
    ? undefined
    : result.issues.find((candidate) => candidate.path?.[0]?.key === 'sections')
  return issue ? t(issue.message) : ''
}

function validateNewAdmin(): NewAdmin | null {
  const issues: Partial<Record<NewAdminField, string>> = {}
  const result = v.safeParse(NewAdminAccountSchema, newAccount.value)

  if (!result.success) {
    showPasswordErrors.value = true

    for (const issue of result.issues) {
      const field = NEW_FIELDS.find((candidate) => candidate === issue.path?.[0]?.key)

      if (field && !issues[field]) {
        issues[field] = issue.message
      }
    }
  }

  if (!issues.username) {
    const conflict = getNewAdminConflict(
      newAccount.value.username.trim().toLowerCase(),
      accountsState.value.data ?? [],
      admins,
    )

    if (conflict) {
      issues.username = conflict
    }
  }
  newIssues.value = issues
  sectionsIssue.value = sectionsMessage()
  const firstInvalid = NEW_FIELDS.find((field) => issues[field])

  if (firstInvalid) {
    focusElement(newFieldRefs[firstInvalid])
    return null
  }

  if (sectionsIssue.value || !result.success) {
    focusElement(sectionsRef)
    return null
  }
  return buildNewAdmin(result.output, permissions.value)
}

function save() {
  reset()
  usernameIssue.value = ''
  sectionsIssue.value = ''

  if (isNew.value) {
    const newAdmin = validateNewAdmin()

    if (newAdmin) {
      mutate({ kind: 'new', newAdmin })
    }
    return
  }
  const result = v.safeParse(AdminFormSchema, {
    username: username.value,
    access: access.value,
    sections: sections.value,
  })

  if (!result.success) {
    for (const issue of result.issues) {
      const field = issue.path?.[0]?.key

      if (field === 'username' && !usernameIssue.value) {
        usernameIssue.value = t(issue.message)
      } else if (field === 'sections' && !sectionsIssue.value) {
        sectionsIssue.value = t(issue.message)
      }
    }
    focusElement(usernameIssue.value ? usernameRef : sectionsRef)
    return
  }
  mutate({ kind: 'existing', name: result.output.username, granted: permissions.value })
}

function requestClose() {
  if (isLoading.value) {
    return
  }

  if (isDirty.value) {
    isShownUnsavedModal.value = true
    return
  }
  emit('close')
}

function discardChanges() {
  isShownUnsavedModal.value = false
  emit('close')
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="isEdit ? t('admin_control.edit_admin') : t('admin_control.add_admin')"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="requestClose"
  >
    <form novalidate @submit.prevent="save">
      <div class="space-y-6">
        <NeRadioSelection
          v-if="!isEdit"
          v-model="modeValue"
          :label="t('admin_control.account')"
          :options="modeOptions"
          card
          grid-style="grid-cols-1 gap-3 sm:grid-cols-2"
          :disabled="isLoading"
          data-testid="admin-user-mode"
        />
        <template v-if="isNew">
          <NeTextInput
            ref="newUsernameRef"
            v-model.trim="newAccount.username"
            :label="t('users.username')"
            :invalid-message="newIssue('username')"
            :disabled="isLoading"
            :maxlength="USERNAME_MAX_LENGTH"
            autocomplete="off"
          />
          <NeTextInput
            ref="nameRef"
            v-model="newAccount.name"
            :label="t('users.name')"
            :invalid-message="newIssue('name')"
            :disabled="isLoading"
          />
          <NeTextInput
            ref="surnameRef"
            v-model="newAccount.surname"
            :label="t('users.surname')"
            :invalid-message="newIssue('surname')"
            :disabled="isLoading"
          />
          <div class="flex flex-col gap-2">
            <NeTextInput
              ref="passwordRef"
              v-model="newAccount.password"
              is-password
              :label="t('users.password')"
              :invalid-message="newIssue('password')"
              :disabled="isLoading"
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
            v-model="newAccount.confirmPassword"
            is-password
            :label="t('users.confirm_password')"
            :invalid-message="newIssue('confirmPassword')"
            :disabled="isLoading"
            :show-password-label="t('ne_text_input.show_password')"
            :hide-password-label="t('ne_text_input.hide_password')"
            autocomplete="new-password"
          />
          <NeTextInput
            ref="emailRef"
            v-model="newAccount.email"
            type="email"
            :label="t('users.email')"
            :placeholder="t('users.email_placeholder')"
            :invalid-message="newIssue('email')"
            optional
            :optional-label="t('common.optional')"
            :disabled="isLoading"
            autocomplete="off"
          />
        </template>
        <template v-else>
          <NeCombobox
            ref="usernameRef"
            v-model="username"
            :label="t('admin_control.user')"
            :options="candidateOptions"
            :selected-option="selectedOption"
            :placeholder="t('admin_control.choose_user')"
            :helper-text="isEdit ? '' : t('admin_control.user_helper')"
            :invalid-message="usernameIssue"
            :disabled="isLoading || isEdit"
            :loading-options="accountsState.status === 'pending'"
            :show-selected-label="false"
            v-bind="comboboxLabels"
            data-testid="admin-user"
          />
          <NeInlineNotification
            v-if="!isEdit && accountsState.status === 'error'"
            kind="error"
            :title="t('admin_control.cannot_load_users')"
            :description="describeError(accountsState.error)"
          />
        </template>
        <NeRadioSelection
          ref="accessRef"
          v-model="accessValue"
          :label="t('admin_control.access')"
          :options="accessOptions"
          card
          grid-style="grid-cols-1 gap-3 sm:grid-cols-2"
          :disabled="isLoading"
        />
        <NeCheckboxCards
          v-if="access === 'sections'"
          ref="sectionsRef"
          v-model="sections"
          :label="t('admin_control.sections')"
          :options="sectionOptions"
          grid-style="grid-cols-1 gap-3"
          :invalid-message="sectionsIssue"
          :disabled="isLoading"
        />
        <NeInlineNotification
          v-if="isErrorShown"
          kind="error"
          :title="
            isEdit ? t('admin_control.cannot_save_admin') : t('admin_control.cannot_add_admin')
          "
          :description="errorDescription"
        />
      </div>
      <hr class="my-8" />
      <div class="flex justify-end gap-3">
        <NeButton kind="tertiary" size="lg" :disabled="isLoading" @click.prevent="emit('close')">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="isLoading" :loading="isLoading">
          {{ isEdit ? t('common.save') : t('common.add') }}
        </NeButton>
      </div>
    </form>
    <NeModal
      :visible="isShownUnsavedModal"
      :title="t('common.unsaved_changes')"
      kind="warning"
      :primary-label="t('common.discard_changes')"
      primary-button-kind="danger"
      :cancel-label="t('common.keep_editing')"
      :close-aria-label="t('common.close')"
      @close="isShownUnsavedModal = false"
      @primary-click="discardChanges"
    >
      <p>{{ t('common.unsaved_changes_description') }}</p>
    </NeModal>
  </NeSideDrawer>
</template>
