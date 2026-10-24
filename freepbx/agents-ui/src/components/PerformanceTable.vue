<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { NeButton } from "@nethesis/vue-components";
import type { Performance } from "../types";
import { duration } from "../monitoring";
defineProps<{ items: Performance[]; kind: "phases" | "tools" }>();
defineEmits<{ select: [value: string] }>();
const { t } = useI18n();
</script>
<template>
  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <caption class="mb-3 text-left text-base font-semibold">
        {{
          t("monitoring." + kind)
        }}
      </caption>
      <thead class="nv-muted">
        <tr>
          <th scope="col" class="p-2">{{ t("name") }}</th>
          <th scope="col" class="p-2">{{ t("monitoring.statusLabel") }}</th>
          <th scope="col" class="p-2">{{ t("monitoring.samples") }}</th>
          <th v-if="kind === 'tools'" scope="col" class="p-2">
            {{ t("monitoring.invocations") }}
          </th>
          <th scope="col" class="p-2">p50 ≈</th>
          <th scope="col" class="p-2">p95 ≈</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id + item.status"
          class="border-t border-gray-500/20"
        >
          <th scope="row" class="p-2">
            <NeButton kind="tertiary" @click="$emit('select', item.id)">{{
              kind === "phases"
                ? t("monitoring.phasesMap." + item.id)
                : t("toolNames." + item.id.replaceAll(".", "_"))
            }}</NeButton>
          </th>
          <td class="p-2">{{ t("monitoring.status." + item.status) }}</td>
          <td class="p-2">{{ item.samples }}</td>
          <td v-if="kind === 'tools'" class="p-2">
            {{ item.invocations ?? "—" }}
          </td>
          <td class="whitespace-nowrap p-2">{{ duration(item.p50_ms) }}</td>
          <td class="whitespace-nowrap p-2">{{ duration(item.p95_ms) }}</td>
        </tr>
        <tr v-if="!items.length">
          <td :colspan="kind === 'tools' ? 6 : 5" class="nv-muted p-2">
            {{ t("noResults") }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
