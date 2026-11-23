<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeButton,
  NeDropdown,
  NeEmptyState,
  NeInlineNotification,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTextInput,
  NeTooltip,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCirclePlus,
  faClone,
  faLink,
  faMagnifyingGlass,
  faPenToSquare,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import ClickToCopy from '@/components/common/ClickToCopy.vue'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditParameterizedUrlDrawer from './CreateOrEditParameterizedUrlDrawer.vue'
import DeleteIntegrationObjectModal from './DeleteIntegrationObjectModal.vue'
import IntegrationsPaginator from './IntegrationsPaginator.vue'
import { describeError } from '@/stores/notifications'
import { useClientPagination } from '@/composables/useClientPagination'
import { matchesText, PAGE_SIZES } from '@/lib/common'
import {
  areAllProfilesBound,
  deleteParameterizedUrl,
  getProfileName,
  PARAMETERIZED_URLS_KEY,
  type ParameterizedUrl,
  sortParameterizedUrls,
} from '@/lib/integrations/parameterizedUrls'
import { useProfileOptions } from '@/queries/integrations/lookups'
import { useParameterizedUrls } from '@/queries/integrations/parameterizedUrls'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'

type DrawerMode = 'create' | 'edit' | 'duplicate'

const { t } = useI18n()
const runtimeConfigStore = useRuntimeConfigStore()
const { state, refetch } = useParameterizedUrls()
const { state: profilesState } = useProfileOptions()

const textFilter = ref('')
const currentUrl = ref<ParameterizedUrl | undefined>()
const drawerMode = ref<DrawerMode>('create')
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)

const profiles = computed(() => profilesState.value.data ?? [])
const urls = computed(() => sortParameterizedUrls(state.value.data ?? [], profiles.value))

const allProfilesBound = computed(
  () => profilesState.value.status === 'success' && areAllProfilesBound(profiles.value, urls.value),
)

const filteredUrls = computed(() =>
  urls.value.filter((item) =>
    matchesText(
      textFilter.value,
      item.name,
      item.url,
      getProfileName(item.profileId, profiles.value),
      describeCalls(item),
    ),
  ),
)

const { pageNum, pageSize, page: urlsPage } = useClientPagination(filteredUrls)

const isNoDataEmptyStateShown = computed(
  () => state.value.status === 'success' && urls.value.length === 0,
)

const isNoMatchEmptyStateShown = computed(
  () =>
    state.value.status === 'success' && urls.value.length > 0 && filteredUrls.value.length === 0,
)

const isTableShown = computed(
  () =>
    state.value.status === 'pending' ||
    (state.value.data !== undefined && filteredUrls.value.length > 0),
)

watch(textFilter, () => {
  pageNum.value = 1
})

function describeCalls(item: ParameterizedUrl): string {
  return item.onlyQueues
    ? t('integrations.param_urls.queue_calls_only')
    : t('integrations.param_urls.all_calls')
}

function showDrawer(mode: DrawerMode, item?: ParameterizedUrl) {
  drawerMode.value = mode
  currentUrl.value = item
  isShownDrawer.value = true
}

function getKebabMenuItems(item: ParameterizedUrl): NeDropdownItem[] {
  const deleteItem: NeDropdownItem = {
    id: 'delete',
    label: t('common.delete'),
    icon: faTrash,
    danger: true,
    action: () => {
      currentUrl.value = item
      isShownDeleteModal.value = true
    },
  }

  if (allProfilesBound.value) {
    return [deleteItem]
  }
  return [
    {
      id: 'duplicate',
      label: t('integrations.param_urls.duplicate'),
      icon: faClone,
      action: () => showDrawer('duplicate', item),
    },
    { id: 'divider' },
    deleteItem,
  ]
}

function deleteCurrentUrl() {
  return currentUrl.value ? deleteParameterizedUrl(currentUrl.value) : Promise.resolve()
}
</script>

