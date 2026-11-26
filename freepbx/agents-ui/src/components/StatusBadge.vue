<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faCircleArrowRight,
  faCircleCheck,
  faCircleXmark,
  faCirclePlay,
  faCircleQuestion,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
const props = defineProps<{
  status: string;
  version?: number;
  label?: string;
}>();
const { t, te } = useI18n();
const success = {
  icon: faCircleCheck,
  color: "text-green-700 dark:text-green-500",
};
const warning = {
  icon: faTriangleExclamation,
  color: "text-amber-700 dark:text-amber-500",
};
const danger = {
  icon: faCircleXmark,
  color: "text-rose-700 dark:text-rose-500",
};
const info = { icon: faCirclePlay, color: "text-blue-700 dark:text-blue-500" };
const neutral = {
  icon: faCircleXmark,
  color: "text-gray-700 dark:text-gray-400",
};
const appearances: Record<string, { icon: IconDefinition; color: string }> = {
  ready: success,
  completed: success,
  ended_by_agent: success,
  indexed: success,
  published: success,
  synced: success,
  enabled: success,
  transferred: {
    icon: faCircleArrowRight,
    color: "text-blue-700 dark:text-blue-500",
  },
  modified: warning,
  pending_sync: warning,
  pending: warning,
  needs_verification: warning,
  interrupted: warning,
  unconfigured: warning,
  fallback: {
    icon: faTriangleExclamation,
    color: "text-amber-700 dark:text-amber-500",
  },
  failed: danger,
  invalid: danger,
  refresh_failed: danger,
  error: danger,
  denied: danger,
  active: info,
  running: info,
  processing: info,
  queued: info,
  accepted: info,
  draft: neutral,
  disabled: neutral,
  cancelled: neutral,
  revoked: neutral,
};
const appearance = computed(
  () =>
    appearances[props.status] || {
      icon: faCircleQuestion,
      color: "text-gray-700 dark:text-gray-400",
    },
);
</script>
<template>
  <span class="inline-flex items-center gap-2 whitespace-nowrap"
    ><FontAwesomeIcon
      :icon="appearance.icon"
      :class="['size-4 shrink-0', appearance.color]"
      aria-hidden="true"
    />{{ label ?? (te("status." + status) ? t("status." + status) : status)
    }}<span v-if="version"> · v{{ version }}</span></span
  >
</template>
