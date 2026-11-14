<script setup lang="ts">
import { h } from "vue";
import { NAV_ICONS } from "../navIcons";
const props = defineProps<{ name: string }>();
const render = () =>
  h("span", { class: "nav-icon", innerHTML: NAV_ICONS[props.name] });
</script>
<template>
  <render aria-hidden="true" />
</template>
