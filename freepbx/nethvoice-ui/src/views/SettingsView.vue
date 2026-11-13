<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NeButton, NeHeading } from '@nethesis/vue-components'
import { faArrowUpRightFromSquare, faKey } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import ChangeAdminPasswordDrawer from '@/components/settings/ChangeAdminPasswordDrawer.vue'
import PbxLanguageSection from '@/components/settings/PbxLanguageSection.vue'
import { FREEPBX_ADMIN_URL } from '@/lib/config'
import { ADMIN_USERNAME } from '@/lib/settings/adminPassword'
import { useLoginStore } from '@/stores/login'

const loginStore = useLoginStore()
const isPasswordDrawerShown = ref(false)

const isAdmin = computed(() => loginStore.username.toLowerCase() === ADMIN_USERNAME)

function openAdvancedSettings() {
  window.open(FREEPBX_ADMIN_URL, '_blank', 'noopener')
}
</script>

<template>
  <div>
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <NeHeading tag="h3">{{ $t('settings.title') }}</NeHeading>
      <NeButton kind="secondary" size="lg" @click="openAdvancedSettings">
        <template #prefix>
          <FontAwesomeIcon :icon="faArrowUpRightFromSquare" class="size-4" aria-hidden="true" />
        </template>
        {{ $t('settings.advanced_settings') }}
      </NeButton>
    </div>
    <div class="flex max-w-186 flex-col gap-8">
      <section
        aria-labelledby="pbx-language-heading"
        class="flex flex-col gap-6 border-b border-gray-200 pb-8 lg:flex-row dark:border-gray-700"
      >
        <h4
          id="pbx-language-heading"
          class="text-primary-neutral w-75 shrink-0 text-base font-medium"
        >
          {{ $t('settings.pbx_language') }}
        </h4>
        <PbxLanguageSection />
      </section>
      <section
        v-if="isAdmin"
        aria-labelledby="admin-password-heading"
        class="flex flex-col gap-6 pb-8 lg:flex-row"
      >
        <h4
          id="admin-password-heading"
          class="text-primary-neutral w-75 shrink-0 text-base font-medium"
        >
          {{ $t('settings.admin_password') }}
        </h4>
        <div>
          <NeButton kind="secondary" size="lg" @click="isPasswordDrawerShown = true">
            <template #prefix>
              <FontAwesomeIcon :icon="faKey" class="size-4" aria-hidden="true" />
            </template>
            {{ $t('settings.change_admin_password') }}
          </NeButton>
        </div>
      </section>
    </div>
    <ChangeAdminPasswordDrawer
      v-if="isAdmin"
      :is-shown="isPasswordDrawerShown"
      @close="isPasswordDrawerShown = false"
    />
  </div>
</template>
