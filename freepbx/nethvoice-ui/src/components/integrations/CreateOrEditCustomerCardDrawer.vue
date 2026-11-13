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
  NeFormItemLabel,
  NeInlineNotification,
  NeSideDrawer,
  NeTextArea,
  NeTextInput,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faEye } from '@fortawesome/free-solid-svg-icons'
import ProfilesMultiselect from './ProfilesMultiselect.vue'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import { useFocusReturn } from '@/composables/useFocusReturn'
import { isApiError } from '@/lib/api/errors'
import type { Focusable } from '@/lib/common'
import {
  buildCustomerCardPayload,
  buildCustomerCardPreviewPayload,
  CALLER_NUMBER_PLACEHOLDER,
  CUSTOMER_CARDS_KEY,
  type CustomerCard,
  type CustomerCardForm,
  emptyCustomerCardForm,
  previewCustomerCard,
  saveCustomerCard,
  toCustomerCardForm,
  validateCustomerCardForm,
} from '@/lib/integrations/customerCards'
import { getLegacyStatusMessage } from '@/lib/integrations/errors'
import { PROFILES_KEY } from '@/lib/profiles/profiles'
import type { FieldIssues } from '@/lib/integrations/validation'
import { useProfileOptions } from '@/queries/integrations/lookups'
import {
  useCardTemplates,
  useCustomerCards,
  useDbConnections,
} from '@/queries/integrations/customerCards'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useThemeStore } from '@/stores/theme'

const PREVIEW_STYLESHEET =
  'https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css'

const { isShown = false, currentCard = undefined } = defineProps<{
  isShown: boolean
  currentCard: CustomerCard | undefined
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const themeStore = useThemeStore()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state: profilesState } = useProfileOptions()
const { state: connectionsState } = useDbConnections()
const { state: templatesState } = useCardTemplates()
const { state: cardsState } = useCustomerCards()

const TEST_NUMBER_PATTERN = /^\+?[0-9]*$/

const form = ref<CustomerCardForm>(emptyCustomerCardForm())
const validationIssues = ref<FieldIssues>({})
const testNumber = ref('')
const initialSnapshot = ref('')
const isShownDiscardModal = ref(false)

useFocusReturn(() => isShown)

const nameRef = useTemplateRef<Focusable>('nameRef')
const connectionRef = useTemplateRef<Focusable>('connectionRef')
const templateRef = useTemplateRef<Focusable>('templateRef')
const profilesRef = useTemplateRef<Focusable>('profilesRef')
const queryRef = useTemplateRef<Focusable>('queryRef')
const testNumberRef = useTemplateRef<Focusable>('testNumberRef')

const fieldRefs: Record<string, Readonly<{ value: Focusable | null }>> = {
  name: nameRef,
  dbConnectionId: connectionRef,
  templateId: templateRef,
  profileIds: profilesRef,
  query: queryRef,
  testNumber: testNumberRef,
}

const profiles = computed(() => profilesState.value.data ?? [])

const isDirty = computed(() => JSON.stringify(form.value) !== initialSnapshot.value)

const usesCallerNumber = computed(() => form.value.query.includes(CALLER_NUMBER_PLACEHOLDER))

const connectionOptions = computed(() =>
  (connectionsState.value.data ?? []).map((connection) => ({
    id: connection.id,
    label: connection.name,
    description: `${connection.host}:${connection.port}`,
  })),
)

const templateOptions = computed(() => {
  const options = (templatesState.value.data ?? []).map((template) => ({
    id: template.id,
    label: template.name,
    description: template.custom
      ? t('integrations.cards.template_custom')
      : t('integrations.cards.template_built_in'),
  }))

  if (currentCard && !options.some((option) => option.id === currentCard.templateId)) {
    options.unshift({
      id: currentCard.templateId,
      label: currentCard.templateName,
      description: t('integrations.cards.template_not_listed'),
    })
  }
  return options
})

