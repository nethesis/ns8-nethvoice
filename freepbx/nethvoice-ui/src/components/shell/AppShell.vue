<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import { Dialog, DialogPanel, TransitionChild, TransitionRoot } from '@headlessui/vue'
import { NeTooltip } from '@nethesis/vue-components'
import SideMenu from './SideMenu.vue'
import BrandLogo from './BrandLogo.vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import TopBar from './TopBar.vue'
import NotificationDrawer from './NotificationDrawer.vue'
import PhoneIslandHost from '@/components/phone/PhoneIslandHost.vue'

const route = useRoute()
const sidebarOpen = ref(false)
const topBarRef = useTemplateRef<InstanceType<typeof TopBar>>('topBarRef')
let focusMenuButtonAfterClose = false

function closeSidebar() {
  focusMenuButtonAfterClose = true
  sidebarOpen.value = false
}

async function returnFocusAfterClose() {
  if (focusMenuButtonAfterClose) {
    focusMenuButtonAfterClose = false
    await nextTick()
    topBarRef.value?.focusOpenSidebar()
  }
}

watch(
  () => route.fullPath,
  () => {
    sidebarOpen.value = false
  },
)
</script>

<template>
  <div>
    <TransitionRoot as="template" :show="sidebarOpen" @after-leave="returnFocusAfterClose">
      <Dialog as="div" class="relative z-50 lg:hidden" @close="closeSidebar">
        <TransitionChild
          as="template"
          enter="transition-opacity ease-linear duration-(--duration-large-enter)"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="transition-opacity ease-linear duration-(--duration-large-leave)"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-900/80 dark:bg-gray-900/80" />
        </TransitionChild>

        <div class="fixed inset-0 flex">
          <TransitionChild
            as="template"
            enter="transition ease-in-out transform duration-(--duration-large-enter)"
            enter-from="-translate-x-full"
            enter-to="translate-x-0"
            leave="transition ease-in-out transform duration-(--duration-large-leave)"
            leave-from="translate-x-0"
            leave-to="-translate-x-full"
          >
            <DialogPanel class="relative mr-16 flex w-full max-w-xs flex-1">
              <TransitionChild
                as="template"
                enter="ease-in-out duration-(--duration-large-enter)"
                enter-from="opacity-0"
                enter-to="opacity-100"
                leave="ease-in-out duration-(--duration-large-leave)"
                leave-from="opacity-100"
                leave-to="opacity-0"
              >
                <div class="absolute top-0 left-full flex w-16 justify-center pt-5">
                  <NeTooltip trigger-event="mouseenter click" placement="bottom" class="flex">
                    <template #trigger>
                      <button type="button" class="-m-2.5 p-2.5" @click="closeSidebar">
                        <span class="sr-only">{{ $t('shell.close_sidebar') }}</span>
                        <FontAwesomeIcon
                          :icon="faXmark"
                          class="h-6 w-6 text-white"
                          aria-hidden="true"
                        />
                      </button>
                    </template>
                    <template #content>{{ $t('shell.close_sidebar') }}</template>
                  </NeTooltip>
                </div>
              </TransitionChild>
              <div
                class="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-2 pt-1 pb-4 dark:bg-gray-950"
              >
                <div class="flex h-12.5 shrink-0 items-center px-4">
                  <BrandLogo class="h-5.5 w-auto" />
                </div>
                <nav class="flex flex-1 flex-col">
                  <ul role="list" class="flex flex-1 flex-col gap-y-7">
                    <li>
                      <ul role="list" class="space-y-2">
                        <SideMenu />
                      </ul>
                    </li>
                  </ul>
                </nav>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </TransitionRoot>

    <div class="hidden lg:fixed lg:z-50 lg:flex lg:h-screen lg:w-75 lg:flex-col">
      <div
        class="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-2 pt-1 pb-4 dark:border-gray-700 dark:bg-gray-950"
      >
        <div class="flex h-12.5 shrink-0 items-center px-4">
          <BrandLogo class="h-5.5 w-auto" />
        </div>
        <nav class="flex flex-1 flex-col">
          <ul role="list" class="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" class="space-y-2">
                <SideMenu />
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <div class="lg:pl-75">
      <TopBar ref="topBarRef" @open-sidebar="sidebarOpen = true" />
      <main class="py-6">
        <div class="px-4 sm:px-6 lg:px-8">
          <RouterView />
        </div>
      </main>
    </div>
    <NotificationDrawer :close-on-click-outside="true" />
    <PhoneIslandHost />
  </div>
</template>
