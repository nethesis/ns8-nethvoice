<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as v from 'valibot'
import { useMutation, useQueryCache } from '@pinia/colada'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import {
  focusElement,
  NeButton,
  NeInlineNotification,
  NeMultiselectCombobox,
  NeSideDrawer,
  NeTextInput,
  NeToggle,
  type NeMultiselectComboboxOption,
} from '@nethesis/vue-components'
import ProfileFeatureToggle from '@/components/profiles/ProfileFeatureToggle.vue'
import ProfileSection from '@/components/profiles/ProfileSection.vue'
import { buildFeatureTree, CALL_FEATURES_MACRO, type FeatureGroupId } from '@/lib/profiles/features'
import {
  BASE_PROFILE_ID,
  buildProfileNameSchema,
  createProfile,
  CTI_MACRO,
  getCopyName,
  getNewlyEnabledPrivacyPermissions,
  getOutboundRouteCategory,
  getProfileUsers,
  isDefaultProfile,
  PROFILES_KEY,
  toProfileForm,
  updateProfile,
  type Profile,
  type ProfileDrawerMode,
  type ProfileForm,
  type ProfileOutboundRoute,
} from '@/lib/profiles/profiles'
import { hasMainExtension, USERS_KEY, type User } from '@/lib/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const {
  isShown = false,
  mode = undefined,
  profiles,
  users,
  subscriptionActive = false,
} = defineProps<{
  isShown: boolean
  mode: ProfileDrawerMode | undefined
  profiles: Profile[]
  users: User[]
  subscriptionActive?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const emptyForm = (): ProfileForm => ({
  name: '',
  macroPermissions: {},
  outboundEnabled: true,
  outboundRoutes: [],
})

const form = reactive<ProfileForm>(emptyForm())
const initialForm = ref<ProfileForm>(emptyForm())
const nameRef = useTemplateRef<InstanceType<typeof NeTextInput>>('nameRef')
const usersRef = useTemplateRef<{ focus: () => void }>('usersRef')
const nameIssue = ref('')
const usersIssue = ref('')
const selectedUsers = ref<NeMultiselectComboboxOption[]>([])
const collapsedGroups = ref<FeatureGroupId[]>([])

const editedProfile = computed(() => (mode?.kind === 'edit' ? mode.profile : undefined))

const initialUserIds = computed(() =>
  editedProfile.value ? getProfileUsers(editedProfile.value.id, users).map((user) => user.id) : [],
)

const selectedUserIds = computed(() => selectedUsers.value.map((option) => Number(option.id)))

const removedUserIds = computed(() =>
  initialUserIds.value.filter((userId) => !selectedUserIds.value.includes(userId)),
)

const isBaseProfile = computed(() => editedProfile.value?.id === BASE_PROFILE_ID)

const featureTree = computed(() => buildFeatureTree(form))

const privacyPermissions = computed(() =>
  getNewlyEnabledPrivacyPermissions(initialForm.value, form),
)

const title = computed(() =>
  editedProfile.value
    ? t('profiles.edit_profile_name', {
        name: isDefaultProfile(editedProfile.value)
          ? t('profiles.default_profile_name', { name: editedProfile.value.name })
          : editedProfile.value.name,
      })
    : t('profiles.create_profile'),
)

const userOptions = computed<NeMultiselectComboboxOption[]>(() =>
  users
    .filter((user) => hasMainExtension(user) || initialUserIds.value.includes(user.id))
    .map((user) => {
      const currentProfile = profiles.find((profile) => profile.id === user.profileId)
      const assignedElsewhere = currentProfile && currentProfile.id !== editedProfile.value?.id

      return {
        id: String(user.id),
        label: user.username,
        description: assignedElsewhere
          ? t('profiles.current_profile', { name: currentProfile.name })
          : user.displayName === user.username
            ? undefined
            : user.displayName,
      }
    }),
)

const {
  mutate: saveProfileMutate,
  isLoading: saving,
  reset: saveProfileReset,
  error: saveProfileError,
} = useMutation({
  mutation: async ({ profileForm, userIds }: { profileForm: ProfileForm; userIds: number[] }) => {
    if (editedProfile.value) {
      await updateProfile(editedProfile.value.id, profileForm, initialUserIds.value, userIds)
      return
    }
    await createProfile(profileForm, userIds)
  },
  onSuccess(_data, { profileForm }) {
    const edited = !!editedProfile.value

    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: edited ? t('profiles.profile_saved') : t('profiles.profile_created'),
        description: edited
          ? t('common.object_saved_successfully', { name: profileForm.name })
          : t('common.object_created_successfully', { name: profileForm.name }),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [PROFILES_KEY] })
    queryCache.invalidateQueries({ key: [USERS_KEY] })
  },
})

