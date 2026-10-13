<script setup lang="ts">
import { ref, onMounted, onUpdated } from "vue";
import { NeTabs } from "@nethesis/vue-components";
const props = defineProps<{
  tabs: { name: string; label: string }[];
  selected: string;
  srTabsLabel: string;
  srSelectTabLabel?: string;
}>();
const emit = defineEmits<{ selectTab: [name: string] }>();
const root = ref<HTMLElement>();
// NeTabs currently renders clickable anchors without href or keyboard semantics.
// Add keyboard access in one shared wrapper while retaining the library's styles.
function sync() {
  root.value?.querySelector("nav")?.setAttribute("role", "tablist");
  root.value?.querySelectorAll("nav a").forEach((element, index) => {
    const selected = props.tabs[index]?.name === props.selected;
    element.setAttribute("role", "tab");
    element.setAttribute("tabindex", selected ? "0" : "-1");
    element.setAttribute("aria-selected", String(selected));
  });
}
function key(event: KeyboardEvent) {
  const links = Array.from(root.value!.querySelectorAll<HTMLElement>("nav a"));
  const index = links.indexOf(event.target as HTMLElement);
  if (index < 0) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    links[index]!.click();
    return;
  }
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? links.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + links.length) %
          links.length;
  links[next]!.click();
  links[next]!.focus();
}
onMounted(sync);
onUpdated(sync);
</script>
<template>
  <div ref="root" @keydown="key">
    <NeTabs
      :tabs="tabs"
      :selected="selected"
      :sr-tabs-label="srTabsLabel"
      :sr-select-tab-label="srSelectTabLabel || srTabsLabel"
      @select-tab="emit('selectTab', $event)"
    />
  </div>
</template>
