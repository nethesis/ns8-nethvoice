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
import { useOutboundRouteLabels } from '@/composables/useOutboundRouteLabels'
import { useOutboundRouteDefaults } from '@/queries/routes/outbound'
import { useTrunkProviders, useTrunks } from '@/queries/trunks/trunks'
import { getTrunkLabelById } from '@/lib/trunks/providers'
import {
  getAvailableTrunks,
  haveSameTrunks,
  moveItem,
  OUTBOUND_ROUTES_KEY,
  postOutboundRouteTrunks,
  type OutboundRoute,
  type RouteTrunk,
} from '@/lib/routes/outbound'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { isShown = false, route = undefined } = defineProps<{
  isShown: boolean
  route: OutboundRoute | undefined
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { getRouteTitle } = useOutboundRouteLabels()
const { state: defaultsState, refetch: refetchDefaults } = useOutboundRouteDefaults()
const { state: trunksState } = useTrunks()
const { state: providersState } = useTrunkProviders()

const trunks = ref<RouteTrunk[]>([])
const draggedIndex = ref<number | null>(null)
const announcement = ref('')
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
  mutation: (vars: { route: OutboundRoute; trunks: RouteTrunk[] }) =>
    postOutboundRouteTrunks(vars.route.id, vars.trunks),
  onSuccess(_data, vars) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('routes.route_saved'),
        description: t('common.object_saved_successfully', { name: getRouteTitle(vars.route) }),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [OUTBOUND_ROUTES_KEY] })
  },
})

const routeTitle = computed(() => (route ? getRouteTitle(route) : ''))

const availableTrunks = computed(() =>
  getAvailableTrunks(defaultsState.value.data?.trunks ?? [], trunks.value),
)

const addTrunkItems = computed<NeDropdownItem[]>(() =>
  availableTrunks.value.map((trunk) => ({
    id: String(trunk.id),
    label: getTrunkLabel(trunk),
    action: () => addTrunk(trunk),
  })),
)

const noTrunksToAddMessage = computed(() => {
  if (defaultsState.value.status !== 'success' || availableTrunks.value.length > 0) {
    return ''
  }
  return defaultsState.value.data.trunks.length === 0
    ? t('routes.no_trunks_configured')
    : t('routes.all_trunks_assigned')
})

watch(
  () => isShown,
  () => {
    if (isShown) {
      saveTrunksReset()
      trunks.value = [...(route?.trunks ?? [])]
      draggedIndex.value = null
      announcement.value = ''
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

function onDragStart(event: DragEvent, index: number) {
  draggedIndex.value = index

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

function onDragEnd() {
  if (draggedIndex.value !== null) {
    const trunk = trunks.value[draggedIndex.value]

    announcement.value = t('routes.trunk_moved', {
      name: getTrunkLabel(trunk),
      position: draggedIndex.value + 1,
    })
  }
  draggedIndex.value = null
}

function saveRoute() {
  if (!route) {
    return
  }

  if (haveSameTrunks(route.trunks, trunks.value)) {
    emit('close')
    return
  }
  saveTrunksMutate({ route, trunks: trunks.value })
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="t('routes.edit_route', { name: routeTitle })"
    :close-aria-label="t('common.close')"
    @close="emit('close')"
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
        >
          <li
            v-for="(trunk, index) in trunks"
            :key="trunk.id"
            :data-trunk-id="trunk.id"
            :draggable="!saveTrunksLoading"
            :class="[
              'flex items-center gap-3 rounded-md bg-gray-100 py-1 pr-2 pl-4 dark:bg-gray-800',
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
            <NeBadgeV2 kind="indigo" size="xs" pill>{{ index + 1 }}</NeBadgeV2>
            <span class="text-primary-neutral min-w-0 flex-1 wrap-anywhere">{{
              getTrunkLabel(trunk)
            }}</span>
            <div class="flex shrink-0 items-center">
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
            </div>
          </li>
        </ol>
        <p class="sr-only" aria-live="polite">{{ announcement }}</p>
        <LoadError
          v-if="defaultsState.status === 'error'"
          :error="defaultsState.error"
          :title="t('routes.cannot_load_trunks')"
          @retry="refetchDefaults()"
        />
        <NeSkeleton v-else-if="defaultsState.status === 'pending'" :lines="1" class="w-32" />
        <div v-else class="flex flex-col items-start gap-1">
          <NeDropdown
            v-if="addTrunkItems.length && !saveTrunksLoading"
            :items="addTrunkItems"
            open-menu-aria-label=""
          >
            <template #button>
              <span
                class="text-primary-700 hover:text-primary-800 dark:text-primary-500 dark:hover:text-primary-400 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-200/70 dark:hover:bg-gray-600/30"
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
          :description="describeError(saveTrunksError)"
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
          @click="emit('close')"
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
</template>
