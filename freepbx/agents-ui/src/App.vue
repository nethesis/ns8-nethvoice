<script setup lang="ts">
import { computed, ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  NeAvatar,
  NeButton,
  NeDropdown,
  NeModal,
  NeSkeleton,
  NeToastNotificationV2,
  type NeDropdownItem,
} from "@nethesis/vue-components";
import {
  faArrowRightFromBracket,
  faLock,
  faMoon,
  faSun,
} from "@fortawesome/free-solid-svg-icons";
import { access, auth, signIn, signOut } from "./api";
import { useUi } from "./stores/ui";
import { DEFAULT_BRANDING, loadWizardBranding } from "./branding";
import { menuIcon } from "./menuIcon";
import NavIcon from "./components/NavIcon.vue";
import AppEmptyState from "./components/AppEmptyState.vue";
import lightLogo from "./assets/logo_light.svg";
const { t, locale } = useI18n();
const route = useRoute();
const ui = useUi();
const mobileMenu = ref(false);
const branding = ref({ ...DEFAULT_BRANDING });
const customLogo = computed(
  () => branding.value.logoUrl !== DEFAULT_BRANDING.logoUrl,
);
const logoSrc = computed(() =>
  customLogo.value || ui.dark ? branding.value.logoUrl : lightLogo,
);
const items = [
  { name: "agents", on: "AISpark", off: "AISparkLight" },
  { name: "activity", on: "ChartLine", off: "ChartLineLight" },
  { name: "trunks", on: "NetworkWired", off: "NetworkWiredLight" },
];
const active = (name: string) => route.path.startsWith("/" + name);
const initials = computed(() => auth.user.slice(0, 1).toUpperCase());
const accountMenu = computed<NeDropdownItem[]>(() => [
  {
    id: "theme",
    label: t(ui.dark ? "lightTheme" : "darkTheme"),
    icon: menuIcon(ui.dark ? faSun : faMoon),
    action: ui.toggleTheme,
  },
  { id: "divider-1" },
  {
    id: "signout",
    label: t("signOut"),
    icon: menuIcon(faArrowRightFromBracket),
    action: signOut,
  },
]);
onMounted(() => {
  document.documentElement.lang = String(locale.value);
  void loadWizardBranding().then((value) => {
    branding.value = value;
  });
  void access().catch(() => {
    auth.ready = true;
  });
});
watch(
  () => route.path,
  () => {
    mobileMenu.value = false;
  },
);
</script>
<template>
  <div class="flex min-h-screen">
    <div
      v-if="mobileMenu"
      class="fixed inset-0 z-40 bg-gray-500/75 lg:hidden dark:bg-gray-700/75"
      aria-hidden="true"
      @click="mobileMenu = false"
    />
    <nav
      id="main-sidebar"
      :aria-label="t('navigation')"
      :class="[
        mobileMenu ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden',
        'bg-elevation-0 border-line h-screen w-75 shrink-0 flex-col gap-5 overflow-y-auto border-r pt-1 lg:sticky lg:top-0 lg:z-auto lg:flex',
      ]"
      @keydown.esc="mobileMenu = false"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex flex-col items-start justify-center px-6 py-2">
          <img
            :src="logoSrc"
            :alt="branding.name"
            :class="[
              'h-6.5 w-auto max-w-50 object-contain object-left',
              customLogo
                ? 'rounded bg-[#171717] px-2 py-1 dark:bg-transparent dark:px-0 dark:py-0'
                : '',
            ]"
            @error="branding.logoUrl = DEFAULT_BRANDING.logoUrl"
          />
          <span class="text-accent text-base leading-6 whitespace-nowrap">{{
            t("agents")
          }}</span>
        </div>
        <NeButton
          kind="tertiary"
          class="mt-2 mr-2 lg:hidden"
          :aria-label="t('closeNavigation')"
          @click="mobileMenu = false"
          ><FontAwesomeIcon icon="xmark" class="size-5" aria-hidden="true"
        /></NeButton>
      </div>
      <ul role="list" class="flex flex-col gap-2 px-2 pb-4">
        <li v-for="item in items" :key="item.name">
          <RouterLink
            :to="'/' + item.name"
            :aria-current="active(item.name) ? 'page' : undefined"
            :class="[
              active(item.name)
                ? 'bg-elevation-2 gap-2 pr-3'
                : 'hover:bg-elevation-2 gap-3 px-3',
              'flex h-12.5 w-full items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
            ]"
            ><span
              v-if="active(item.name)"
              class="bg-accent h-9 w-1 shrink-0 rounded-r-md"
              aria-hidden="true"
            /><span class="flex min-w-0 flex-1 items-center gap-4"
              ><NavIcon
                :name="active(item.name) ? item.on : item.off"
                :class="[
                  'size-6 shrink-0',
                  active(item.name)
                    ? 'text-primary-neutral'
                    : 'text-tertiary-neutral',
                ]"
              /><span
                :class="[
                  'text-base font-medium whitespace-nowrap',
                  active(item.name)
                    ? 'text-primary-neutral'
                    : 'text-tertiary-neutral',
                ]"
                >{{ t(item.name) }}</span
              ></span
            ></RouterLink
          >
        </li>
      </ul>
    </nav>
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="bg-elevation-0 border-line sticky top-0 z-30 flex h-16 min-h-16 items-center gap-6 border-b px-4"
      >
        <button
          type="button"
          class="text-secondary-neutral flex cursor-pointer items-center lg:hidden"
          :aria-label="t('openNavigation')"
          aria-controls="main-sidebar"
          :aria-expanded="mobileMenu ? 'true' : 'false'"
          @click="mobileMenu = true"
        >
          <FontAwesomeIcon icon="bars" class="size-4" aria-hidden="true" />
        </button>
        <span class="bg-line -my-px h-16 w-px lg:hidden" aria-hidden="true" />
        <div class="flex-1" />
        <NeDropdown
          :items="accountMenu"
          align-to-right
          :open-menu-aria-label="t('openAccountMenu')"
        >
          <template #button>
            <NeAvatar size="sm" :initials="initials" :alt="auth.user" />
          </template>
          <template v-if="auth.user" #menuHeader>
            <div class="px-4 pt-1 pb-3">
              <p class="text-primary-neutral font-medium">{{ auth.user }}</p>
            </div>
            <hr class="border-divider mb-1" />
          </template>
        </NeDropdown>
      </header>
      <main class="flex-1 px-4 py-6 sm:px-8">
        <NeSkeleton v-if="!auth.ready" :lines="8" />
        <AppEmptyState
          v-else-if="!auth.authorized"
          :title="t('authenticationRequired')"
          :description="t('authenticationHelp')"
          :icon="faLock"
          ><NeButton kind="primary" size="lg" @click="signIn">{{
            t("signIn")
          }}</NeButton></AppEmptyState
        >
        <RouterView v-else v-slot="{ Component }"
          ><component :is="Component" :key="$route.path"
        /></RouterView>
      </main>
    </div>
    <div
      class="pointer-events-none fixed top-20 right-4 z-[120] w-[calc(100vw-2rem)] max-w-sm space-y-3 sm:right-6"
      aria-live="polite"
    >
      <NeToastNotificationV2
        v-for="notice in ui.notices"
        :key="notice.id"
        :notification="notice"
        :sr-close-label="t('close')"
        show-close-button
        class="pointer-events-auto [overflow-wrap:anywhere]"
        @close="ui.notices = ui.notices.filter((n) => n.id !== notice.id)"
      />
    </div>
  </div>
  <NeModal
    :visible="ui.leaveDialog"
    kind="warning"
    :title="t('unsavedTitle')"
    :primary-label="t('leave')"
    primary-button-kind="danger"
    :cancel-label="t('cancel')"
    :close-aria-label="t('close')"
    @primary-click="ui.resolveLeave(true)"
    @close="ui.resolveLeave(false)"
    ><p>{{ t("unsavedHelp") }}</p></NeModal
  >
</template>
