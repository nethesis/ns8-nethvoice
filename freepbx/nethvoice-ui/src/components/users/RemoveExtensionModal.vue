<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@pinia/colada'
import DeleteObjectModal from '@/components/common/DeleteObjectModal.vue'
import { postMainExtension } from '@/lib/users/extensions'
import type { User } from '@/lib/users/users'
import { useInvalidateUsers } from '@/queries/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { visible = false, user = undefined } = defineProps<{
  visible: boolean
  user?: User
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const invalidateUsers = useInvalidateUsers()

watch(
  () => visible,
  (shown) => {
    if (shown) {
      reset()
    }
  },
)

const { mutate, isLoading, error, reset } = useMutation({
  mutation: (target: User) => postMainExtension(target.username, ''),
  onSuccess(_, target) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('users.extension_removed'),
        description: t('users.extension_removed_description', {
          extension: target.mainExtension,
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
</script>

<template>
  <DeleteObjectModal
    :visible="visible"
    :title="t('users.remove_extension')"
    :primary-label="t('users.remove_extension')"
    :deleting="isLoading"
    :confirmation-message="
      t('users.remove_extension_confirmation', {
        extension: user?.mainExtension ?? '',
        name: user?.displayName ?? '',
      })
    "
    :error-title="error ? t('users.cannot_remove_extension') : ''"
    :error-description="describeError(error)"
    @close="emit('close')"
    @primary-click="user && mutate(user)"
  />
</template>
