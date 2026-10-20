<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  NeButton,
  NeModal,
  NeEmptyState,
  NeSkeleton,
  NeToastNotificationV2,
} from "@nethesis/vue-components";
import { access, auth, signIn } from "./api";
import { useUi } from "./stores/ui";
const { t, locale } = useI18n();
const route = useRoute();
const ui = useUi();
const mobileMenu = ref(false);
const items = [
  { name: "trunks", icon: "gear" },
  { name: "agents", icon: "comments" },
  { name: "activity", icon: "clock" },
];
onMounted(() => {
  document.documentElement.lang = String(locale.value);
  void access().catch(() => {
    auth.ready = true;
  });
});
watch(locale, (value) => {
  localStorage.setItem("nethvoice.agents.language", String(value));
  document.documentElement.lang = String(value);
});
</script>
<template>
  <div class="min-h-screen">
    <header
      class="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-700 dark:bg-gray-950"
    >
      <div class="flex items-center gap-4">
        <NeButton
          class="lg:hidden"
          :aria-label="t('navigation')"
          @click="mobileMenu = !mobileMenu"
          ><FontAwesomeIcon icon="bars" /></NeButton
        ><a href="#/agents" class="text-2xl font-semibold tracking-tight"
          ><span class="text-primary-700 dark:text-primary-400">neth</span
          >voice</a
        >
      </div>
      <div class="flex items-center gap-4">
        <select
          v-model="locale"
          class="rounded border-gray-300 bg-transparent text-sm dark:border-gray-700"
          aria-label="Language"
        >
          <option value="en">EN</option>
          <option value="it">IT</option></select
        ><span class="nv-muted">{{ auth.user }}</span
        ><NeButton
          kind="tertiary"
          :aria-label="ui.dark ? 'Light mode' : 'Dark mode'"
          @click="ui.toggleTheme"
          ><FontAwesomeIcon :icon="ui.dark ? 'sun' : 'moon'"
        /></NeButton>
      </div>
    </header>
    <aside
      :class="[
        mobileMenu ? 'block' : 'hidden',
        'fixed bottom-0 left-0 top-16 z-20 w-60 border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 lg:block',
      ]"
    >
      <p class="nv-muted mb-2 mt-6 px-3 text-xs tracking-wide">
        {{ t("voiceAgents") }}
      </p>
      <RouterLink
        v-for="item in items"
        :key="item.name"
        :to="'/' + item.name"
        class="mb-1 flex items-center gap-3 rounded-md px-3 py-3 hover:bg-gray-100 dark:hover:bg-gray-800"
        :class="{
          'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400':
            route.path.startsWith('/' + item.name),
        }"
        @click="mobileMenu = false"
        ><FontAwesomeIcon :icon="item.icon" class="w-4" />{{
          t(item.name)
        }}</RouterLink
      >
      <p class="nv-muted absolute bottom-6 px-3 text-xs">
        {{ t("installer") }}
      </p>
    </aside>
    <main class="min-h-screen px-5 pb-12 pt-24 lg:ml-60 lg:px-8">
      <NeSkeleton v-if="!auth.ready" class="h-64 w-full" />
      <NeEmptyState
        v-else-if="!auth.authorized"
        :title="t('authenticationRequired')"
        :description="t('authenticationHelp')"
        ><NeButton kind="primary" @click="signIn">{{
          t("signIn")
        }}</NeButton></NeEmptyState
      >
      <RouterView v-else v-slot="{ Component }"
        ><component :is="Component" :key="$route.path"
      /></RouterView>
    </main>
    <div
      class="pointer-events-none fixed bottom-4 right-4 z-50 w-[28rem] max-w-[calc(100vw-2rem)] space-y-3 sm:bottom-6 sm:right-6"
    >
      <NeToastNotificationV2
        v-for="notice in ui.notices"
        :key="notice.id"
        :notification="notice"
        :sr-close-label="t('close')"
        full-width
        class="[overflow-wrap:anywhere]"
        @close="ui.notices = ui.notices.filter((n) => n.id !== notice.id)"
      />
    </div>
  </div>
  <NeModal
    :visible="ui.leaveDialog"
    :title="t('unsavedTitle')"
    :primary-label="t('leave')"
    :cancel-label="t('cancel')"
    :close-aria-label="t('close')"
    @primary-click="ui.resolveLeave(true)"
    @close="ui.resolveLeave(false)"
    ><p>{{ t("unsavedHelp") }}</p></NeModal
  >
</template>
