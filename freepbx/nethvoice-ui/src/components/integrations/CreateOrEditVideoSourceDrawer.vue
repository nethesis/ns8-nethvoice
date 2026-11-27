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
  NeCheckbox,
  NeCombobox,
  NeInlineNotification,
  NeListbox,
  NeSideDrawer,
  NeStepper,
  NeTextInput,
  NeTooltip,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faArrowRightArrowLeft,
  faCircleCheck,
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons'
import ProfilesMultiselect from './ProfilesMultiselect.vue'
import VideoSourceCheckResult from './VideoSourceCheckResult.vue'
import VideoSourceGatesEditor from './VideoSourceGatesEditor.vue'
import VideoSourceReachability from './VideoSourceReachability.vue'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import { useFocusReturn } from '@/composables/useFocusReturn'
import type { Focusable } from '@/lib/common'
import type { FieldIssues } from '@/lib/integrations/validation'
import {
  applyDeviceType,
  applyQuality,
  buildCheckPayload,
  buildVideoSourcePayload,
  connectionSignature,
  detectQuality,
  emptyVideoSourceForm,
  endpointHost,
  firstGateIssueUids,
  fromDoorPhonePrefill,
  gateLimit,
  getAddressIssue,
  hasQualityChoice,
  isDoorAddressConfirmed,
  isDoorPasswordRequest,
  isStoredPasswordKept,
  isTlsRelevant,
  isTlsUrl,
  issueParams,
  mapSaveError,
  saveVideoSource,
  streamsOf,
  testVideoSource,
  toVideoSourceForm,
  urlEndpoint,
  usesDoorPhoneCredentials,
  validateConnection,
  validateGates,
  validateSourceFields,
  VIDEO_DOOR_PHONES_KEY,
  VIDEO_SOURCES_KEY,
  type CheckPayload,
  type DeviceType,
  type DoorContext,
  type DoorPhonePrefill,
  type StreamQuality,
  type VideoSource,
  type VideoSourceCheck,
  type VideoSourceForm,
} from '@/lib/integrations/videoSources'
import { useExtensionOptions, useProfileOptions } from '@/queries/integrations/lookups'
import { usePermissions } from '@/queries/permissions/me'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'

const {
  isShown = false,
  currentSource = undefined,
  sources,
  prefill = undefined,
  defaultProfileIds = [],
  doorContext = null,
  storedCheck = null,
} = defineProps<{
  isShown: boolean
  currentSource: VideoSource | undefined
  sources: VideoSource[]
  prefill?: DoorPhonePrefill
  defaultProfileIds?: string[]
  doorContext?: DoorContext | null
  storedCheck?: VideoSourceCheck | null
}>()

const emit = defineEmits<{
  close: []
  saved: [name: string, check: VideoSourceCheck | null]
}>()

const { t, te } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const runtimeConfigStore = useRuntimeConfigStore()
const { state: profilesState } = useProfileOptions()
const { state: extensionsState } = useExtensionOptions()
const { isSuperadmin } = usePermissions()

const form = ref<VideoSourceForm>(emptyVideoSourceForm())
const step = ref<1 | 2>(1)
const issues = ref<FieldIssues>({})
const saveMessage = ref('')
const initialSnapshot = ref('')
const initialSignature = ref('')
const lastCheck = ref<{ signature: string; check: VideoSourceCheck } | null>(null)
const testOrigin = ref<'' | 'button' | 'submit'>('')
const isShownDiscardModal = ref(false)
const doorNotice = ref<{ registered: boolean; credentialsGenerated: boolean } | null>(null)
const doorRefusal = ref<{ endpoint: string; user: string } | null>(null)
let testRun = 0

useFocusReturn(() => isShown)

const nameRef = useTemplateRef<Focusable>('nameRef')
const extensionRef = useTemplateRef<Focusable>('extensionRef')
const profilesRef = useTemplateRef<Focusable>('profilesRef')
const urlRef = useTemplateRef<Focusable>('urlRef')
const userRef = useTemplateRef<Focusable>('userRef')
const passwordRef = useTemplateRef<Focusable>('passwordRef')
const tlsRef = useTemplateRef<Focusable>('tlsRef')
const gatesRef = useTemplateRef<InstanceType<typeof VideoSourceGatesEditor>>('gatesRef')
const resultRef = useTemplateRef<HTMLElement>('resultRef')
const step2Ref = useTemplateRef<HTMLElement>('step2Ref')
const doorConfirmRef = useTemplateRef<HTMLElement>('doorConfirmRef')

