<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as v from 'valibot'
import { useQueryCache } from '@pinia/colada'
import {
  focusElement,
  NeCombobox,
  NeInlineNotification,
  NeSkeleton,
} from '@nethesis/vue-components'
import SetupStepLayout from './SetupStepLayout.vue'
import { useSetupNavigation } from '@/composables/useSetupNavigation'
import { usePbxCountries, usePbxLanguages } from '@/queries/settings/system'
import {
  getCountryLabel,
  getLanguageLabel,
  PBX_LANGUAGES_KEY,
  postPbxDefaultLanguage,
  SystemSettingsSchema,
} from '@/lib/settings/system'
import { useSetupStore } from '@/stores/setup'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { t, locale } = useI18n()
const queryCache = useQueryCache()
const setupStore = useSetupStore()
const notificationsStore = useNotificationsStore()
const { state: languagesState } = usePbxLanguages()
const { state: countriesState } = usePbxCountries()
const { advancing, goToNextStep } = useSetupNavigation('system')

const country = ref(setupStore.country)
const language = ref('')
const validationIssues = ref<Partial<Record<'country' | 'language', string>>>({})
const countryRef = useTemplateRef<InstanceType<typeof NeCombobox>>('countryRef')
const languageRef = useTemplateRef<InstanceType<typeof NeCombobox>>('languageRef')

const loading = computed(
  () => languagesState.value.status === 'pending' || countriesState.value.status === 'pending',
)

const loadError = computed(() => languagesState.value.error ?? countriesState.value.error)

const countryOptions = computed(() =>
  (countriesState.value.data ?? [])
    .map((pbxLocale) => ({ id: pbxLocale, label: getCountryLabel(pbxLocale, locale.value) }))
    .sort((a, b) => a.label.localeCompare(b.label)),
)

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

watch(
  () => [countriesState.value.data, languagesState.value.data] as const,
  ([countries, languages]) => {
    if (!countries || !languages || country.value) {
      return
    }
    country.value = countries.includes(languages.defaultLanguage)
      ? languages.defaultLanguage
      : (countries[0] ?? '')
  },
  { immediate: true },
)

function validate(): boolean {
  validationIssues.value = {}
  const result = v.safeParse(SystemSettingsSchema, {
    country: country.value,
    language: language.value,
  })

  if (result.success) {
    return true
  }

  for (const issue of result.issues) {
    const field = issue.path?.[0].key

    if ((field === 'country' || field === 'language') && !validationIssues.value[field]) {
      validationIssues.value[field] = issue.message
    }
  }
  focusElement(validationIssues.value.country ? countryRef : languageRef)
  return false
}

function saveAndContinue() {
  if (!validate()) {
    return
  }

  goToNextStep(async () => {
    if (language.value !== languagesState.value.data?.defaultLanguage) {
      try {
        await postPbxDefaultLanguage(language.value)
      } catch (error) {
        notificationsStore.createNotificationFromError(error, t('settings.cannot_save_language'))
        return false
      }
      await queryCache.invalidateQueries({ key: [PBX_LANGUAGES_KEY] })
    }
    setupStore.country = country.value
  })
}
</script>

<template>
  <SetupStepLayout
    step-id="system"
    :title="t('setup.system.title')"
    :description="t('setup.system.description')"
    :next-loading="advancing"
    :next-disabled="loading || !!loadError"
    @next="saveAndContinue"
  >
    <NeInlineNotification
      v-if="loadError"
      kind="error"
      :title="t('setup.system.cannot_load_settings')"
      :description="describeError(loadError)"
    />
    <div v-else-if="loading" class="flex w-full max-w-[420px] flex-col gap-8">
      <NeSkeleton :lines="3" />
      <NeSkeleton :lines="3" />
    </div>
    <form v-else class="flex w-full max-w-[420px] flex-col gap-8" @submit.prevent="saveAndContinue">
      <NeCombobox
        ref="countryRef"
        v-model="country"
        :label="t('setup.system.pbx_country')"
        :options="countryOptions"
        :helper-text="t('setup.system.pbx_country_helper')"
        :placeholder="t('ne_combobox.choose')"
        :invalid-message="validationIssues.country ? t(validationIssues.country) : ''"
        :disabled="advancing"
        :no-results-label="t('ne_combobox.no_results')"
        :limited-options-label="t('ne_combobox.limited_options_label')"
        :no-options-label="t('ne_combobox.no_options_label')"
        :selected-label="t('ne_combobox.selected')"
        :user-input-label="t('ne_combobox.user_input_label')"
        :optional-label="t('common.optional')"
      />
      <NeCombobox
        ref="languageRef"
        v-model="language"
        :label="t('setup.system.pbx_language')"
        :options="languageOptions"
        :helper-text="t('setup.system.pbx_language_helper')"
        :placeholder="t('ne_combobox.choose')"
        :invalid-message="validationIssues.language ? t(validationIssues.language) : ''"
        :disabled="advancing"
        :no-results-label="t('ne_combobox.no_results')"
        :limited-options-label="t('ne_combobox.limited_options_label')"
        :no-options-label="t('ne_combobox.no_options_label')"
        :selected-label="t('ne_combobox.selected')"
        :user-input-label="t('ne_combobox.user_input_label')"
        :optional-label="t('common.optional')"
      />
    </form>
  </SetupStepLayout>
</template>
