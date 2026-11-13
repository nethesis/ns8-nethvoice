<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as v from 'valibot'
import {
  NeButton,
  NeCheckbox,
  NeInlineNotification,
  NeLink,
  NeTextInput,
} from '@nethesis/vue-components'
import { useLoginStore } from '@/stores/login'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import { LoginSchema } from '@/lib/auth'
import { isApiError } from '@/lib/api/errors'
import type { Focusable } from '@/lib/common'
import { getInternalRedirect } from '@/lib/setup/guard'
import LogoDark from '@/assets/logo_dark.svg'

type LoginError = '' | 'invalid_credentials' | 'generic'

const route = useRoute()
const router = useRouter()
const loginStore = useLoginStore()
const runtimeConfigStore = useRuntimeConfigStore()

const username = ref(loginStore.rememberedUsername())
const password = ref('')
const rememberUsername = ref(loginStore.rememberedUsername() !== '')
const loading = ref(false)
const loginError = ref<LoginError>('')
const validationIssues = ref<Partial<Record<'username' | 'password', string>>>({})
const usernameRef = useTemplateRef<Focusable>('usernameRef')
const passwordRef = useTemplateRef<Focusable>('passwordRef')

const backgroundStyle = computed(() => {
  const backgroundUrl = runtimeConfigStore.config.loginBackgroundUrl
  return backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : {}
})

const customLogoFailed = ref(false)

const customLogoUrl = computed(() =>
  customLogoFailed.value ? '' : runtimeConfigStore.config.loginLogoUrl,
)

const rightPanelLogo = computed(() => customLogoUrl.value || LogoDark)

watch(
  () => runtimeConfigStore.config.loginLogoUrl,
  () => {
    customLogoFailed.value = false
  },
)

function validate(): boolean {
  validationIssues.value = {}
  const result = v.safeParse(LoginSchema, { username: username.value, password: password.value })

  if (result.success) {
    return true
  }

  for (const issue of result.issues) {
    const field = issue.path?.[0].key

    if ((field === 'username' || field === 'password') && !validationIssues.value[field]) {
      validationIssues.value[field] = issue.message
    }
  }

  if (validationIssues.value.username) {
    usernameRef.value?.focus()
  } else {
    passwordRef.value?.focus()
  }
  return false
}

async function signIn() {
  loginError.value = ''

  if (!validate()) {
    return
  }
  loading.value = true

  try {
    await loginStore.login(username.value.trim(), password.value, rememberUsername.value)
  } catch (error) {
    loginError.value = isApiError(error) && error.status === 401 ? 'invalid_credentials' : 'generic'
    loading.value = false
    await nextTick()
    passwordRef.value?.focus()
    return
  }

  try {
    await router.push(getInternalRedirect(route.query.redirect) ?? { name: 'dashboard' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-full">
    <div
      class="elevation-0 flex w-full flex-col items-center justify-center px-6 py-12 lg:w-9/25 lg:min-w-128"
    >
      <form
        class="elevation-1 flex w-full max-w-md flex-col gap-6 rounded-lg p-10 shadow-lg"
        novalidate
        @submit.prevent="signIn"
      >
        <div class="flex flex-col gap-8">
          <div class="flex flex-col gap-2">
            <h1 class="text-primary-neutral text-xl font-medium">{{ $t('login.welcome') }}</h1>
            <p class="text-secondary-neutral">
              {{ $t('login.sign_in_to_brand', { brand: runtimeConfigStore.config.brandName }) }}
            </p>
          </div>
          <NeInlineNotification
            v-if="loginStore.sessionExpired && !loginError"
            kind="warning"
            :title="$t('login.session_expired')"
            :description="$t('login.session_expired_description')"
          />
          <NeInlineNotification
            v-if="loginError"
            kind="error"
            :title="$t(`login.${loginError}`)"
            :description="$t(`login.${loginError}_description`)"
          />
          <NeTextInput
            id="username"
            ref="usernameRef"
            v-model="username"
            :label="$t('login.username')"
            :invalid-message="validationIssues.username ? $t(validationIssues.username) : ''"
            :disabled="loading"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
          />
          <div class="flex flex-col gap-1">
            <NeTextInput
              id="password"
              ref="passwordRef"
              v-model="password"
              is-password
              :label="$t('login.password')"
              :show-password-label="$t('ne_text_input.show_password')"
              :hide-password-label="$t('ne_text_input.hide_password')"
              :invalid-message="validationIssues.password ? $t(validationIssues.password) : ''"
              :disabled="loading"
              autocomplete="current-password"
            />
            <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <NeCheckbox
                id="remember-username"
                v-model="rememberUsername"
                :label="$t('login.remember_username')"
                :disabled="loading"
              />
              <NeLink
                :href="runtimeConfigStore.docsUrl"
                target="_blank"
                rel="noreferrer"
                class="whitespace-nowrap"
              >
                {{ $t('common.need_help') }}
              </NeLink>
            </div>
          </div>
        </div>
        <NeButton kind="primary" size="lg" type="submit" :loading="loading" :disabled="loading">
          {{ $t('login.sign_in') }}
        </NeButton>
      </form>
    </div>
    <div
      class="hidden flex-1 items-center justify-center bg-linear-to-b from-emerald-800 to-gray-950 bg-cover bg-center lg:flex"
      :style="backgroundStyle"
      aria-hidden="true"
    >
      <img
        v-if="!runtimeConfigStore.config.loginBackgroundUrl || customLogoUrl"
        :src="rightPanelLogo"
        alt=""
        :class="['h-9 w-auto max-w-3/5', { 'brightness-0 invert': !customLogoUrl }]"
        @error="customLogoFailed = true"
      />
    </div>
  </div>
</template>