const fieldRefs: Record<string, Readonly<{ value: Focusable | null }>> = {
  name: nameRef,
  extension: extensionRef,
  profileIds: profilesRef,
  url: urlRef,
  user: userRef,
  password: passwordRef,
  tlsSkipVerify: tlsRef,
}

const NO_EXTENSION = '-'

const {
  mutateAsync: testMutateAsync,
  isLoading: testing,
  error: testError,
  reset: testReset,
} = useMutation({
  mutation: (payload: CheckPayload) => testVideoSource(payload),
})

const {
  mutateAsync: saveMutateAsync,
  isLoading: saving,
  error: saveError,
  reset: saveReset,
} = useMutation({
  mutation: (sourceForm: VideoSourceForm) =>
    saveVideoSource(buildVideoSourcePayload(sourceForm, currentSource), currentSource),
  onSettled: () => {
    queryCache.invalidateQueries({ key: [VIDEO_SOURCES_KEY] })
    queryCache.invalidateQueries({ key: [VIDEO_DOOR_PHONES_KEY] })
  },
})

const isEdit = computed(() => !!currentSource)
const cti = computed(() => runtimeConfigStore.config.ctiProductName)
const profiles = computed(() => profilesState.value.data ?? [])
const showCredentials = computed(() => !usesDoorPhoneCredentials(form.value))
const streams = computed(() => streamsOf(form.value.deviceType, doorContext))
const relays = computed(() => (form.value.doorPhone ? (doorContext?.relays ?? []) : []))
const limit = computed(() => gateLimit(form.value.doorPhone, doorContext?.maxGates ?? null))
const signature = computed(() => connectionSignature(form.value))
const currentCheck = computed(() =>
  lastCheck.value && lastCheck.value.signature === signature.value ? lastCheck.value.check : null,
)
const busy = computed(() => saving.value || testing.value)
const isDirty = computed(() => JSON.stringify(form.value) !== initialSnapshot.value)
const tlsOnUrl = computed(() => isTlsUrl(form.value.url))
const tlsRelevant = computed(() => isTlsRelevant(form.value))
const showQuality = computed(() => hasQualityChoice(form.value.url, streams.value))
const hasDtmfGate = computed(() => form.value.gates.some((gate) => gate.type === 'dtmf'))
const shownCheck = computed(() =>
  currentCheck.value && currentCheck.value.reason !== 'address_not_allowed'
    ? currentCheck.value
    : null,
)
const testErrorText = computed(() => {
  const message = unexpectedTestError.value
    ? mapSaveError(unexpectedTestError.value, []).message
    : ''

  return message ? issueTextOf(message) : describeError(unexpectedTestError.value)
})
const passwordHelper = computed(() => {
  if (!currentSource?.hasSecret || !form.value.user.trim() || form.value.doorPhone) {
    return ''
  }
  return isStoredPasswordKept(form.value, currentSource)
    ? t('integrations.password_keep_helper')
    : t('integrations.video.password_device_changed_helper')
})
const doorAddressToConfirm = computed(() =>
  doorRefusal.value &&
  usesDoorPhoneCredentials(form.value) &&
  doorRefusal.value.endpoint === urlEndpoint(form.value.url) &&
  !isDoorAddressConfirmed(form.value)
    ? endpointHost(doorRefusal.value.endpoint)
    : '',
)
const doorAddressConfirmed = computed(() =>
  isDoorAddressConfirmed(form.value) ? endpointHost(form.value.confirmedAddress) : '',
)
const unexpectedTestError = computed(() =>
  testError.value && Object.keys(mapSaveError(testError.value, []).issues).length === 0
    ? testError.value
    : null,
)