watch(
  () => isShown,
  () => {
    if (!isShown || !mode) {
      return
    }
    saveProfileReset()
    nameIssue.value = ''
    usersIssue.value = ''
    collapsedGroups.value = []

    const source = mode.kind === 'edit' ? mode.profile : mode.source
    const name =
      mode.kind === 'edit'
        ? source.name
        : getCopyName(
            source.name,
            t('profiles.copy_suffix'),
            profiles.map((profile) => profile.name),
          )

    Object.assign(form, toProfileForm(source, name))
    initialForm.value = toProfileForm(source, name)
    selectedUsers.value = userOptions.value.filter((option) =>
      initialUserIds.value.includes(Number(option.id)),
    )
    focusElement(mode.kind === 'edit' ? usersRef : nameRef)
  },
)

function getRouteLabel(route: ProfileOutboundRoute) {
  const category = getOutboundRouteCategory(route.name)
  return category ? t(`profiles.outbound.${category}`) : route.name
}

function toggleGroup(groupId: FeatureGroupId) {
  collapsedGroups.value = collapsedGroups.value.includes(groupId)
    ? collapsedGroups.value.filter((id) => id !== groupId)
    : [...collapsedGroups.value, groupId]
}

function macroValue(macro: string) {
  return form.macroPermissions[macro]?.value ?? false
}

function setMacroValue(macro: string, value: boolean) {
  const target = form.macroPermissions[macro]

  if (target) {
    target.value = value
  }
}

