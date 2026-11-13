<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import DeleteObjectModal from '@/components/common/DeleteObjectModal.vue'
import { useInboundRouteLabels } from '@/composables/useInboundRouteLabels'
import { deleteInboundRoute, INBOUND_ROUTES_KEY, type InboundRoute } from '@/lib/routes/inbound'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { visible = false, route = undefined } = defineProps<{
  visible: boolean
  route: InboundRoute | undefined
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { getRouteName } = useInboundRouteLabels()

const {
  mutate: deleteRouteMutate,
  isLoading: deleteRouteLoading,
  reset: deleteRouteReset,
  error: deleteRouteError,
} = useMutation({
  mutation: (routeToDelete: InboundRoute) => deleteInboundRoute(routeToDelete),
  onSuccess(result, routeToDelete) {
    const name = getRouteName(routeToDelete)

    setTimeout(() => {
      notificationsStore.createNotification(
        result === 'not_found'
          ? {
              kind: 'warning',
              title: t('routes.route_already_deleted'),
              description: t('routes.route_already_deleted_description', { name }),
            }
          : {
              kind: 'success',
              title: t('routes.route_deleted'),
              description: t('routes.route_deleted_description', { name }),
            },
      )
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [INBOUND_ROUTES_KEY] })
  },
})

watch(
  () => visible,
  () => {
    if (visible) {
      deleteRouteReset()
    }
  },
)

function deleteRoute() {
  if (route) {
    deleteRouteMutate(route)
  }
}
</script>

<template>
  <DeleteObjectModal
    :visible="visible"
    :title="t('routes.delete_route')"
    :primary-label="t('common.delete')"
    :deleting="deleteRouteLoading"
    :confirmation-message="
      t('routes.delete_route_confirmation', { name: route ? getRouteName(route) : '' })
    "
    :error-title="deleteRouteError ? t('routes.cannot_delete_route') : ''"
    :error-description="describeError(deleteRouteError)"
    @close="emit('close')"
    @primary-click="deleteRoute"
  />
</template>