const extensionOptions = computed(() => {
  const options = (extensionsState.value.data ?? []).map((item) => ({
    id: item.extension,
    label: item.name ? `${item.name} (${item.extension})` : item.extension,
  }))

  if (form.value.extension && !options.some((option) => option.id === form.value.extension)) {
    options.unshift({ id: form.value.extension, label: form.value.extension })
  }
  return [{ id: NO_EXTENSION, label: t('common.none') }, ...options]
})

const extensionModel = computed({
  get: () => form.value.extension,
  set: (extension: string) => {
    form.value.extension = extension === NO_EXTENSION ? '' : extension
  },
})

const deviceTypeOptions = computed(() => [
  { id: 'other', label: t('integrations.video.device_other') },
  { id: 'fanvil', label: t('integrations.video.device_fanvil') },
])

const qualityOptions = computed(() => {
  const label = (key: string, resolution: string) =>
    resolution ? t(`${key}_with_resolution`, { resolution }) : t(key)

  return [
    { id: 'main', label: label('integrations.video.quality_main', streams.value?.mainLabel ?? '') },
    { id: 'sub', label: label('integrations.video.quality_sub', streams.value?.subLabel ?? '') },
  ]
})

const urlPlaceholder = computed(() =>
  form.value.deviceType === 'fanvil'
    ? 'rtsp://192.0.2.50:554/h264/stream.live0'
    : 'rtsp://192.0.2.50:554/stream1',
)

function issueTextOf(issue: string): string {
  return te(issue) ? t(issue, issueParams(issue)) : issue
}

function issueText(key: string): string {
  const issue = issues.value[key]
  return issue ? issueTextOf(issue) : ''
}

function clearIssue(key: string) {
  if (issues.value[key]) {
    const next = { ...issues.value }
    delete next[key]
    issues.value = next
  }
}

function initialize() {
  step.value = 1
  issues.value = {}
  saveMessage.value = ''
  lastCheck.value = null
  testOrigin.value = ''
  testRun += 1
  doorNotice.value = null
  doorRefusal.value = null
  saveReset()
  testReset()

  if (currentSource) {
    form.value = toVideoSourceForm(currentSource, doorContext)
  } else if (prefill) {
    form.value = fromDoorPhonePrefill(prefill, defaultProfileIds)
    doorNotice.value = {
      registered: prefill.registered && !!prefill.url,
      credentialsGenerated: prefill.credentialsGenerated,
    }
  } else {
    form.value = emptyVideoSourceForm(defaultProfileIds)
  }
  initialSnapshot.value = JSON.stringify(form.value)
  initialSignature.value = connectionSignature(form.value)

  if (currentSource && storedCheck?.success) {
    lastCheck.value = { signature: initialSignature.value, check: storedCheck }
  }
  focusElement(nameRef)
}

watch(
  () => isShown,
  () => {
    if (isShown) {
      initialize()
    } else {
      isShownDiscardModal.value = false
      testRun += 1
    }
  },
)

watch(
  () => form.value.name,
  () => clearIssue('name'),
)
watch(
  () => form.value.extension,
  () => clearIssue('extension'),
)
watch(
  () => form.value.profileIds,
  () => clearIssue('profileIds'),
)
watch(
  () => form.value.user,
  () => clearIssue('user'),
)
watch(
  () => form.value.password,
  () => clearIssue('password'),
)
watch(
  () => form.value.tlsSkipVerify,
  () => clearIssue('tlsSkipVerify'),
)

function setUrl(url: string) {
  if (url !== form.value.url) {
    clearIssue('url')
  }
  form.value.url = url

  if (!form.value.doorPhone && form.value.deviceType === 'fanvil' && /^https?:\/\//i.test(url)) {
    form.value.deviceType = 'other'
  }
  form.value.quality = detectQuality(url, streams.value)
}

function setDeviceType(deviceType: DeviceType) {
  form.value.deviceType = deviceType

  if (!form.value.doorPhone) {
    setUrl(applyDeviceType(form.value.url, deviceType))
  }
  if (deviceType === 'fanvil' && !form.value.quality && !form.value.url.trim()) {
    form.value.quality = 'main'
  }
}

function setQuality(quality: StreamQuality) {
  form.value.quality = quality
  const url = applyQuality(form.value.url, streams.value, quality)

  if (url !== form.value.url) {
    setUrl(url)
  }
}

