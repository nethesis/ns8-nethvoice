<script setup lang="ts">
import { NeEmptyState } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>
<template>
  <div class="nv-stack">
    <h1>{{ t("agents") }}</h1>
    <section class="nv-panel" aria-live="polite">
      <NeEmptyState :title="t('foundationTitle')" :description="t('foundationHelp')" />
    </section>
  </div>
</template>
