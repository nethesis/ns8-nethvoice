<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeBadgeV2,
  NeButton,
  NeDropdown,
  NeEmptyState,
  NeHeading,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCirclePlus,
  faClone,
  faCode,
  faEye,
  faPenToSquare,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditCardTemplateDrawer from './CreateOrEditCardTemplateDrawer.vue'
import DeleteIntegrationObjectModal from './DeleteIntegrationObjectModal.vue'
import IntegrationsPaginator from './IntegrationsPaginator.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { PAGE_SIZES } from '@/lib/common'
import {
  CARD_TEMPLATES_KEY,
  type CardTemplate,
  deleteCardTemplate,
  TEMPLATE_COLORS,
} from '@/lib/integrations/cardTemplates'
import { getCardsUsingTemplate } from '@/lib/integrations/customerCards'
import { useCardTemplates, useCustomerCards } from '@/queries/integrations/customerCards'
import { usePermissions } from '@/queries/permissions/me'

type DrawerMode = 'create' | 'edit' | 'duplicate' | 'view'

const { t } = useI18n()
const { state, refetch } = useCardTemplates()
const { state: cardsState } = useCustomerCards()
const { isSuperadmin } = usePermissions()

const currentTemplate = ref<CardTemplate | undefined>()
const drawerMode = ref<DrawerMode>('create')
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)

const templates = computed(() => state.value.data ?? [])

const { pageNum, pageSize, page: templatesPage } = useClientPagination(templates)

const isTableShown = computed(() => state.value.status === 'pending' || templates.value.length > 0)

function getUsers(template: CardTemplate): string[] {
  return getCardsUsingTemplate(cardsState.value.data ?? [], template.id).map((card) => card.name)
}

function describeColor(template: CardTemplate): string {
  if (template.custom) {
    return t('integrations.cards.color_in_code')
  }
  if (!template.color) {
    return t('integrations.cards.color_not_set')
  }
  return TEMPLATE_COLORS.includes(template.color)
    ? t(`integrations.cards.colors.${template.color}`)
    : template.color
}

function openDrawer(mode: DrawerMode, template?: CardTemplate) {
  drawerMode.value = mode
  currentTemplate.value = template
  isShownDrawer.value = true
}

function getKebabMenuItems(template: CardTemplate): NeDropdownItem[] {
  if (!isSuperadmin.value) {
    return []
  }
  const items: NeDropdownItem[] = [
    {
      id: 'duplicate',
      label: t('integrations.cards.duplicate'),
      icon: faClone,
      action: () => openDrawer('duplicate', template),
    },
  ]

  if (template.custom && cardsState.value.status === 'success' && !getUsers(template).length) {
    items.push({ id: 'divider' })
    items.push({
      id: 'delete',
      label: t('common.delete'),
      icon: faTrash,
      danger: true,
      action: () => {
        currentTemplate.value = template
        isShownDeleteModal.value = true
      },
    })
  }
  return items
}

function deleteCurrentTemplate() {
  return currentTemplate.value ? deleteCardTemplate(currentTemplate.value.name) : Promise.resolve()
}
</script>

