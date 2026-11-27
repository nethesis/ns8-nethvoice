<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeButton, NeCombobox, type NeComboboxOption } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleArrowUp } from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import ImportTemplateDrawer from './ImportTemplateDrawer.vue'
import type { PhoneTemplate } from '@/lib/phones/templates'
import { usePhoneModels } from '@/queries/phones/models'
import { usePhoneTemplates, useStandardTemplate } from '@/queries/phones/templates'
import { usePermissions } from '@/queries/permissions/me'

const {
  label,
  modelName,
  disabled = false,
} = defineProps<{
  label: string
  modelName: string
  disabled?: boolean
}>()

const model = defineModel<string>({ required: true })

const { t } = useI18n()
const { isSuperadmin } = usePermissions()
const { state, refetch } = usePhoneTemplates()
const { state: modelsState } = usePhoneModels()
const initialValue = model.value
const isShownImportDrawer = ref(false)

const customNames = computed(() => (state.value.data ?? []).map((template) => template.name))

const isCustomInUse = computed(
  () => customNames.value.includes(model.value) || customNames.value.includes(initialValue),
)

const { state: standardState } = useStandardTemplate(
  () => modelName,
  () => modelsState.value.data,
  isCustomInUse,
)

const standardTemplate = computed(() => standardState.value.data ?? '')

const options = computed<NeComboboxOption[]>(() => {
  const names = [standardTemplate.value, initialValue, model.value].filter(
    (name, index, all) =>
      name !== '' && !customNames.value.includes(name) && all.indexOf(name) === index,
  )

  return [
    ...names.map((name) => ({
      id: name,
      label:
        name === standardTemplate.value ? t('phones.templates.standard_option', { name }) : name,
    })),
    ...customNames.value.map((name) => ({ id: name, label: name })),
  ]
})

function onImported(template: PhoneTemplate) {
  model.value = template.name
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <NeCombobox
      v-model="model"
      :label="label"
      :options="options"
      :placeholder="$t('ne_combobox.choose')"
      :helper-text="$t('phones.templates.template_helper')"
      :disabled="disabled || state.status === 'pending'"
      :no-results-label="$t('ne_combobox.no_results')"
      :limited-options-label="$t('ne_combobox.limited_options_label')"
      :no-options-label="$t('ne_combobox.no_options_label')"
      :selected-label="$t('ne_combobox.selected')"
      :user-input-label="$t('ne_combobox.user_input_label')"
      :optional-label="$t('common.optional')"
    />
    <LoadError
      v-if="state.status === 'error'"
      :error="state.error"
      :title="$t('phones.templates.cannot_retrieve_templates')"
      @retry="refetch()"
    />
    <div v-if="isSuperadmin">
      <NeButton
        kind="tertiary"
        :disabled="disabled"
        class="-ml-3"
        @click.prevent="isShownImportDrawer = true"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faCircleArrowUp" class="size-4" aria-hidden="true" />
        </template>
        {{ $t('phones.templates.import_template') }}
      </NeButton>
    </div>
    <Teleport to="body">
      <ImportTemplateDrawer
        :is-shown="isShownImportDrawer"
        @close="isShownImportDrawer = false"
        @imported="onImported"
      />
    </Teleport>
  </div>
</template>