function applyServerIssues(mapped: FieldIssues): boolean {
  if (
    isSuperadmin.value &&
    mapped.password === 'integrations.video.door_phone_password_not_allowed' &&
    usesDoorPhoneCredentials(form.value)
  ) {
    const others = { ...mapped }

    delete others.password
    issues.value = { ...issues.value, ...others }
    doorRefusal.value = { endpoint: urlEndpoint(form.value.url), user: form.value.user }
    return true
  }
  issues.value = { ...issues.value, ...mapped }

  if (isDoorPasswordRequest(mapped) && form.value.doorPhone) {
    form.value.ownCredentials = true
  }
  return false
}

async function focusDoorConfirm() {
  await nextTick()
  doorConfirmRef.value?.focus()
}

async function confirmDoorAddress() {
  if (!doorRefusal.value || busy.value) {
    return
  }
  form.value.confirmedAddress = doorRefusal.value.endpoint
  doorRefusal.value = null
  await testButton()
}

async function enterDoorPassword() {
  if (!doorRefusal.value || busy.value) {
    return
  }
  form.value.user = doorRefusal.value.user
  form.value.ownCredentials = true
  doorRefusal.value = null
  await nextTick()
  passwordRef.value?.focus()
}

async function focusFirstIssue() {
  await nextTick()
  const keys = Object.keys(issues.value)
  const sourceField = Object.keys(fieldRefs).find((field) => keys.includes(field))

  gatesRef.value?.expand(firstGateIssueUids(issues.value))

  if (sourceField && (isEdit.value || step.value === 1)) {
    fieldRefs[sourceField]?.value?.focus()
    return
  }
  const firstGateKey = keys.find((key) => key.startsWith('gates.') && key.split('.').length === 3)

  if (firstGateKey) {
    const [, uid = '', field = 'name'] = firstGateKey.split('.')
    await gatesRef.value?.focusField(uid, field)
  }
}

async function scrollResultIntoView() {
  await nextTick()
  resultRef.value?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
}

async function runTest(origin: 'button' | 'submit'): Promise<VideoSourceCheck | null> {
  testRun += 1
  const run = testRun
  const testedSignature = signature.value
  testOrigin.value = origin

  try {
    const check = await testMutateAsync(buildCheckPayload(form.value, currentSource))

    if (run !== testRun) {
      return null
    }
    lastCheck.value = { signature: testedSignature, check }

    if (check.reason === 'address_not_allowed') {
      issues.value = { ...issues.value, url: getAddressIssue(check.message) }
      void focusFirstIssue()
    }
    return check
  } catch (error) {
    if (run === testRun) {
      const mapped = mapSaveError(error, form.value.gates).issues

      if (Object.keys(mapped).length > 0) {
        void (applyServerIssues(mapped) ? focusDoorConfirm() : focusFirstIssue())
      }
    }
    return null
  } finally {
    if (run === testRun) {
      testOrigin.value = ''
    }
  }
}

async function testButton() {
  const urlIssues = validateConnection(form.value, currentSource)

  if (Object.keys(urlIssues).length > 0) {
    issues.value = { ...issues.value, ...urlIssues }
    void focusFirstIssue()
    return
  }
  const check = await runTest('button')

  if (check && !check.success) {
    await scrollResultIntoView()
  }
}

async function next() {
  saveMessage.value = ''
  issues.value = validateSourceFields(
    form.value,
    sources.filter((source) => source.name !== currentSource?.name),
  )

  if (Object.keys(issues.value).length > 0) {
    void focusFirstIssue()
    return
  }
  if (!currentCheck.value?.success) {
    const check = await runTest('submit')

    if (!check?.success) {
      await scrollResultIntoView()
      return
    }
  }
  step.value = 2
  await nextTick()
  step2Ref.value?.focus()
}

async function previous() {
  step.value = 1
  await nextTick()
  focusElement(nameRef)
}

