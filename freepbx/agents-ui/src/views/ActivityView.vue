<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeInlineNotification,
  NeTextInput,
  NeSkeleton,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request } from "../api";
import PageHeader from "../components/PageHeader.vue";
import FieldSelect from "../components/FieldSelect.vue";
import PerformanceTable from "../components/PerformanceTable.vue";
import { duration } from "../monitoring";
import type { Run, MonitoringSummary, MonitoringHealth } from "../types";
const { t } = useI18n(),
  route = useRoute();
const page = ref(1),
  period = ref("default"),
  from = ref(""),
  to = ref("");
const agent = ref(
  typeof route.query.agent_id === "string" ? route.query.agent_id : "",
);
const provider = ref(""),
  adapter = ref(""),
  outcome = ref(""),
  error = ref(""),
  phase = ref(""),
  tool = ref("");
const search = ref(""),
  debouncedSearch = ref("");
watch(search, (value, _, cleanup) => {
  const timer = setTimeout(() => {
    debouncedSearch.value = value;
  }, 300);
  cleanup(() => clearTimeout(timer));
});
const windowEnd = ref(new Date());
const common = computed(() => {
  const filters: Record<string, string> = {};
  if (agent.value) filters.agent_id = agent.value;
  if (provider.value) filters.provider = provider.value;
  if (adapter.value) filters.adapter = adapter.value;
  if (period.value === "custom") {
    if (from.value)
      filters.from = new Date(from.value + "T00:00:00Z").toISOString();
    if (to.value) filters.to = new Date(to.value + "T23:59:59Z").toISOString();
  } else if (period.value !== "default") {
    const start = new Date(
      windowEnd.value.getTime() - Number(period.value) * 86400000,
    );
    start.setUTCMinutes(0, 0, 0);
    filters.from = start.toISOString();
  }
  return filters;
});
const validRange = computed(
  () =>
    period.value !== "custom" ||
    (!!from.value && !!to.value && from.value <= to.value),
);
const filters = computed(() => ({
  ...common.value,
  page: page.value,
  ...(debouncedSearch.value ? { query: debouncedSearch.value } : {}),
  ...(outcome.value ? { outcome: outcome.value } : {}),
  ...(error.value ? { error_code: error.value } : {}),
  ...(phase.value ? { phase: phase.value } : {}),
  ...(tool.value ? { tool_id: tool.value } : {}),
}));
watch(
  [common, debouncedSearch, outcome, error, phase, tool],
  () => {
    page.value = 1;
  },
  { deep: true },
);
const profiles = useQuery({
  queryKey: ["monitoring-agents"],
  queryFn: () =>
    request<{
      items: { agent_id: string; name: string; agent_type?: string }[];
    }>("GET", "/profiles"),
});
const summary = useQuery({
  queryKey: ["monitoring-summary", common],
  queryFn: () =>
    request<MonitoringSummary>(
      "GET",
      "/monitoring/summary",
      undefined,
      common.value,
    ),
  enabled: validRange,
  refetchInterval: 30000,
});
const health = useQuery({
  queryKey: ["monitoring-health"],
  queryFn: () => request<MonitoringHealth>("GET", "/monitoring/health"),
  refetchInterval: 30000,
});
const runs = useQuery({
  queryKey: ["runs", filters],
  queryFn: () =>
    request<{ items: Run[]; has_more: boolean }>(
      "GET",
      "/runs",
      undefined,
      filters.value,
    ),
  enabled: validRange,
  refetchInterval: 30000,
});
const all = computed(() => ({ id: "", label: t("monitoring.all") }));
const agentOptions = computed(() => [
  all.value,
  ...(profiles.data.value?.items || [])
    .filter((a) => a.agent_type !== "cleverai")
    .map((a) => ({
      id: a.agent_id,
      label: a.name,
    })),
]);
const outcomes = [
  "running",
  "completed",
  "transferred",
  "ended_by_agent",
  "fallback",
  "failed",
  "interrupted",
];
const outcomeCount = (value: string) =>
  Number(
    summary.data.value?.outcomes?.find((o) => o.outcome === value)?.count || 0,
  );
