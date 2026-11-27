<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import DeleteObjectModal from '@/components/common/DeleteObjectModal.vue'
import { deleteGroup, type Group } from '@/lib/groups/groups'
import { PHONEBOOK_IMPORTS_KEY } from '@/lib/integrations/phonebookImports'
import { PHONEBOOK_SOURCES_KEY } from '@/lib/integrations/phonebookSources'
import { useInvalidateUsers } from '@/queries/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { visible = false, group = undefined } = defineProps<{
  visible: boolean
  group: Group | undefined
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const invalidateUsers = useInvalidateUsers()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const {
  mutate: deleteGroupMutate,
  isLoading: deleteGroupLoading,
  reset: deleteGroupReset,
  error: deleteGroupError,
} = useMutation({
  mutation: (groupToDelete: Group) => deleteGroup(groupToDelete.id),
  onSuccess(_data, groupToDelete) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('groups.group_deleted'),
        description: t('groups.group_deleted_description', { name: groupToDelete.name }),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    invalidateUsers()
    queryCache.invalidateQueries({ key: [PHONEBOOK_SOURCES_KEY] })
    queryCache.invalidateQueries({ key: [PHONEBOOK_IMPORTS_KEY] })
  },
})

watch(
  () => visible,
  () => {
    if (visible) {
      deleteGroupReset()
    }
  },
)

function confirmDelete() {
  if (group) {
    deleteGroupMutate(group)
  }
}
</script>

<template>
  <DeleteObjectModal
    :visible="visible"
    :title="t('groups.delete_group')"
    :primary-label="t('common.delete')"
    :deleting="deleteGroupLoading"
    :error-title="deleteGroupError ? t('groups.cannot_delete_group') : ''"
    :error-description="deleteGroupError ? describeError(deleteGroupError) : ''"
    @close="emit('close')"
    @primary-click="confirmDelete"
  >
    <div class="flex flex-col gap-2">
      <p>{{ t('groups.delete_group_confirmation', { name: group?.name ?? '' }) }}</p>
      <p>{{ t('groups.delete_group_sharing') }}</p>
    </div>
  </DeleteObjectModal>
</template>
