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
  NeInlineNotification,
  NeSideDrawer,
  NeTextArea,
  NeToggle,
} from '@nethesis/vue-components'
import ProfilesMultiselect from './ProfilesMultiselect.vue'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import { useFocusReturn } from '@/composables/useFocusReturn'
import type { Focusable } from '@/lib/common'
import { getLegacyStatusMessage } from '@/lib/integrations/errors'
import {
  emptyParameterizedUrlForm,
  getBusyProfileIds,
  PARAMETERIZED_URL_PLACEHOLDERS,
  PARAMETERIZED_URLS_KEY,
  type ParameterizedUrl,
  type ParameterizedUrlForm,
  saveParameterizedUrl,
  toParameterizedUrlForm,
  validateParameterizedUrlForm,
} from '@/lib/integrations/parameterizedUrls'
import type { FieldIssues } from '@/lib/integrations/validation'
import { useProfileOptions } from '@/queries/integrations/lookups'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const {
  isShown = false,
  currentUrl = undefined,
  urls,
} = defineProps<{
  isShown: boolean
  currentUrl: ParameterizedUrl | undefined
  urls: ParameterizedUrl[]
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state: profilesState } = useProfileOptions()

const form = ref<ParameterizedUrlForm>(emptyParameterizedUrlForm())
const validationIssues = ref<FieldIssues>({})
const initialSnapshot = ref('')
const isShownDiscardModal = ref(false)
const urlRef = useTemplateRef<Focusable>('urlRef')
const urlContainerRef = useTemplateRef<HTMLElement>('urlContainerRef')

useFocusReturn(() => isShown)

const profilesRef = useTemplateRef<Focusable>('profilesRef')

const fieldRefs: Record<string, Readonly<{ value: Focusable | null }>> = {
  url: urlRef,
  profileIds: profilesRef,
}

const profiles = computed(() => profilesState.value.data ?? [])
const busyProfileIds = computed(() => getBusyProfileIds(urls, currentUrl))

const isDirty = computed(() => JSON.stringify(form.value) !== initialSnapshot.value)

const noProfileAvailable = computed(
  () =>
    !currentUrl &&
    profilesState.value.status === 'success' &&
    profiles.value.every((profile) => busyProfileIds.value.includes(profile.id)),
)

const {
  mutate: saveMutate,
  isLoading: saving,
  reset: saveReset,
  error: saveError,
} = useMutation({
  mutation: (urlForm: ParameterizedUrlForm) => saveParameterizedUrl(urlForm, currentUrl),
  onSuccess(_data, urlForm) {
    const edited = !!currentUrl

    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: edited
          ? t('integrations.param_urls.url_saved')
          : t('integrations.param_urls.url_created'),
        description: t(
          edited ? 'common.object_saved_successfully' : 'common.object_created_successfully',
          { name: urlForm.url.trim() },
        ),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [PARAMETERIZED_URLS_KEY] })
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
    form.value = currentUrl ? toParameterizedUrlForm(currentUrl) : emptyParameterizedUrlForm()
    initialSnapshot.value = JSON.stringify(form.value)
    focusElement(urlRef)
  },
)

async function insertPlaceholder(placeholder: string) {
  const textarea = urlContainerRef.value?.querySelector('textarea')
  const url = form.value.url
  const start = textarea?.selectionStart ?? url.length
  const end = textarea?.selectionEnd ?? url.length

  form.value.url = url.slice(0, start) + placeholder + url.slice(end)
  await nextTick()
  textarea?.focus()
  textarea?.setSelectionRange(start + placeholder.length, start + placeholder.length)
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
  validationIssues.value = validateParameterizedUrlForm(
    form.value,
    urls.filter((item) => item.id !== currentUrl?.id),
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
      currentUrl ? t('integrations.param_urls.edit_url') : t('integrations.param_urls.create_url')
    "
    :close-aria-label="t('shell.close_side_drawer')"
    @close="requestClose"
  >
    <form novalidate @submit.prevent="save">
      <div class="flex flex-col gap-6">
        <div ref="urlContainerRef">
          <NeTextArea
            ref="urlRef"
            v-model="form.url"
            :label="t('integrations.url')"
            :rows="4"
            placeholder="https://crm.example.com/open?number=$CALLER_NUMBER"
            :helper-text="t('integrations.param_urls.url_helper')"
            :invalid-message="validationIssues.url ? t(validationIssues.url) : ''"
            :disabled="saving"
          />
        </div>
        <div class="flex flex-col gap-2">
          <p class="text-secondary-neutral text-sm">
            {{ t('integrations.param_urls.placeholders') }}
          </p>
          <div class="flex flex-wrap gap-2">
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
        <ProfilesMultiselect
          ref="profilesRef"
          v-model="form.profileIds"
          :profiles="profiles"
          :busy-profile-ids="busyProfileIds"
          :busy-description="t('integrations.param_urls.profile_already_used')"
          :helper-text="t('integrations.param_urls.profiles_helper')"
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
          v-else-if="noProfileAvailable"
          kind="warning"
          :title="t('integrations.param_urls.no_profile_available')"
          :description="t('integrations.param_urls.no_profile_available_description')"
        />
        <NeToggle
          v-model="form.onlyQueues"
          :top-label="t('integrations.param_urls.calls')"
          :label="t('integrations.param_urls.only_queue_calls')"
          :disabled="saving"
        />
        <NeInlineNotification
          v-if="saveError"
          kind="error"
          :title="
            currentUrl
              ? t('integrations.param_urls.cannot_save_url')
              : t('integrations.param_urls.cannot_create_url')
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
        <NeButton type="submit" kind="primary" size="lg" :disabled="saving" :loading="saving">
          {{ currentUrl ? t('common.save') : t('integrations.param_urls.create_url') }}
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
