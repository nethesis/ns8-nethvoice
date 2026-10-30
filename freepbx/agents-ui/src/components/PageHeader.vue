<script setup lang="ts">
import { NeButton, NeHeading } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
defineProps<{ title: string; description?: string; back?: string }>();
const { t } = useI18n();
const router = useRouter();
</script>
<template>
  <NeButton
    v-if="back"
    kind="tertiary"
    class="mb-3 -ml-2.5"
    @click="router.push(back)"
    ><template #prefix
      ><FontAwesomeIcon icon="arrow-left" aria-hidden="true" /></template
    >{{ t("back") }}</NeButton
  >
  <div class="flex flex-wrap items-center gap-3">
    <NeHeading tag="h3" class="break-words">{{ title }}</NeHeading>
    <slot name="badges" />
  </div>
  <div
    :class="[
      $slots.notice ? 'mb-4' : 'mb-8',
      'flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center',
    ]"
  >
    <div class="max-w-2xl">
      <p v-if="description" class="text-muted mt-2">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.default" class="flex shrink-0 flex-wrap gap-4">
      <slot />
    </div>
  </div>
  <div v-if="$slots.notice" class="mb-8 max-w-6xl">
    <slot name="notice" />
  </div>
</template>
