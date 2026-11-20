<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  focusElement,
  NeButton,
  NeCombobox,
  NeInlineNotification,
  NeLink,
  NeSideDrawer,
  NeTextArea,
  NeTextInput,
  type NeComboboxOption,
} from '@nethesis/vue-components'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import { useFocusReturn } from '@/composables/useFocusReturn'
import type { Focusable } from '@/lib/common'
import {
  buildCardTemplateColorPayload,
  buildCardTemplatePayload,
  CARD_TEMPLATES_KEY,
  type CardTemplate,
  type CardTemplateForm,
  emptyCardTemplateForm,
  saveCardTemplate,
  TEMPLATE_COLORS,
  toCardTemplateForm,
  toDuplicatedCardTemplateForm,
  validateCardTemplateForm,
} from '@/lib/integrations/cardTemplates'
import { getLegacyStatusMessage } from '@/lib/integrations/errors'
import type { FieldIssues } from '@/lib/integrations/validation'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const EJS_DOCS_URL = 'https://ejs.co/#docs'

const {
  isShown = false,
  mode,
  currentTemplate = undefined,
  templates,
  usedBy = [],
} = defineProps<{
  isShown: boolean
  mode: 'create' | 'edit' | 'duplicate'
  currentTemplate: CardTemplate | undefined
  templates: CardTemplate[]
  usedBy?: string[]
}>()

const emit = defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const form = ref<CardTemplateForm>(emptyCardTemplateForm())
const color = ref('')
const validationIssues = ref<FieldIssues>({})
const initialSnapshot = ref('')
const isShownDiscardModal = ref(false)

useFocusReturn(() => isShown)

const nameRef = useTemplateRef<Focusable>('nameRef')
const codeRef = useTemplateRef<Focusable>('codeRef')
const colorRef = useTemplateRef<Focusable>('colorRef')

const fieldRefs: Record<string, Readonly<{ value: Focusable | null }>> = {
  name: nameRef,
  code: codeRef,
}

const editing = computed(() => mode === 'edit' && !!currentTemplate)
const editingColor = computed(() => editing.value && !currentTemplate?.custom)

const isDirty = computed(() => snapshot() !== initialSnapshot.value)

const title = computed(() => {
  switch (mode) {
    case 'edit':
      return t('integrations.cards.edit_template')
    default:
      return t('integrations.cards.create_template')
  }
})

const colorOptions = computed<NeComboboxOption[]>(() => {
  const options = TEMPLATE_COLORS.map((id) => ({
    id,
    label: t(`integrations.cards.colors.${id}`),
  }))

  if (color.value && !TEMPLATE_COLORS.includes(color.value)) {
    options.unshift({ id: color.value, label: color.value })
  }
  return options
})

const usedByText = computed(() =>
  t(
    'integrations.cards.template_used_by',
    { cards: new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(usedBy) },
    usedBy.length,
  ),
)

function snapshot(): string {
  return JSON.stringify([form.value, color.value])
}

const {
  mutate: saveMutate,
  isLoading: saving,
  reset: saveReset,
  error: saveError,
} = useMutation({
  mutation: (templateForm: CardTemplateForm) =>
    saveCardTemplate(
      editingColor.value && currentTemplate
        ? buildCardTemplateColorPayload(currentTemplate, color.value)
        : buildCardTemplatePayload(templateForm),
      editing.value ? currentTemplate : undefined,
    ),
  onSuccess(_data, templateForm) {
    const edited = editing.value

    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: edited
          ? t('integrations.cards.template_updated')
          : t('integrations.cards.template_created'),
        description: t(
          edited
            ? 'integrations.cards.template_updated_description'
            : 'integrations.cards.template_created_description',
          {
            name: editingColor.value
              ? (currentTemplate?.name ?? '')
              : buildCardTemplatePayload(templateForm).name,
          },
        ),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [CARD_TEMPLATES_KEY] })
  },
})

