<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  NeButton,
  NeTable,
  NeTableHead,
  NeTableHeadCell,
  NeTableBody,
  NeTableRow,
  NeTableCell,
  NePaginator,
  NeTextInput,
  NeDropdownFilterV2,
} from "@nethesis/vue-components";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import AppEmptyState from "./AppEmptyState.vue";
import type { JsonObject } from "../types";
type Option = { id: string; label: string };
const props = defineProps<{
  rows: JsonObject[];
  columns: { key: string; label: string }[];
  rowKey: string;
  loading?: boolean;
  searchKeys?: string[];
  filters?: { key: string; label: string; options: Option[] }[];
  searchPlaceholder?: string;
  ariaLabel?: string;
}>();
const { t } = useI18n();
const search = ref(""),
  page = ref(1),
  size = ref(10);
const selected = ref<Record<string, Option[]>>({});
const filtered = computed(() =>
  props.rows.filter(
    (row) =>
      (props.filters || []).every(
        (filter) =>
          !selected.value[filter.key]?.length ||
          selected.value[filter.key].some(
            (option) => option.id === String(row[filter.key] ?? ""),
          ),
      ) &&
      (props.searchKeys || ["name", props.rowKey]).some((key) =>
        String(row[key] || "")
          .toLocaleLowerCase()
          .includes(search.value.trim().toLocaleLowerCase()),
      ),
  ),
);
const visible = computed(() =>
  filtered.value.slice((page.value - 1) * size.value, page.value * size.value),
);
function reset() {
  search.value = "";
  selected.value = {};
}
watch(
  [search, selected, size],
  () => {
    page.value = 1;
  },
  { deep: true },
);
</script>
<template>
  <slot v-if="!loading && !rows.length" name="empty" />
  <template v-else>
    <div class="mb-6 flex flex-wrap items-center gap-4">
      <NeTextInput
        v-model="search"
        is-search
        :placeholder="searchPlaceholder || t('search')"
        :clear-search-label="t('clear')"
        class="max-w-48 sm:max-w-sm"
      />
      <NeDropdownFilterV2
        v-for="filter in filters || []"
        :key="filter.key"
        :model-value="selected[filter.key] || []"
        :options="filter.options"
        kind="checkbox"
        :label="filter.label"
        :no-options-label="t('noOptions')"
        :no-results-label="t('noResults')"
        :clear-filter-label="t('clearSelection')"
        :open-menu-aria-label="t('openFilter')"
        :more-options-hidden-label="t('moreOptions')"
        :clear-search-label="t('clear')"
        @update:model-value="selected[filter.key] = $event"
      />
      <NeButton kind="tertiary" @click="reset">{{
        t("resetFilters")
      }}</NeButton>
    </div>
    <AppEmptyState
      v-if="!loading && !filtered.length"
      :title="t('noResults')"
      :description="t('noResultsHelp')"
      :icon="faMagnifyingGlass"
      ><NeButton kind="tertiary" size="lg" @click="reset">{{
        t("resetFilters")
      }}</NeButton></AppEmptyState
    >
    <NeTable
      v-else
      :aria-label="ariaLabel"
      :loading="loading"
      :skeleton-columns="columns.length"
      :skeleton-rows="4"
      card-breakpoint="xl"
    >
      <NeTableHead
        ><NeTableHeadCell v-for="column in columns" :key="column.key">{{
          column.label
        }}</NeTableHeadCell></NeTableHead
      >
      <NeTableBody
        ><NeTableRow v-for="row in visible" :key="String(row[rowKey])">
          <NeTableCell
            v-for="column in columns"
            :key="column.key"
            :data-label="column.label || t('actions')"
            ><slot :name="column.key" :row="row">{{
              row[column.key]
            }}</slot></NeTableCell
          >
        </NeTableRow></NeTableBody
      >
      <template #paginator>
        <NePaginator
          :current-page="page"
          :page-size="size"
          :total-rows="filtered.length"
          :page-sizes="[5, 10, 25, 50, 100]"
          :previous-label="t('previousPage')"
          :next-label="t('nextPage')"
          :nav-pagination-label="t('pagination')"
          :page-size-label="t('pageSize')"
          :range-of-total-label="t('rangeOfTotal')"
          @select-page="page = $event"
          @select-page-size="size = $event"
        />
      </template>
    </NeTable>
  </template>
</template>
