<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeMultiselectCombobox, type NeMultiselectComboboxOption } from '@nethesis/vue-components'
import type { Focusable } from '@/lib/common'
import type { ProfileOption } from '@/lib/integrations/lookups'

const {
  profiles,
  busyProfileIds = [],
  busyDescription = '',
  helperText = '',
  invalidMessage = '',
  disabled = false,
  loading = false,
} = defineProps<{
  profiles: ProfileOption[]
  busyProfileIds?: string[]
  busyDescription?: string
  helperText?: string
  invalidMessage?: string
  disabled?: boolean
  loading?: boolean
}>()

const profileIds = defineModel<string[]>({ required: true })

const { t } = useI18n()
const comboboxRef = useTemplateRef<Focusable>('comboboxRef')

const options = computed<NeMultiselectComboboxOption[]>(() =>
  profiles.map((profile) => {
    const busy = busyProfileIds.includes(profile.id)

    return {
      id: profile.id,
      label: profile.name,
      description: busy ? busyDescription : undefined,
      disabled: busy,
    }
  }),
)

const selectedOptions = computed<NeMultiselectComboboxOption[]>({
  get: () =>
    profileIds.value.map(
      (id) => options.value.find((option) => option.id === id) ?? { id, label: `#${id}` },
    ),
  set: (selected) => {
    profileIds.value = selected.map((option) => option.id)
  },
})

defineExpose({ focus: () => comboboxRef.value?.focus() })
</script>

<template>
  <NeMultiselectCombobox
    ref="comboboxRef"
    v-model="selectedOptions"
    :label="t('integrations.profiles')"
    :options="options"
    :placeholder="t('ne_combobox.choose_multiple')"
    :helper-text="helperText"
    :invalid-message="invalidMessage"
    :disabled="disabled"
    :loading-options="loading"
    :no-results-label="t('ne_combobox.no_results')"
    :limited-options-label="t('ne_combobox.limited_options_label')"
    :no-options-label="t('ne_combobox.no_options_label')"
    :user-input-label="t('ne_combobox.user_input_label')"
    :optional-label="t('common.optional')"
    :remove-label="t('common.remove')"
  />
</template>