async function save() {
  saveMessage.value = ''
  saveReset()
  issues.value = {
    ...validateSourceFields(
      form.value,
      sources.filter((source) => source.name !== currentSource?.name),
      currentSource,
    ),
    ...validateGates(form.value, limit.value),
  }

  if (
    !isEdit.value &&
    Object.keys(issues.value).some((key) => key in fieldRefs && key !== 'extension')
  ) {
    step.value = 1
    await nextTick()
  }
  if (Object.keys(issues.value).length > 0) {
    void focusFirstIssue()
    return
  }
  const needsTest = isEdit.value
    ? signature.value !== initialSignature.value && !currentCheck.value?.success
    : !currentCheck.value?.success

  if (needsTest) {
    const check = await runTest('submit')

    if (!check?.success) {
      if (!isEdit.value) {
        step.value = 1
      }
      await scrollResultIntoView()
      return
    }
  }
  const sourceForm = { ...form.value }
  const check = currentCheck.value

  try {
    await saveMutateAsync(sourceForm)
  } catch (error) {
    const mapped = mapSaveError(error, sourceForm.gates)

    if (applyServerIssues(mapped.issues)) {
      saveReset()
      if (!isEdit.value) {
        step.value = 1
      }
      void focusDoorConfirm()
      return
    }
    saveMessage.value = mapped.message

    if (!isEdit.value && Object.keys(mapped.issues).some((key) => key in fieldRefs)) {
      step.value = 1
      await nextTick()
    }
    void focusFirstIssue()
    return
  }
  const name = sourceForm.name.trim()
  const edited = isEdit.value

  emit('saved', name, check)
  emit('close')
  setTimeout(() => {
    notificationsStore.createNotification({
      kind: 'success',
      title: edited
        ? t('integrations.video.source_updated')
        : t('integrations.video.source_created'),
      description: t(
        edited
          ? 'integrations.video.source_updated_description'
          : 'integrations.video.source_created_description',
        { name },
      ),
    })
  }, 500)
}

function submit() {
  if (busy.value) {
    return
  }
  if (!isEdit.value && step.value === 1) {
    void next()
  } else {
    void save()
  }
}

