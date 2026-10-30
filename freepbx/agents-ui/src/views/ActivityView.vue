<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeBadgeV2,
  NeButton,
  NeCard,
  NeDropdownFilterV2,
  NeHeading,
  NeInlineNotification,
  NeSkeleton,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTextInput,
} from "@nethesis/vue-components";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import { request } from "../api";
import PageHeader from "../components/PageHeader.vue";
import CounterCard from "../components/CounterCard.vue";
import AppEmptyState from "../components/AppEmptyState.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { duration, formatDay, formatUtc } from "../monitoring";
import type {
  Run,
  MonitoringSummary,
  MonitoringHealth,
  Performance,
} from "../types";
type Option = { id: string; label: string };
const { t, te, locale } = useI18n(),
  route = useRoute(),
  router = useRouter();
const filterLabels = computed(() => ({
  clearFilterLabel: t("clearSelection"),
  openMenuAriaLabel: t("openFilter"),
  noOptionsLabel: t("noOptions"),
  moreOptionsHiddenLabel: t("moreOptions"),
  clearSearchLabel: t("clear"),
}));
const periodOptions = computed<Option[]>(() => [
  { id: "default", label: t("monitoring.availableHistory") },
  { id: "1", label: t("monitoring.lastDay") },
  { id: "7", label: t("monitoring.last7") },
  { id: "30", label: t("monitoring.last30") },
  { id: "90", label: t("monitoring.last90") },
  { id: "custom", label: t("monitoring.custom") },
]);
const periodFilter = ref<Option[]>([]);
const period = computed(() => periodFilter.value[0]?.id || "default");
const from = ref(""),
  to = ref("");
const initialAgent =
  typeof route.query.agent_id === "string" ? route.query.agent_id : "";
const agentFilter = ref<Option[]>(
  initialAgent ? [{ id: initialAgent, label: initialAgent }] : [],
);
const providerFilter = ref<Option[]>([]);
const adapterFilter = ref<Option[]>([]);
const outcomeFilter = ref<Option[]>([]);
const page = ref(1);
const search = ref(""),
  debouncedSearch = ref("");