const trendRows = computed(() => {
  const days = new Map<
    string,
    {
      day: string;
      total: number;
      outcomes: { outcome: string; count: number }[];
    }
  >();
  for (const item of summary.data.value?.trends || []) {
    const day = days.get(item.day) || { day: item.day, total: 0, outcomes: [] };
    day.total += Number(item.count);
    day.outcomes.push(item);
    days.set(item.day, day);
  }
  return [...days.values()];
});
const maxTrend = computed(() =>
  Math.max(1, ...trendRows.value.map((d) => d.total)),
);
function selectDay(day: string) {
  from.value = day;
  to.value = day;
  period.value = "custom";
  if (summary.data.value?.resolution === "month") {
    const start = new Date(day + "T00:00:00Z");
    to.value = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
    )
      .toISOString()
      .slice(0, 10);
  }
}
function selectPhase(value: string) {
  phase.value = value;
  tool.value = "";
}
function selectTool(value: string) {
  tool.value = value;
  phase.value = "";
}
function refresh() {
  windowEnd.value = new Date();
  void summary.refetch();
  void health.refetch();
  void runs.refetch();
}
</script>
<template>
  <PageHeader :title="t('activity')" :description="t('monitoring.help')"
    ><NeButton @click="refresh">{{ t("refresh") }}</NeButton></PageHeader
  >
  <div class="nv-panel mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <FieldSelect
      v-model="period"
      :label="t('monitoring.period')"
      :options="[
        { id: 'default', label: t('monitoring.availableHistory') },
        { id: '1', label: t('monitoring.lastDay') },
        { id: '7', label: t('monitoring.last7') },
        { id: '30', label: t('monitoring.last30') },
        { id: '90', label: t('monitoring.last90') },
        { id: 'custom', label: t('monitoring.custom') },
      ]"
    />
    <FieldSelect v-model="agent" :label="t('agents')" :options="agentOptions" />
    <FieldSelect
      v-model="provider"
      :label="t('provider')"
      :options="[
        all,
        { id: 'openai', label: 'OpenAI' },
        { id: 'grok', label: 'Grok' },
        { id: 'unknown', label: t('monitoring.unknown') },
      ]"
    />
    <FieldSelect
      v-model="adapter"
      :label="t('monitoring.adapter')"
      :options="[
        all,
        { id: 'realtime', label: 'Realtime' },
        { id: 'live', label: t('monitoring.liveSip') },
        { id: 'live_ws', label: t('monitoring.liveWebSocket') },
        { id: 'unknown', label: t('monitoring.unknown') },
      ]"
    />
    <template v-if="period === 'custom'"
      ><label class="space-y-2"
        >{{ t("monitoring.from")
        }}<input
          v-model="from"
          type="date"
          class="block w-full rounded border border-gray-500 bg-transparent p-2" /></label
      ><label class="space-y-2"
        >{{ t("monitoring.to")
        }}<input
          v-model="to"
          type="date"
          class="block w-full rounded border border-gray-500 bg-transparent p-2" /></label
    ></template>
  </div>
  <NeInlineNotification
    v-if="!validRange"
    kind="warning"
    :title="t('monitoring.invalidRange')"
    class="mb-5"
  />
  <NeInlineNotification
    v-if="summary.isError.value || runs.isError.value || health.isError.value"
    data-testid="monitoring-request-error"
    kind="error"
    :title="t('error.request_failed')"
    class="mb-5"
  />
  <NeInlineNotification
    v-if="
      health.data.value?.stale ||
      health.data.value?.degraded ||
      health.data.value?.ari_connected === false
    "
    data-testid="monitoring-health-warning"
    kind="warning"
    :title="t('monitoring.healthWarning')"
    :description="
      health.data.value?.stale
        ? t('monitoring.stale')
        : t('monitoring.deliveryWarning')
    "
    class="mb-5"
  />
  <details
    v-if="health.data.value && !health.data.value.stale"
    class="nv-panel mb-5 space-y-3"
  >
    <summary class="cursor-pointer font-semibold">
      {{ t("monitoring.delivery") }}
    </summary>
    <dl class="grid gap-3 text-sm md:grid-cols-3">
      <div
        v-for="key in [
          'active_calls',
          'spool_writable',
          'active_calls',
          'spool_writable',
          'queue_depth',
          'oldest_pending_seconds',
          'dropped',
          'retries',
          'last_write_at',
        ] as const"
        :key="key"
      >
        <dt class="nv-muted">{{ t("monitoring.healthKeys." + key) }}</dt>
        <dd>{{ health.data.value[key] ?? "—" }}</dd>
      </div>
    </dl>
  </details>
  <NeSkeleton v-if="summary.isLoading.value" class="mb-5 h-32" />
  <template v-if="summary.data.value?.coverage">
    <section
      :aria-label="t('monitoring.overview')"
      class="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4"
    >
      <div class="nv-panel">
        <p class="nv-muted">{{ t("monitoring.calls") }}</p>
        <p data-testid="monitoring-total" class="mt-2 text-3xl font-semibold">
          {{ summary.data.value.coverage.total_runs }}
        </p>
      </div>
      <div class="nv-panel">
        <p class="nv-muted">{{ t("runOutcomes.transferred") }}</p>
        <p class="mt-2 text-3xl font-semibold">
          {{ outcomeCount("transferred") }}
        </p>
      </div>
      <div class="nv-panel">
        <p class="nv-muted">{{ t("monitoring.fallbacksFailures") }}</p>
        <p class="mt-2 text-3xl font-semibold">
          {{ outcomeCount("fallback") + outcomeCount("failed") }}
        </p>
      </div>
      <div class="nv-panel">
        <p class="nv-muted">{{ t("monitoring.partial") }}</p>
        <p class="mt-2 text-3xl font-semibold">
          {{ summary.data.value.coverage.partial_runs }}
        </p>
        <p class="nv-muted text-sm">
          {{
            t("monitoring.incompleteCount", {
              count: summary.data.value.coverage.incomplete_runs,
            })
          }}
        </p>
      </div>
    </section>
    <section class="nv-panel mb-5 space-y-4">
      <h2>{{ t("monitoring.performance") }}</h2>
      <p class="nv-muted text-sm">{{ t("monitoring.percentiles") }}</p>
      <div class="grid gap-4 md:grid-cols-3">
        <div
          v-for="metric in ['run_duration', 'setup_duration', 'first_output']"
          :key="metric"
        >
          <p>{{ t("monitoring.metrics." + metric) }}</p>
          <p class="mt-1 text-xl font-semibold">
            p95 ≈ {{ duration(summary.data.value.latencies?.[metric]?.p95_ms) }}
          </p>
          <p class="nv-muted text-sm">
            {{
              t("monitoring.sampleCount", {
                count: summary.data.value.latencies?.[metric]?.samples || 0,
              })
            }}
          </p>
        </div>
      </div>
      <p class="nv-muted text-sm">{{ t("monitoring.audioLimit") }}</p>
    </section>
    <section v-if="trendRows.length" class="nv-panel mb-5 space-y-3">
      <h2>{{ t("monitoring.daily") }}</h2>
      <div class="max-h-72 space-y-3 overflow-y-auto" role="list">
        <div
          v-for="day in trendRows"
          :key="day.day"
          role="listitem"
          class="space-y-1"
        >
          <div class="flex justify-between text-sm">
            <button
              type="button"
              class="text-primary-500"
              @click="selectDay(day.day)"
            >
              {{ day.day }}</button
            ><span>{{ day.total }}</span>
          </div>
          <div
            class="h-2 rounded bg-primary-500"
            :style="{ width: Math.max(1, (day.total / maxTrend) * 100) + '%' }"
            aria-hidden="true"
          />
          <p class="nv-muted text-xs">
            {{
              day.outcomes
                .map((o) => t("runOutcomes." + o.outcome) + ": " + o.count)
                .join(" · ")
            }}
          </p>
          <p
            v-for="latency in summary.data.value?.latency_trends?.filter(
              (item) => item.day === day.day,
            ) || []"
            :key="latency.metric"
            class="nv-muted text-xs"
          >
            {{ t("monitoring.metrics." + latency.metric) }} p95 ≈
            {{ duration(latency.p95_ms) }} ·
            {{ t("monitoring.sampleCount", { count: latency.samples }) }}
          </p>
        </div>
      </div>
    </section>
    <section class="nv-panel mb-5 space-y-6">
      <PerformanceTable
        :items="summary.data.value.phases || []"
        kind="phases"
        @select="selectPhase"
      /><PerformanceTable
        :items="summary.data.value.tools || []"
        kind="tools"
        @select="selectTool"
      />
    </section>
    <section
      v-if="summary.data.value.errors?.length"
      class="nv-panel mb-5 space-y-3"
    >
      <h2>{{ t("monitoring.providerErrors") }}</h2>
      <div
        v-for="item in summary.data.value.errors"
        :key="item.phase + item.error_code"
        class="flex flex-wrap items-center justify-between gap-2"
      >
        <span class="break-words"
          >{{ t("monitoring.phasesMap." + item.phase) }} ·
          {{ item.error_code }} · {{ item.count }}</span
        ><NeButton
          kind="tertiary"
          @click="
            error = item.error_code;
            phase = item.phase;
          "
          >{{ t("monitoring.showRuns") }}</NeButton
        >
      </div>
    </section>
  </template>
  <section class="nv-panel space-y-4">
    <h2>{{ t("monitoring.runs") }}</h2>
    <div class="grid gap-4 md:grid-cols-2">
      <NeTextInput
        v-model="search"
        data-testid="run-search"
        :label="t('monitoring.search')"
      /><FieldSelect
        v-model="outcome"
        :label="t('outcome')"
        :options="[
          all,
          ...outcomes.map((id) => ({ id, label: t('runOutcomes.' + id) })),
        ]"
      />
    </div>
    <div
      v-if="phase || tool || error"
      class="flex flex-wrap items-center gap-3 text-sm"
    >
      <span class="break-all">{{
        [phase, tool, error].filter(Boolean).join(" · ")
      }}</span
      ><NeButton
        kind="tertiary"
        @click="
          phase = '';
          tool = '';
          error = '';
        "
        >{{ t("clear") }}</NeButton
      >
    </div>
    <NeSkeleton v-if="runs.isLoading.value" class="h-32" />
    <p v-else-if="!runs.data.value?.items?.length" class="nv-muted">
      {{ t("noResults") }}
    </p>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="nv-muted">
          <tr>
            <th scope="col" class="p-3">{{ t("agents") }}</th>
            <th scope="col" class="p-3">{{ t("startedAt") }}</th>
            <th scope="col" class="p-3">{{ t("outcome") }}</th>
            <th scope="col" class="p-3">{{ t("monitoring.duration") }}</th>
            <th scope="col" class="p-3">{{ t("actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="run in runs.data.value.items"
            :key="run.run_id"
            class="border-t border-gray-500/20"
          >
            <th scope="row" class="p-3">
              {{ run.agent_name || run.agent_id }}
            </th>
            <td class="whitespace-nowrap p-3">{{ run.started_at }} UTC</td>
            <td class="p-3">
              {{ t("runOutcomes." + run.outcome)
              }}<span v-if="run.incomplete" class="block text-amber-600">{{
                t("monitoring.incomplete")
              }}</span>
            </td>
            <td class="whitespace-nowrap p-3">
              {{ duration(run.duration_ms) }}
            </td>
            <td class="p-3">
              <RouterLink :to="'/activity/' + run.run_id"
                ><NeButton kind="tertiary">{{
                  t("open")
                }}</NeButton></RouterLink
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="nv-action-bar">
      <NeButton :disabled="page === 1" @click="page--">{{
        t("previous")
      }}</NeButton
      ><span>{{ page }}</span
      ><NeButton :disabled="!runs.data.value?.has_more" @click="page++">{{
        t("next")
      }}</NeButton>
    </div>
  </section>
</template>