function saveProfile() {
  saveProfileReset()
  nameIssue.value = ''
  usersIssue.value = ''

  if (isBaseProfile.value && removedUserIds.value.length > 0) {
    usersIssue.value = 'profiles.cannot_remove_from_base'
    focusElement(usersRef)
    return
  }

  if (!editedProfile.value) {
    const validation = v.safeParse(
      buildProfileNameSchema(profiles.map((profile) => profile.name)),
      form.name,
    )

    if (!validation.success) {
      nameIssue.value = validation.issues[0].message
      focusElement(nameRef)
      return
    }
    form.name = validation.output
  }
  saveProfileMutate({ profileForm: form, userIds: selectedUserIds.value })
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="title"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="emit('close')"
  >
    <form @submit.prevent="saveProfile">
      <div class="space-y-6">
        <NeTextInput
          v-if="!editedProfile"
          ref="nameRef"
          v-model="form.name"
          :label="t('profiles.name')"
          :invalid-message="nameIssue ? t(nameIssue) : ''"
          :disabled="saving"
          @blur="form.name = form.name.trim()"
        />
        <NeMultiselectCombobox
          ref="usersRef"
          v-model="selectedUsers"
          :label="t('profiles.assign_users')"
          :options="userOptions"
          :placeholder="t('profiles.choose_users')"
          :invalid-message="usersIssue ? t(usersIssue) : ''"
          :disabled="saving"
          optional
          :optional-label="t('common.optional')"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :remove-label="t('common.remove')"
        />
        <NeInlineNotification
          v-if="!isBaseProfile && removedUserIds.length > 0"
          kind="info"
          :title="t('profiles.users_moved_to_base_title')"
          :description="t('profiles.users_moved_to_base_description')"
        />
        <ProfileSection
          v-if="form.macroPermissions[CALL_FEATURES_MACRO]"
          section-id="call_features"
          :model-value="macroValue(CALL_FEATURES_MACRO)"
          :title="t('profiles.call_features')"
          :description="t('profiles.call_features_description')"
          :disabled="saving"
          initially-expanded
          @update:model-value="setMacroValue(CALL_FEATURES_MACRO, $event)"
        >
          <ProfileFeatureToggle
            v-for="node in featureTree.callFeatures"
            :key="node.key"
            :node="node"
            :form="form"
            :parent-enabled="macroValue(CALL_FEATURES_MACRO)"
            :disabled="saving"
          />
        </ProfileSection>
        <ProfileSection
          v-model="form.outboundEnabled"
          section-id="outbound_calling"
          :title="t('profiles.outbound_calling')"
          :description="t('profiles.outbound_calling_description')"
          :disabled="saving"
        >
          <p v-if="form.outboundRoutes.length === 0" class="text-tertiary-neutral">
            {{ t('profiles.no_outbound_routes') }}
          </p>
          <div
            v-for="route in form.outboundRoutes"
            :key="route.routeId"
            :data-feature="`route.${route.routeId}`"
          >
            <NeToggle
              v-model="route.allowed"
              :top-label="getRouteLabel(route)"
              :label="route.allowed ? t('common.enabled') : t('common.disabled')"
              :disabled="saving || !form.outboundEnabled"
            />
          </div>
        </ProfileSection>
        <ProfileSection
          v-if="form.macroPermissions[CTI_MACRO]"
          section-id="cti_features"
          :model-value="macroValue(CTI_MACRO)"
          :title="t('profiles.cti_features')"
          :description="t('profiles.cti_features_description')"
          :disabled="saving"
          @update:model-value="setMacroValue(CTI_MACRO, $event)"
        >
          <div v-for="group in featureTree.ctiGroups" :key="group.id" class="space-y-4">
            <button
              type="button"
              class="text-secondary-neutral flex w-full items-center gap-2 border-b border-gray-200 pb-2 text-left text-xs font-medium uppercase dark:border-gray-700"
              :aria-expanded="!collapsedGroups.includes(group.id)"
              @click="toggleGroup(group.id)"
            >
              <FontAwesomeIcon
                :icon="collapsedGroups.includes(group.id) ? faChevronDown : faChevronUp"
                class="size-3"
                aria-hidden="true"
              />
              {{ t(`profiles.groups.${group.id}`) }}
            </button>
            <div v-show="!collapsedGroups.includes(group.id)" class="space-y-4">
              <ProfileFeatureToggle
                v-for="node in group.nodes"
                :key="node.key"
                :node="node"
                :form="form"
                :parent-enabled="macroValue(CTI_MACRO)"
                :disabled="saving"
                :subscription-active="subscriptionActive"
              />
            </div>
          </div>
        </ProfileSection>
        <NeInlineNotification
          v-if="privacyPermissions.length > 0"
          kind="warning"
          :title="t('profiles.privacy_warning_title')"
          :description="t('profiles.privacy_warning_description')"
        />
        <NeInlineNotification
          v-if="saveProfileError"
          kind="error"
          :title="
            editedProfile ? t('profiles.cannot_save_profile') : t('profiles.cannot_create_profile')
          "
          :description="describeError(saveProfileError)"
        />
      </div>
      <hr class="my-8" />
      <div class="flex justify-end gap-3">
        <NeButton kind="tertiary" size="lg" :disabled="saving" @click.prevent="emit('close')">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="saving" :loading="saving">
          {{ editedProfile ? t('common.save') : t('profiles.create') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