const previewDocument = computed(() =>
  previewHtml.value === undefined
    ? ''
    : `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${PREVIEW_STYLESHEET}"><style>body{padding:8px;}</style></head><body>${previewHtml.value}</body></html>`,
)

const {
  mutate: saveMutate,
  isLoading: saving,
  reset: saveReset,
  error: saveError,
} = useMutation({
  mutation: (cardForm: CustomerCardForm) =>
    saveCustomerCard(buildCustomerCardPayload(cardForm), currentCard?.id),
  onSuccess(_data, cardForm) {
    const edited = !!currentCard

    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: edited ? t('integrations.cards.card_saved') : t('integrations.cards.card_created'),
        description: t(
          edited ? 'common.object_saved_successfully' : 'common.object_created_successfully',
          { name: cardForm.name.trim() },
        ),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [CUSTOMER_CARDS_KEY] })
    queryCache.invalidateQueries({ key: [PROFILES_KEY] })
  },
})

const {
  mutate: previewMutate,
  isLoading: previewing,
  reset: previewReset,
  error: previewError,
  data: previewHtml,
} = useMutation({
  mutation: ({ cardForm, number }: { cardForm: CustomerCardForm; number: string }) =>
    previewCustomerCard(buildCustomerCardPreviewPayload(cardForm, number)),
})

const busy = computed(() => saving.value || previewing.value)

watch(
  () => isShown,
  () => {
    if (!isShown) {
      isShownDiscardModal.value = false
      return
    }
    saveReset()
    previewReset()
    validationIssues.value = {}
    testNumber.value = ''
    form.value = currentCard ? toCustomerCardForm(currentCard) : emptyCustomerCardForm()
    initialSnapshot.value = JSON.stringify(form.value)
    focusElement(nameRef)
  },
)

function focusFirstInvalidField(fields: string[]): boolean {
  const firstInvalidField = Object.keys(validationIssues.value).find((field) =>
    fields.includes(field),
  )

  if (firstInvalidField) {
    fieldRefs[firstInvalidField]?.value?.focus()
    return true
  }
  return false
}

function preview() {
  previewReset()
  const previewFields = ['dbConnectionId', 'templateId', 'query', 'testNumber']
  const issues = validateCustomerCardForm(form.value, [])

  if (!TEST_NUMBER_PATTERN.test(testNumber.value.trim())) {
    issues.testNumber = 'integrations.cards.test_number_invalid'
  }
  validationIssues.value = Object.fromEntries(
    Object.entries(issues).filter(([field]) => previewFields.includes(field)),
  )

  if (!focusFirstInvalidField(previewFields)) {
    previewMutate({ cardForm: { ...form.value }, number: testNumber.value })
  }
}

