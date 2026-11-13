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
  NeSkeleton,
} from '@nethesis/vue-components'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import LoadError from '@/components/common/LoadError.vue'
import { getLanguageLabel, PBX_LANGUAGES_KEY, postPbxDefaultLanguage } from '@/lib/settings/system'
import { usePbxLanguages } from '@/queries/settings/system'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state: languagesState, refetch: refetchLanguages } = usePbxLanguages()

const language = ref('')
const languageIssue = ref('')
const languageRef = useTemplateRef<InstanceType<typeof NeCombobox>>('languageRef')

const languageOptions = computed(() =>
  (languagesState.value.data?.languages ?? []).map((item) => ({
    id: item,
    label: getLanguageLabel(item),
  })),
)

watch(
  () => languagesState.value.data,
  (languages) => {
    if (languages && !language.value) {
      language.value = languages.defaultLanguage
    }
  },
  { immediate: true },
)

const {
  mutate: saveLanguageMutate,
  isLoading: saving,
  reset: saveLanguageReset,
  error: saveLanguageError,
} = useMutation({
  mutation: (newLanguage: string) => postPbxDefaultLanguage(newLanguage),
  onSuccess(_data, newLanguage) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('settings.language_saved'),
        description: t('settings.language_saved_description', {
          language: getLanguageLabel(newLanguage),
        }),
      })
    }, 500)
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [PBX_LANGUAGES_KEY] })
  },
})

const isDirty = computed(
  () => !!languagesState.value.data && language.value !== languagesState.value.data.defaultLanguage,
)

function save() {
  if (!isDirty.value || saving.value) {
    return
  }
  saveLanguageReset()
  languageIssue.value = ''

  if (!language.value) {
    languageIssue.value = t('settings.language_required')
    focusElement(languageRef)
    return
  }
  saveLanguageMutate(language.value)
}
</script>

<template>
  <LoadError
    v-if="languagesState.error"
    class="max-w-[420px]"
    :error="languagesState.error"
    :title="$t('settings.cannot_load_settings')"
    @retry="refetchLanguages()"
  />
  <NeSkeleton v-else-if="languagesState.status === 'pending'" :lines="3" class="w-[420px]" />
  <form v-else class="flex w-full max-w-[420px] flex-col gap-6" @submit.prevent="save">
    <NeCombobox
      ref="languageRef"
      v-model="language"
      :label="$t('settings.language')"
      :options="languageOptions"
      :helper-text="$t('settings.language_helper')"
      :placeholder="$t('ne_combobox.choose')"
      :invalid-message="languageIssue"
      :disabled="saving"
      :no-results-label="$t('ne_combobox.no_results')"
      :limited-options-label="$t('ne_combobox.limited_options_label')"
      :no-options-label="$t('ne_combobox.no_options_label')"
      :selected-label="$t('ne_combobox.selected')"
      :user-input-label="$t('ne_combobox.user_input_label')"
      :optional-label="$t('common.optional')"
    />
    <NeInlineNotification
      v-if="saveLanguageError"
      kind="error"
      :title="$t('settings.cannot_save_language')"
      :description="describeError(saveLanguageError)"
    />
    <div>
      <NeButton
        type="submit"
        kind="primary"
        size="lg"
        :loading="saving"
        :disabled="saving || !isDirty"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faFloppyDisk" class="size-4" aria-hidden="true" />
        </template>
        {{ $t('common.save') }}
      </NeButton>
    </div>
  </form>
</template>
