<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  NeCombobox,
  NeInlineNotification,
  NeModal,
  focusElement,
  type NeComboboxOption,
} from '@nethesis/vue-components'
import { getUserLabel, PHONES_KEY } from '@/lib/phones/phones'
import { getReassignTargets, reassignMainExtension } from '@/lib/users/extensions'
import type { User } from '@/lib/users/users'
import { useInvalidateUsers } from '@/queries/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useFocusReturn } from '@/composables/useFocusReturn'

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

useFocusReturn(() => visible)

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const invalidateUsers = useInvalidateUsers()
const queryCache = useQueryCache()

const username = ref('')
const usernameIssue = ref('')
const usernameRef = useTemplateRef<{ focus(): void }>('usernameRef')

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
  onSuccess(result, { owner, target }) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('users.extension_reassigned'),
        description:
          result.keyLabelsUpdated > 0
            ? t(
                'users.extension_reassigned_key_labels_description',
                {
                  extension: owner.mainExtension,
                  name: target.displayName,
                  count: result.keyLabelsUpdated,
                },
                result.keyLabelsUpdated,
              )
            : t('users.extension_reassigned_description', {
                extension: owner.mainExtension,
                name: target.displayName,
              }),
      })

      if (result.keyLabelsIncomplete) {
        notificationsStore.createNotification({
          kind: 'warning',
          title: t('users.cannot_update_key_labels'),
          description: t('users.cannot_update_key_labels_description', {
            extension: owner.mainExtension,
            previous: owner.displayName,
          }),
        })
      }
    }, 500)
    emit('close')
  },
  onSettled() {
    invalidateUsers()
    queryCache.invalidateQueries({ key: [PHONES_KEY] })
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
    focusElement(usernameRef)
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
        ref="usernameRef"
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
