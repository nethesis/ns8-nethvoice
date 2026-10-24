<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  NeTable,
  NeTableHead,
  NeTableHeadCell,
  NeTableBody,
  NeTableRow,
  NeTableCell,
  NePaginator,
  NeEmptyState,
  NeTextInput,
  NeSkeleton,
  NeDropdownFilterV2,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import type { JsonObject } from "../types";
const props = defineProps<{
  rows: JsonObject[];
  columns: { key: string; label: string }[];
  rowKey: string;
  loading?: boolean;
  searchKeys?: string[];
  filterKey?: string;
}>();
const { t } = useI18n();
const search = ref(""),
  page = ref(1),
  size = ref(10),
  sort = ref("name");
const filters = ref<{ id: string; label: string }[]>([]);
const filterOptions = computed(() =>
  [
    ...new Set(
      props.rows.map((r) => String(r[props.filterKey || "status"] || "")),
    ),
  ]
    .filter(Boolean)
    .map((id) => ({
      id,
      label: t("status." + id) === "status." + id ? id : t("status." + id),
    })),
);
const filtered = computed(() =>
  props.rows
    .filter(
      (row) =>
        (!filters.value.length ||
          filters.value.some(
            (f) => f.id === String(row[props.filterKey || "status"] || ""),
          )) &&
        (props.searchKeys || ["name", "description", props.rowKey]).some(
          (key) =>
            String(row[key] || "")
              .toLocaleLowerCase()
              .includes(search.value.toLocaleLowerCase()),
        ),
    )
    .sort((a, b) =>
      String(a[sort.value] || "").localeCompare(String(b[sort.value] || "")),
    ),
);
const visible = computed(() =>
  filtered.value.slice((page.value - 1) * size.value, page.value * size.value),
);
watch(
  [search, filters, size],
  () => {
    page.value = 1;
  },
  { deep: true },
);
</script>
<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-4">
      <NeTextInput
        v-model="search"
        :label="t('search')"
        class="w-full md:max-w-md"
      />
      <NeDropdownFilterV2
        v-if="filterOptions.length"
        v-model="filters"
        :options="filterOptions"
        kind="checkbox"
        :label="t('filters')"
        :no-options-label="t('noOptions')"
        :no-results-label="t('noResults')"
        :clear-filter-label="t('clear')"
        :open-menu-aria-label="t('filters')"
        :more-options-hidden-label="t('moreOptions')"
        :clear-search-label="t('clear')"
      />
    </div>
    <NeSkeleton v-if="loading" class="h-48 w-full" />
    <NeEmptyState v-else-if="!filtered.length" :title="t('noResults')"
      ><slot name="empty"
    /></NeEmptyState>
    <NeTable v-else>
      <NeTableHead
        ><NeTableHeadCell v-for="column in columns" :key="column.key"
          ><button class="font-medium" type="button" @click="sort = column.key">
            {{ column.label }}
          </button></NeTableHeadCell
        ></NeTableHead
      >
      <NeTableBody
        ><NeTableRow v-for="row in visible" :key="String(row[rowKey])">
          <NeTableCell v-for="column in columns" :key="column.key"
            ><slot :name="column.key" :row="row">{{
              row[column.key]
            }}</slot></NeTableCell
          >
        </NeTableRow></NeTableBody
      >
    </NeTable>
    <NePaginator
      v-if="filtered.length > 10"
      :current-page="page"
      :page-size="size"
      :total-rows="filtered.length"
      :previous-label="t('previous')"
      :next-label="t('next')"
      :nav-pagination-label="t('pagination')"
      :page-size-label="t('pageSize')"
      :range-of-total-label="t('rangeOfTotal')"
      @select-page="page = $event"
      @select-page-size="size = $event"
    />
  </div>
</template>
