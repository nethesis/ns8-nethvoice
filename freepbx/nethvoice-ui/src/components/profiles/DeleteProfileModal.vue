<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@pinia/colada'
import DeleteObjectModal from '@/components/common/DeleteObjectModal.vue'
import { deleteProfileAndMoveUsers, getProfileUsers, type Profile } from '@/lib/profiles/profiles'
import type { User } from '@/lib/users/users'
import { useInvalidateUsers } from '@/queries/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const {
  visible = false,
  profile = undefined,
  users,
} = defineProps<{
  visible: boolean
  profile: Profile | undefined
  users: User[]
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const invalidateUsers = useInvalidateUsers()
const notificationsStore = useNotificationsStore()

const assignedUserIds = computed(() =>
  profile ? getProfileUsers(profile.id, users).map((user) => user.id) : [],
)

const {
  mutate: deleteProfileMutate,
  isLoading: deleteProfileLoading,
  reset: deleteProfileReset,
  error: deleteProfileError,
} = useMutation({
  mutation: ({ profileToDelete, userIds }: { profileToDelete: Profile; userIds: number[] }) =>
    deleteProfileAndMoveUsers(profileToDelete.id, userIds),
  onSuccess(_data, { profileToDelete }) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('profiles.profile_deleted'),
        description: t('profiles.profile_deleted_description', { name: profileToDelete.name }),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    invalidateUsers()
  },
})

watch(
  () => visible,
  () => {
    if (visible) {
      deleteProfileReset()
    }
  },
)

function confirmDelete() {
  if (profile) {
    deleteProfileMutate({ profileToDelete: profile, userIds: assignedUserIds.value })
  }
}
</script>

<template>
  <DeleteObjectModal
    :visible="visible"
    :title="t('profiles.delete_profile')"
    :primary-label="t('common.delete')"
    :deleting="deleteProfileLoading"
    :error-title="deleteProfileError ? t('profiles.cannot_delete_profile') : ''"
    :error-description="deleteProfileError ? describeError(deleteProfileError) : ''"
    @close="emit('close')"
    @primary-click="confirmDelete"
  >
    <p>{{ t('profiles.delete_profile_confirmation', { name: profile?.name ?? '' }) }}</p>
    <p v-if="assignedUserIds.length > 0">
      {{ t('profiles.delete_profile_users_moved', assignedUserIds.length) }}
    </p>
  </DeleteObjectModal>
</template>
