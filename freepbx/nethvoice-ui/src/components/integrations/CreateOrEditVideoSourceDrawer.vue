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
  NeTextInput,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleCheck, faPlugCircleBolt } from '@fortawesome/free-solid-svg-icons'
import ProfilesMultiselect from './ProfilesMultiselect.vue'
import type { Focusable } from '@/lib/common'
import { getLegacyStatusMessage } from '@/lib/integrations/errors'
import type { FieldIssues } from '@/lib/integrations/validation'
import {
  buildVideoSourcePayload,
  emptyVideoSourceForm,
  saveVideoSource,
  testVideoSource,
  toVideoSourceForm,
  validateVideoSourceForm,
  VIDEO_SOURCES_KEY,
  type VideoSource,
  type VideoSourceForm,
} from '@/lib/integrations/videoSources'
import { useExtensionOptions, useProfileOptions } from '@/queries/integrations/lookups'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const {
  isShown = false,
  currentSource = undefined,
  sources,
} = defineProps<{
  isShown: boolean
  currentSource: VideoSource | undefined
  sources: VideoSource[]
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state: profilesState } = useProfileOptions()
const { state: extensionsState } = useExtensionOptions()

const form = ref<VideoSourceForm>(emptyVideoSourceForm())
const validationIssues = ref<FieldIssues>({})
const nameRef = useTemplateRef<Focusable>('nameRef')
const urlRef = useTemplateRef<Focusable>('urlRef')
const openCodeRef = useTemplateRef<Focusable>('openCodeRef')
const profilesRef = useTemplateRef<Focusable>('profilesRef')

const fieldRefs: Record<string, Readonly<{ value: Focusable | null }>> = {
  name: nameRef,
  url: urlRef,
  openCode: openCodeRef,
  profileIds: profilesRef,
}

const profiles = computed(() => profilesState.value.data ?? [])

const extensionOptions = computed(() => [
  { id: '', label: t('common.none') },
  ...(extensionsState.value.data ?? []).map((item) => ({
    id: item.extension,
    label: item.name ? `${item.extension} - ${item.name}` : item.extension,
  })),
])

const {
  mutate: saveMutate,
  isLoading: saving,
  reset: saveReset,
  error: saveError,
} = useMutation({
  mutation: (sourceForm: VideoSourceForm) =>
    saveVideoSource(buildVideoSourcePayload(sourceForm, currentSource), currentSource),
  onSuccess(_data, sourceForm) {
    const edited = !!currentSource

    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: edited
          ? t('integrations.video.source_saved')
          : t('integrations.video.source_created'),
        description: t(
          edited ? 'common.object_saved_successfully' : 'common.object_created_successfully',
          { name: sourceForm.name.trim() },
        ),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [VIDEO_SOURCES_KEY] })
  },
})

const {
  mutate: testMutate,
  isLoading: testing,
  reset: testReset,
  error: testError,
  data: snapshot,
} = useMutation({
  mutation: (url: string) => testVideoSource(url),
})

watch(
  () => isShown,
  () => {
    if (isShown) {
      saveReset()
      testReset()
      validationIssues.value = {}
      form.value = currentSource ? toVideoSourceForm(currentSource) : emptyVideoSourceForm()
      focusElement(nameRef)
    }
  },
)

watch(
  () => form.value.url,
  () => testReset(),
)

function testSource() {
  const issues = validateVideoSourceForm(form.value, [])

  validationIssues.value = issues.url ? { url: issues.url } : {}

  if (issues.url) {
    urlRef.value?.focus()
    return
  }
  testMutate(form.value.url)
}

