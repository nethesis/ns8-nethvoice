<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeInlineNotification,
  NeMultiselectCombobox,
  NeRadioSelection,
  type NeMultiselectComboboxOption,
} from '@nethesis/vue-components'
import type { Focusable } from '@/lib/common'
import { useGroupNames } from '@/queries/integrations/lookups'
import { describeError } from '@/stores/notifications'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'

const { invalidMessage = '', disabled = false } = defineProps<{
  invalidMessage?: string
  disabled?: boolean
}>()

const sharing = defineModel<'public' | 'groups'>('sharing', { required: true })
const groups = defineModel<string[]>('groups', { required: true })

const { t } = useI18n()
const runtimeConfigStore = useRuntimeConfigStore()
const { state: groupsState } = useGroupNames()

const radioRef = useTemplateRef<Focusable>('radioRef')
const groupsRef = useTemplateRef<Focusable>('groupsRef')

const sharingOptions = computed(() => [
  { id: 'public', label: t('integrations.phonebook.everyone') },
  { id: 'groups', label: t('integrations.phonebook.selected_groups') },
])

const sharingValue = computed({
  get: () => sharing.value,
  set: (value: string) => {
    sharing.value = value === 'groups' ? 'groups' : 'public'
  },
})

const groupOptions = computed<NeMultiselectComboboxOption[]>(() =>
  (groupsState.value.data ?? []).map((name) => ({ id: name, label: name })),
)

const selectedGroups = computed<NeMultiselectComboboxOption[]>({
  get: () => groups.value.map((name) => ({ id: name, label: name })),
  set: (options) => {
    groups.value = options.map((option) => option.id)
  },
})

defineExpose({
  focus: () => radioRef.value?.focus(),
  focusGroups: () => groupsRef.value?.focus(),
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <NeRadioSelection
      ref="radioRef"
      v-model="sharingValue"
      :label="t('integrations.phonebook.visible_to')"
      :options="sharingOptions"
      :disabled="disabled"
    />
    <template v-if="sharing === 'groups'">
      <NeMultiselectCombobox
        ref="groupsRef"
        v-model="selectedGroups"
        :label="t('integrations.phonebook.groups')"
        :options="groupOptions"
        :placeholder="t('integrations.phonebook.groups_placeholder')"
        :helper-text="
          t('integrations.phonebook.groups_helper', {
            cti: runtimeConfigStore.config.ctiProductName,
          })
        "
        :invalid-message="invalidMessage"
        :disabled="disabled"
        :loading-options="groupsState.status === 'pending'"
        :no-results-label="t('ne_combobox.no_results')"
        :limited-options-label="t('ne_combobox.limited_options_label')"
        :no-options-label="t('integrations.phonebook.no_groups')"
        :user-input-label="t('ne_combobox.user_input_label')"
        :optional-label="t('common.optional')"
        :remove-label="t('common.remove')"
      />
      <NeInlineNotification
        v-if="groupsState.status === 'error'"
        kind="error"
        :title="t('integrations.phonebook.cannot_load_groups')"
        :description="describeError(groupsState.error)"
      />
    </template>
  </div>
</template>