<template>
  <div>
    <div
      v-if="!isNoDataEmptyStateShown"
      class="mb-8 grid gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto] sm:items-center"
    >
      <p class="text-tertiary-neutral max-w-2xl">
        {{
          t('integrations.param_urls.description', {
            cti: runtimeConfigStore.config.ctiProductName,
          })
        }}
      </p>
      <NeTooltip
        v-if="allProfilesBound && state.status === 'success'"
        trigger-event="mouseenter focus"
        placement="top"
        tabindex="0"
        data-testid="create-url-disabled"
        class="focus:ring-primary-500 dark:focus:ring-primary-300 dark:focus:ring-offset-primary-950 mt-2 inline-flex justify-self-start rounded-md focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:outline-hidden sm:mt-0"
      >
        <template #trigger>
          <NeButton kind="primary" size="lg" disabled>
            <template #prefix>
              <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
            </template>
            {{ t('integrations.param_urls.create_url') }}
          </NeButton>
        </template>
        <template #content>{{ t('integrations.param_urls.all_profiles_used') }}</template>
      </NeTooltip>
      <NeButton
        v-else
        kind="primary"
        size="lg"
        :disabled="state.status !== 'success'"
        class="mt-2 justify-self-start sm:mt-0"
        @click="showDrawer('create')"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
        </template>
        {{ t('integrations.param_urls.create_url') }}
      </NeButton>
    </div>
    <div class="flex flex-col gap-6">
      <div
        v-if="!isNoDataEmptyStateShown && state.status !== 'error'"
        class="flex flex-wrap items-center gap-4"
      >
        <NeTextInput
          v-model="textFilter"
          is-search
          :placeholder="t('integrations.param_urls.filter_urls')"
          :aria-label="t('integrations.param_urls.filter_urls')"
          :clear-search-label="t('ne_text_input.clear_search')"
          class="w-full max-w-xs"
          @blur="textFilter = textFilter.trim()"
        />
        <NeButton kind="tertiary" :disabled="!textFilter.trim()" @click="textFilter = ''">
          {{ t('common.reset_filters') }}
        </NeButton>
      </div>
      <LoadError
        v-if="state.status === 'error'"
        :error="state.error"
        :title="t('integrations.param_urls.cannot_load_urls')"
        @retry="refetch()"
      />
      <NeEmptyState
        v-if="isNoDataEmptyStateShown"
        :title="t('integrations.param_urls.no_urls')"
        :description="
          t('integrations.param_urls.description', {
            cti: runtimeConfigStore.config.ctiProductName,
          })
        "
        :icon="faLink"
        class="elevation-0"
      >
        <NeButton kind="primary" size="lg" @click="showDrawer('create')">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
          </template>
          {{ t('integrations.param_urls.create_url') }}
        </NeButton>
      </NeEmptyState>
      <NeEmptyState
        v-else-if="isNoMatchEmptyStateShown"
        :title="t('integrations.param_urls.no_urls_found')"
        :description="t('common.try_different_words')"
        :icon="faMagnifyingGlass"
        class="elevation-0"
      >
        <NeButton kind="tertiary" @click="textFilter = ''">
          {{ t('common.clear_filter') }}
        </NeButton>
      </NeEmptyState>
      <NeInlineNotification
        v-if="isTableShown && profilesState.status === 'error'"
        kind="warning"
        :title="t('integrations.cannot_load_profiles')"
        :description="describeError(profilesState.error)"
      />
      <NeTable
        v-if="isTableShown"
        :aria-label="t('integrations.tab_parameterized_urls')"
        card-breakpoint="lg"
        :loading="state.status === 'pending'"
        :skeleton-columns="5"
        :skeleton-rows="5"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ t('integrations.name') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.url') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.param_urls.profile') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.param_urls.calls') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="item in urlsPage" :key="item.id">
            <NeTableCell :data-label="t('integrations.name')">
              <span class="wrap-anywhere">{{ item.name }}</span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.url')">
              <ClickToCopy class="wrap-anywhere" :text="item.url" />
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.param_urls.profile')">
              {{ getProfileName(item.profileId, profiles) }}
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.param_urls.calls')">
              {{ describeCalls(item) }}
            </NeTableCell>
            <NeTableCell :data-label="t('common.actions')">
              <div class="-ml-2.5 flex gap-2 lg:ml-0 lg:justify-end">
                <NeButton kind="tertiary" @click="showDrawer('edit', item)">
                  <template #prefix>
                    <FontAwesomeIcon :icon="faPenToSquare" class="size-4" aria-hidden="true" />
                  </template>
                  {{ t('common.edit') }}
                  <span class="sr-only">{{ item.name }}</span>
                </NeButton>
                <NeDropdown
                  :items="getKebabMenuItems(item)"
                  :align-to-right="true"
                  :open-menu-aria-label="t('integrations.open_menu_of', { name: item.name })"
                />
              </div>
            </NeTableCell>
          </NeTableRow>
        </NeTableBody>
        <template v-if="filteredUrls.length > PAGE_SIZES[0]" #paginator>
          <IntegrationsPaginator
            v-model:page-num="pageNum"
            v-model:page-size="pageSize"
            :total-rows="filteredUrls.length"
          />
        </template>
      </NeTable>
    </div>
    <CreateOrEditParameterizedUrlDrawer
      :is-shown="isShownDrawer"
      :mode="drawerMode"
      :current-url="currentUrl"
      :urls="urls"
      @close="isShownDrawer = false"
    />
    <DeleteIntegrationObjectModal
      :visible="isShownDeleteModal"
      :title="t('integrations.param_urls.delete_url')"
      :object-name="currentUrl?.name ?? ''"
      :confirmation-message="
        t('integrations.param_urls.delete_url_confirmation', {
          cti: runtimeConfigStore.config.ctiProductName,
          name: currentUrl?.name ?? '',
          profile: currentUrl ? getProfileName(currentUrl.profileId, profiles) : '',
        })
      "
      :success-title="t('integrations.param_urls.url_deleted')"
      success-description-key="integrations.param_urls.url_deleted_description"
      :error-title="t('integrations.param_urls.cannot_delete_url')"
      :delete-object="deleteCurrentUrl"
      :invalidate-keys="[PARAMETERIZED_URLS_KEY]"
      @close="isShownDeleteModal = false"
    />
  </div>
</template>
