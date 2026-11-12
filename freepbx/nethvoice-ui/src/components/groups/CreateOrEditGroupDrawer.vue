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
  NeMultiselectCombobox,
  NeSideDrawer,
  NeTextInput,
  type NeMultiselectComboboxOption,
} from '@nethesis/vue-components'
import {
  buildGroupFormSchema,
  createGroup,
  GROUPS_KEY,
  saveGroupMembers,
  type Group,
  type GroupForm,
} from '@/lib/groups/groups'
import { PROFILES_KEY } from '@/lib/profiles/profiles'
import { hasMainExtension, type User } from '@/lib/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const {
  isShown = false,
  currentGroup = undefined,
  groups,
  users,
} = defineProps<{
  isShown: boolean
  currentGroup: Group | undefined
  groups: Group[]
  users: User[]
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const name = ref('')
const nameRef = useTemplateRef<InstanceType<typeof NeTextInput>>('nameRef')
const selectedUsers = ref<NeMultiselectComboboxOption[]>([])
const usersRef = useTemplateRef<{ focus: () => void }>('usersRef')
const nameIssue = ref('')

const userOptions = computed<NeMultiselectComboboxOption[]>(() =>
  users
    .filter((user) => hasMainExtension(user) || currentGroup?.userIds.includes(user.id))
    .map((user) => ({
      id: String(user.id),
      label: user.username,
      description: user.displayName === user.username ? undefined : user.displayName,
    })),
)

const {
  mutate: createGroupMutate,
  isLoading: createGroupLoading,
  reset: createGroupReset,
  error: createGroupError,
} = useMutation({
  mutation: (group: GroupForm) => createGroup(group),
  onSuccess(_data, group) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('groups.group_created'),
        description: t('common.object_created_successfully', { name: group.name }),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [GROUPS_KEY] })
    queryCache.invalidateQueries({ key: [PROFILES_KEY] })
  },
})

const {
  mutate: editGroupMutate,
  isLoading: editGroupLoading,
  reset: editGroupReset,
  error: editGroupError,
} = useMutation({
  mutation: ({ group, userIds }: { group: Group; userIds: number[] }) =>
    saveGroupMembers(group.id, group.userIds, userIds),
  onSuccess(_data, { group }) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('groups.group_saved'),
        description: t('common.object_saved_successfully', { name: group.name }),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [GROUPS_KEY] })
  },
})

const saving = computed(() => createGroupLoading.value || editGroupLoading.value)

watch(
  () => isShown,
  () => {
    if (!isShown) {
      return
    }
    createGroupReset()
    editGroupReset()
    nameIssue.value = ''
    name.value = currentGroup?.name ?? ''
    selectedUsers.value = userOptions.value.filter((option) =>
      currentGroup?.userIds.includes(Number(option.id)),
    )
    focusElement(currentGroup ? usersRef : nameRef)
  },
)

function saveGroup() {
  createGroupReset()
  editGroupReset()
  nameIssue.value = ''
  const userIds = selectedUsers.value.map((option) => Number(option.id))

  if (currentGroup) {
    editGroupMutate({ group: currentGroup, userIds })
    return
  }
  const validation = v.safeParse(buildGroupFormSchema(groups.map((group) => group.name)), {
    name: name.value,
    userIds,
  })

  if (!validation.success) {
    nameIssue.value = validation.issues[0].message
    focusElement(nameRef)
    return
  }
  createGroupMutate(validation.output)
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="currentGroup ? t('groups.edit_group') : t('groups.create_group')"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="emit('close')"
  >
    <form @submit.prevent="saveGroup">
      <div class="space-y-6">
        <NeTextInput
          ref="nameRef"
          v-model="name"
          :label="t('groups.name')"
          :placeholder="t('groups.name_placeholder')"
          :helper-text="currentGroup ? t('groups.rename_not_available') : ''"
          :invalid-message="nameIssue ? t(nameIssue) : ''"
          :disabled="saving || !!currentGroup"
          @blur="name = name.trim()"
        />
        <NeMultiselectCombobox
          ref="usersRef"
          v-model="selectedUsers"
          :label="t('groups.users')"
          :options="userOptions"
          :placeholder="t('groups.choose_users')"
          :disabled="saving"
          optional
          :optional-label="t('common.optional')"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :remove-label="t('common.remove')"
        />
        <NeInlineNotification
          v-if="createGroupError"
          kind="error"
          :title="t('groups.cannot_create_group')"
          :description="describeError(createGroupError)"
        />
        <NeInlineNotification
          v-if="editGroupError"
          kind="error"
          :title="t('groups.cannot_save_group')"
          :description="describeError(editGroupError)"
        />
      </div>
      <hr class="my-8" />
      <div class="flex justify-end gap-3">
        <NeButton kind="tertiary" size="lg" :disabled="saving" @click.prevent="emit('close')">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="saving" :loading="saving">
          {{ currentGroup ? t('common.save') : t('groups.create') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
