<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import { useSignInSplashStore } from '@/stores/signInSplash'

const MARK_PATH =
  'M23.6849 20.9578C22.1837 20.959 20.6972 20.6626 19.3113 20.0858C17.9254 19.5091 16.6675 18.6633 15.6104 17.5974C13.9421 15.936 11.6835 15.0032 9.32894 15.0032C6.97443 15.0032 4.71581 15.936 3.04747 17.5974L2.83087 17.814L0 14.9802L0.213591 14.7636C2.63345 12.3504 5.91147 10.9952 9.32894 10.9952C12.7464 10.9952 16.0244 12.3504 18.4443 14.7636C19.1334 15.4545 19.9521 16.0027 20.8534 16.3767C21.7548 16.7508 22.721 16.9433 23.6969 16.9433C24.6728 16.9433 25.639 16.7508 26.5404 16.3767C27.4417 16.0027 28.2604 15.4545 28.9495 14.7636L29.1631 14.547L32 17.3778L31.7834 17.5944C30.7238 18.6638 29.4622 19.5119 28.0719 20.0893C26.6815 20.6667 25.1903 20.9619 23.6849 20.9578Z'

const runtimeConfigStore = useRuntimeConfigStore()
const splashStore = useSignInSplashStore()
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150 ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-200 ease-out"
    leave-to-class="opacity-0"
  >
    <div
      v-if="splashStore.visible"
      class="bg-elevation-1 fixed inset-0 z-50 flex items-center justify-center"
      aria-busy="true"
      data-testid="sign-in-splash"
    >
      <svg
        viewBox="-0.5 10.5 33 11"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        :aria-label="$t('shell.brand_logo', { brand: runtimeConfigStore.config.brandName })"
        class="text-primary-active h-12 w-36"
      >
        <path
          :d="MARK_PATH"
          pathLength="1"
          class="sign-in-splash-mark"
          fill="currentColor"
          stroke="currentColor"
          stroke-width="0.5"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  </Transition>
</template>

<style scoped>
.sign-in-splash-mark {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  fill-opacity: 0;
  animation:
    sign-in-splash-trace 700ms cubic-bezier(0.65, 0, 0.35, 1) forwards,
    sign-in-splash-fill 400ms ease-out 500ms forwards;
}

@keyframes sign-in-splash-trace {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes sign-in-splash-fill {
  to {
    fill-opacity: 1;
    stroke-opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sign-in-splash-mark {
    animation: none;
    fill-opacity: 1;
    stroke-opacity: 0;
  }
}
</style>
