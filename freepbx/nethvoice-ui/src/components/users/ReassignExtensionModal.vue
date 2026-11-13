<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@pinia/colada'
import {
  NeCombobox,
  NeInlineNotification,
  NeModal,
  type NeComboboxOption,
} from '@nethesis/vue-components'
import { getUserLabel } from '@/lib/phones/phones'
import { getReassignTargets, reassignMainExtension } from '@/lib/users/extensions'
import type { User } from '@/lib/users/users'
import { useInvalidateUsers } from '@/queries/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const {
  visible = false,
  user = undefined,
  users = [],
} = defineProps<{
  visible: boolean
  user?: User
  users?: User[]
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const invalidateUsers = useInvalidateUsers()

const username = ref('')
const usernameIssue = ref('')

const comboboxLabels = computed(() => ({
  noResultsLabel: t('ne_combobox.no_results'),
  limitedOptionsLabel: t('ne_combobox.limited_options_label'),
  noOptionsLabel: t('users.no_users_without_extension'),
  selectedLabel: t('ne_combobox.selected'),
  userInputLabel: t('ne_combobox.user_input_label'),
  optionalLabel: t('common.optional'),
}))

const userOptions = computed<NeComboboxOption[]>(() =>
  user
    ? getReassignTargets(users, user).map((target) => ({
        id: target.username,
        label: getUserLabel(target),
      }))
    : [],
)

const { mutate, isLoading, error, reset } = useMutation({
  mutation: ({ owner, target }: { owner: User; target: User }) =>
    reassignMainExtension(owner.mainExtension, target.username),
  onSuccess(_, { owner, target }) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('users.extension_reassigned'),
        description: t('users.extension_reassigned_description', {
          extension: owner.mainExtension,
          name: target.displayName,
        }),
      })
    }, 500)
    emit('close')
  },
  onSettled() {
    invalidateUsers()
  },
})

watch(
  () => visible,
  (shown) => {
    if (shown) {
      reset()
      username.value = ''
      usernameIssue.value = ''
    }
  },
)

function requestClose() {
  if (!isLoading.value) {
    emit('close')
  }
}

function confirm() {
  reset()
  usernameIssue.value = ''
  const target = users.find((item) => item.username === username.value)

  if (!user || !target) {
    usernameIssue.value = t('users.new_user_required')
    return
  }
  mutate({ owner: user, target })
}
</script>

<template>
  <NeModal
    :visible="visible"
    :title="t('users.reassign_extension')"
    kind="info"
    :primary-label="t('users.reassign')"
    :cancel-label="t('common.cancel')"
    :primary-button-disabled="isLoading"
    :primary-button-loading="isLoading"
    :close-aria-label="t('common.close')"
    @close="requestClose"
    @primary-click="confirm"
  >
    <div class="space-y-6">
      <p>
        {{
          t('users.reassign_extension_description', {
            extension: user?.mainExtension ?? '',
            name: user?.displayName ?? '',
          })
        }}
      </p>
      <NeCombobox
        v-model="username"
        :label="t('users.new_user')"
        :options="userOptions"
        :placeholder="t('users.choose_user')"
        :helper-text="t('users.new_user_helper')"
        :invalid-message="usernameIssue"
        :disabled="isLoading"
        :show-selected-label="false"
        v-bind="comboboxLabels"
      />
      <NeInlineNotification
        v-if="error"
        kind="error"
        :title="t('users.cannot_reassign_extension')"
        :description="describeError(error)"
      />
    </div>
  </NeModal>
</template>
