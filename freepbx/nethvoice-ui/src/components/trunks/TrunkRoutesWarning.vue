<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@pinia/colada'
import { NeInlineNotification } from '@nethesis/vue-components'
import { getOutboundRoutes, OUTBOUND_ROUTES_KEY, type OutboundRoute } from '@/lib/routes/outbound'
import { getTrunkRouteUsage } from '@/lib/trunks/trunks'
import { useOutboundRouteLabels } from '@/composables/useOutboundRouteLabels'
import { useLoginStore } from '@/stores/login'
import { describeError } from '@/stores/notifications'

const { isShown = false, trunkIds = [] } = defineProps<{
  isShown: boolean
  trunkIds: number[]
}>()

const { t } = useI18n()
const loginStore = useLoginStore()
const { getRouteTitle } = useOutboundRouteLabels()

const { state: routesState } = useQuery({
  key: () => [OUTBOUND_ROUTES_KEY],
  enabled: () => isShown && loginStore.isAuthenticated,
  query: () => getOutboundRoutes(),
})

const usage = computed(() => getTrunkRouteUsage(routesState.value.data ?? [], trunkIds))

const getRouteNames = (routes: OutboundRoute[]): string => routes.map(getRouteTitle).join(', ')
</script>

<template>
  <NeInlineNotification
    v-if="routesState.status === 'error'"
    kind="warning"
    :title="t('trunks.cannot_check_outbound_routes')"
    :description="describeError(routesState.error)"
  />
  <NeInlineNotification
    v-else-if="usage.orphaned.length > 0 || usage.remaining.length > 0"
    kind="warning"
    :title="
      usage.orphaned.length > 0
        ? t('trunks.routes_left_without_trunks')
        : t('trunks.used_by_outbound_routes')
    "
  >
    <template #description>
      <span class="flex flex-col gap-1">
        <span v-if="usage.orphaned.length > 0">
          {{
            t('trunks.routes_without_trunks_description', {
              routes: getRouteNames(usage.orphaned),
            })
          }}
        </span>
        <span v-if="usage.remaining.length > 0">
          {{
            t('trunks.routes_keep_trunks_description', { routes: getRouteNames(usage.remaining) })
          }}
        </span>
      </span>
    </template>
  </NeInlineNotification>
</template>