<template>
  <section aria-labelledby="card-templates-heading">
    <NeHeading id="card-templates-heading" tag="h5" class="mb-2">
      {{ t('integrations.cards.templates') }}
    </NeHeading>
    <div class="mb-8 grid gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto] sm:items-center">
      <p class="text-tertiary-neutral max-w-2xl">
        {{
          isSuperadmin
            ? t('integrations.cards.templates_description')
            : t('integrations.cards.templates_description_read_only')
        }}
      </p>
      <NeButton
        v-if="isSuperadmin"
        kind="secondary"
        size="lg"
        :disabled="state.status !== 'success'"
        class="mt-2 justify-self-start sm:mt-0"
        @click="openDrawer('create')"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
        </template>
        {{ t('integrations.cards.create_template') }}
      </NeButton>
    </div>
    <div class="flex flex-col gap-6">
      <LoadError
        v-if="state.status === 'error'"
        :error="state.error"
        :title="t('integrations.cards.cannot_load_templates')"
        @retry="refetch()"
      />
      <NeEmptyState
        v-else-if="state.status === 'success' && templates.length === 0"
        :title="t('integrations.cards.no_templates')"
        :icon="faCode"
        class="elevation-0"
      />
      <NeTable
        v-if="isTableShown"
        :aria-label="t('integrations.cards.templates')"
        card-breakpoint="xl"
        :loading="state.status === 'pending'"
        :skeleton-columns="4"
        :skeleton-rows="3"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ t('integrations.name') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.cards.color') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.cards.used_by') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="template in templatesPage" :key="template.id">
            <NeTableCell :data-label="t('integrations.name')">
              <div class="flex flex-wrap items-center gap-2">
                <span class="wrap-break-word">{{ template.name }}</span>
                <NeBadgeV2 v-if="!template.custom" kind="gray" size="xs">
                  {{ t('integrations.cards.built_in') }}
                </NeBadgeV2>
              </div>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.cards.color')">
              {{ describeColor(template) }}
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.cards.used_by')">
              <span class="wrap-break-word">
                {{
                  cardsState.status === 'success'
                    ? getUsers(template).join(', ') || t('integrations.cards.not_used')
                    : '-'
                }}
              </span>
            </NeTableCell>
            <NeTableCell :data-label="t('common.actions')">
              <div class="-ml-2.5 flex gap-2 xl:ml-0 xl:justify-end">
                <NeButton v-if="isSuperadmin" kind="tertiary" @click="openDrawer('edit', template)">
                  <template #prefix>
                    <FontAwesomeIcon :icon="faPenToSquare" class="size-4" aria-hidden="true" />
                  </template>
                  {{ t('common.edit') }}
                  <span class="sr-only">{{ template.name }}</span>
                </NeButton>
                <NeButton v-else kind="tertiary" @click="openDrawer('view', template)">
                  <template #prefix>
                    <FontAwesomeIcon :icon="faEye" class="size-4" aria-hidden="true" />
                  </template>
                  {{ t('integrations.cards.view') }}
                  <span class="sr-only">{{ template.name }}</span>
                </NeButton>
                <NeDropdown
                  v-if="getKebabMenuItems(template).length"
                  :items="getKebabMenuItems(template)"
                  :align-to-right="true"
                  :open-menu-aria-label="t('integrations.open_menu_of', { name: template.name })"
                />
              </div>
            </NeTableCell>
          </NeTableRow>
        </NeTableBody>
        <template v-if="templates.length > PAGE_SIZES[0]" #paginator>
          <IntegrationsPaginator
            v-model:page-num="pageNum"
            v-model:page-size="pageSize"
            :total-rows="templates.length"
          />
        </template>
      </NeTable>
    </div>
    <CreateOrEditCardTemplateDrawer
      :is-shown="isShownDrawer"
      :mode="drawerMode"
      :current-template="currentTemplate"
      :templates="templates"
      :used-by="currentTemplate ? getUsers(currentTemplate) : []"
      @close="isShownDrawer = false"
    />
    <DeleteIntegrationObjectModal
      :visible="isShownDeleteModal"
      :title="t('integrations.cards.delete_template')"
      :object-name="currentTemplate?.name ?? ''"
      :confirmation-message="
        t('integrations.cards.delete_template_confirmation', { name: currentTemplate?.name ?? '' })
      "
      :success-title="t('integrations.cards.template_deleted')"
      success-description-key="integrations.cards.template_deleted_description"
      :error-title="t('integrations.cards.cannot_delete_template')"
      :delete-object="deleteCurrentTemplate"
      :invalidate-keys="[CARD_TEMPLATES_KEY]"
      @close="isShownDeleteModal = false"
    />
  </section>
</template>
