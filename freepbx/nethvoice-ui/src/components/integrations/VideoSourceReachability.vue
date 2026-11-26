<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeInlineNotification, NeSpinner } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import { replaceUrlHost } from '@/lib/integrations/videoSources'
import { useReachability, useVideoGateway } from '@/queries/integrations/videoSources'

const {
  url,
  doorPhone = '',
  active = true,
  disabled = false,
} = defineProps<{
  url: string
  doorPhone?: string
  active?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ useUrl: [url: string] }>()

const { t } = useI18n()
const { state: gatewayState } = useVideoGateway()
const { state, asyncStatus, isActive } = useReachability(
  () => url,
  () => doorPhone,
  () => active,
)

const result = computed(() => (isActive.value ? state.value.data : undefined))
const checking = computed(
  () => isActive.value && asyncStatus.value === 'loading' && state.value.data === undefined,
)
const publicIp = computed(() => gatewayState.value.data?.publicIp ?? '')

const forwardText = computed(() =>
  publicIp.value
    ? t('integrations.video.forward_port_with_ip', {
        port: result.value?.port ?? '',
        ip: publicIp.value,
      })
    : t('integrations.video.forward_port', { port: result.value?.port ?? '' }),
)

const publicUrl = computed(() =>
  result.value?.publicAddress ? replaceUrlHost(url, result.value.publicAddress) : '',
)
</script>

<template>
  <p v-if="checking" role="status" class="flex items-center gap-2 text-sm">
    <NeSpinner color="gray" size="4" />
    {{ t('integrations.video.checking_address') }}
  </p>
  <p v-else-if="result?.reachable" role="status" class="flex items-center gap-2 text-sm">
    <FontAwesomeIcon :icon="faCircleCheck" class="text-icon-enabled size-4" aria-hidden="true" />
    {{ t('integrations.video.address_reachable') }}
  </p>
  <div v-else-if="result" role="status">
    <NeInlineNotification
      v-if="publicUrl"
      kind="warning"
      :title="t('integrations.video.address_unreachable')"
      :description="
        t('integrations.video.public_address_reachable', { address: result.publicAddress })
      "
      :primary-button-label="t('integrations.video.use_public_address')"
      @primary-click="!disabled && emit('useUrl', publicUrl)"
    />
    <NeInlineNotification
      v-else
      kind="warning"
      :title="t('integrations.video.address_unreachable')"
      :description="
        result.private ? `${t('integrations.video.private_address')} ${forwardText}` : forwardText
      "
    />
  </div>
</template>
