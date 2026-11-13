<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@pinia/colada'
import {
  focusElement,
  NeButton,
  NeInlineNotification,
  NePasswordRequirements,
  NeSideDrawer,
  NeTextInput,
  usePasswordRequirements,
  type NePasswordRequirement,
} from '@nethesis/vue-components'
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_PASSWORD_REQUIREMENTS,
  ADMIN_USERNAME,
  changeAdminPassword,
  getChangeAdminPasswordIssues,
  isWrongCurrentPasswordError,
  type ChangeAdminPasswordField,
  type ChangeAdminPasswordForm,
} from '@/lib/settings/adminPassword'
import { useLoginStore } from '@/stores/login'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { isShown = false } = defineProps<{ isShown?: boolean }>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const loginStore = useLoginStore()
const notificationsStore = useNotificationsStore()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const validationIssues = ref<Partial<Record<ChangeAdminPasswordField, string>>>({})
const showRequirementErrors = ref(false)

const fieldRefs = {
  currentPassword: useTemplateRef<InstanceType<typeof NeTextInput>>('currentPasswordRef'),
  newPassword: useTemplateRef<InstanceType<typeof NeTextInput>>('newPasswordRef'),
  confirmPassword: useTemplateRef<InstanceType<typeof NeTextInput>>('confirmPasswordRef'),
}

const requirementDefinitions = computed<NePasswordRequirement[]>(() =>
  ADMIN_PASSWORD_REQUIREMENTS.map((requirement) => ({
    key: requirement.key,
    label: t(`settings.password_requirements.${requirement.key}`, {
      minLength: ADMIN_PASSWORD_MIN_LENGTH,
    }),
    validate: requirement.validate,
  })),
)

const { requirements } = usePasswordRequirements(newPassword, {
  requirements: requirementDefinitions,
})

const {
  mutate: changePasswordMutate,
  isLoading: changing,
  reset: changePasswordReset,
  error: changePasswordError,
} = useMutation({
  mutation: async (form: ChangeAdminPasswordForm) => {
    await changeAdminPassword(form)
    await loginStore.login(
      ADMIN_USERNAME,
      form.newPassword,
      loginStore.rememberedUsername() === ADMIN_USERNAME,
    )
  },
  onSuccess() {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('settings.admin_password_changed'),
        description: t('settings.admin_password_changed_description'),
      })
    }, 500)
    emit('close')
  },
  onError(error) {
    if (isWrongCurrentPasswordError(error)) {
      validationIssues.value = { currentPassword: error.message }
    }
  },
})

watch(
  changing,
  (isChanging) => {
    if (!isChanging && changePasswordError.value) {
      focusElement(fieldRefs.currentPassword)
    }
  },
  { flush: 'post' },
)

const mutationErrorDescription = computed(() =>
  changePasswordError.value && !isWrongCurrentPasswordError(changePasswordError.value)
    ? describeError(changePasswordError.value)
    : '',
)

watch(
  () => isShown,
  (shown) => {
    if (!shown) {
      return
    }
    changePasswordReset()
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    validationIssues.value = {}
    showRequirementErrors.value = false
    focusElement(fieldRefs.currentPassword)
  },
)

const getForm = (): ChangeAdminPasswordForm => ({
  currentPassword: currentPassword.value,
  newPassword: newPassword.value,
  confirmPassword: confirmPassword.value,
})

watch([newPassword, confirmPassword], () => {
  if (!showRequirementErrors.value) {
    return
  }
  const issues = getChangeAdminPasswordIssues(getForm())
  validationIssues.value = {
    ...validationIssues.value,
    newPassword: issues.newPassword,
    confirmPassword: issues.confirmPassword,
  }
})

watch(currentPassword, () => {
  if (showRequirementErrors.value) {
    validationIssues.value = {
      ...validationIssues.value,
      currentPassword: getChangeAdminPasswordIssues(getForm()).currentPassword,
    }
  }
})

function submit() {
  changePasswordReset()
  const form = getForm()
  validationIssues.value = getChangeAdminPasswordIssues(form)
  showRequirementErrors.value = true

  const firstInvalidField = (Object.keys(fieldRefs) as ChangeAdminPasswordField[]).find(
    (field) => validationIssues.value[field],
  )

  if (firstInvalidField) {
    focusElement(fieldRefs[firstInvalidField])
    return
  }
  changePasswordMutate(form)
}

const issueMessage = (field: ChangeAdminPasswordField) => {
  const issue = validationIssues.value[field]
  return issue ? t(issue) : ''
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="$t('settings.change_admin_password')"
    :close-aria-label="$t('shell.close_side_drawer')"
    @close="emit('close')"
  >
    <form novalidate @submit.prevent="submit">
      <div class="flex flex-col gap-8">
        <NeTextInput
          ref="currentPasswordRef"
          v-model="currentPassword"
          is-password
          autocomplete="current-password"
          :label="$t('settings.current_password')"
          :invalid-message="issueMessage('currentPassword')"
          :show-password-label="$t('ne_text_input.show_password')"
          :hide-password-label="$t('ne_text_input.hide_password')"
          :disabled="changing"
        />
        <div class="flex flex-col gap-3">
          <NeTextInput
            ref="newPasswordRef"
            v-model="newPassword"
            is-password
            autocomplete="new-password"
            :label="$t('settings.new_password')"
            :invalid-message="issueMessage('newPassword')"
            :show-password-label="$t('ne_text_input.show_password')"
            :hide-password-label="$t('ne_text_input.hide_password')"
            :disabled="changing"
          />
          <NePasswordRequirements
            :requirements="requirements"
            :show-errors="showRequirementErrors"
            :met-label="$t('settings.password_requirements.requirement_met')"
            :unmet-label="$t('settings.password_requirements.requirement_not_met')"
          />
        </div>
        <NeTextInput
          ref="confirmPasswordRef"
          v-model="confirmPassword"
          is-password
          autocomplete="new-password"
          :label="$t('settings.confirm_password')"
          :invalid-message="issueMessage('confirmPassword')"
          :show-password-label="$t('ne_text_input.show_password')"
          :hide-password-label="$t('ne_text_input.hide_password')"
          :disabled="changing"
        />
        <NeInlineNotification
          v-if="mutationErrorDescription"
          kind="error"
          :title="$t('settings.cannot_change_admin_password')"
          :description="mutationErrorDescription"
        />
      </div>
      <hr class="my-8 border-gray-200 dark:border-gray-700" />
      <div class="flex justify-end gap-6">
        <NeButton kind="tertiary" size="lg" :disabled="changing" @click.prevent="emit('close')">
          {{ $t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="changing" :loading="changing">
          {{ $t('settings.change_password') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
