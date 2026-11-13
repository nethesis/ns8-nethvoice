<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  NeBadgeV2,
  NeButton,
  NeDropdown,
  NeInlineNotification,
  NeSideDrawer,
  NeSkeleton,
  NeTooltip,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faArrowDown,
  faArrowUp,
  faChevronDown,
  faCirclePlus,
  faGripVertical,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import RouteTrunkBadge from './RouteTrunkBadge.vue'
import { useFocusReturn } from '@/composables/useFocusReturn'
import { useOutboundRouteLabels } from '@/composables/useOutboundRouteLabels'
import { useOutboundRouteDefaults, useOutboundRoutes } from '@/queries/routes/outbound'
import { useTrunkProviders, useTrunks } from '@/queries/trunks/trunks'
import { getTrunkLabelById } from '@/lib/trunks/providers'
import {
  getAvailableTrunks,
  getNoTrunksToAddReason,
  getRouteTrunkState,
  haveSameTrunks,
  moveItem,
  OUTBOUND_ROUTES_KEY,
  postOutboundRouteTrunks,
  type OutboundRoute,
  type RouteTrunk,
} from '@/lib/routes/outbound'
import { useNotificationsStore } from '@/stores/notifications'

const { isShown = false, route = undefined } = defineProps<{
  isShown: boolean
  route: OutboundRoute | undefined
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { getRouteTitleAmong, describeRouteError } = useOutboundRouteLabels()
const { state: routesState } = useOutboundRoutes()
const { state: defaultsState, refetch: refetchDefaults } = useOutboundRouteDefaults()
const { state: trunksState, refetch: refetchTrunks } = useTrunks()
const { state: providersState } = useTrunkProviders()

useFocusReturn(() => isShown)

const trunks = ref<RouteTrunk[]>([])
const draggedIndex = ref<number | null>(null)
const orderBeforeDrag = ref<RouteTrunk[] | null>(null)
const announcement = ref('')
const isShownDiscardModal = ref(false)
const trunkListRef = useTemplateRef<HTMLOListElement>('trunkListRef')

function getTrunkLabel(trunk: RouteTrunk): string {
  return getTrunkLabelById(
    trunk.id,
    trunk.name,
    trunksState.value.data ?? [],
    providersState.value.data ?? [],
  )
}

const {
  mutate: saveTrunksMutate,
  isLoading: saveTrunksLoading,
  reset: saveTrunksReset,
  error: saveTrunksError,
} = useMutation({
  mutation: (vars: { route: OutboundRoute; title: string; trunks: RouteTrunk[] }) =>
    postOutboundRouteTrunks(vars.route.id, vars.trunks),
  onSuccess(_data, vars) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('routes.route_saved'),
        description: t('routes.route_saved_description', { name: vars.title }),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [OUTBOUND_ROUTES_KEY] })
  },
})

const routeTitle = computed(() =>
  route ? getRouteTitleAmong(route, routesState.value.data ?? []) : '',
)

const loadedTrunks = computed(() =>
  trunksState.value.status === 'success' ? trunksState.value.data : undefined,
)

const trunkChoicesStatus = computed(() => {
  if (defaultsState.value.status === 'error' || trunksState.value.status === 'error') {
    return 'error'
  }
  return defaultsState.value.status === 'success' && loadedTrunks.value ? 'success' : 'pending'
})

const trunkChoicesError = computed(() => defaultsState.value.error ?? trunksState.value.error)

const availableTrunks = computed(() =>
  getAvailableTrunks(
    defaultsState.value.data?.trunks ?? [],
    trunks.value,
    loadedTrunks.value ?? [],
  ),
)

const isDirty = computed(() => Boolean(route) && !haveSameTrunks(route?.trunks ?? [], trunks.value))

const addTrunkItems = computed<NeDropdownItem[]>(() =>
  availableTrunks.value.map((trunk) => ({
    id: String(trunk.id),
    label: getTrunkLabel(trunk),
    action: () => addTrunk(trunk),
  })),
)

const noTrunksToAddMessage = computed(() => {
  if (trunkChoicesStatus.value !== 'success' || availableTrunks.value.length > 0) {
    return ''
  }
  switch (
    getNoTrunksToAddReason(defaultsState.value.data?.trunks ?? [], loadedTrunks.value ?? [])
  ) {
    case 'all_assigned':
      return t('routes.all_trunks_assigned')
    case 'no_enabled_trunks':
      return t('routes.no_enabled_trunks')
    default:
      return t('routes.no_trunks_configured')
  }
})

watch(
  () => isShown,
  () => {
    if (isShown) {
      saveTrunksReset()
      trunks.value = [...(route?.trunks ?? [])]
      draggedIndex.value = null
      orderBeforeDrag.value = null
      announcement.value = ''
      isShownDiscardModal.value = false
    }
  },
  { immediate: true },
)