function save() {
  saveReset()
  validationIssues.value = validateVideoSourceForm(
    form.value,
    sources.filter((source) => source.name !== currentSource?.name),
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
    :title="
      currentSource ? t('integrations.video.edit_source') : t('integrations.video.create_source')
    "
    :close-aria-label="t('shell.close_side_drawer')"
    @close="emit('close')"
  >
    <form novalidate @submit.prevent="save">
      <div class="flex flex-col gap-6">
        <NeTextInput
          ref="nameRef"
          v-model="form.name"
          :label="t('integrations.name')"
          :invalid-message="validationIssues.name ? t(validationIssues.name) : ''"
          :disabled="saving"
          @blur="form.name = form.name.trim()"
        />
        <NeInlineNotification
          v-if="currentSource && form.name.trim() !== currentSource.name"
          kind="warning"
          :description="t('integrations.video.rename_warning')"
        />
        <div class="flex flex-col gap-3">
          <NeTextInput
            ref="urlRef"
            v-model="form.url"
            :label="t('integrations.video.image_url')"
            placeholder="http://192.0.2.10/snapshot.jpg"
            :helper-text="t('integrations.video.image_url_helper')"
            :invalid-message="validationIssues.url ? t(validationIssues.url) : ''"
            :disabled="saving"
            @blur="form.url = form.url.trim()"
          />
          <div>
            <NeButton
              type="button"
              kind="secondary"
              :disabled="saving || testing || !form.url.trim()"
              :loading="testing"
              @click="testSource"
            >
              <template #prefix>
                <FontAwesomeIcon :icon="faPlugCircleBolt" class="h-4 w-4" aria-hidden="true" />
              </template>
              {{ t('integrations.video.test_source') }}
            </NeButton>
          </div>
          <NeInlineNotification
            v-if="testError"
            kind="error"
            :title="t('integrations.video.test_failed')"
            :description="getLegacyStatusMessage(testError) || describeError(testError)"
          />
          <div v-else-if="snapshot !== undefined" class="flex flex-col gap-2">
            <p class="flex items-center gap-2 text-sm text-green-700 dark:text-green-500">
              <FontAwesomeIcon :icon="faCircleCheck" class="h-4 w-4" aria-hidden="true" />
              {{ t('integrations.video.test_succeeded') }}
            </p>
            <div v-if="snapshot">
              <NeFormItemLabel>{{ t('integrations.video.preview') }}</NeFormItemLabel>
              <img
                :src="snapshot"
                :alt="t('integrations.video.preview_alt', { name: form.name || form.url })"
                class="max-h-64 max-w-full rounded-md border border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>
        </div>
        <NeCombobox
          v-model="form.extension"
          :label="t('integrations.video.extension')"
          :options="extensionOptions"
          :helper-text="t('integrations.video.extension_helper')"
          :placeholder="t('ne_combobox.choose')"
          :disabled="saving || extensionsState.status === 'pending'"
          optional
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
        />
        <NeTextInput
          ref="openCodeRef"
          v-model="form.openCode"
          :label="t('integrations.video.open_code')"
          :helper-text="t('integrations.video.open_code_helper')"
          :invalid-message="validationIssues.openCode ? t(validationIssues.openCode) : ''"
          :disabled="saving"
          optional
          :optional-label="t('common.optional')"
          @blur="form.openCode = form.openCode.trim()"
        />
        <ProfilesMultiselect
          ref="profilesRef"
          v-model="form.profileIds"
          :profiles="profiles"
          :helper-text="t('integrations.video.profiles_helper')"
          :invalid-message="validationIssues.profileIds ? t(validationIssues.profileIds) : ''"
          :disabled="saving"
          :loading="profilesState.status === 'pending'"
        />
        <NeInlineNotification
          v-if="profilesState.status === 'error'"
          kind="error"
          :title="t('integrations.cannot_load_profiles')"
          :description="describeError(profilesState.error)"
        />
        <NeInlineNotification
          v-if="saveError"
          kind="error"
          :title="
            currentSource
              ? t('integrations.video.cannot_save_source')
              : t('integrations.video.cannot_create_source')
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
          @click="emit('close')"
        >
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="saving" :loading="saving">
          {{ currentSource ? t('common.save') : t('integrations.video.create_source') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
