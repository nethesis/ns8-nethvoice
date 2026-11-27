<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  focusElement,
  NeButton,
  NeCombobox,
  NeInlineNotification,
  NeSideDrawer,
  NeTextInput,
  NeToggle,
  NeTooltip,
  type NeComboboxOption,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import { useFocusReturn } from '@/composables/useFocusReturn'
import type { Focusable } from '@/lib/common'
import { describeIntegrationError } from '@/lib/integrations/errors'
import {
  emptyParameterizedUrlForm,
  getAvailableProfiles,
  getProfileName,
  getRowsSharingUrl,
  PARAMETERIZED_URL_EXAMPLE,
  PARAMETERIZED_URL_MAX_LENGTH,
  PARAMETERIZED_URL_NAME_MAX_LENGTH,
  PARAMETERIZED_URL_PLACEHOLDERS,
  PARAMETERIZED_URLS_KEY,
  type ParameterizedUrl,
  type ParameterizedUrlForm,
  saveParameterizedUrl,
  toDuplicatedParameterizedUrlForm,
  toParameterizedUrlForm,
  validateParameterizedUrlForm,
} from '@/lib/integrations/parameterizedUrls'
import type { FieldIssues } from '@/lib/integrations/validation'
import { useProfileOptions } from '@/queries/integrations/lookups'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'

const {
  isShown = false,
  mode = 'create',
  currentUrl = undefined,
  urls,
} = defineProps<{
  isShown: boolean
  mode?: 'create' | 'edit' | 'duplicate'
  currentUrl: ParameterizedUrl | undefined
  urls: ParameterizedUrl[]
}>()

const emit = defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const runtimeConfigStore = useRuntimeConfigStore()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state: profilesState } = useProfileOptions()

const form = ref<ParameterizedUrlForm>(emptyParameterizedUrlForm())
const validationIssues = ref<FieldIssues>({})
const initialSnapshot = ref('')
const isShownDiscardModal = ref(false)
const nameRef = useTemplateRef<Focusable>('nameRef')
const urlRef = useTemplateRef<Focusable>('urlRef')
const urlContainerRef = useTemplateRef<HTMLElement>('urlContainerRef')
const profileRef = useTemplateRef<Focusable>('profileRef')

useFocusReturn(() => isShown)

const fieldRefs: Record<string, Readonly<{ value: Focusable | null }>> = {
  name: nameRef,
  url: urlRef,
  profileId: profileRef,
}

const editing = computed(() => (mode === 'edit' ? currentUrl : undefined))
const profiles = computed(() => profilesState.value.data ?? [])

const profileOptions = computed<NeComboboxOption[]>(() =>
  getAvailableProfiles(profiles.value, urls, editing.value).map((profile) => ({
    id: profile.id,
    label: profile.name,
  })),
)

const placeholdersText = computed(() =>
  new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(PARAMETERIZED_URL_PLACEHOLDERS),
)

const changedSharingProfiles = computed(() =>
  getRowsSharingUrl(urls, form.value.url, editing.value)
    .filter((row) => row.onlyQueues !== form.value.onlyQueues)
    .map((row) => getProfileName(row.profileId, profiles.value)),
)

const isDirty = computed(() => JSON.stringify(form.value) !== initialSnapshot.value)

const {
  mutate: saveMutate,
  isLoading: saving,
  reset: saveReset,
  error: saveError,
} = useMutation({
  mutation: (urlForm: ParameterizedUrlForm) => saveParameterizedUrl(urlForm, urls, editing.value),
  onSuccess(_data, urlForm) {
    const edited = !!editing.value

    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: edited
          ? t('integrations.param_urls.url_updated')
          : t('integrations.param_urls.url_created'),
        description: t(
          edited
            ? 'integrations.param_urls.url_updated_description'
            : 'integrations.param_urls.url_created_description',
          { name: urlForm.name.trim() },
        ),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [PARAMETERIZED_URLS_KEY] })
  },
})

function initialForm(): ParameterizedUrlForm {
  if (!currentUrl) {
    return emptyParameterizedUrlForm()
  }
  return mode === 'duplicate'
    ? toDuplicatedParameterizedUrlForm(currentUrl, (name) =>
        t('integrations.param_urls.copy_name', { name }),
      )
    : toParameterizedUrlForm(currentUrl)
}

watch(
  () => isShown,
  () => {
    if (!isShown) {
      isShownDiscardModal.value = false
      return
    }
    saveReset()
    validationIssues.value = {}
    form.value = initialForm()
    initialSnapshot.value = JSON.stringify(form.value)
    focusElement(nameRef)
  },
)

