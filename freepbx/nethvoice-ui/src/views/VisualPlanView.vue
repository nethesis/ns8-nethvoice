<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, onMounted, ref, toRaw, watch } from 'vue'
import { cloneDeep } from 'lodash'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { NeButton, NeEmptyState, NeSkeleton } from '@nethesis/vue-components'
import { faArrowLeft, faPhoneVolume } from '@fortawesome/free-solid-svg-icons'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { inboundRouteKey } from '@/lib/visualplan/model'
import { saveVisualPlanLayout } from '@/lib/visualplan/api'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useVisualPlanData } from '@/queries/visualplan/visualPlan'
import { usePermissions } from '@/queries/permissions/me'
import { useVisualPlanStore } from '@/stores/visualPlan'
import LoadError from '@/components/common/LoadError.vue'
import VisualPlanEditor from '@/components/visualplan/VisualPlanEditor.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useVisualPlanStore()
const notificationsStore = useNotificationsStore()
const { isSuperadmin } = usePermissions()
const { state, refetch } = useVisualPlanData()

const loadedKey = ref<string | undefined>(undefined)
const fresh = ref(false)
const reloading = ref(false)
const pendingReload = ref<{ key: string; refs: Record<string, string> } | null>(null)

const routeKey = computed(() => (typeof route.query.route === 'string' ? route.query.route : null))

const notFound = computed(
  () =>
    fresh.value &&
    !reloading.value &&
    routeKey.value !== null &&
    Boolean(state.value.data) &&
    !state.value.data?.inboundRoutes.some((item) => inboundRouteKey(item) === routeKey.value),
)

const loadError = computed(() => (state.value.status === 'error' ? state.value.error : null))

onMounted(async () => {
  await refetch()
  fresh.value = true
})

watch(
  [() => state.value.data, routeKey, fresh],
  ([data, key, isFresh]) => {
    const marker = key ?? ''
    if (data && isFresh && !reloading.value && !notFound.value && loadedKey.value !== marker) {
      store.load(data, key)
      loadedKey.value = marker
    }
  },
  { immediate: true },
)

async function reload() {
  const pending = pendingReload.value
  if (!pending) {
    await refetch()
    return
  }
  reloading.value = true
  const result = await refetch()
  if (result.status === 'success') {
    loadedKey.value = pending.key
    store.load(result.data, pending.key, pending.refs)
    pendingReload.value = null
    try {
      const sent = cloneDeep(toRaw(store.positions))
      await saveVisualPlanLayout(pending.key, sent)
      store.markLayoutSaved(sent)
    } catch (error) {
      notificationsStore.createNotification({
        kind: 'error',
        title: t('visual_plan.cannot_save_layout'),
        description: describeError(error),
      })
    }
  }
  reloading.value = false
}

async function reloadData() {
  const result = await refetch()
  if (result.status === 'success' && !store.isDirty) {
    store.load(result.data, routeKey.value)
  }
}

async function onSaved(savedKey: string | null, refs: Record<string, string>) {
  if (savedKey === null) {
    return
  }
  pendingReload.value = { key: savedKey, refs }
  reloading.value = true
  if (savedKey !== routeKey.value) {
    loadedKey.value = savedKey
    await router.replace({ name: 'visual-plan', query: { route: savedKey } })
  }
  await reload()
}

function goBack() {
  router.push({ name: 'routes', params: { tab: 'inbound' } })
}
</script>

<template>
  <div class="h-full">
    <div v-if="loadError && !reloading" class="space-y-6 p-6">
      <NeButton kind="tertiary" size="sm" @click="goBack">
        <template #prefix>
          <FontAwesomeIcon :icon="faArrowLeft" aria-hidden="true" />
        </template>
        {{ t('visual_plan.back_to_routes') }}
      </NeButton>
      <LoadError :error="loadError" :title="t('visual_plan.cannot_load')" @retry="reload()" />
    </div>
    <div
      v-else-if="!fresh || !state.data || (!notFound && loadedKey === undefined)"
      class="flex h-full flex-col"
    >
      <div class="bg-elevation-0 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <NeSkeleton :lines="2" class="max-w-sm" />
      </div>
      <div class="flex min-h-0 flex-1 gap-6 p-6">
        <NeSkeleton :lines="12" class="hidden w-56 lg:block" />
        <NeSkeleton :lines="6" class="flex-1" />
      </div>
    </div>
    <div v-else-if="notFound" class="p-6">
      <NeEmptyState
        :title="t('visual_plan.route_not_found')"
        :description="t('visual_plan.route_not_found_description')"
        :icon="faPhoneVolume"
      >
        <NeButton kind="secondary" @click="goBack">{{
          t('visual_plan.go_to_inbound_routes')
        }}</NeButton>
      </NeEmptyState>
    </div>
    <VisualPlanEditor
      v-else
      :read-only="!isSuperadmin"
      :reloading="reloading"
      @saved="onSaved"
      @reload="reloadData"
    />
  </div>
</template>