watch(
  () => isShown,
  () => {
    if (!isShown) {
      isShownDiscardModal.value = false
      return
    }
    saveReset()
    validationIssues.value = {}

    if (currentTemplate && mode === 'duplicate') {
      form.value = toDuplicatedCardTemplateForm(currentTemplate)
    } else if (currentTemplate && mode !== 'create') {
      form.value = toCardTemplateForm(currentTemplate)
    } else {
      form.value = emptyCardTemplateForm()
    }
    color.value = currentTemplate?.color ?? ''
    initialSnapshot.value = snapshot()
    focusElement(editingColor.value ? colorRef : mode === 'edit' ? codeRef : nameRef)
  },
)

function requestClose() {
  if (saving.value || isShownDiscardModal.value) {
    return
  }

  if (isDirty.value) {
    isShownDiscardModal.value = true
    return
  }
  emit('close')
}

function discardChanges() {
  isShownDiscardModal.value = false
  emit('close')
}

function save() {
  saveReset()

  if (editingColor.value) {
    validationIssues.value = color.value ? {} : { color: 'integrations.cards.color_required' }

    if (color.value) {
      saveMutate({ ...form.value })
    } else {
      colorRef.value?.focus()
    }
    return
  }
  validationIssues.value = validateCardTemplateForm(
    form.value,
    templates.filter((template) => !editing.value || template.id !== currentTemplate?.id),
  )
  const [firstInvalidField] = Object.keys(validationIssues.value)

  if (firstInvalidField) {
    fieldRefs[firstInvalidField]?.value?.focus()
    return
  }
  saveMutate({ ...form.value })
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="title"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="requestClose"
  >
    <form novalidate @submit.prevent="save">
      <div class="flex flex-col gap-6">
        <NeCombobox
          v-if="editingColor"
          ref="colorRef"
          v-model="color"
          :label="t('integrations.cards.color')"
          :options="colorOptions"
          :placeholder="t('ne_combobox.choose')"
          :invalid-message="validationIssues.color ? t(validationIssues.color) : ''"
          :disabled="saving"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
        />
        <template v-else>
          <NeTextInput
            ref="nameRef"
            v-model="form.name"
            :label="t('integrations.name')"
            :placeholder="t('integrations.cards.template_name_placeholder')"
            :helper-text="
              editing
                ? t('integrations.cards.template_name_locked')
                : t('integrations.cards.template_name_helper')
            "
            :invalid-message="validationIssues.name ? t(validationIssues.name) : ''"
            :disabled="saving || editing"
            @blur="form.name = form.name.trim()"
          />
          <p v-if="editing && usedBy.length" class="text-tertiary-neutral text-sm">
            {{ usedByText }}
          </p>
          <div class="flex flex-col gap-2">
            <NeTextArea
              ref="codeRef"
              v-model="form.code"
              :label="t('integrations.cards.template_code')"
              :rows="10"
              class="[&_textarea]:font-mono"
              :helper-text="t('integrations.cards.template_code_helper')"
              :invalid-message="validationIssues.code ? t(validationIssues.code) : ''"
              :disabled="saving"
            />
            <div>
              <NeLink :href="EJS_DOCS_URL" target="_blank" rel="noopener noreferrer">
                {{ t('integrations.cards.ejs_docs') }}
              </NeLink>
            </div>
          </div>
        </template>
        <NeInlineNotification
          v-if="saveError"
          kind="error"
          :title="
            editing
              ? t('integrations.cards.cannot_save_template')
              : t('integrations.cards.cannot_create_template')
          "
          :description="getLegacyStatusMessage(saveError) || describeError(saveError)"
        />
      </div>
      <hr class="my-8" />
      <div class="flex justify-end gap-3">
        <NeButton type="button" kind="tertiary" size="lg" :disabled="saving" @click="requestClose">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="saving" :loading="saving">
          {{ editing ? t('common.save') : t('common.create') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
  <DiscardChangesModal
    :visible="isShownDiscardModal"
    @close="isShownDiscardModal = false"
    @discard="discardChanges"
  />
</template>