async function insertPlaceholder(placeholder: string) {
  const input = urlContainerRef.value?.querySelector('input')
  const url = form.value.url
  const start = input?.selectionStart ?? url.length
  const end = input?.selectionEnd ?? url.length

  form.value.url = url.slice(0, start) + placeholder + url.slice(end)
  await nextTick()
  input?.focus()
  input?.setSelectionRange(start + placeholder.length, start + placeholder.length)
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
  validationIssues.value = validateParameterizedUrlForm(form.value, urls, editing.value)
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
    :title="
      editing ? t('integrations.param_urls.edit_url') : t('integrations.param_urls.create_url')
    "
    :close-aria-label="t('shell.close_side_drawer')"
    @close="requestClose"
  >
    <form novalidate @submit.prevent="save">
      <div class="flex flex-col gap-6">
        <NeTextInput
          ref="nameRef"
          v-model="form.name"
          :label="t('integrations.name')"
          :placeholder="t('integrations.param_urls.name_placeholder')"
          :invalid-message="
            validationIssues.name
              ? t(validationIssues.name, { max: PARAMETERIZED_URL_NAME_MAX_LENGTH })
              : ''
          "
          :disabled="saving"
          @blur="form.name = form.name.trim()"
        />
        <div ref="urlContainerRef" class="flex flex-col gap-2">
          <NeTextInput
            ref="urlRef"
            v-model="form.url"
            :label="t('integrations.url')"
            :placeholder="
              t('integrations.param_urls.url_placeholder', { url: PARAMETERIZED_URL_EXAMPLE })
            "
            :helper-text="
              t('integrations.param_urls.url_helper', { placeholders: placeholdersText })
            "
            :invalid-message="
              validationIssues.url
                ? t(validationIssues.url, { max: PARAMETERIZED_URL_MAX_LENGTH })
                : ''
            "
            :disabled="saving"
          />
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-tertiary-neutral text-sm">
              {{ t('integrations.param_urls.placeholders') }}
            </span>
            <NeButton
              v-for="placeholder in PARAMETERIZED_URL_PLACEHOLDERS"
              :key="placeholder"
              type="button"
              kind="secondary"
              size="sm"
              :disabled="saving"
              @click="insertPlaceholder(placeholder)"
            >
              <span class="sr-only">{{ t('integrations.param_urls.insert_placeholder') }}</span>
              <span class="font-mono">{{ placeholder }}</span>
            </NeButton>
          </div>
        </div>
        <NeCombobox
          ref="profileRef"
          v-model="form.profileId"
          :label="t('integrations.param_urls.profile')"
          :options="profileOptions"
          :placeholder="t('ne_combobox.choose')"
          :helper-text="
            t('integrations.param_urls.profile_helper', {
              cti: runtimeConfigStore.config.ctiProductName,
            })
          "
          :invalid-message="validationIssues.profileId ? t(validationIssues.profileId) : ''"
          :disabled="saving || profilesState.status === 'pending'"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('integrations.param_urls.all_profiles_used')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
        />
        <NeInlineNotification
          v-if="profilesState.status === 'error'"
          kind="error"
          :title="t('integrations.cannot_load_profiles')"
          :description="describeError(profilesState.error)"
        />
        <NeToggle
          v-model="form.onlyQueues"
          role="group"
          :aria-label="t('integrations.param_urls.queue_calls_only')"
          :top-label="t('integrations.param_urls.queue_calls_only')"
          :label="form.onlyQueues ? t('common.enabled') : t('common.disabled')"
          :disabled="saving"
        >
          <template #topTooltip>
            <NeTooltip trigger-event="mouseenter focus">
              <template #trigger>
                <button
                  type="button"
                  class="inline-flex"
                  :aria-label="
                    t('integrations.param_urls.queue_calls_only_info', {
                      label: t('integrations.param_urls.queue_calls_only'),
                    })
                  "
                >
                  <FontAwesomeIcon
                    :icon="faCircleInfo"
                    class="size-4 text-indigo-500 dark:text-indigo-300"
                    aria-hidden="true"
                  />
                </button>
              </template>
              <template #content>
                {{ t('integrations.param_urls.queue_calls_only_tooltip') }}
              </template>
            </NeTooltip>
          </template>
        </NeToggle>
        <NeInlineNotification
          v-if="changedSharingProfiles.length > 0"
          kind="info"
          :title="t('integrations.param_urls.shared_url')"
          :description="
            t('integrations.param_urls.shared_url_description', {
              setting: t('integrations.param_urls.queue_calls_only'),
              profiles: changedSharingProfiles.join(', '),
            })
          "
        />
        <NeInlineNotification
          v-if="saveError"
          kind="error"
          :title="
            editing
              ? t('integrations.param_urls.cannot_save_url')
              : t('integrations.param_urls.cannot_create_url')
          "
          :description="describeIntegrationError(saveError)"
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
