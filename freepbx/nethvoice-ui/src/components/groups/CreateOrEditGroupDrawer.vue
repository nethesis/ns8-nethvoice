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
  NeModal,
  NeMultiselectCombobox,
  NeSideDrawer,
  NeTextInput,
  type NeMultiselectComboboxOption,
} from '@nethesis/vue-components'
import {
  buildGroupFormSchema,
  createGroup,
  GROUP_NAME_MAX_LENGTH,
  GroupMembersError,
  updateGroup,
  type Group,
  type GroupForm,
} from '@/lib/groups/groups'
import { PHONEBOOK_IMPORTS_KEY } from '@/lib/integrations/phonebookImports'
import { PHONEBOOK_SOURCES_KEY } from '@/lib/integrations/phonebookSources'
import { hasMainExtension, type User } from '@/lib/users/users'
import { useInvalidateUsers } from '@/queries/users/users'
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
const invalidateUsers = useInvalidateUsers()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const name = ref('')
const nameRef = useTemplateRef<InstanceType<typeof NeTextInput>>('nameRef')
const selectedUsers = ref<NeMultiselectComboboxOption[]>([])
const nameIssue = ref('')
const isShownUnsavedModal = ref(false)

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
        description: t('groups.group_created_description', { name: group.name }),
      })
    }, 500)
    emit('close')
  },
  onError(error, group) {
    if (!(error instanceof GroupMembersError)) {
      return
    }
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'error',
        title: t('groups.cannot_add_group_users'),
        description: t('groups.group_created_without_users_description', {
          name: group.name,
          error: describeError(error.cause),
        }),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    invalidateUsers()
  },
})

const {
  mutate: editGroupMutate,
  isLoading: editGroupLoading,
  reset: editGroupReset,
  error: editGroupError,
} = useMutation({
  mutation: ({ group, form }: { group: Group; form: GroupForm }) => updateGroup(group, form),
  onSuccess(_data, { form }) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('groups.group_saved'),
        description: t('groups.group_updated_description', { name: form.name }),
      })
    }, 500)
    emit('close')
  },
  onSettled: (_data, _error, { group, form }) => {
    invalidateUsers()
    if (form.name !== group.name) {
      queryCache.invalidateQueries({ key: [PHONEBOOK_SOURCES_KEY] })
      queryCache.invalidateQueries({ key: [PHONEBOOK_IMPORTS_KEY] })
    }
  },
})

const saving = computed(() => createGroupLoading.value || editGroupLoading.value)

const selectedUserIds = computed(() => selectedUsers.value.map((option) => Number(option.id)))

const isRenaming = computed(() => !!currentGroup && name.value.trim() !== currentGroup.name)

const isDirty = computed(() => {
  const initialUserIds = currentGroup?.userIds ?? []

  return (
    name.value.trim() !== (currentGroup?.name ?? '') ||
    selectedUserIds.value.length !== initialUserIds.length ||
    selectedUserIds.value.some((userId) => !initialUserIds.includes(userId))
  )
})

watch(
  () => isShown,
  () => {
    if (!isShown) {
      return
    }
    createGroupReset()
    editGroupReset()
    nameIssue.value = ''
    isShownUnsavedModal.value = false
    name.value = currentGroup?.name ?? ''
    selectedUsers.value = userOptions.value.filter((option) =>
      currentGroup?.userIds.includes(Number(option.id)),
    )
    focusElement(nameRef)
  },
)

function saveGroup() {
  createGroupReset()
  editGroupReset()
  nameIssue.value = ''
  const userIds = selectedUserIds.value

  if (currentGroup && !isRenaming.value) {
    editGroupMutate({ group: currentGroup, form: { name: currentGroup.name, userIds } })
    return
  }
  const otherGroupNames = groups
    .filter((group) => group.id !== currentGroup?.id)
    .map((group) => group.name)
  const validation = v.safeParse(buildGroupFormSchema(otherGroupNames), {
    name: name.value,
    userIds,
  })

  if (!validation.success) {
    nameIssue.value = validation.issues[0].message
    focusElement(nameRef)
    return
  }
  if (currentGroup) {
    editGroupMutate({ group: currentGroup, form: validation.output })
    return
  }
  createGroupMutate(validation.output)
}

function requestClose() {
  if (saving.value) {
    return
  }

  if (isDirty.value) {
    isShownUnsavedModal.value = true
    return
  }
  emit('close')
}

function discardChanges() {
  isShownUnsavedModal.value = false
  emit('close')
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="currentGroup ? t('groups.edit_group') : t('groups.create_group')"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="requestClose"
  >
    <form @submit.prevent="saveGroup">
      <div class="space-y-6">
        <NeTextInput
          ref="nameRef"
          v-model="name"
          :label="t('groups.name')"
          :placeholder="t('groups.name_placeholder')"
          :invalid-message="nameIssue ? t(nameIssue, { max: GROUP_NAME_MAX_LENGTH }) : ''"
          :disabled="saving"
          @blur="name = name.trim()"
        />
        <NeInlineNotification
          v-if="isRenaming"
          kind="warning"
          :title="t('groups.rename_group_title')"
          :description="t('groups.rename_group_description')"
        />
        <NeMultiselectCombobox
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
          v-if="createGroupError && !(createGroupError instanceof GroupMembersError)"
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
    <NeModal
      :visible="isShownUnsavedModal"
      :title="t('common.unsaved_changes')"
      kind="warning"
      :primary-label="t('common.discard_changes')"
      primary-button-kind="danger"
      :cancel-label="t('common.keep_editing')"
      :close-aria-label="t('common.close')"
      @close="isShownUnsavedModal = false"
      @primary-click="discardChanges"
    >
      <p>{{ t('common.unsaved_changes_description') }}</p>
    </NeModal>
  </NeSideDrawer>
</template>