function requestClose() {
  if (saving.value || testOrigin.value === 'submit' || isShownDiscardModal.value) {
    return
  }
  testRun += 1

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

const showStep1 = computed(() => isEdit.value || step.value === 1)
const showStep2 = computed(() => isEdit.value || step.value === 2)
const submitLabel = computed(() => {
  if (isEdit.value) {
    return t('common.save')
  }
  return step.value === 1 ? t('common.next') : t('common.create')
})
const hasIssues = computed(() => Object.keys(issues.value).length > 0)
const saveFailed = computed(() => !!saveMessage.value || (!!saveError.value && !hasIssues.value))
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="isEdit ? t('integrations.video.edit_source') : t('integrations.video.create_source')"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="requestClose"
  >
    <form novalidate @submit.prevent="submit">
      <NeStepper
        v-if="!isEdit"
        :total-steps="2"
        :current-step="step"
        :step-label="t('integrations.video.step')"
        class="mb-8"
      />
      <div v-show="showStep1" class="flex flex-col gap-6">
        <NeTextInput
          ref="nameRef"
          v-model="form.name"
          :label="t('integrations.name')"
          :placeholder="t('integrations.video.name_placeholder')"
          :helper-text="t('integrations.video.name_helper', { cti })"
          :invalid-message="issueText('name')"
          :disabled="busy"
          @blur="form.name = form.name.trim()"
        />
        <NeInlineNotification
          v-if="currentSource && form.name.trim() !== currentSource.name"
          kind="warning"
          :description="t('integrations.video.rename_warning')"
        />
        <NeCombobox
          ref="extensionRef"
          v-model="extensionModel"
          :label="t('integrations.video.extension')"
          :options="extensionOptions"
          :placeholder="t('integrations.video.extension_placeholder')"
          :helper-text="t('integrations.video.extension_helper')"
          :invalid-message="issueText('extension')"
          :disabled="busy || extensionsState.status === 'pending'"
          :optional="!hasDtmfGate"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
        />
        <ProfilesMultiselect
          ref="profilesRef"
          v-model="form.profileIds"
          :profiles="profiles"
          :helper-text="t('integrations.video.profiles_helper', { cti })"
          :invalid-message="issueText('profileIds')"
          :disabled="busy"
          :loading="profilesState.status === 'pending'"
        />
        <NeInlineNotification
          v-if="profilesState.status === 'error'"
          kind="error"
          :title="t('integrations.cannot_load_profiles')"
          :description="describeError(profilesState.error)"
        />
        <NeListbox
          :model-value="form.deviceType"
          :label="t('integrations.video.device_type')"
          :options="deviceTypeOptions"
          :disabled="busy"
          :no-options-label="t('ne_combobox.no_options_label')"
          :optional-label="t('common.optional')"
          @update:model-value="setDeviceType($event as DeviceType)"
        />
        <NeListbox
          v-if="showQuality"
          :model-value="form.quality"
          :label="t('integrations.video.video_quality')"
          :options="qualityOptions"
          :placeholder="t('integrations.video.custom_path')"
          :disabled="busy"
          :no-options-label="t('ne_combobox.no_options_label')"
          :optional-label="t('common.optional')"
          @update:model-value="setQuality($event as StreamQuality)"
        />
        <div class="flex flex-col gap-4">
          <NeTextInput
            ref="urlRef"
            :model-value="form.url"
            :label="t('integrations.url')"
            :placeholder="t('integrations.video.example', { value: urlPlaceholder })"
            :helper-text="t('integrations.video.url_helper')"
            :invalid-message="issueText('url')"
            :disabled="busy"
            @update:model-value="setUrl(String($event))"
            @blur="setUrl(form.url.trim())"
          >
            <template #tooltip>
              <NeTooltip trigger-event="mouseenter focus">
                <template #trigger>
                  <button
                    type="button"
                    class="focus:ring-primary-500 dark:focus:ring-primary-300 inline-flex rounded-sm focus:ring-2 focus:outline-hidden"
                    :aria-label="t('integrations.video.url_info_label')"
                  >
                    <FontAwesomeIcon
                      :icon="faCircleInfo"
                      class="text-secondary size-4"
                      aria-hidden="true"
                    />
                  </button>
                </template>
                <template #content>{{ t('integrations.video.url_info') }}</template>
              </NeTooltip>
            </template>
          </NeTextInput>
          <NeInlineNotification
            v-if="doorNotice && !doorNotice.registered && !form.url.trim()"
            kind="warning"
            :description="t('integrations.video.door_phone_not_registered')"
          />
          <VideoSourceReachability
            :url="form.url"
            :door-phone="form.doorPhone"
            :active="isShown && !issues.url"
            :disabled="busy"
            @use-url="setUrl"
          />
          <NeInlineNotification
            v-if="doorNotice?.credentialsGenerated"
            kind="info"
            :description="t('integrations.video.credentials_generated')"
          />
          <div
            v-if="doorAddressToConfirm"
            ref="doorConfirmRef"
            tabindex="-1"
            class="outline-hidden"
          >
            <NeInlineNotification
              kind="warning"
              :title="t('integrations.video.door_address_unknown')"
              :description="
                t('integrations.video.door_address_confirm_description', {
                  address: doorAddressToConfirm,
                })
              "
              :primary-button-label="
                t('integrations.video.door_address_confirm', { address: doorAddressToConfirm })
              "
              :secondary-button-label="t('integrations.video.door_address_enter_password')"
              @primary-click="confirmDoorAddress"
              @secondary-click="enterDoorPassword"
            />
          </div>
          <p v-if="doorAddressConfirmed" role="status" class="flex items-center gap-2 text-sm">
            <FontAwesomeIcon
              :icon="faCircleCheck"
              class="text-icon-enabled size-4"
              aria-hidden="true"
            />
            {{ t('integrations.video.door_address_confirmed', { address: doorAddressConfirmed }) }}
          </p>
        </div>
        <template v-if="showCredentials">
          <NeTextInput
            ref="userRef"
            v-model="form.user"
            :label="t('integrations.video.username')"
            :placeholder="t('integrations.video.username_placeholder')"
            :invalid-message="issueText('user')"
            :disabled="busy"
            optional
            :optional-label="t('common.optional')"
            autocomplete="off"
          />
          <NeTextInput
            ref="passwordRef"
            v-model="form.password"
            :label="t('integrations.password')"
            :helper-text="passwordHelper"
            :invalid-message="issueText('password')"
            :disabled="busy"
            is-password
            :optional="!form.doorPhone"
            :optional-label="t('common.optional')"
            :show-password-label="t('ne_text_input.show_password')"
            :hide-password-label="t('ne_text_input.hide_password')"
            autocomplete="new-password"
          />
        </template>
        <div v-if="tlsOnUrl || (isEdit && tlsRelevant)" class="flex flex-col gap-4">
          <NeCheckbox
            ref="tlsRef"
            v-model="form.tlsSkipVerify"
            :label="t('integrations.video.tls_skip_verify')"
            :invalid-message="issueText('tlsSkipVerify')"
            :disabled="busy"
          >
            <template #description>{{ t('integrations.video.tls_skip_verify_helper') }}</template>
          </NeCheckbox>
          <NeInlineNotification
            v-if="currentSource?.tlsUnpinned && form.tlsSkipVerify"
            kind="warning"
            :description="t('integrations.video.tls_unpinned_description')"
          />
        </div>
        <div v-if="isEdit">
          <NeButton
            type="button"
            kind="secondary"
            :disabled="busy || !form.url.trim()"
            :loading="testOrigin === 'button'"
            @click="testButton"
          >
            <template #prefix>
              <FontAwesomeIcon :icon="faArrowRightArrowLeft" class="size-4" aria-hidden="true" />
            </template>
            {{
              testOrigin === 'button'
                ? t('integrations.video.testing_connection')
                : t('integrations.video.test_connection')
            }}
          </NeButton>
          <p class="text-tertiary-neutral mt-2 text-sm">
            {{ t('integrations.video.test_needed') }}
          </p>
        </div>
        <NeInlineNotification
          v-if="unexpectedTestError"
          kind="error"
          :title="t('integrations.video.cannot_test_source')"
          :description="testErrorText"
        />
        <div v-if="shownCheck && (isEdit || !shownCheck.success)" ref="resultRef">
          <VideoSourceCheckResult
            :check="shownCheck"
            :name="form.name.trim()"
            :tls-skip-verify="form.tlsSkipVerify"
            :tls-relevant="tlsOnUrl"
          />
        </div>
      </div>
      <div v-show="showStep2" :class="['flex flex-col gap-6', isEdit ? 'mt-6' : '']">
        <div
          v-if="!isEdit && shownCheck?.success"
          ref="step2Ref"
          tabindex="-1"
          class="outline-hidden"
        >
          <VideoSourceCheckResult :check="shownCheck" :name="form.name.trim()" show-verified />
        </div>
        <VideoSourceGatesEditor
          ref="gatesRef"
          v-model="form.gates"
          :issues="issues"
          :relays="relays"
          :limit="limit"
          :disabled="busy"
          :cti="cti"
          @clear-issue="clearIssue"
        />
        <div v-if="!isEdit && !tlsOnUrl && tlsRelevant">
          <NeCheckbox
            v-model="form.tlsSkipVerify"
            :label="t('integrations.video.tls_skip_verify')"
            :invalid-message="issueText('tlsSkipVerify')"
            :disabled="busy"
          >
            <template #description>{{ t('integrations.video.tls_skip_verify_helper') }}</template>
          </NeCheckbox>
        </div>
      </div>
      <NeInlineNotification
        v-if="saveFailed"
        kind="error"
        class="mt-6"
        :title="
          isEdit
            ? t('integrations.video.cannot_save_source')
            : t('integrations.video.cannot_create_source')
        "
        :description="saveMessage ? issueTextOf(saveMessage) : describeError(saveError)"
      />
      <hr class="my-8" />
      <div class="flex justify-end gap-3">
        <NeButton
          v-if="!isEdit && step === 2"
          type="button"
          kind="tertiary"
          size="lg"
          :disabled="busy"
          @click="previous"
        >
          {{ t('common.previous') }}
        </NeButton>
        <NeButton
          v-else
          type="button"
          kind="tertiary"
          size="lg"
          :disabled="saving || testOrigin === 'submit'"
          @click="requestClose"
        >
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton
          type="submit"
          kind="primary"
          size="lg"
          :disabled="busy"
          :loading="saving || testOrigin === 'submit'"
        >
          {{ submitLabel }}
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
