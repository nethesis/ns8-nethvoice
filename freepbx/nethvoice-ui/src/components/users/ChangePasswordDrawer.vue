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
  NeInlineNotification,
  NePasswordRequirements,
  NeSideDrawer,
  NeTextInput,
  usePasswordRequirements,
} from '@nethesis/vue-components'
import { focusUnlessFocusedWithin } from '@/lib/common'
import {
  changeAccountPassword,
  ChangePasswordSchema,
  getAccountErrorCode,
  isAccountMissing,
  type AccountErrorCode,
} from '@/lib/users/accounts'
import { PASSWORD_MIN_LENGTH } from '@/lib/users/createUser'
import type { UserRow } from '@/lib/users/directory'
import { useInvalidateAccounts } from '@/queries/users/accounts'
import { useInvalidateUsers } from '@/queries/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useFocusReturn } from '@/composables/useFocusReturn'

type Field = 'password' | 'confirmPassword'

const POLICY_ERRORS: AccountErrorCode[] = [
  'password_complexity',
  'password_history',
  'password_same',
  'password_rejected',
]

const { isShown = false, user = undefined } = defineProps<{
  isShown: boolean
  user?: UserRow
}>()

const emit = defineEmits<{ close: [] }>()

useFocusReturn(() => isShown)

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const invalidateAccounts = useInvalidateAccounts()
const invalidateUsers = useInvalidateUsers()

const password = ref('')
const confirmPassword = ref('')
const showPasswordErrors = ref(false)
const validationIssues = ref<Partial<Record<Field, string>>>({})
const focusAfterSave = ref<Field | 'error' | null>(null)
const formRef = useTemplateRef<HTMLFormElement>('formRef')
const errorRef = useTemplateRef<HTMLElement>('errorRef')
const passwordRef = useTemplateRef<{ focus(): void }>('passwordRef')
const confirmPasswordRef = useTemplateRef<{ focus(): void }>('confirmPasswordRef')

const { requirements: passwordRequirements } = usePasswordRequirements(password, {
  labels: () => ({
    minLength: t('users.password_rule_min_length', { min: PASSWORD_MIN_LENGTH }),
    uppercase: t('users.password_rule_uppercase'),
    lowercase: t('users.password_rule_lowercase'),
    number: t('users.password_rule_number'),
    specialCharacter: t('users.password_rule_special'),
  }),
})

const {
  mutate,
  isLoading: saving,
  error: saveError,
  reset,
} = useMutation({
  mutation: (target: UserRow) => changeAccountPassword(target.username, password.value),
  onSuccess(_, target) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('users.password_updated'),
        description: t('users.password_updated_description', { name: target.username }),
      })
    }, 500)
    emit('close')
  },
  onError(error, target) {
    const code = getAccountErrorCode(error)

    if (isAccountMissing(error)) {
      setTimeout(() => {
        notificationsStore.createNotification({
          kind: 'error',
          title: t('users.cannot_change_password'),
          description: t('users.user_no_longer_exists_description', {
            name: target.username,
            action: t('users.sync_users'),
          }),
        })
      }, 500)
      emit('close')
      return invalidateUsers()
    }
    if (code && POLICY_ERRORS.includes(code)) {
      validationIssues.value = { password: `users.account_error_${code}` }
      focusAfterSave.value = 'password'
    } else {
      focusAfterSave.value = 'error'
    }
  },
  onSettled() {
    return invalidateAccounts()
  },
})

const errorDescription = computed(() => {
  const code = getAccountErrorCode(saveError.value)
  return code ? t(`users.account_error_${code}`) : describeError(saveError.value)
})

const showSaveError = computed(() => {
  const code = getAccountErrorCode(saveError.value)
  return saveError.value !== null && !(code && POLICY_ERRORS.includes(code))
})

watch(
  () => isShown,
  (shown) => {
    if (!shown) {
      return
    }
    reset()
    password.value = ''
    confirmPassword.value = ''
    showPasswordErrors.value = false
    validationIssues.value = {}
    focusAfterSave.value = null
    setTimeout(() => focusUnlessFocusedWithin(formRef.value, passwordRef.value), 300)
  },
)

watch(password, () => {
  if (validationIssues.value.password) {
    validationIssues.value = { ...validationIssues.value, password: undefined }
  }
})

watch(confirmPassword, () => {
  if (validationIssues.value.confirmPassword) {
    validationIssues.value = { ...validationIssues.value, confirmPassword: undefined }
  }
})

watch(saving, async (isSaving) => {
  if (isSaving || focusAfterSave.value === null) {
    return
  }
  const target = focusAfterSave.value
  focusAfterSave.value = null
  await nextTick()

  if (target === 'password') {
    passwordRef.value?.focus()
  } else if (target === 'confirmPassword') {
    confirmPasswordRef.value?.focus()
  } else {
    errorRef.value?.focus()
  }
})

function validate(): boolean {
  const result = v.safeParse(ChangePasswordSchema, {
    password: password.value,
    confirmPassword: confirmPassword.value,
  })

  if (result.success) {
    validationIssues.value = {}
    return true
  }
  showPasswordErrors.value = true
  const issues: Partial<Record<Field, string>> = {}

  for (const issue of result.issues) {
    const key = issue.path?.[0]?.key

    if ((key === 'password' || key === 'confirmPassword') && !(key in issues)) {
      issues[key] = issue.message
    }
  }
  validationIssues.value = issues

  if (issues.password) {
    passwordRef.value?.focus()
  } else {
    confirmPasswordRef.value?.focus()
  }
  return false
}

function save() {
  reset()

  if (user && validate()) {
    mutate(user)
  }
}

function requestClose() {
  if (!saving.value) {
    emit('close')
  }
}

const issue = (field: Field) =>
  validationIssues.value[field] ? t(validationIssues.value[field]) : ''
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="t('users.change_password_of', { name: user?.username ?? '' })"
    :close-aria-label="t('common.close')"
    @close="requestClose"
  >
    <form ref="formRef" class="flex flex-col gap-6" novalidate @submit.prevent="save">
      <div class="flex flex-col gap-2">
        <NeTextInput
          ref="passwordRef"
          v-model="password"
          is-password
          :label="t('users.new_password')"
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
      <div v-if="showSaveError" ref="errorRef" tabindex="-1" data-testid="change-password-error">
        <NeInlineNotification
          kind="error"
          :title="t('users.cannot_change_password')"
          :description="errorDescription"
        />
      </div>
      <div class="flex justify-end gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
        <NeButton kind="tertiary" :disabled="saving" @click="requestClose">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton kind="primary" type="submit" :loading="saving" :disabled="saving">
          {{ t('users.change') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