function addTrunk(trunk: RouteTrunk) {
  trunks.value = [...trunks.value, trunk]
  announcement.value = t('routes.trunk_added', {
    name: getTrunkLabel(trunk),
    position: trunks.value.length,
  })
}

function removeTrunk(trunk: RouteTrunk) {
  trunks.value = trunks.value.filter((item) => item.id !== trunk.id)
  announcement.value = t('routes.trunk_removed', { name: getTrunkLabel(trunk) })
}

async function moveTrunk(index: number, offset: -1 | 1) {
  const trunk = trunks.value[index]
  const target = index + offset

  trunks.value = moveItem(trunks.value, index, target)
  announcement.value = t('routes.trunk_moved', { name: getTrunkLabel(trunk), position: target + 1 })
  await nextTick()

  const row = trunkListRef.value?.querySelector(`[data-trunk-id="${trunk.id}"]`)
  const preferred = row?.querySelector<HTMLButtonElement>(
    `[data-move="${offset === -1 ? 'up' : 'down'}"]`,
  )
  const fallback = row?.querySelector<HTMLButtonElement>(
    `[data-move="${offset === -1 ? 'down' : 'up'}"]`,
  )

  if (preferred && !preferred.disabled) {
    preferred.focus()
  } else {
    fallback?.focus()
  }
}

function getTrunkState(trunk: RouteTrunk) {
  return getRouteTrunkState(trunk.id, loadedTrunks.value)
}

function retryTrunkChoices() {
  if (defaultsState.value.status === 'error') {
    refetchDefaults()
  }
  if (trunksState.value.status === 'error') {
    refetchTrunks()
  }
}

function onDragStart(event: DragEvent, index: number) {
  draggedIndex.value = index
  orderBeforeDrag.value = [...trunks.value]

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', getTrunkLabel(trunks.value[index]))
  }
}

function onDragEnter(index: number) {
  if (draggedIndex.value === null || draggedIndex.value === index) {
    return
  }
  trunks.value = moveItem(trunks.value, draggedIndex.value, index)
  draggedIndex.value = index
}

function onDragEnd(event: DragEvent) {
  if (event.dataTransfer?.dropEffect === 'none' && orderBeforeDrag.value) {
    trunks.value = orderBeforeDrag.value
  } else if (draggedIndex.value !== null) {
    const trunk = trunks.value[draggedIndex.value]

    announcement.value = t('routes.trunk_moved', {
      name: getTrunkLabel(trunk),
      position: draggedIndex.value + 1,
    })
  }
  draggedIndex.value = null
  orderBeforeDrag.value = null
}

function saveRoute() {
  if (!route) {
    return
  }

  if (!isDirty.value) {
    emit('close')
    return
  }
  saveTrunksMutate({ route, title: routeTitle.value, trunks: trunks.value })
}

