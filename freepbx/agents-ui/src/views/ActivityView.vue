<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeBadgeV2,
  NeButton,
  NeCard,
  NeDropdownFilterV2,
  NeExpandable,
  NeHeading,
  NeInlineNotification,
  NePaginator,
  NeSkeleton,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTextInput,
} from "@nethesis/vue-components";
import {
  faArrowRightArrowLeft,
  faArrowsRotate,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faEye,
  faMagnifyingGlass,
  faPhone,
  faPlug,
  faStopwatch,
  faTriangleExclamation,
  faVolumeHigh,
} from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import { useLoadError } from "../composables/useLoadError";
import { errorCode, request } from "../api";
import PageHeader from "../components/PageHeader.vue";
import CounterCard from "../components/CounterCard.vue";
import AppEmptyState from "../components/AppEmptyState.vue";
import StatusBadge from "../components/StatusBadge.vue";
import {
  duration,
  formatDateTime,
  formatDay,
  formatNumber,
  formatPercent,
  phoneNumber,
  runErrorReason,
} from "../monitoring";
import type {
  Catalog,
  MonitoringHealth,
  MonitoringSummary,
  Performance,
  Run,
} from "../types";
type Option = { id: string; label: string };
const { t, te, locale } = useI18n(),
  loadError = useLoadError(),
  route = useRoute(),
  router = useRouter();
const lang = computed(() => String(locale.value));
const filterLabels = computed(() => ({
  clearFilterLabel: t("clearSelection"),
  openMenuAriaLabel: t("openFilter"),
  noOptionsLabel: t("noOptions"),
  moreOptionsHiddenLabel: t("moreOptions"),
  clearSearchLabel: t("clear"),
}));
const paginatorLabels = computed(() => ({
  previousLabel: t("previousPage"),
  nextLabel: t("nextPage"),
  navPaginationLabel: t("pagination"),
  rangeOfTotalLabel: t("rangeOfTotal"),
  pageSizeLabel: t("pageSize"),
}));

// Page filters: they apply to the counters, the calls and the daily outcomes.
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
const outcomeFilter = ref<Option[]>([]);
const page = ref(1);
const search = ref(""),
  debouncedSearch = ref("");
