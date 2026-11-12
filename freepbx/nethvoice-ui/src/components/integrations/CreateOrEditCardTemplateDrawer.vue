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
  NeInlineNotification,
  NeLink,
  NeSideDrawer,
  NeTextArea,
  NeTextInput,
} from '@nethesis/vue-components'
import type { Focusable } from '@/lib/common'
import {
  buildCardTemplatePayload,
  CARD_TEMPLATES_KEY,
  type CardTemplate,
  type CardTemplateForm,
  emptyCardTemplateForm,
  saveCardTemplate,
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
} = defineProps<{
  isShown: boolean
  mode: 'create' | 'edit' | 'duplicate' | 'view'
  currentTemplate: CardTemplate | undefined
  templates: CardTemplate[]
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const form = ref<CardTemplateForm>(emptyCardTemplateForm())
const validationIssues = ref<FieldIssues>({})
const nameRef = useTemplateRef<Focusable>('nameRef')
const codeRef = useTemplateRef<Focusable>('codeRef')

const fieldRefs: Record<string, Readonly<{ value: Focusable | null }>> = {
  name: nameRef,
  code: codeRef,
}

const editing = computed(() => mode === 'edit' && !!currentTemplate)
const readOnly = computed(() => mode === 'view')

const title = computed(() => {
  switch (mode) {
    case 'edit':
      return t('integrations.cards.edit_template')
    case 'duplicate':
      return t('integrations.cards.duplicate_template', { name: currentTemplate?.name ?? '' })
    case 'view':
      return t('integrations.cards.view_template', { name: currentTemplate?.name ?? '' })
    default:
      return t('integrations.cards.create_template')
  }
})

const {
  mutate: saveMutate,
  isLoading: saving,
  reset: saveReset,
  error: saveError,
} = useMutation({
  mutation: (templateForm: CardTemplateForm) =>
    saveCardTemplate(
      buildCardTemplatePayload(templateForm),
      editing.value ? currentTemplate : undefined,
    ),
  onSuccess(_data, templateForm) {
    const edited = editing.value

    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: edited
          ? t('integrations.cards.template_saved')
          : t('integrations.cards.template_created'),
        description: t(
          edited ? 'common.object_saved_successfully' : 'common.object_created_successfully',
          { name: buildCardTemplatePayload(templateForm).name },
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
    focusElement(mode === 'edit' || mode === 'view' ? codeRef : nameRef)
  },
)

function save() {
  saveReset()
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
    @close="emit('close')"
  >
    <form novalidate @submit.prevent="save">
      <div class="flex flex-col gap-6">
        <NeTextInput
          v-if="!readOnly"
          ref="nameRef"
          v-model="form.name"
          :label="t('integrations.name')"
          :helper-text="
            editing
              ? t('integrations.cards.template_name_locked')
              : t('integrations.cards.template_name_helper')
          "
          :invalid-message="validationIssues.name ? t(validationIssues.name) : ''"
          :disabled="saving || editing"
          @blur="form.name = form.name.trim()"
        />
        <NeInlineNotification
          v-if="readOnly"
          kind="info"
          :description="t('integrations.cards.built_in_template_info')"
        />
        <NeTextArea
          ref="codeRef"
          v-model="form.code"
          :label="t('integrations.cards.template_code')"
          :rows="18"
          class="[&_textarea]:font-mono"
          :readonly="readOnly"
          :invalid-message="validationIssues.code ? t(validationIssues.code) : ''"
          :disabled="saving"
        />
        <p class="text-secondary-neutral text-sm">
          {{ t('integrations.cards.template_code_helper') }}
          <NeLink :href="EJS_DOCS_URL" target="_blank" rel="noopener noreferrer">
            {{ t('integrations.cards.ejs_docs') }}
          </NeLink>
        </p>
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
      <div class="flex justify-end">
        <NeButton
          type="button"
          :kind="readOnly ? 'primary' : 'tertiary'"
          size="lg"
          :disabled="saving"
          :class="{ 'mr-3': !readOnly }"
          @click="emit('close')"
        >
          {{ readOnly ? t('common.close') : t('common.cancel') }}
        </NeButton>
        <NeButton
          v-if="!readOnly"
          type="submit"
          kind="primary"
          size="lg"
          :disabled="saving"
          :loading="saving"
        >
          {{ editing ? t('common.save') : t('integrations.cards.create_template') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
