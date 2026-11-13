<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import {
  NeBadgeV2,
  NeCard,
  NeProgressBar,
  NeRoundedIcon,
  NeSkeleton,
} from '@nethesis/vue-components'
import {
  faAward,
  faServer,
  faTriangleExclamation,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  getExtensionsUsagePercent,
  isExtensionsLimitReached,
  type DashboardSubscription,
} from '@/lib/dashboard/subscription'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'

const { subscription = undefined, loading = false } = defineProps<{
  subscription?: DashboardSubscription
  loading?: boolean
}>()

const runtimeConfigStore = useRuntimeConfigStore()

const usagePercent = computed(() => (subscription ? getExtensionsUsagePercent(subscription) : 0))

const limitReached = computed(() => (subscription ? isExtensionsLimitReached(subscription) : false))

const hostnameParts = computed(() =>
  runtimeConfigStore.hostname
    .split('.')
    .map((part, index, parts) => (index < parts.length - 1 ? `${part}.` : part)),
)

const usageValue = computed(() =>
  subscription ? Math.min(subscription.configuredExtensions, subscription.extensionsLimit ?? 0) : 0,
)
</script>

<template>
  <NeCard data-testid="system-card">
    <template #title>
      <span class="text-secondary-neutral text-sm font-normal">
        {{ $t('dashboard.system.title') }}
      </span>
    </template>
    <div class="flex flex-col gap-6">
      <div class="flex items-center gap-2.5">
        <NeRoundedIcon
          :custom-icon="faServer"
          custom-background-classes="bg-emerald-100 dark:bg-emerald-700"
          custom-foreground-classes="text-emerald-700 dark:text-emerald-50"
        />
        <span class="text-primary-neutral">{{ runtimeConfigStore.config.brandName }}</span>
      </div>
      <dl>
        <div
          class="flex items-center justify-between gap-4 border-b border-gray-200 py-3 last:border-b-0 dark:border-gray-700"
        >
          <dt class="text-primary-neutral shrink-0 font-medium">
            {{ $t('dashboard.system.hostname') }}
          </dt>
          <dd
            class="text-tertiary-neutral min-w-0 text-right break-words"
            data-testid="system-hostname"
          >
            <template v-for="(part, index) in hostnameParts" :key="index"
              ><wbr v-if="index > 0" />{{ part }}</template
            >
          </dd>
        </div>
        <template v-if="!loading && subscription">
          <div
            class="flex items-center justify-between gap-4 border-b border-gray-200 py-3 last:border-b-0 dark:border-gray-700"
          >
            <dt class="text-primary-neutral font-medium">
              {{ $t('dashboard.system.subscription') }}
            </dt>
            <dd data-testid="subscription-plan">
              <NeBadgeV2 kind="blue" size="xs">
                <FontAwesomeIcon
                  :icon="subscription.plan === 'enterprise' ? faAward : faUsers"
                  class="size-3.5"
                  aria-hidden="true"
                />
                {{ $t(`dashboard.system.${subscription.plan}`) }}
              </NeBadgeV2>
            </dd>
          </div>
          <div class="flex flex-col gap-2 py-3">
            <div class="flex items-center justify-between gap-4">
              <dt class="text-primary-neutral font-medium">
                {{ $t('dashboard.system.extensions') }}
              </dt>
              <dd class="text-tertiary-neutral tabular-nums" data-testid="extensions-usage">
                <template v-if="subscription.extensionsLimit !== null">
                  {{ subscription.configuredExtensions }}/{{ subscription.extensionsLimit }}
                </template>
                <template v-else>{{ subscription.configuredExtensions }}</template>
              </dd>
            </div>
            <NeProgressBar
              v-if="subscription.extensionsLimit !== null"
              :progress="usagePercent"
              size="sm"
              color="custom"
              :custom-color-classes="
                limitReached
                  ? 'bg-amber-500 dark:bg-amber-400'
                  : 'bg-linear-to-r from-emerald-500 to-indigo-500'
              "
              role="progressbar"
              :aria-valuenow="usageValue"
              aria-valuemin="0"
              :aria-valuemax="subscription.extensionsLimit"
              :aria-valuetext="
                $t('dashboard.system.extensions_usage', {
                  configured: subscription.configuredExtensions,
                  limit: subscription.extensionsLimit,
                })
              "
              :aria-label="
                $t('dashboard.system.extensions_usage', {
                  configured: subscription.configuredExtensions,
                  limit: subscription.extensionsLimit,
                })
              "
            />
            <p
              v-if="limitReached"
              class="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-500"
              data-testid="extensions-limit-reached"
            >
              <FontAwesomeIcon :icon="faTriangleExclamation" class="size-4" aria-hidden="true" />
              {{ $t('dashboard.system.limit_reached') }}
            </p>
          </div>
        </template>
      </dl>
      <NeSkeleton v-if="loading" :lines="2" class="w-full" />
    </div>
  </NeCard>
</template>