function requestClose() {
  if (saveTrunksLoading.value || isShownDiscardModal.value) {
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
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="t('routes.edit_route', { name: routeTitle })"
    :close-aria-label="t('common.close')"
    @close="requestClose"
  >
    <form @submit.prevent="saveRoute">
      <div class="flex flex-col gap-2">
        <div class="flex flex-col gap-1">
          <h3 id="trunk-priority-label" class="text-primary-neutral text-sm font-medium">
            {{ t('routes.trunk_priority') }}
          </h3>
          <p id="trunk-priority-helper" class="text-secondary-neutral text-xs">
            {{ t('routes.trunk_priority_helper') }}
          </p>
        </div>
        <p v-if="trunks.length === 0" class="text-tertiary-neutral py-2">
          {{ t('routes.route_without_trunks') }}
        </p>
        <ol
          v-else
          ref="trunkListRef"
          aria-labelledby="trunk-priority-label"
          aria-describedby="trunk-priority-helper"
          class="flex flex-col gap-2"
          @dragover.prevent
          @drop.prevent
        >
          <li
            v-for="(trunk, index) in trunks"
            :key="trunk.id"
            :data-trunk-id="trunk.id"
            :draggable="!saveTrunksLoading"
            :class="[
              'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-gray-100 py-1 pr-2 pl-4 dark:bg-gray-800',
              { 'opacity-50': draggedIndex === index },
            ]"
            @dragstart="onDragStart($event, index)"
            @dragenter.prevent="onDragEnter(index)"
            @dragover.prevent
            @drop.prevent
            @dragend="onDragEnd"
          >
            <FontAwesomeIcon
              :icon="faGripVertical"
              class="text-secondary-neutral h-4 w-4 shrink-0 cursor-grab"
              aria-hidden="true"
            />
            <span class="flex min-w-6 shrink-0 justify-center">
              <NeBadgeV2 kind="indigo" size="xs" pill>{{ index + 1 }}</NeBadgeV2>
            </span>
            <span class="flex min-w-0 flex-1 basis-40 flex-wrap items-center gap-x-2 gap-y-1">
              <span class="text-primary-neutral min-w-0 break-words">{{
                getTrunkLabel(trunk)
              }}</span>
              <RouteTrunkBadge :state="getTrunkState(trunk)" />
            </span>
            <div class="ml-auto flex shrink-0 items-center">
              <NeTooltip trigger-event="mouseenter focus" placement="top">
                <template #trigger>
                  <NeButton
                    type="button"
                    kind="tertiary"
                    size="sm"
                    data-move="up"
                    :disabled="index === 0 || saveTrunksLoading"
                    @click="moveTrunk(index, -1)"
                  >
                    <span class="sr-only">{{
                      t('routes.move_trunk_up', { name: getTrunkLabel(trunk) })
                    }}</span>
                    <FontAwesomeIcon :icon="faArrowUp" class="h-4 w-4" aria-hidden="true" />
                  </NeButton>
                </template>
                <template #content>{{ t('routes.move_up') }}</template>
              </NeTooltip>
              <NeTooltip trigger-event="mouseenter focus" placement="top">
                <template #trigger>
                  <NeButton
                    type="button"
                    kind="tertiary"
                    size="sm"
                    data-move="down"
                    :disabled="index === trunks.length - 1 || saveTrunksLoading"
                    @click="moveTrunk(index, 1)"
                  >
                    <span class="sr-only">{{
                      t('routes.move_trunk_down', { name: getTrunkLabel(trunk) })
                    }}</span>
                    <FontAwesomeIcon :icon="faArrowDown" class="h-4 w-4" aria-hidden="true" />
                  </NeButton>
                </template>
                <template #content>{{ t('routes.move_down') }}</template>
              </NeTooltip>
              <NeTooltip trigger-event="mouseenter focus" placement="top">
                <template #trigger>
                  <NeButton
                    type="button"
                    kind="tertiary"
                    size="sm"
                    :disabled="saveTrunksLoading"
                    @click="removeTrunk(trunk)"
                  >
                    <span class="sr-only">{{
                      t('routes.remove_trunk', { name: getTrunkLabel(trunk) })
                    }}</span>
                    <FontAwesomeIcon :icon="faTrash" class="h-4 w-4" aria-hidden="true" />
                  </NeButton>
                </template>
                <template #content>{{ t('common.remove') }}</template>
              </NeTooltip>
            </div>
          </li>
        </ol>
        <p class="sr-only" aria-live="polite">{{ announcement }}</p>
        <LoadError
          v-if="trunkChoicesStatus === 'error'"
          :error="trunkChoicesError"
          :title="t('routes.cannot_load_trunks')"
          @retry="retryTrunkChoices"
        />
        <NeSkeleton v-else-if="trunkChoicesStatus === 'pending'" :lines="1" class="w-32" />
        <div v-else class="flex flex-col items-start gap-1">
          <NeDropdown
            v-if="addTrunkItems.length && !saveTrunksLoading"
            :items="addTrunkItems"
            :open-menu-aria-label="t('routes.add_trunk')"
          >
            <template #button>
              <span
                aria-hidden="true"
                class="text-primary-700 hover:text-primary-800 dark:text-primary-500 dark:hover:text-primary-400 in-focus-visible:ring-primary-500 dark:in-focus-visible:ring-primary-300 dark:in-focus-visible:ring-offset-primary-950 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-200/70 in-focus-visible:ring-2 in-focus-visible:ring-offset-2 in-focus-visible:ring-offset-white dark:hover:bg-gray-600/30"
              >
                <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
                {{ t('routes.add_trunk') }}
                <FontAwesomeIcon :icon="faChevronDown" class="h-3 w-3" aria-hidden="true" />
              </span>
            </template>
          </NeDropdown>
          <template v-else>
            <NeButton
              type="button"
              kind="tertiary"
              disabled
              :aria-describedby="noTrunksToAddMessage ? 'no-trunks-to-add' : undefined"
            >
              <template #prefix>
                <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
              </template>
              {{ t('routes.add_trunk') }}
              <template #suffix>
                <FontAwesomeIcon :icon="faChevronDown" class="h-3 w-3" aria-hidden="true" />
              </template>
            </NeButton>
            <p
              v-if="noTrunksToAddMessage"
              id="no-trunks-to-add"
              class="text-tertiary-neutral px-3 text-xs"
            >
              {{ noTrunksToAddMessage }}
            </p>
          </template>
        </div>
        <NeInlineNotification
          v-if="saveTrunksError"
          kind="error"
          :title="t('routes.cannot_save_route')"
          :description="describeRouteError(saveTrunksError)"
          class="mt-4"
        />
      </div>
      <hr class="my-8" />
      <div class="flex justify-end">
        <NeButton
          type="button"
          kind="tertiary"
          size="lg"
          :disabled="saveTrunksLoading"
          class="mr-3"
          @click="requestClose"
        >
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton
          type="submit"
          kind="primary"
          size="lg"
          :disabled="saveTrunksLoading"
          :loading="saveTrunksLoading"
        >
          {{ t('common.save') }}
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
