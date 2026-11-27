<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faArrowRightToBracket } from '@fortawesome/free-solid-svg-icons'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import * as v from 'valibot'
import {
  NeButton,
  NeCheckbox,
  NeInlineNotification,
  NeLink,
  NeTextInput,
  focusElement,
} from '@nethesis/vue-components'
import { useLoginStore } from '@/stores/login'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import { useSignInSplashStore } from '@/stores/signInSplash'
import { useThemeStore } from '@/stores/theme'
import { LoginSchema, SignInError, type SignInFailure } from '@/lib/auth'
import type { Focusable } from '@/lib/common'
import { getInternalRedirect } from '@/lib/setup/guard'
import BrandLogo from '@/components/shell/BrandLogo.vue'
import LoginBackgroundLight from '@/assets/login/nethvoice-login-bg-light.svg?no-inline'
import LoginBackgroundDark from '@/assets/login/nethvoice-login-bg-dark.svg?no-inline'

type LoginError = '' | SignInFailure

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const loginStore = useLoginStore()
const runtimeConfigStore = useRuntimeConfigStore()
const splashStore = useSignInSplashStore()
const themeStore = useThemeStore()

const username = ref(loginStore.rememberedUsername())
const password = ref('')
const rememberUsername = ref(loginStore.rememberedUsername() !== '')
const loading = ref(false)
const loginError = ref<LoginError>('')
const retryAfter = ref<number | null>(null)
const validationIssues = ref<Partial<Record<'username' | 'password', string>>>({})
const usernameRef = useTemplateRef<Focusable>('usernameRef')
const passwordRef = useTemplateRef<Focusable>('passwordRef')

const customBackgroundFailed = ref(false)

const backgroundUrl = computed(() => {
  if (!runtimeConfigStore.loaded) {
    return ''
  }
  const customUrl = runtimeConfigStore.config.loginBackgroundUrl

  if (customUrl && !customBackgroundFailed.value) {
    return customUrl
  }
  return themeStore.isLight ? LoginBackgroundLight : LoginBackgroundDark
})

const loginErrorDescription = computed(() => {
  if (loginError.value === 'too_many_attempts' && retryAfter.value !== null) {
    const minutes = Math.max(1, Math.ceil(retryAfter.value / 60))
    return t('login.too_many_attempts_retry', minutes)
  }
  return t(`login.${loginError.value}_description`)
})

watch(
  () => runtimeConfigStore.config.loginBackgroundUrl,
  () => {
    customBackgroundFailed.value = false
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
    focusElement(usernameRef)
  } else {
    focusElement(passwordRef)
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
    loginError.value = error instanceof SignInError ? error.failure : 'generic'
    retryAfter.value = error instanceof SignInError ? error.retryAfter : null
    loading.value = false
    await nextTick()
    focusElement(passwordRef)
    return
  }

  try {
    await splashStore.navigateAfterSignIn(() =>
      router.push(getInternalRedirect(route.query.redirect) ?? { name: 'dashboard' }),
    )
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative isolate flex min-h-full items-center justify-center px-4 py-10">
    <img
      v-if="backgroundUrl"
      :src="backgroundUrl"
      alt=""
      class="fixed inset-0 -z-10 size-full object-cover object-center"
      data-testid="login-background"
      @error="customBackgroundFailed = true"
    />
    <div
      class="elevation-1 flex w-full max-w-125 flex-col gap-6 rounded-xl px-6 py-14 shadow-lg sm:px-10"
      data-testid="login-card"
    >
      <div class="flex flex-col items-center gap-5">
        <BrandLogo variant="login" class="h-10 w-auto max-w-full object-contain" />
        <h1 class="text-primary-active text-center text-2xl">{{ $t('login.product_label') }}</h1>
      </div>
      <form class="flex flex-col gap-6" novalidate @submit.prevent="signIn">
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
          :description="loginErrorDescription"
        />
        <div class="flex flex-col gap-8">
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
          <div class="flex flex-col gap-3">
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
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <NeCheckbox id="remember-username" v-model="rememberUsername" :disabled="loading">
                <span class="font-normal">{{ $t('login.remember_username') }}</span>
              </NeCheckbox>
              <NeLink
                v-if="runtimeConfigStore.showDocs"
                :href="runtimeConfigStore.docsUrl"
                target="_blank"
                rel="noreferrer"
                class="ml-auto whitespace-nowrap"
              >
                {{ $t('common.need_help') }}
              </NeLink>
            </div>
          </div>
        </div>
        <NeButton
          kind="primary"
          size="lg"
          type="submit"
          class="w-full"
          :loading="loading"
          :disabled="loading"
        >
          <template #prefix>
            <FontAwesomeIcon :icon="faArrowRightToBracket" class="size-4" aria-hidden="true" />
          </template>
          {{ $t('login.sign_in') }}
        </NeButton>
      </form>
    </div>
  </div>
</template>
