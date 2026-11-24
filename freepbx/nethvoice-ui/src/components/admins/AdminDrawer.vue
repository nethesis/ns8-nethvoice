<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as v from 'valibot'
import { useMutation } from '@pinia/colada'
import {
  focusElement,
  NeButton,
  NeCheckboxCards,
  NeCombobox,
  NeInlineNotification,
  NeModal,
  NeRadioSelection,
  NeSideDrawer,
  type NeComboboxOption,
} from '@nethesis/vue-components'
import {
  AdminFormSchema,
  buildPermissions,
  getAdminCandidates,
  getAdminErrorCode,
  getAdminSections,
  isFullAccess,
  setAdminPermissions,
  type AdminAccess,
  type AdminAccount,
} from '@/lib/admins/admins'
import type { Focusable } from '@/lib/common'
import { SECTIONS, type Permission } from '@/lib/permissions/permissions'
import { useFocusReturn } from '@/composables/useFocusReturn'
import { useInvalidateAdmins } from '@/queries/admins/admins'
import { useUserAccounts } from '@/queries/users/accounts'
import { useLoginStore } from '@/stores/login'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const {
  isShown = false,
  currentAdmin = undefined,
  admins,
} = defineProps<{
  isShown: boolean
  currentAdmin: AdminAccount | undefined
  admins: AdminAccount[]
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const loginStore = useLoginStore()
const notificationsStore = useNotificationsStore()
const invalidateAdmins = useInvalidateAdmins()
const { state: accountsState } = useUserAccounts()

useFocusReturn(() => isShown)

const username = ref('')
const access = ref<AdminAccess>('sections')
const sections = ref<string[]>([])
const usernameIssue = ref('')
const sectionsIssue = ref('')
const isShownUnsavedModal = ref(false)
const usernameRef = useTemplateRef<Focusable>('usernameRef')
const accessRef = useTemplateRef<Focusable>('accessRef')
const sectionsRef = useTemplateRef<Focusable>('sectionsRef')

const isEdit = computed(() => currentAdmin !== undefined)

const candidateOptions = computed<NeComboboxOption[]>(() =>
  getAdminCandidates(accountsState.value.data ?? [], admins, loginStore.username).map(
    (candidate) => ({
      id: candidate.username,
      label: candidate.username,
      description: candidate.unavailable
        ? t(`admin_control.candidate_${candidate.unavailable}`)
        : candidate.displayName || undefined,
      disabled: candidate.unavailable !== null,
    }),
  ),
)

const selectedOption = computed<NeComboboxOption | undefined>(() =>
  currentAdmin
    ? {
        id: currentAdmin.username,
        label: currentAdmin.username,
        description: currentAdmin.displayName || undefined,
      }
    : undefined,
)

const accessOptions = computed(() => [
  {
    id: 'full',
    label: t('admin_control.full_access'),
    description: t('admin_control.full_access_description'),
  },
  {
    id: 'sections',
    label: t('admin_control.selected_sections'),
    description: t('admin_control.selected_sections_description'),
  },
])

const accessValue = computed({
  get: () => access.value,
  set: (value: string) => {
    access.value = value === 'full' ? 'full' : 'sections'
    sectionsIssue.value = ''
  },
})

const sectionOptions = computed(() =>
  SECTIONS.map((section) => ({
    id: section,
    label: t(`${section}.title`),
    description: t(`admin_control.section_description_${section}`),
  })),
)

const comboboxLabels = computed(() => ({
  noResultsLabel: t('ne_combobox.no_results'),
  limitedOptionsLabel: t('ne_combobox.limited_options_label'),
  noOptionsLabel: t('admin_control.no_domain_users'),
  selectedLabel: t('ne_combobox.selected'),
  userInputLabel: t('ne_combobox.user_input_label'),
  optionalLabel: t('common.optional'),
}))

const initialPermissions = computed<Permission[]>(() => currentAdmin?.permissions ?? [])

const permissions = computed(() => buildPermissions(access.value, sections.value))

const isDirty = computed(() => {
  if (!isEdit.value) {
    return username.value !== '' || sections.value.length > 0 || access.value !== 'sections'
  }
  const initial = initialPermissions.value
  return (
    permissions.value.length !== initial.length ||
    permissions.value.some((permission) => !initial.includes(permission))
  )
})

const { mutate, isLoading, error, reset } = useMutation({
  mutation: ({ name, granted }: { name: string; granted: Permission[] }) =>
    setAdminPermissions(name, granted),
  onSuccess(_data, { name }) {
    const added = !isEdit.value
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: added ? t('admin_control.admin_added') : t('admin_control.admin_updated'),
        description: added
          ? t('admin_control.admin_added_description', { name })
          : t('admin_control.admin_updated_description', { name }),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => invalidateAdmins(),
})

const errorDescription = computed(() => {
  const code = getAdminErrorCode(error.value)
  return code ? t(`admin_control.error_${code}`) : describeError(error.value)
})

watch(
  () => isShown,
  () => {
    if (!isShown) {
      return
    }
    reset()
    usernameIssue.value = ''
    sectionsIssue.value = ''
    isShownUnsavedModal.value = false
    username.value = currentAdmin?.username ?? ''
    access.value = currentAdmin && isFullAccess(currentAdmin.permissions) ? 'full' : 'sections'
    sections.value = currentAdmin ? getAdminSections(currentAdmin.permissions) : []
    focusElement(currentAdmin ? accessRef : usernameRef)
  },
)

watch(sections, () => {
  sectionsIssue.value = ''
})

function save() {
  reset()
  usernameIssue.value = ''
  sectionsIssue.value = ''
  const result = v.safeParse(AdminFormSchema, {
    username: username.value,
    access: access.value,
    sections: sections.value,
  })

  if (!result.success) {
    for (const issue of result.issues) {
      const field = issue.path?.[0]?.key

      if (field === 'username' && !usernameIssue.value) {
        usernameIssue.value = t(issue.message)
      } else if (field === 'sections' && !sectionsIssue.value) {
        sectionsIssue.value = t(issue.message)
      }
    }
    focusElement(usernameIssue.value ? usernameRef : sectionsRef)
    return
  }
  mutate({ name: result.output.username, granted: permissions.value })
}

function requestClose() {
  if (isLoading.value) {
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
    :title="isEdit ? t('admin_control.edit_admin') : t('admin_control.add_admin')"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="requestClose"
  >
    <form novalidate @submit.prevent="save">
      <div class="space-y-6">
        <NeCombobox
          ref="usernameRef"
          v-model="username"
          :label="t('admin_control.user')"
          :options="candidateOptions"
          :selected-option="selectedOption"
          :placeholder="t('admin_control.choose_user')"
          :helper-text="isEdit ? '' : t('admin_control.user_helper')"
          :invalid-message="usernameIssue"
          :disabled="isLoading || isEdit"
          :loading-options="accountsState.status === 'pending'"
          :show-selected-label="false"
          v-bind="comboboxLabels"
          data-testid="admin-user"
        />
        <NeInlineNotification
          v-if="!isEdit && accountsState.status === 'error'"
          kind="error"
          :title="t('admin_control.cannot_load_users')"
          :description="describeError(accountsState.error)"
        />
        <NeRadioSelection
          ref="accessRef"
          v-model="accessValue"
          :label="t('admin_control.access')"
          :options="accessOptions"
          card
          grid-style="grid-cols-1 gap-3 sm:grid-cols-2"
          :disabled="isLoading"
        />
        <NeCheckboxCards
          v-if="access === 'sections'"
          ref="sectionsRef"
          v-model="sections"
          :label="t('admin_control.sections')"
          :options="sectionOptions"
          grid-style="grid-cols-1 gap-3"
          :invalid-message="sectionsIssue"
          :disabled="isLoading"
        />
        <NeInlineNotification
          v-if="error"
          kind="error"
          :title="
            isEdit ? t('admin_control.cannot_save_admin') : t('admin_control.cannot_add_admin')
          "
          :description="errorDescription"
        />
      </div>
      <hr class="my-8" />
      <div class="flex justify-end gap-3">
        <NeButton kind="tertiary" size="lg" :disabled="isLoading" @click.prevent="emit('close')">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="isLoading" :loading="isLoading">
          {{ isEdit ? t('common.save') : t('common.add') }}
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
