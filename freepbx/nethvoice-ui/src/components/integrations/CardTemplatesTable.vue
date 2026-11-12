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
} from '@/lib/integrations/cardTemplates'
import { getCardsUsingTemplate } from '@/lib/integrations/customerCards'
import { useCardTemplates, useCustomerCards } from '@/queries/integrations/customerCards'

type DrawerMode = 'create' | 'edit' | 'duplicate' | 'view'

const { t } = useI18n()
const { state, refetch } = useCardTemplates()
const { state: cardsState } = useCustomerCards()

const currentTemplate = ref<CardTemplate | undefined>()
const drawerMode = ref<DrawerMode>('create')
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)

const templates = computed(() => state.value.data ?? [])

const { pageNum, pageSize, page: templatesPage } = useClientPagination(templates)

const isTableShown = computed(() => state.value.status === 'pending' || templates.value.length > 0)

const blockingCards = computed(() =>
  currentTemplate.value
    ? getCardsUsingTemplate(cardsState.value.data ?? [], currentTemplate.value.id).map(
        (card) => card.name,
      )
    : [],
)

function openDrawer(mode: DrawerMode, template?: CardTemplate) {
  drawerMode.value = mode
  currentTemplate.value = template
  isShownDrawer.value = true
}

function getKebabMenuItems(template: CardTemplate): NeDropdownItem[] {
  const items: NeDropdownItem[] = [
    {
      id: 'duplicate',
      label: t('integrations.cards.duplicate'),
      icon: faClone,
      action: () => openDrawer('duplicate', template),
    },
  ]

  if (template.custom) {
    items.push({
      id: 'delete',
      label: t('common.delete'),
      icon: faTrash,
      danger: true,
      disabled: cardsState.value.status !== 'success',
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
  <section class="flex flex-col gap-4" aria-labelledby="card-templates-heading">
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div class="flex flex-col gap-1">
        <NeHeading id="card-templates-heading" tag="h5">
          {{ t('integrations.cards.templates') }}
        </NeHeading>
        <p class="text-secondary-neutral max-w-2xl text-sm">
          {{ t('integrations.cards.templates_description') }}
        </p>
      </div>
      <NeButton
        kind="secondary"
        :disabled="state.status !== 'success'"
        @click="openDrawer('create')"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
        </template>
        {{ t('integrations.cards.create_template') }}
      </NeButton>
    </div>
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
      card-breakpoint="lg"
      :loading="state.status === 'pending'"
      :skeleton-columns="3"
      :skeleton-rows="3"
    >
      <NeTableHead>
        <NeTableHeadCell>{{ t('integrations.name') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('integrations.cards.template_kind') }}</NeTableHeadCell>
        <NeTableHeadCell>
          <span class="sr-only">{{ t('common.actions') }}</span>
        </NeTableHeadCell>
      </NeTableHead>
      <NeTableBody>
        <NeTableRow v-for="template in templatesPage" :key="template.id">
          <NeTableCell :data-label="t('integrations.name')">
            <span class="wrap-anywhere">{{ template.name }}</span>
          </NeTableCell>
          <NeTableCell :data-label="t('integrations.cards.template_kind')">
            <NeBadgeV2 :kind="template.custom ? 'indigo' : 'gray'" size="xs">
              {{
                template.custom
                  ? t('integrations.cards.template_custom')
                  : t('integrations.cards.template_built_in')
              }}
            </NeBadgeV2>
          </NeTableCell>
          <NeTableCell :data-label="t('common.actions')">
            <div class="-ml-2.5 flex gap-2 lg:ml-0 lg:justify-end">
              <NeButton
                kind="tertiary"
                @click="openDrawer(template.custom ? 'edit' : 'view', template)"
              >
                <template #prefix>
                  <FontAwesomeIcon
                    :icon="template.custom ? faPenToSquare : faEye"
                    class="h-4 w-4"
                    aria-hidden="true"
                  />
                </template>
                {{ template.custom ? t('common.edit') : t('integrations.cards.view') }}
                <span class="sr-only">{{ template.name }}</span>
              </NeButton>
              <NeDropdown
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
    <CreateOrEditCardTemplateDrawer
      :is-shown="isShownDrawer"
      :mode="drawerMode"
      :current-template="currentTemplate"
      :templates="templates"
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
      :error-title="t('integrations.cards.cannot_delete_template')"
      :delete-object="deleteCurrentTemplate"
      :invalidate-keys="[CARD_TEMPLATES_KEY]"
      :blocked-by="blockingCards"
      :blocked-message="t('integrations.cards.template_in_use')"
      @close="isShownDeleteModal = false"
    />
  </section>
</template>
