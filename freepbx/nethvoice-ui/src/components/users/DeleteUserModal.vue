<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import DeleteObjectModal from '@/components/common/DeleteObjectModal.vue'
import { PHONES_KEY } from '@/lib/phones/phones'
import { deleteAccount, getAccountErrorCode, isAccountMissing } from '@/lib/users/accounts'
import type { User } from '@/lib/users/users'
import { useInvalidateAccounts } from '@/queries/users/accounts'
import { useInvalidateUsers } from '@/queries/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import { useFocusReturn } from '@/composables/useFocusReturn'

const { visible = false, user = undefined } = defineProps<{
  visible: boolean
  user?: User
}>()

const emit = defineEmits<{ close: [] }>()

useFocusReturn(() => visible)

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const runtimeConfigStore = useRuntimeConfigStore()
const queryCache = useQueryCache()
const invalidateUsers = useInvalidateUsers()
const invalidateAccounts = useInvalidateAccounts()

watch(
  () => visible,
  (shown) => {
    if (shown) {
      reset()
    }
  },
)

const { mutate, isLoading, error, reset } = useMutation({
  mutation: (target: User) => deleteAccount(target.username),
  onSuccess(result, target) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('users.user_deleted'),
        description: t('users.user_deleted_description', { name: target.displayName }),
      })

      if (!result.cleaned) {
        notificationsStore.createNotification({
          kind: 'warning',
          title: t('users.cannot_delete_user_data'),
          description: t('users.cannot_delete_user_data_description', {
            name: target.displayName,
            brand: runtimeConfigStore.config.brandName,
            action: t('users.sync_users'),
            orphans: t('users.orphan_extensions'),
          }),
        })
      } else if (!result.synchronized) {
        notificationsStore.createNotification({
          kind: 'warning',
          title: t('users.cannot_sync_users'),
          description: t('users.users_list_not_updated', { action: t('users.sync_users') }),
        })
      }
    }, 500)
    emit('close')
  },
  onError(error, target) {
    if (!isAccountMissing(error)) {
      return
    }
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'error',
        title: t('users.cannot_delete_user'),
        description: t('users.user_no_longer_exists_description', {
          name: target.username,
          action: t('users.sync_users'),
        }),
      })
    }, 500)
    emit('close')
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [PHONES_KEY] }).catch(() => undefined)
    return Promise.all([invalidateUsers(), invalidateAccounts()])
  },
})

const errorDescription = computed(() => {
  const code = getAccountErrorCode(error.value)
  return code ? t(`users.account_error_${code}`) : describeError(error.value)
})
</script>

<template>
  <DeleteObjectModal
    :visible="visible"
    :title="t('users.delete_user')"
    :primary-label="t('common.delete')"
    :deleting="isLoading"
    :error-title="error ? t('users.cannot_delete_user') : ''"
    :error-description="errorDescription"
    @close="emit('close')"
    @primary-click="user && mutate(user)"
  >
    <div class="flex flex-col gap-2" data-testid="delete-user-confirmation">
      <p>
        {{
          t('users.delete_user_confirmation', {
            name: user ? `${user.displayName} (${user.username})` : '',
          })
        }}
      </p>
      <p>{{ t('users.delete_user_domain') }}</p>
      <p v-if="user?.mainExtension">
        {{ t('users.delete_user_phone_data', { extension: user.mainExtension }) }}
      </p>
      <p>{{ t('users.delete_user_cannot_be_undone') }}</p>
    </div>
  </DeleteObjectModal>
</template>
