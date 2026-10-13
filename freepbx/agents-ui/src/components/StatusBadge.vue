<script setup lang="ts">
import { computed } from "vue";
import { NeBadgeV2 } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
const props = defineProps<{ status: string; version?: number }>();
const { t, te } = useI18n();
const kind = computed(() =>
  ["ready", "completed", "indexed"].includes(props.status)
    ? "green"
    : ["failed", "invalid", "refresh_failed"].includes(props.status)
      ? "rose"
      : ["pending_sync", "unknown", "needs_verification", "fallback"].includes(
            props.status,
          )
        ? "amber"
        : ["active", "running", "processing"].includes(props.status)
          ? "blue"
          : "gray",
);
</script>
<template>
  <NeBadgeV2 :kind="kind"
    >{{ te("status." + status) ? t("status." + status) : status
    }}<span v-if="version"> · v{{ version }}</span></NeBadgeV2
  >
</template>