watch(search, (value, _, cleanup) => {
  const timer = setTimeout(() => {
    debouncedSearch.value = value.trim();
  }, 300);
  cleanup(() => clearTimeout(timer));
});
const windowEnd = ref(new Date());
const ids = (options: Option[]) => options.map((o) => o.id).join(",");
const common = computed(() => {
  const filters: Record<string, string> = {};
  if (agentFilter.value.length) filters.agent_id = ids(agentFilter.value);
  if (providerFilter.value.length) filters.provider = ids(providerFilter.value);
  if (period.value === "custom") {
    if (from.value)
      filters.from = new Date(from.value + "T00:00:00").toISOString();
    if (to.value) filters.to = new Date(to.value + "T23:59:59").toISOString();
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
const pageFiltersChanged = computed(
  () =>
    period.value !== "default" ||
    !!agentFilter.value.length ||
    !!providerFilter.value.length,
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

const catalog = useQuery({
  queryKey: ["catalog"],
  queryFn: () => request<Catalog>("GET", "/catalog"),
});
const profiles = useQuery({
  queryKey: ["monitoring-agents"],
  queryFn: () =>
    request<{
      items: { agent_id: string; name: string; agent_type?: string }[];
    }>("GET", "/profiles"),
});
// Daily buckets follow the browser time zone, like the times of the calls.
const timeZone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
})();
const summary = useQuery({
  queryKey: ["monitoring-summary", common],
  queryFn: async () => {
    if (timeZone) {
      try {
        const data = await request<MonitoringSummary>(
          "GET",
          "/monitoring/summary",
          undefined,
          { ...common.value, timezone: timeZone },
        );
        return { ...data, utcDays: timeZone === "UTC" };
      } catch (error) {
        if (
          ![
            "invalid_monitoring_timezone",
            "monitoring_timezone_unavailable",
          ].includes(errorCode(error))
        )
          throw error;
      }
    }
    const data = await request<MonitoringSummary>(
      "GET",
      "/monitoring/summary",
      undefined,
      common.value,
    );
    return { ...data, utcDays: true };
  },
  enabled: validRange,
  refetchInterval: 30000,
});
const health = useQuery({
  queryKey: ["monitoring-health"],
  queryFn: () => request<MonitoringHealth>("GET", "/monitoring/health"),
  refetchInterval: 30000,
});
// Search terms can be phone numbers: they go in the request body, not in the URL.
const runs = useQuery({
  queryKey: ["runs", runFilters],
  queryFn: () =>
    runFilters.value.query
      ? request<{ items: Run[]; has_more: boolean }>(
          "POST",
          "/runs/search",
          runFilters.value,
        )
      : request<{ items: Run[]; has_more: boolean }>(
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
  ...(catalog.data.value?.sip_lab_enabled ||
  providerFilter.value.some((o) => o.id === "grok")
    ? [{ id: "grok", label: "Grok" }]
    : []),
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
}
function resetRunFilters() {
  search.value = "";
  debouncedSearch.value = "";
  outcomeFilter.value = [];
}

const outcomeCount = (value: string) =>
  Number(
    summary.data.value?.outcomes?.find((o) => o.outcome === value)?.count || 0,
  );
function share(count: number) {
  const total = summary.data.value?.coverage.total_runs || 0;
  return total
    ? t("monitoringPage.shareOfCalls", {
        percent: formatPercent(count, total, lang.value),
      })
    : "";
}
const kpis = computed(() => {
  const coverage = summary.data.value?.coverage;
  if (!coverage) return [];
  const completed = outcomeCount("completed");
  const transferred = outcomeCount("transferred");
  const failures = outcomeCount("fallback") + outcomeCount("failed");
  return [
    {
      id: "total",
      label: t("monitoringPage.calls"),
      value: coverage.total_runs,
      icon: faPhone,
      note: "",
    },
    {
      id: "completed",
      label: t("monitoringPage.completed"),
      value: completed,
      icon: faCircleCheck,
      note: share(completed),
    },
    {
      id: "transferred",
      label: t("monitoringPage.transferred"),
      value: transferred,
      icon: faArrowRightArrowLeft,
      note: share(transferred),
    },
    {
      id: "failures",
      label: t("monitoringPage.fallbacksFailures"),
      value: failures,
      icon: faTriangleExclamation,
      note: share(failures),
    },
  ].map((kpi) => ({ ...kpi, value: formatNumber(kpi.value, lang.value) }));
});
const performance = computed(() =>
  (
    [
      ["run_duration", faStopwatch],
      ["setup_duration", faPlug],
      ["first_output", faVolumeHigh],
    ] as const
  ).map(([metric, icon]) => {
    const value = summary.data.value?.latencies?.[metric];
    const samples = value?.samples || 0;
    return {
      id: metric,
      label: t("monitoringPage.metrics." + metric),
      value: duration(value?.p95_ms, lang.value),
      icon,
      note: t("monitoringPage.measuredCalls", { count: samples }, samples),
      tooltip:
        metric === "first_output" ? t("monitoringPage.firstAnswerHelp") : "",
    };
  }),
);
const dayColumns = [
  "completed",
  "transferred",
  "fallback",
  "failed",
  "interrupted",
  "ended_by_agent",
];
const days = computed(() => {
  const rows = new Map<string, Record<string, number> & { total: number }>();
  for (const item of summary.data.value?.trends || []) {
    const row = rows.get(item.day) || { total: 0 };
    row.total += Number(item.count);
    row[item.outcome] = (row[item.outcome] || 0) + Number(item.count);
    rows.set(item.day, row);
  }
  return [...rows.entries()].map(([day, row]) => ({
    day,
    label: formatDay(
      day,
      lang.value,
      summary.data.value?.resolution === "month",
    ),
    row,
  }));
});
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
      p50: duration(reference.p50_ms, lang.value),
      p95: duration(reference.p95_ms, lang.value),
    };
  });
}
const tablePageSize = 5;
const tablePages = ref<Record<string, number>>({ phases: 1, tools: 1 });
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
watch(performanceTables, (tables) => {
  for (const table of tables) {
    const last = Math.max(1, Math.ceil(table.rows.length / tablePageSize));
    if ((tablePages.value[table.id] || 1) > last)
      tablePages.value[table.id] = last;
  }
});
function pageRows<T>(id: string, rows: T[]) {
  const current = tablePages.value[id] || 1;
  return rows.slice((current - 1) * tablePageSize, current * tablePageSize);
}
const delivery = computed(() => {
  const value = health.data.value;
  if (!value || value.stale) return [];
  const warn = (n?: number) => (n ? "fallback" : "");
  const count = (n?: number) => (n == null ? "—" : formatNumber(n, lang.value));
  const coverage = summary.data.value?.coverage;
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
      value: count(value.active_calls),
      status: "",
    },
    {
      id: "pending",
      label: t("monitoring.healthKeys.queue_depth"),
      value: count(value.queue_depth),
      status: warn(value.queue_depth),
    },
    {
      id: "oldest",
      label: t("monitoring.healthKeys.oldest_pending_seconds"),
      value:
        value.oldest_pending_seconds == null
          ? "—"
          : count(value.oldest_pending_seconds) + " s",
      status: warn(value.oldest_pending_seconds),
    },
    {
      id: "dropped",
      label: t("monitoring.healthKeys.dropped"),
      value: count(value.dropped),
      status: warn(value.dropped),
    },
    {
      id: "retries",
      label: t("monitoring.healthKeys.retries"),
      value: count(value.retries),
      status: warn(value.retries),
    },
    {
      id: "signatures",
      label: t("invalidSignatures"),
      value: count(value.invalid_webhook_signatures),
      status: warn(value.invalid_webhook_signatures),
    },
    ...(coverage
      ? [
          {
            id: "partial",
            label: t("monitoringPage.partialCalls"),
            value: count(coverage.partial_runs),
            status: warn(coverage.partial_runs),
          },
          {
            id: "unfinished",
            label: t("monitoringPage.unfinishedCalls"),
            value: count(coverage.incomplete_runs),
            status: warn(coverage.incomplete_runs),
          },
        ]
      : []),
    {
      id: "last",
      label: t("monitoring.healthKeys.last_write_at"),
      value: value.last_write_at
        ? formatDateTime(value.last_write_at, lang.value)
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
const diagnosticsOpen = ref(false);
async function showDiagnostics() {
  diagnosticsOpen.value = true;
  await nextTick();
  document
    .getElementById("diagnostics")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function reason(run: Run) {
  if (!run.error_code) return "";
  return (
    runErrorReason(run.error_code, t, te) || t("monitoring.runErrors.other")
  );
}
function refresh() {
  windowEnd.value = new Date();
  void summary.refetch();
  void health.refetch();
  void runs.refetch();
}
</script>
<template>
  <PageHeader
    :title="t('activity')"
    :description="t('monitoringPage.description')"
    ><NeButton
      kind="secondary"
      size="lg"
      :loading="summary.isFetching.value || runs.isFetching.value"
      @click="refresh"
      ><template #prefix
        ><FontAwesomeIcon :icon="faArrowsRotate" aria-hidden="true" /></template
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
      :label="t('monitoringPage.agent')"
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
    <NeButton
      kind="tertiary"
      :disabled="!pageFiltersChanged"
      @click="resetFilters"
      >{{ t("resetFilters") }}</NeButton
    >
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
        healthWarning
      "
      class="flex max-w-3xl flex-col gap-4"
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
        :title="
          loadError(summary.error.value, runs.error.value, health.error.value)
        "
      />
      <NeInlineNotification
        v-if="healthWarning"
        data-testid="monitoring-health-warning"
        kind="warning"
        :title="t('monitoringPage.attentionTitle')"
        :description="
          health.data.value?.stale
            ? t('monitoringPage.staleDescription')
            : t('monitoringPage.attentionDescription')
        "
        :primary-button-label="t('monitoringPage.showDiagnostics')"
        @primary-click="showDiagnostics"
      />
    </div>
    <NeSkeleton v-if="summary.isLoading.value" :lines="4" />
    <section
      v-if="kpis.length"
      :aria-label="t('monitoringPage.overview')"
      class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
    >
      <CounterCard
        v-for="kpi in kpis"
        :key="kpi.id"
        :title="kpi.label"
        :value="kpi.value"
        :icon="kpi.icon"
        :note="kpi.note"
        :testid="'monitoring-' + kpi.id"
      />
    </section>
    <section>
      <NeHeading tag="h5" class="mb-3">{{
        t("monitoringPage.calls")
      }}</NeHeading>
      <div class="mb-6 flex flex-wrap items-center gap-4">
        <NeTextInput
          v-model="search"
          data-testid="run-search"
          is-search
          :placeholder="t('monitoringPage.search')"
          :clear-search-label="t('clear')"
          class="w-full sm:w-80"
        />
        <NeDropdownFilterV2
          v-model="outcomeFilter"
          kind="checkbox"
          :label="t('monitoringPage.outcome')"
          :options="outcomeOptions"
          v-bind="filterLabels"
        />
        <NeButton
          kind="tertiary"
          :disabled="!search && !outcomeFilter.length"
          @click="resetRunFilters"
          >{{ t("resetFilters") }}</NeButton
        >
      </div>
      <AppEmptyState
        v-if="runs.isSuccess.value && !runs.data.value?.items?.length"
        :icon="faMagnifyingGlass"
        :title="t('monitoringPage.noCalls')"
        :description="t('noResultsHelp')"
        ><NeButton kind="tertiary" size="lg" @click="resetRunFilters">{{
          t("resetFilters")
        }}</NeButton></AppEmptyState
      >
      <NeTable
        v-else
        data-testid="calls-table"
        :aria-label="t('monitoringPage.calls')"
        :loading="runs.isLoading.value"
        :skeleton-columns="7"
        :skeleton-rows="5"
        card-breakpoint="xl"
      >
        <NeTableHead>
          <NeTableHeadCell class="whitespace-nowrap">{{
            t("monitoringPage.started")
          }}</NeTableHeadCell>
          <NeTableHeadCell class="whitespace-nowrap">{{
            t("monitoringPage.caller")
          }}</NeTableHeadCell>
          <NeTableHeadCell class="whitespace-nowrap">{{
            t("monitoringPage.calledNumber")
          }}</NeTableHeadCell>
          <NeTableHeadCell class="whitespace-nowrap">{{
            t("monitoringPage.agent")
          }}</NeTableHeadCell>
          <NeTableHeadCell class="whitespace-nowrap">{{
            t("monitoringPage.outcome")
          }}</NeTableHeadCell>
          <NeTableHeadCell class="whitespace-nowrap">{{
            t("monitoringPage.duration")
          }}</NeTableHeadCell>
          <NeTableHeadCell
            ><span class="sr-only">{{ t("actions") }}</span></NeTableHeadCell
          >
        </NeTableHead>
        <NeTableBody>
          <NeTableRow
            v-for="run in runs.data.value?.items || []"
            :key="run.run_id"
          >
            <NeTableCell :data-label="t('monitoringPage.started')"
              ><span class="whitespace-nowrap">{{
                formatDateTime(run.started_at, lang)
              }}</span></NeTableCell
            >
            <NeTableCell :data-label="t('monitoringPage.caller')"
              ><span class="whitespace-nowrap" data-testid="run-caller">{{
                phoneNumber(run.caller_number)
              }}</span></NeTableCell
            >
            <NeTableCell :data-label="t('monitoringPage.calledNumber')"
              ><span class="whitespace-nowrap" data-testid="run-called">{{
                phoneNumber(run.called_number)
              }}</span></NeTableCell
            >
            <NeTableCell :data-label="t('monitoringPage.agent')"
              ><span class="text-primary-neutral">{{
                run.agent_name || run.agent_id
              }}</span></NeTableCell
            >
            <NeTableCell :data-label="t('monitoringPage.outcome')"
              ><div class="flex flex-col items-start gap-1">
                <div class="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    :status="run.outcome"
                    class="whitespace-normal!"
                  /><NeBadgeV2 v-if="run.incomplete" kind="amber" size="xs">{{
                    t("monitoring.incomplete")
                  }}</NeBadgeV2>
                </div>
                <span v-if="run.error_code" class="text-tertiary-neutral">{{
                  reason(run)
                }}</span>
              </div></NeTableCell
            >
            <NeTableCell :data-label="t('monitoringPage.duration')"
              ><span class="whitespace-nowrap">{{
                duration(run.duration_ms, lang)
              }}</span></NeTableCell
            >
            <NeTableCell :data-label="t('actions')"
              ><div class="-ml-2.5 flex gap-2 xl:ml-0 xl:justify-end">
                <NeButton
                  kind="tertiary"
                  @click="router.push('/activity/' + run.run_id)"
                  ><template #prefix
                    ><FontAwesomeIcon
                      :icon="faEye"
                      class="size-4"
                      aria-hidden="true" /></template
                  >{{ t("details")
                  }}<span class="sr-only">
                    {{ formatDateTime(run.started_at, lang) }}</span
                  ></NeButton
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
                    class="ms-0 flex h-10 items-center justify-center rounded-s-lg border border-e-0 border-gray-300 bg-white px-4 leading-tight text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
                    :disabled="page === 1"
                    @click="page--"
                  >
                    <span class="sr-only">{{ t("previousPage") }}</span
                    ><FontAwesomeIcon
                      :icon="faChevronLeft"
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
                    class="flex h-10 items-center justify-center rounded-e-lg border border-s-0 border-gray-300 bg-white px-4 leading-tight text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
                    :disabled="!runs.data.value?.has_more"
                    @click="page++"
                  >
                    <span class="sr-only">{{ t("nextPage") }}</span
                    ><FontAwesomeIcon
                      :icon="faChevronRight"
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
    <section v-if="summary.data.value?.coverage" data-testid="daily-outcomes">
      <NeHeading tag="h5" :class="summary.data.value.utcDays ? '' : 'mb-3'">{{
        t("monitoringPage.daily")
      }}</NeHeading>
      <p
        v-if="summary.data.value.utcDays"
        class="text-muted mt-1 mb-3 max-w-2xl"
      >
        {{ t("monitoringPage.dailyUtc") }}
      </p>
      <AppEmptyState v-if="!days.length" :title="t('noResults')" />
      <NeTable
        v-else
        :aria-label="t('monitoringPage.daily')"
        card-breakpoint="xl"
      >
        <NeTableHead>
          <NeTableHeadCell class="whitespace-nowrap">{{
            t("monitoringPage.date")
          }}</NeTableHeadCell>
          <NeTableHeadCell class="whitespace-nowrap">{{
            t("monitoringPage.calls")
          }}</NeTableHeadCell>
          <NeTableHeadCell v-for="column in dayColumns" :key="column">{{
            t("monitoring.columns." + column)
          }}</NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="day in days" :key="day.day">
            <NeTableCell :data-label="t('monitoringPage.date')"
              ><span class="text-primary-neutral whitespace-nowrap">{{
                day.label
              }}</span></NeTableCell
            >
            <NeTableCell :data-label="t('monitoringPage.calls')">{{
              formatNumber(day.row.total, lang)
            }}</NeTableCell>
            <NeTableCell
              v-for="column in dayColumns"
              :key="column"
              :data-label="t('monitoring.columns.' + column)"
              >{{ formatNumber(day.row[column] || 0, lang) }}</NeTableCell
            >
          </NeTableRow>
        </NeTableBody>
      </NeTable>
    </section>
    <section id="diagnostics" class="scroll-mt-20" data-testid="diagnostics">
      <NeExpandable
        :label="t('monitoringPage.diagnostics')"
        :is-expanded="diagnosticsOpen"
        @set-expanded="diagnosticsOpen = $event"
      >
        <div class="mt-6 flex flex-col gap-12">
          <NeCard
            :title="t('monitoring.delivery')"
            :description="t('monitoringPage.deliveryDescription')"
          >
            <p v-if="!delivery.length" class="text-muted">
              {{ t("monitoringPage.healthUnavailable") }}
            </p>
            <dl
              v-else
              class="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4"
            >
              <div
                v-for="item in delivery"
                :key="item.id"
                class="flex flex-col gap-1"
              >
                <dt class="text-tertiary-neutral text-sm">{{ item.label }}</dt>
                <dd class="text-primary-neutral flex items-center gap-2">
                  <StatusBadge
                    v-if="item.status"
                    :status="item.status"
                    :label="item.value"
                  /><template v-else>{{ item.value }}</template>
                </dd>
              </div>
            </dl>
          </NeCard>
          <template v-if="summary.data.value?.coverage">
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
            <div class="grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <section
                v-for="table in performanceTables"
                :key="table.id"
                class="min-w-0"
              >
                <NeHeading tag="h5" class="mb-3">{{ table.title }}</NeHeading>
                <AppEmptyState
                  v-if="!table.rows.length"
                  :title="t('noResults')"
                />
                <NeTable v-else :aria-label="table.title" card-breakpoint="xl">
                  <NeTableHead>
                    <NeTableHeadCell class="whitespace-nowrap">{{
                      t("name")
                    }}</NeTableHeadCell>
                    <NeTableHeadCell class="whitespace-nowrap">{{
                      table.countLabel
                    }}</NeTableHeadCell>
                    <NeTableHeadCell class="whitespace-nowrap">{{
                      t("monitoring.columns.failed")
                    }}</NeTableHeadCell>
                    <NeTableHeadCell>p50</NeTableHeadCell>
                    <NeTableHeadCell>p95</NeTableHeadCell>
                  </NeTableHead>
                  <NeTableBody>
                    <NeTableRow
                      v-for="row in pageRows(table.id, table.rows)"
                      :key="row.id"
                    >
                      <NeTableCell :data-label="t('name')"
                        ><span class="text-primary-neutral">{{
                          row.name
                        }}</span></NeTableCell
                      >
                      <NeTableCell :data-label="table.countLabel">{{
                        formatNumber(row.count, lang)
                      }}</NeTableCell>
                      <NeTableCell :data-label="t('monitoring.columns.failed')"
                        ><StatusBadge
                          v-if="row.failed"
                          status="failed"
                          :label="formatNumber(row.failed, lang)"
                        /><template v-else>0</template></NeTableCell
                      >
                      <NeTableCell data-label="p50">{{ row.p50 }}</NeTableCell>
                      <NeTableCell data-label="p95">{{ row.p95 }}</NeTableCell>
                    </NeTableRow>
                  </NeTableBody>
                  <template v-if="table.rows.length > tablePageSize" #paginator>
                    <NePaginator
                      :current-page="tablePages[table.id] || 1"
                      :total-rows="table.rows.length"
                      :page-size="tablePageSize"
                      :page-sizes="[tablePageSize]"
                      v-bind="paginatorLabels"
                      @select-page="tablePages[table.id] = $event"
                    />
                  </template>
                </NeTable>
              </section>
            </div>
          </template>
        </div>
      </NeExpandable>
    </section>
  </div>
</template>
