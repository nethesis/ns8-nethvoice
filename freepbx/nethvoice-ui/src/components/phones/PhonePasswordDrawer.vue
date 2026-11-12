<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as v from 'valibot'
import { useMutation, useQueryCache } from '@pinia/colada'
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
  changePhonePassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
  PASSWORD_SPECIAL_CHARACTERS,
  PHONE_DEFAULTS_KEY,
  PhonePasswordSchema,
  type PhonePasswordKind,
} from '@/lib/phones/defaults'
import { describeError, useNotificationsStore } from '@/stores/notifications'

type PasswordField = 'password' | 'confirmPassword'

const { isShown = false, kind = 'admin' } = defineProps<{
  isShown?: boolean
  kind?: PhonePasswordKind
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const password = ref('')
const confirmPassword = ref('')
const validationIssues = ref<Partial<Record<PasswordField, string>>>({})
const showRequirementErrors = ref(false)

const fieldRefs = {
  password: useTemplateRef<InstanceType<typeof NeTextInput>>('passwordRef'),
  confirmPassword: useTemplateRef<InstanceType<typeof NeTextInput>>('confirmPasswordRef'),
}

const requirementDefinitions = computed<NePasswordRequirement[]>(() =>
  PASSWORD_REQUIREMENTS.map((requirement) => ({
    key: requirement.id,
    label: t(`phones.settings.password_requirements.${requirement.id}`, {
      minLength: PASSWORD_MIN_LENGTH,
      characters: PASSWORD_SPECIAL_CHARACTERS,
    }),
    validate: requirement.test,
  })),
)

const { requirements } = usePasswordRequirements(password, {
  requirements: requirementDefinitions,
})

const {
  mutate: changePasswordMutate,
  isLoading: saving,
  reset: changePasswordReset,
  error: changePasswordError,
} = useMutation({
  mutation: (newPassword: string) => changePhonePassword(kind, newPassword),
  onSuccess() {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t(`phones.settings.${kind}_password_changed`),
        description: t('phones.settings.password_changed_description'),
      })
    }, 500)
    emit('close')
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [PHONE_DEFAULTS_KEY] })
  },
})

watch(
  () => isShown,
  (shown) => {
    if (!shown) {
      return
    }
    changePasswordReset()
    password.value = ''
    confirmPassword.value = ''
    validationIssues.value = {}
    showRequirementErrors.value = false
    focusElement(fieldRefs.password)
  },
)

function submit() {
  changePasswordReset()
  validationIssues.value = {}
  showRequirementErrors.value = true
  const result = v.safeParse(PhonePasswordSchema, {
    password: password.value,
    confirmPassword: confirmPassword.value,
  })

  if (result.success) {
    changePasswordMutate(password.value)
    return
  }

  for (const issue of result.issues) {
    const field = issue.path?.[0].key

    if ((field === 'password' || field === 'confirmPassword') && !validationIssues.value[field]) {
      validationIssues.value[field] = issue.message
    }
  }
  focusElement(validationIssues.value.password ? fieldRefs.password : fieldRefs.confirmPassword)
}

const issueMessage = (field: PasswordField) => {
  const issue = validationIssues.value[field]
  return issue ? t(issue) : ''
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="$t(`phones.settings.change_${kind}_password`)"
    :close-aria-label="$t('shell.close_side_drawer')"
    @close="emit('close')"
  >
    <form novalidate @submit.prevent="submit">
      <div class="flex flex-col gap-8">
        <NeInlineNotification
          kind="warning"
          :title="$t('phones.settings.changes_apply_after_provisioning')"
        />
        <div class="flex flex-col gap-3">
          <NeTextInput
            ref="passwordRef"
            v-model="password"
            is-password
            autocomplete="new-password"
            :label="$t('phones.settings.new_password')"
            :invalid-message="issueMessage('password')"
            :show-password-label="$t('ne_text_input.show_password')"
            :hide-password-label="$t('ne_text_input.hide_password')"
            :disabled="saving"
          />
          <NePasswordRequirements
            :requirements="requirements"
            :show-errors="showRequirementErrors"
            :met-label="$t('phones.settings.password_requirements.requirement_met')"
            :unmet-label="$t('phones.settings.password_requirements.requirement_not_met')"
          />
        </div>
        <NeTextInput
          ref="confirmPasswordRef"
          v-model="confirmPassword"
          is-password
          autocomplete="new-password"
          :label="$t('phones.settings.confirm_password')"
          :invalid-message="issueMessage('confirmPassword')"
          :show-password-label="$t('ne_text_input.show_password')"
          :hide-password-label="$t('ne_text_input.hide_password')"
          :disabled="saving"
        />
        <NeInlineNotification
          v-if="changePasswordError"
          kind="error"
          :title="$t('phones.settings.cannot_change_password')"
          :description="describeError(changePasswordError)"
        />
      </div>
      <hr class="my-8 border-gray-200 dark:border-gray-700" />
      <div class="flex justify-end gap-6">
        <NeButton kind="tertiary" size="lg" :disabled="saving" @click.prevent="emit('close')">
          {{ $t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="saving" :loading="saving">
          {{ $t('phones.settings.change_password') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
