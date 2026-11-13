<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as v from 'valibot'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  NeButton,
  NeCombobox,
  NeInlineNotification,
  NeRadioSelection,
  NeSkeleton,
  NeTextInput,
  NeTooltip,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleInfo, faFloppyDisk, faKey } from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import PhonePasswordDrawer from './PhonePasswordDrawer.vue'
import { getLanguageLabel } from '@/lib/settings/system'
import {
  DefaultPhoneConfigurationSchema,
  getToneZoneLabel,
  PHONE_DEFAULTS_KEY,
  PHONE_LANGUAGES,
  PHONE_TONE_ZONES,
  saveDefaultPhoneConfiguration,
  withCurrentOption,
  type DefaultPhoneConfiguration,
  type PhonePasswordKind,
  type ProvisioningFrequency,
} from '@/lib/phones/defaults'
import { usePhoneDefaults } from '@/queries/phones/defaults'
import { describeError, useNotificationsStore } from '@/stores/notifications'

type ConfigurationField = 'language' | 'toneZone'

const { t, locale } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state, refetch } = usePhoneDefaults()

const language = ref('')
const toneZone = ref('')
const provisioningFrequency = ref<string>('everyday')
const validationIssues = ref<Partial<Record<ConfigurationField, string>>>({})
const passwordDrawerKind = ref<PhonePasswordKind>('admin')
const isShownPasswordDrawer = ref(false)

const comboboxLabels = computed(() => ({
  noResultsLabel: t('ne_combobox.no_results'),
  limitedOptionsLabel: t('ne_combobox.limited_options_label'),
  noOptionsLabel: t('ne_combobox.no_options_label'),
  selectedLabel: t('ne_combobox.selected'),
  userInputLabel: t('ne_combobox.user_input_label'),
  optionalLabel: t('common.optional'),
}))

const languageOptions = computed(() =>
  withCurrentOption(PHONE_LANGUAGES, state.value.data?.language ?? '').map((item) => ({
    id: item,
    label: getLanguageLabel(item),
  })),
)

const toneZoneOptions = computed(() =>
  withCurrentOption(PHONE_TONE_ZONES, state.value.data?.toneZone ?? '').map((item) => ({
    id: item,
    label: getToneZoneLabel(item, locale.value),
  })),
)

const isDirty = computed(() => {
  const defaults = state.value.data

  return (
    !!defaults &&
    (language.value !== defaults.language ||
      toneZone.value !== defaults.toneZone ||
      provisioningFrequency.value !== defaults.provisioningFrequency)
  )
})

const frequencyOptions = computed(() => [
  { id: 'everyday', label: t('phones.settings.every_day') },
  { id: 'never', label: t('phones.settings.only_at_startup') },
])

const {
  mutate: saveMutate,
  isLoading: saving,
  reset: saveReset,
  error: saveError,
} = useMutation({
  mutation: (configuration: DefaultPhoneConfiguration) =>
    saveDefaultPhoneConfiguration(configuration),
  onSuccess() {
    notificationsStore.createNotification({
      kind: 'success',
      title: t('phones.settings.default_configuration_saved'),
      description: t('phones.settings.changes_apply_after_provisioning'),
    })
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [PHONE_DEFAULTS_KEY] })
  },
})

watch(
  () => state.value.data,
  (defaults) => {
    if (!defaults) {
      return
    }
    language.value = defaults.language
    toneZone.value = defaults.toneZone
    provisioningFrequency.value = defaults.provisioningFrequency
  },
  { immediate: true },
)

function save() {
  saveReset()
  validationIssues.value = {}
  const result = v.safeParse(DefaultPhoneConfigurationSchema, {
    language: language.value,
    toneZone: toneZone.value,
    provisioningFrequency: provisioningFrequency.value as ProvisioningFrequency,
  })

  if (result.success) {
    saveMutate(result.output)
    return
  }

  for (const issue of result.issues) {
    const field = issue.path?.[0].key

    if ((field === 'language' || field === 'toneZone') && !validationIssues.value[field]) {
      validationIssues.value[field] = issue.message
    }
  }
}

function showPasswordDrawer(kind: PhonePasswordKind) {
  passwordDrawerKind.value = kind
  isShownPasswordDrawer.value = true
}

const issueMessage = (field: ConfigurationField) => {
  const issue = validationIssues.value[field]
  return issue ? t(issue) : ''
}
</script>

