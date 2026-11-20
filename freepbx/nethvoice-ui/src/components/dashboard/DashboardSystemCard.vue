<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
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
import { formatLoadAndMemory, splitUptime, type DashboardSystemInfo } from '@/lib/dashboard/system'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'

const {
  subscription = undefined,
  loading = false,
  system = undefined,
  systemLoading = false,
} = defineProps<{
  subscription?: DashboardSubscription
  loading?: boolean
  system?: DashboardSystemInfo
  systemLoading?: boolean
}>()

const { t, locale } = useI18n()
const runtimeConfigStore = useRuntimeConfigStore()

const release = computed(() =>
  system?.release ? `${runtimeConfigStore.config.brandName} ${system.release}` : '',
)

const uptime = computed(() => {
  if (!system) {
    return ''
  }
  const integer = new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 })
  return splitUptime(system.uptimeSeconds)
    .map(({ unit, value }) =>
      t(`dashboard.system.uptime_${unit}`, { count: integer.format(value) }, value),
    )
    .join(' ')
})

const loadAndMemory = computed(() => (system ? formatLoadAndMemory(system, locale.value) : ''))

const skeletonLines = computed(() => (systemLoading ? 3 : 0) + (loading ? 2 : 0))

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
  <NeCard data-testid="system-card" :aria-label="$t('dashboard.system.title')" role="region">
    <div class="flex flex-col gap-6">
      <div class="flex items-center gap-2.5">
        <NeRoundedIcon
          :custom-icon="faServer"
          custom-background-classes="bg-emerald-100 dark:bg-emerald-700"
          custom-foreground-classes="text-emerald-700 dark:text-emerald-50"
        />
        <span class="text-primary-neutral text-sm">{{ runtimeConfigStore.config.brandName }}</span>
      </div>
      <dl>
        <div
          class="flex items-center justify-between gap-4 border-b border-gray-200 py-3 last:border-b-0 dark:border-gray-700"
        >
          <dt class="text-tertiary-neutral shrink-0 font-medium">
            {{ $t('dashboard.system.hostname') }}
          </dt>
          <dd
            class="text-primary-neutral min-w-0 text-right break-words"
            data-testid="system-hostname"
          >
            <template v-for="(part, index) in hostnameParts" :key="index"
              ><wbr v-if="index > 0" />{{ part }}</template
            >
          </dd>
        </div>
        <template v-if="!systemLoading && system">
          <div
            v-if="release"
            class="flex items-center justify-between gap-4 border-b border-gray-200 py-3 last:border-b-0 dark:border-gray-700"
          >
            <dt class="text-tertiary-neutral shrink-0 font-medium">
              {{ $t('dashboard.system.release') }}
            </dt>
            <dd
              class="text-primary-neutral min-w-0 text-right break-words"
              data-testid="system-release"
            >
              {{ release }}
            </dd>
          </div>
          <div
            class="flex items-center justify-between gap-4 border-b border-gray-200 py-3 last:border-b-0 dark:border-gray-700"
          >
            <dt class="text-tertiary-neutral shrink-0 font-medium">
              {{ $t('dashboard.system.uptime') }}
            </dt>
            <dd
              class="text-primary-neutral min-w-0 text-right break-words"
              data-testid="system-uptime"
            >
              {{ uptime }}
            </dd>
          </div>
          <div
            class="flex items-center justify-between gap-4 border-b border-gray-200 py-3 last:border-b-0 dark:border-gray-700"
          >
            <dt class="text-tertiary-neutral shrink-0 font-medium">
              {{ $t('dashboard.system.load_memory') }}
            </dt>
            <dd
              class="text-primary-neutral min-w-0 text-right tabular-nums"
              data-testid="system-load-memory"
            >
              {{ loadAndMemory }}
            </dd>
          </div>
        </template>
        <template v-if="!loading && subscription">
          <div
            class="flex items-center justify-between gap-4 border-b border-gray-200 py-3 last:border-b-0 dark:border-gray-700"
          >
            <dt class="text-tertiary-neutral font-medium">
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
          <div v-if="subscription.extensionsLimit !== null" class="flex flex-col gap-2 py-3">
            <div class="flex items-center justify-between gap-4">
              <dt class="text-tertiary-neutral font-medium">
                {{ $t('dashboard.system.extensions') }}
              </dt>
              <dd class="text-primary-neutral tabular-nums" data-testid="extensions-usage">
                {{ subscription.configuredExtensions }}/{{ subscription.extensionsLimit }}
              </dd>
            </div>
            <NeProgressBar
              :progress="usagePercent"
              size="sm"
              color="custom"
              :custom-color-classes="
                limitReached
                  ? 'bg-accent-amber'
                  : 'from-accent-green to-accent-indigo bg-linear-to-r'
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
      <NeSkeleton v-if="skeletonLines" :lines="skeletonLines" class="w-full" />
    </div>
  </NeCard>
</template>
