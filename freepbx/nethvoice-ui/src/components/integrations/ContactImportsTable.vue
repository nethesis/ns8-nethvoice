<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  formatDateTimeNoSeconds,
  NeButton,
  NeEmptyState,
  NeHeading,
  NeInlineNotification,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTooltip,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleArrowUp, faCircleInfo, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import ImportContactsDrawer from './ImportContactsDrawer.vue'
import IntegrationsPaginator from './IntegrationsPaginator.vue'
import PhonebookUpdating from './PhonebookUpdating.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { useUpdatingIndicator } from '@/composables/useUpdatingIndicator'
import { PAGE_SIZES } from '@/lib/common'
import { describeOwner, type PhonebookImport } from '@/lib/integrations/phonebookImports'
import { useImportOwners, usePhonebookImports } from '@/queries/integrations/phonebookSources'
import { describeError } from '@/stores/notifications'

const { t, locale } = useI18n()
const { state, asyncStatus, refetch } = usePhonebookImports()
const { state: ownersState } = useImportOwners()

const isShownDrawer = ref(false)

const isUpdatingShown = useUpdatingIndicator(
  () => state.value.status === 'success' && asyncStatus.value === 'loading',
)

const imports = computed(() => state.value.data ?? [])

const owners = computed(() => ownersState.value.data ?? [])

const { pageNum, pageSize, page: importsPage } = useClientPagination(imports)

const isEmpty = computed(() => state.value.status === 'success' && imports.value.length === 0)

const isTableShown = computed(() => state.value.status === 'pending' || imports.value.length > 0)

function describeVisibility(item: PhonebookImport): string {
  return item.groups.length > 0 ? item.groups.join(', ') : t('integrations.phonebook.everyone')
}
</script>

<template>
  <section aria-labelledby="contact-imports-heading">
    <div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      <NeHeading id="contact-imports-heading" tag="h5">
        {{ t('integrations.phonebook.import_contacts') }}
      </NeHeading>
      <PhonebookUpdating v-if="isUpdatingShown" />
    </div>
    <div v-if="!isEmpty" class="mb-8 grid gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto] sm:items-center">
      <p class="text-tertiary-neutral max-w-2xl">
        {{ t('integrations.phonebook.imports_description') }}
      </p>
      <NeButton
        kind="secondary"
        size="lg"
        :disabled="state.status !== 'success'"
        class="mt-2 justify-self-start sm:mt-0"
        @click="isShownDrawer = true"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faCircleArrowUp" class="size-4" aria-hidden="true" />
        </template>
        {{ t('integrations.phonebook.import_contacts') }}
      </NeButton>
    </div>
    <div class="flex flex-col gap-6">
      <LoadError
        v-if="state.status === 'error'"
        :error="state.error"
        :title="t('integrations.phonebook.cannot_load_imports')"
        @retry="refetch()"
      />
      <NeEmptyState
        v-else-if="isEmpty"
        :title="t('integrations.phonebook.no_imports')"
        :description="t('integrations.phonebook.imports_description')"
        :icon="faClockRotateLeft"
        class="elevation-0"
      >
        <NeButton kind="secondary" size="lg" @click="isShownDrawer = true">
          <template #prefix>
            <FontAwesomeIcon :icon="faCircleArrowUp" class="size-4" aria-hidden="true" />
          </template>
          {{ t('integrations.phonebook.import_contacts') }}
        </NeButton>
      </NeEmptyState>
      <NeInlineNotification
        v-if="imports.length > 0 && ownersState.status === 'error'"
        kind="warning"
        :title="t('integrations.phonebook.cannot_load_owners')"
        :description="describeError(ownersState.error)"
      />
      <NeTable
        v-if="isTableShown"
        :aria-label="t('integrations.phonebook.imported_contacts')"
        card-breakpoint="lg"
        :loading="state.status === 'pending'"
        :skeleton-columns="5"
        :skeleton-rows="3"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ t('integrations.phonebook.date') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.phonebook.owner') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.phonebook.file') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.phonebook.contacts') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.phonebook.visible_to') }}</NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="item in importsPage" :key="item.id">
            <NeTableCell :data-label="t('integrations.phonebook.date')">
              {{ formatDateTimeNoSeconds(item.createdAt, locale) }}
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.phonebook.owner')">
              <span class="wrap-anywhere">{{ describeOwner(item.owner, owners) }}</span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.phonebook.file')">
              <span class="flex items-center gap-2">
                <span class="wrap-anywhere">{{ item.filename || '-' }}</span>
                <NeTooltip v-if="item.notImported > 0" trigger-event="focusin">
                  <template #trigger>
                    <button
                      type="button"
                      class="focus:ring-primary-500 dark:focus:ring-primary-300 flex rounded-sm focus:ring-2 focus:outline-hidden"
                      :aria-label="
                        t(
                          'integrations.phonebook.rows_skipped',
                          { count: item.notImported },
                          item.notImported,
                        )
                      "
                    >
                      <FontAwesomeIcon
                        :icon="faCircleInfo"
                        class="text-secondary size-4"
                        aria-hidden="true"
                      />
                    </button>
                  </template>
                  <template #content>
                    {{
                      t(
                        'integrations.phonebook.rows_skipped_description',
                        { count: item.notImported },
                        item.notImported,
                      )
                    }}
                  </template>
                </NeTooltip>
              </span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.phonebook.contacts')">
              {{
                t('integrations.phonebook.imported_count', { count: item.imported }, item.imported)
              }}
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.phonebook.visible_to')">
              <span class="wrap-anywhere">{{ describeVisibility(item) }}</span>
            </NeTableCell>
          </NeTableRow>
        </NeTableBody>
        <template v-if="imports.length > PAGE_SIZES[0]" #paginator>
          <IntegrationsPaginator
            v-model:page-num="pageNum"
            v-model:page-size="pageSize"
            :total-rows="imports.length"
          />
        </template>
      </NeTable>
    </div>
    <ImportContactsDrawer :is-shown="isShownDrawer" @close="isShownDrawer = false" />
  </section>
</template>