function describePreviewError(error: unknown): string {
  return (
    getLegacyStatusMessage(error) ||
    (isApiError(error) && error.status >= 500
      ? t('integrations.cards.preview_failed_description')
      : describeError(error))
  )
}

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
  validationIssues.value = validateCustomerCardForm(
    form.value,
    (cardsState.value.data ?? []).filter((card) => card.id !== currentCard?.id),
  )

  if (!focusFirstInvalidField(Object.keys(fieldRefs))) {
    saveMutate({ ...form.value })
  }
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="currentCard ? t('integrations.cards.edit_card') : t('integrations.cards.create_card')"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="requestClose"
  >
    <form novalidate @submit.prevent="save">
      <div class="flex flex-col gap-6">
        <NeTextInput
          ref="nameRef"
          v-model="form.name"
          :label="t('integrations.name')"
          :invalid-message="validationIssues.name ? t(validationIssues.name) : ''"
          :disabled="busy"
          @blur="form.name = form.name.trim()"
        />
        <NeCombobox
          ref="connectionRef"
          v-model="form.dbConnectionId"
          :label="t('integrations.cards.connection')"
          :options="connectionOptions"
          :placeholder="t('ne_combobox.choose')"
          :invalid-message="
            validationIssues.dbConnectionId ? t(validationIssues.dbConnectionId) : ''
          "
          :disabled="busy || connectionsState.status !== 'success'"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('integrations.cards.no_connections')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
        />
        <NeCombobox
          ref="templateRef"
          v-model="form.templateId"
          :label="t('integrations.cards.template')"
          :options="templateOptions"
          :placeholder="t('ne_combobox.choose')"
          :invalid-message="validationIssues.templateId ? t(validationIssues.templateId) : ''"
          :disabled="busy || templatesState.status !== 'success'"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('integrations.cards.no_templates')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
        />
        <ProfilesMultiselect
          ref="profilesRef"
          v-model="form.profileIds"
          :profiles="profiles"
          :helper-text="t('integrations.cards.profiles_helper')"
          :invalid-message="validationIssues.profileIds ? t(validationIssues.profileIds) : ''"
          :disabled="busy"
          :loading="profilesState.status === 'pending'"
        />
        <NeInlineNotification
          v-if="profilesState.status === 'error'"
          kind="error"
          :title="t('integrations.cannot_load_profiles')"
          :description="describeError(profilesState.error)"
        />
        <NeTextArea
          ref="queryRef"
          v-model="form.query"
          :label="t('integrations.query')"
          :rows="6"
          class="[&_textarea]:font-mono"
          placeholder="SELECT * FROM contacts WHERE phone LIKE '%$NUMBER'"
          :helper-text="t('integrations.cards.query_helper')"
          :invalid-message="validationIssues.query ? t(validationIssues.query) : ''"
          :disabled="busy"
        />
        <NeTextInput
          v-if="usesCallerNumber"
          ref="testNumberRef"
          v-model="testNumber"
          :label="t('integrations.cards.test_number')"
          :helper-text="t('integrations.cards.test_number_helper')"
          inputmode="tel"
          :invalid-message="validationIssues.testNumber ? t(validationIssues.testNumber) : ''"
          :disabled="busy"
          optional
          :optional-label="t('common.optional')"
          @blur="testNumber = testNumber.trim()"
        />
        <div class="flex flex-col gap-3">
          <div>
            <NeButton
              type="button"
              kind="secondary"
              :disabled="busy"
              :loading="previewing"
              @click="preview"
            >
              <template #prefix>
                <FontAwesomeIcon :icon="faEye" class="h-4 w-4" aria-hidden="true" />
              </template>
              {{ t('integrations.cards.show_preview') }}
            </NeButton>
          </div>
          <NeInlineNotification
            v-if="previewError"
            kind="error"
            :title="t('integrations.cards.preview_failed')"
            :description="describePreviewError(previewError)"
          />
          <div v-else-if="previewHtml !== undefined">
            <NeFormItemLabel>{{ t('integrations.cards.preview') }}</NeFormItemLabel>
            <p v-if="!themeStore.isLight" class="text-tertiary-neutral mb-2 text-sm">
              {{ t('integrations.cards.preview_light_background') }}
            </p>
            <iframe
              :srcdoc="previewDocument"
              sandbox=""
              referrerpolicy="no-referrer"
              :title="t('integrations.cards.preview')"
              class="h-80 w-full rounded-md border border-gray-300 bg-white dark:border-gray-600"
            />
          </div>
        </div>
        <NeInlineNotification
          v-if="saveError"
          kind="error"
          :title="
            currentCard
              ? t('integrations.cards.cannot_save_card')
              : t('integrations.cards.cannot_create_card')
          "
          :description="getLegacyStatusMessage(saveError) || describeError(saveError)"
        />
      </div>
      <hr class="my-8" />
      <div class="flex justify-end">
        <NeButton
          type="button"
          kind="tertiary"
          size="lg"
          :disabled="saving"
          class="mr-3"
          @click="requestClose"
        >
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="busy" :loading="saving">
          {{ currentCard ? t('common.save') : t('integrations.cards.create_card') }}
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