<template>
  <div>
    <LoadError
      v-if="state.status === 'error'"
      :error="state.error"
      :title="$t('phones.settings.cannot_load_settings')"
      @retry="refetch"
    />
    <div v-else-if="state.status === 'pending'" class="flex max-w-4xl flex-col gap-8">
      <NeSkeleton :lines="6" />
      <NeSkeleton :lines="4" />
    </div>
    <div v-else class="flex max-w-4xl flex-col">
      <section
        class="grid grid-cols-1 gap-6 border-b border-gray-200 pb-8 lg:grid-cols-[1fr_1.1fr] lg:gap-8 dark:border-gray-700"
      >
        <div>
          <h4 class="text-primary-neutral mb-2 text-base font-medium">
            {{ $t('phones.settings.default_configuration') }}
          </h4>
          <p class="text-tertiary-neutral">
            {{ $t('phones.settings.default_configuration_description') }}
          </p>
        </div>
        <form class="flex flex-col gap-6" novalidate @submit.prevent="save">
          <NeCombobox
            v-model="language"
            :label="$t('phones.settings.phone_language')"
            :options="languageOptions"
            :placeholder="$t('ne_combobox.choose')"
            :invalid-message="issueMessage('language')"
            :disabled="saving"
            v-bind="comboboxLabels"
          />
          <NeCombobox
            v-model="toneZone"
            :label="$t('phones.settings.tone_region')"
            :options="toneZoneOptions"
            :placeholder="$t('ne_combobox.choose')"
            :invalid-message="issueMessage('toneZone')"
            :disabled="saving"
            v-bind="comboboxLabels"
          />
          <NeRadioSelection
            v-model="provisioningFrequency"
            :label="$t('phones.settings.provisioning_schedule')"
            :options="frequencyOptions"
            :disabled="saving"
          >
            <template #tooltip>
              <NeTooltip trigger-event="mouseenter focus">
                <template #trigger>
                  <button type="button" class="inline-flex">
                    <FontAwesomeIcon
                      :icon="faCircleInfo"
                      class="text-primary-700 dark:text-primary-500 size-4"
                      aria-hidden="true"
                    />
                    <span class="sr-only">{{
                      $t('phones.settings.provisioning_schedule_info')
                    }}</span>
                  </button>
                </template>
                <template #content>
                  {{ $t('phones.settings.provisioning_schedule_info') }}
                </template>
              </NeTooltip>
            </template>
          </NeRadioSelection>
          <NeInlineNotification
            v-if="saveError"
            kind="error"
            :title="$t('phones.settings.cannot_save_settings')"
            :description="describeError(saveError)"
          />
          <div>
            <NeButton type="submit" kind="primary" :loading="saving" :disabled="saving || !isDirty">
              <template #prefix>
                <FontAwesomeIcon :icon="faFloppyDisk" class="size-4" aria-hidden="true" />
              </template>
              {{ $t('common.save') }}
            </NeButton>
          </div>
        </form>
      </section>
      <section
        v-for="kind in ['admin', 'user'] as const"
        :key="kind"
        class="grid grid-cols-1 gap-6 border-gray-200 py-8 lg:grid-cols-[1fr_1.1fr] lg:gap-8 dark:border-gray-700"
        :class="kind === 'admin' ? 'border-b' : ''"
      >
        <div>
          <h4 class="text-primary-neutral mb-2 text-base font-medium">
            {{ $t(`phones.settings.${kind}_password`) }}
          </h4>
          <p class="text-tertiary-neutral">
            {{ $t(`phones.settings.${kind}_password_description`) }}
          </p>
        </div>
        <div class="flex flex-col items-start gap-4">
          <NeTextInput
            :model-value="kind === 'admin' ? state.data.adminPassword : state.data.userPassword"
            :label="$t(`phones.settings.current_${kind}_password`)"
            is-password
            readonly
            autocomplete="off"
            :show-password-label="$t('ne_text_input.show_password')"
            :hide-password-label="$t('ne_text_input.hide_password')"
            class="w-full"
          />
          <NeButton kind="secondary" @click="showPasswordDrawer(kind)">
            <template #prefix>
              <FontAwesomeIcon :icon="faKey" class="size-4" aria-hidden="true" />
            </template>
            {{ $t(`phones.settings.change_${kind}_password`) }}
          </NeButton>
        </div>
      </section>
    </div>
    <PhonePasswordDrawer
      :is-shown="isShownPasswordDrawer"
      :kind="passwordDrawerKind"
      @close="isShownPasswordDrawer = false"
    />
  </div>
</template>