watch(search, (value, _, cleanup) => {
  const timer = setTimeout(() => {
    debouncedSearch.value = value;
  }, 300);
  cleanup(() => clearTimeout(timer));
});
const windowEnd = ref(new Date());
const ids = (options: Option[]) => options.map((o) => o.id).join(",");
const common = computed(() => {
  const filters: Record<string, string> = {};
  if (agentFilter.value.length) filters.agent_id = ids(agentFilter.value);
  if (providerFilter.value.length) filters.provider = ids(providerFilter.value);
  if (adapterFilter.value.length) filters.adapter = ids(adapterFilter.value);
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
const runFilters = computed(() => ({
  ...common.value,
  page: page.value,
  ...(debouncedSearch.value ? { query: debouncedSearch.value } : {}),
  ...(outcomeFilter.value.length ? { outcome: ids(outcomeFilter.value) } : {}),
}));
watch(
  [common, debouncedSearch, outcomeFilter],
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
  queryKey: ["runs", runFilters],
  queryFn: () =>
    request<{ items: Run[]; has_more: boolean }>(
      "GET",
      "/runs",
      undefined,
      runFilters.value,
    ),
  enabled: validRange,
  refetchInterval: 30000,
});
const agentOptions = computed<Option[]>(() =>
  (profiles.data.value?.items || [])
    .filter((a) => a.agent_type !== "cleverai")
    .map((a) => ({ id: a.agent_id, label: a.name })),
);
watch(agentOptions, (options) => {
  const named = agentFilter.value.map(
    (s) => options.find((o) => o.id === s.id) || s,
  );
  if (named.some((o, i) => o.label !== agentFilter.value[i].label))
    agentFilter.value = named;
});
const providerOptions = computed<Option[]>(() => [
  { id: "openai", label: "OpenAI" },
  { id: "grok", label: "Grok" },
  { id: "unknown", label: t("monitoring.unknown") },
]);
const adapterOptions = computed<Option[]>(() => [
  { id: "realtime", label: "Realtime" },
  { id: "live", label: t("monitoring.liveSip") },
  { id: "live_ws", label: t("monitoring.liveWebSocket") },
  { id: "unknown", label: t("monitoring.unknown") },
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
const outcomeOptions = computed<Option[]>(() =>
  outcomes.map((id) => ({ id, label: t("runOutcomes." + id) })),
);
function resetFilters() {
  periodFilter.value = [];
  from.value = "";
  to.value = "";
  agentFilter.value = [];
  providerFilter.value = [];
  adapterFilter.value = [];
}
function resetRunFilters() {
  search.value = "";
  outcomeFilter.value = [];
}
const outcomeCount = (value: string) =>
  Number(
    summary.data.value?.outcomes?.find((o) => o.outcome === value)?.count || 0,
  );
function share(count: number) {
  const total = summary.data.value?.coverage.total_runs || 0;
  return total
    ? t("monitoring.shareOfCalls", {
        percent: Math.round((count / total) * 100),
      })
    : "";
}
const kpis = computed(() => {
  const coverage = summary.data.value?.coverage;
  if (!coverage) return [];
  const transferred = outcomeCount("transferred");
  const failures = outcomeCount("fallback") + outcomeCount("failed");
  return [
    {
      id: "total",
      label: t("monitoring.calls"),
      value: coverage.total_runs,
      icon: "phone",
      note: "",
    },
    {
      id: "transferred",
      label: t("monitoring.columns.transferred"),
      value: transferred,
      icon: "arrow-right-arrow-left",
      note: share(transferred),
    },
    {
      id: "failures",
      label: t("monitoring.fallbacksFailures"),
      value: failures,
      icon: "triangle-exclamation",
      note: share(failures),
    },
    {
      id: "partial",
      label: t("monitoring.partial"),
      value: coverage.partial_runs,
      icon: "chart-gantt",
      note: t("monitoring.incompleteCount", {
        count: coverage.incomplete_runs,
      }),
    },
  ];
});
const performance = computed(() =>
  (
    [
      ["run_duration", "stopwatch"],
      ["setup_duration", "plug"],
      ["first_output", "volume-high"],
    ] as const
  ).map(([metric, icon]) => {
    const value = summary.data.value?.latencies?.[metric];
    return {
      id: metric,
      label: t("monitoring.metrics." + metric),
      value: duration(value?.p95_ms),
      icon,
      note: t("monitoring.sampleCount", { count: value?.samples || 0 }),
      tooltip: metric === "first_output" ? t("monitoring.audioLimit") : "",
    };
  }),
);
const days = computed(() => {
  const rows = new Map<string, Record<string, number> & { total: number }>();
  for (const item of summary.data.value?.trends || []) {
    const row = rows.get(item.day) || { total: 0 };
    row.total += Number(item.count);
    row[item.outcome] = (row[item.outcome] || 0) + Number(item.count);
    rows.set(item.day, row);
  }
  const latency = (day: string, metric: string) =>
    summary.data.value?.latency_trends?.find(
      (item) => item.day === day && item.metric === metric,
    )?.p95_ms;
  return [...rows.entries()].map(([day, row]) => ({
    day,
    label:
      summary.data.value?.resolution === "month"
        ? formatDay(day, String(locale.value), true)
        : formatDay(day, String(locale.value)),
    row,
    runtime: duration(latency(day, "run_duration")),
    media: duration(latency(day, "setup_duration")),
  }));
});
const dayColumns = [
  "completed",
  "transferred",
  "fallback",
  "interrupted",
  "ended_by_agent",
];
const phaseOrder = [
  "snapshot",
  "admission",
  "binding",
  "routing_context",
  "origination",
  "webhook_wait",
  "provider_accept",
  "provider_answer",
  "provider_sideband",
  "media_bridge",
  "media_prepare",
  "provider_start",
  "provider_stream",
  "greeting",
  "provider_audio",
  "response",
  "tool",
  "transfer",
  "fallback",
  "cleanup",
];
function label(key: string, fallback: string) {
  return te(key) ? t(key) : fallback;
}
function rank(id: string) {
  const index = phaseOrder.indexOf(id);
  return index < 0 ? phaseOrder.length : index;
}
function aggregate(items: Performance[], tools: boolean) {
  const groups = new Map<string, Performance[]>();
  for (const item of tools
    ? items
    : [...items].sort((a, b) => rank(a.id) - rank(b.id)))
    groups.set(item.id, [...(groups.get(item.id) || []), item]);
  return [...groups.entries()].map(([id, rows]) => {
    const count = (row: Performance) =>
      tools ? (row.invocations ?? row.samples) : row.samples;
    const reference =
      rows.find((row) => row.status === "completed" && row.samples) ||
      rows.find((row) => row.samples) ||
      rows[0];
    return {
      id,
      name: label(
        tools
          ? "toolNames." + id.replaceAll(".", "_")
          : "monitoring.phasesMap." + id,
        id,
      ),
      count: rows.reduce((sum, row) => sum + count(row), 0),
      failed: rows
        .filter((row) => row.status === "failed" || row.status === "denied")
        .reduce((sum, row) => sum + count(row), 0),
      p50: duration(reference.p50_ms),
      p95: duration(reference.p95_ms),
    };
  });
}
const performanceTables = computed(() => [
  {
    id: "phases",
    title: t("monitoring.phases"),
    countLabel: t("monitoring.samples"),
    rows: aggregate(summary.data.value?.phases || [], false),
  },
  {
    id: "tools",
    title: t("monitoring.tools"),
    countLabel: t("monitoring.invocations"),
    rows: aggregate(summary.data.value?.tools || [], true),
  },
]);
const delivery = computed(() => {
  const value = health.data.value;
  if (!value || value.stale) return [];
  const warn = (n?: number) => (n ? "fallback" : "");
  return [
    {
      id: "spool",
      label: t("monitoring.healthKeys.spool_writable"),
      value: t(
        value.spool_writable
          ? "monitoring.spoolWritable"
          : "monitoring.spoolNotWritable",
      ),
      status: value.spool_writable ? "completed" : "failed",
    },
    {
      id: "active",
      label: t("monitoring.healthKeys.active_calls"),
      value: String(value.active_calls ?? "—"),
      status: "",
    },
    {
      id: "pending",
      label: t("monitoring.healthKeys.queue_depth"),
      value: String(value.queue_depth ?? "—"),
      status: warn(value.queue_depth),
    },
    {
      id: "oldest",
      label: t("monitoring.healthKeys.oldest_pending_seconds"),
      value:
        value.oldest_pending_seconds == null
          ? "—"
          : value.oldest_pending_seconds + " s",
      status: warn(value.oldest_pending_seconds),
    },
    {
      id: "dropped",
      label: t("monitoring.healthKeys.dropped"),
      value: String(value.dropped ?? "—"),
      status: warn(value.dropped),
    },
    {
      id: "retries",
      label: t("monitoring.healthKeys.retries"),
      value: String(value.retries ?? "—"),
      status: warn(value.retries),
    },
    {
      id: "last",
      label: t("monitoring.healthKeys.last_write_at"),
      value: value.last_write_at
        ? formatUtc(value.last_write_at, String(locale.value)) + " UTC"
        : "—",
      status: "",
    },
  ];
});
const healthWarning = computed(
  () =>
    health.data.value?.stale ||
    health.data.value?.degraded ||
    health.data.value?.ari_connected === false,
);
function refresh() {
  windowEnd.value = new Date();
  void summary.refetch();
  void health.refetch();
  void runs.refetch();
}
</script>
<template>
  <PageHeader :title="t('activity')" :description="t('monitoring.help')"
    ><NeButton
      kind="secondary"
      size="lg"
      :loading="summary.isFetching.value || runs.isFetching.value"
      @click="refresh"
      ><template #prefix
        ><FontAwesomeIcon icon="arrows-rotate" aria-hidden="true" /></template
      >{{ t("refresh") }}</NeButton
    ></PageHeader
  >
  <div class="mb-6 flex flex-wrap items-center gap-4">
    <NeDropdownFilterV2
      v-model="periodFilter"
      kind="radio"
      :label="t('monitoring.period')"
      :options="periodOptions"
      :show-clear-filter="false"
      v-bind="filterLabels"
    />
    <NeDropdownFilterV2
      v-model="agentFilter"
      kind="checkbox"
      :label="t('agentFilter')"
      :options="agentOptions"
      v-bind="filterLabels"
    />
    <NeDropdownFilterV2
      v-model="providerFilter"
      kind="checkbox"
      :label="t('provider')"
      :options="providerOptions"
      v-bind="filterLabels"
    />
    <NeDropdownFilterV2
      v-model="adapterFilter"
      kind="checkbox"
      :label="t('monitoring.adapter')"
      :options="adapterOptions"
      v-bind="filterLabels"
    />
    <NeButton kind="tertiary" @click="resetFilters">{{
      t("resetFilters")
    }}</NeButton>
  </div>
  <div
    v-if="period === 'custom'"
    class="mb-6 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2"
  >
    <NeTextInput v-model="from" type="date" :label="t('monitoring.from')" />
    <NeTextInput v-model="to" type="date" :label="t('monitoring.to')" />
  </div>
  <div class="flex flex-col gap-12">
    <div
      v-if="
        !validRange ||
        summary.isError.value ||
        runs.isError.value ||
        health.isError.value ||
        healthWarning ||
        delivery.length
      "
      class="flex flex-col gap-4"
    >
      <NeInlineNotification
        v-if="!validRange"
        kind="warning"
        :title="t('monitoring.invalidRange')"
      />
      <NeInlineNotification
        v-if="
          summary.isError.value || runs.isError.value || health.isError.value
        "
        data-testid="monitoring-request-error"
        kind="error"
        :title="t('error.request_failed')"
      />
      <NeInlineNotification
        v-if="healthWarning"
        data-testid="monitoring-health-warning"
        kind="warning"
        :title="t('monitoring.healthWarning')"
        :description="
          health.data.value?.stale
            ? t('monitoring.stale')
            : t('monitoring.deliveryWarning')
        "
      />
      <NeCard v-if="delivery.length" :title="t('monitoring.delivery')">
        <dl
          class="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4"
        >
          <div
            v-for="item in delivery"
            :key="item.id"
            class="flex flex-col gap-1"
          >
            <dt class="text-tertiary-neutral text-sm">{{ item.label }}</dt>
            <dd
              class="text-primary-neutral flex items-center gap-2 font-medium"
            >
              <StatusBadge
                v-if="item.status"
                :status="item.status"
                :label="item.value"
              /><template v-else>{{ item.value }}</template>
            </dd>
          </div>
        </dl>
      </NeCard>
    </div>
    <NeSkeleton v-if="summary.isLoading.value" :lines="6" />
    <template v-if="summary.data.value?.coverage">
      <section
        :aria-label="t('monitoring.overview')"
        class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
      >
        <CounterCard
          v-for="kpi in kpis"
          :key="kpi.id"
          :title="kpi.label"
          :value="kpi.value"
          :icon="kpi.icon"
          :note="kpi.note"
          :testid="kpi.id === 'total' ? 'monitoring-total' : undefined"
        />
      </section>
      <section>
        <NeHeading tag="h5">{{ t("monitoring.performance") }}</NeHeading>
        <p class="text-muted mt-1 mb-3 max-w-2xl">
          {{ t("monitoring.percentiles") }}
        </p>
        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <CounterCard
            v-for="metric in performance"
            :key="metric.id"
            :title="metric.label"
            :value="metric.value"
            :icon="metric.icon"
            :note="metric.note"
            :tooltip="metric.tooltip"
          />
        </div>
      </section>
      <section>
        <NeHeading tag="h5" class="mb-3">{{ t("monitoring.daily") }}</NeHeading>
        <AppEmptyState v-if="!days.length" :title="t('noResults')" />
        <NeTable
          v-else
          :aria-label="t('monitoring.daily')"
          card-breakpoint="xl"
        >
          <NeTableHead>
            <NeTableHeadCell>{{ t("monitoring.date") }}</NeTableHeadCell>
            <NeTableHeadCell>{{ t("monitoring.calls") }}</NeTableHeadCell>
            <NeTableHeadCell v-for="column in dayColumns" :key="column">{{
              t("monitoring.columns." + column)
            }}</NeTableHeadCell>
            <NeTableHeadCell>{{ t("monitoring.runtimeP95") }}</NeTableHeadCell>
            <NeTableHeadCell>{{ t("monitoring.mediaP95") }}</NeTableHeadCell>
          </NeTableHead>
          <NeTableBody>
            <NeTableRow v-for="day in days" :key="day.day">
              <NeTableCell :data-label="t('monitoring.date')"
                ><span
                  class="text-primary-neutral font-medium whitespace-nowrap"
                  >{{ day.label }}</span
                ></NeTableCell
              >
              <NeTableCell :data-label="t('monitoring.calls')">{{
                day.row.total
              }}</NeTableCell>
              <NeTableCell
                v-for="column in dayColumns"
                :key="column"
                :data-label="t('monitoring.columns.' + column)"
                >{{ day.row[column] || 0 }}</NeTableCell
              >
              <NeTableCell :data-label="t('monitoring.runtimeP95')">{{
                day.runtime
              }}</NeTableCell>
              <NeTableCell :data-label="t('monitoring.mediaP95')">{{
                day.media
              }}</NeTableCell>
            </NeTableRow>
          </NeTableBody>
        </NeTable>
      </section>
      <div class="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <section
          v-for="table in performanceTables"
          :key="table.id"
          class="min-w-0"
        >
          <NeHeading tag="h5" class="mb-3">{{ table.title }}</NeHeading>
          <AppEmptyState v-if="!table.rows.length" :title="t('noResults')" />
          <NeTable v-else :aria-label="table.title" card-breakpoint="xl">
            <NeTableHead>
              <NeTableHeadCell>{{ t("name") }}</NeTableHeadCell>
              <NeTableHeadCell>{{ table.countLabel }}</NeTableHeadCell>
              <NeTableHeadCell>{{
                t("monitoring.columns.failed")
              }}</NeTableHeadCell>
              <NeTableHeadCell>p50</NeTableHeadCell>
              <NeTableHeadCell>p95</NeTableHeadCell>
            </NeTableHead>
            <NeTableBody>
              <NeTableRow v-for="row in table.rows" :key="row.id">
                <NeTableCell :data-label="t('name')"
                  ><span class="text-primary-neutral">{{
                    row.name
                  }}</span></NeTableCell
                >
                <NeTableCell :data-label="table.countLabel">{{
                  row.count
                }}</NeTableCell>
                <NeTableCell :data-label="t('monitoring.columns.failed')"
                  ><StatusBadge
                    v-if="row.failed"
                    status="failed"
                    :label="String(row.failed)"
                  /><template v-else>0</template></NeTableCell
                >
                <NeTableCell data-label="p50">{{ row.p50 }}</NeTableCell>
                <NeTableCell data-label="p95">{{ row.p95 }}</NeTableCell>
              </NeTableRow>
            </NeTableBody>
          </NeTable>
        </section>
      </div>
    </template>
    <section>
      <NeHeading tag="h5" class="mb-3">{{ t("monitoring.runs") }}</NeHeading>
      <div class="mb-6 flex flex-wrap items-center gap-4">
        <NeTextInput
          v-model="search"
          data-testid="run-search"
          is-search
          :placeholder="t('monitoring.search')"
          :clear-search-label="t('clear')"
          class="max-w-48 sm:max-w-sm"
        />
        <NeDropdownFilterV2
          v-model="outcomeFilter"
          kind="checkbox"
          :label="t('outcome')"
          :options="outcomeOptions"
          v-bind="filterLabels"
        />
        <NeButton kind="tertiary" @click="resetRunFilters">{{
          t("resetFilters")
        }}</NeButton>
      </div>
      <AppEmptyState
        v-if="runs.isSuccess.value && !runs.data.value?.items?.length"
        :icon="faMagnifyingGlass"
        :title="t('monitoring.noRuns')"
        :description="t('noResultsHelp')"
        ><NeButton kind="tertiary" size="lg" @click="resetRunFilters">{{
          t("resetFilters")
        }}</NeButton></AppEmptyState
      >
      <NeTable
        v-else
        :aria-label="t('monitoring.runs')"
        :loading="runs.isLoading.value"
        :skeleton-columns="5"
        :skeleton-rows="5"
        card-breakpoint="xl"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ t("agentColumn") }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t("startedAt") }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t("outcome") }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t("monitoring.duration") }}</NeTableHeadCell>
          <NeTableHeadCell />
        </NeTableHead>
        <NeTableBody>
          <NeTableRow
            v-for="run in runs.data.value?.items || []"
            :key="run.run_id"
          >
            <NeTableCell :data-label="t('agentColumn')"
              ><span class="text-primary-neutral font-medium">{{
                run.agent_name || run.agent_id
              }}</span></NeTableCell
            >
            <NeTableCell :data-label="t('startedAt')"
              ><span class="whitespace-nowrap">{{
                formatUtc(run.started_at, String(locale))
              }}</span></NeTableCell
            >
            <NeTableCell :data-label="t('outcome')"
              ><div class="flex flex-wrap items-center gap-2">
                <StatusBadge :status="run.outcome" /><NeBadgeV2
                  v-if="run.incomplete"
                  kind="amber"
                  size="xs"
                  >{{ t("monitoring.incomplete") }}</NeBadgeV2
                >
              </div></NeTableCell
            >
            <NeTableCell :data-label="t('monitoring.duration')"
              ><span class="whitespace-nowrap">{{
                duration(run.duration_ms)
              }}</span></NeTableCell
            >
            <NeTableCell :data-label="t('actions')"
              ><div class="-ml-2.5 flex gap-2 xl:ml-0 xl:justify-end">
                <NeButton
                  kind="tertiary"
                  @click="router.push('/activity/' + run.run_id)"
                  ><template #prefix
                    ><FontAwesomeIcon
                      icon="eye"
                      class="size-4"
                      aria-hidden="true" /></template
                  >{{ t("details") }}</NeButton
                >
              </div></NeTableCell
            >
          </NeTableRow>
        </NeTableBody>
        <template v-if="page > 1 || runs.data.value?.has_more" #paginator>
          <div
            class="flex flex-col justify-between gap-6 border-t border-gray-300 bg-white px-6 py-3 text-sm text-gray-700 sm:flex-row sm:items-center dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
          >
            <span>{{
              t("monitoring.range", {
                from: (page - 1) * 25 + 1,
                to: (page - 1) * 25 + (runs.data.value?.items?.length || 0),
              })
            }}</span>
            <nav :aria-label="t('pagination')">
              <ul class="flex h-10 items-center -space-x-px text-base">
                <li>
                  <button
                    type="button"
                    class="flex h-10 items-center justify-center border border-gray-300 bg-white px-4 leading-tight text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white ms-0 rounded-s-lg border-e-0"
                    :disabled="page === 1"
                    @click="page--"
                  >
                    <span class="sr-only">{{ t("previousPage") }}</span
                    ><FontAwesomeIcon
                      icon="chevron-left"
                      class="size-4 shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                </li>
                <li>
                  <span
                    aria-current="page"
                    class="z-10 flex h-10 cursor-default items-center justify-center border border-gray-300 bg-gray-100 px-4 leading-tight text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >{{ page }}</span
                  >
                </li>
                <li>
                  <button
                    type="button"
                    class="flex h-10 items-center justify-center border border-gray-300 bg-white px-4 leading-tight text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white rounded-e-lg border-s-0"
                    :disabled="!runs.data.value?.has_more"
                    @click="page++"
                  >
                    <span class="sr-only">{{ t("nextPage") }}</span
                    ><FontAwesomeIcon
                      icon="chevron-right"
                      class="size-4 shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </template>
      </NeTable>
    </section>
  </div>
</template>
