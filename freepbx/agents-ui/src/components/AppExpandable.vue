<script setup lang="ts">
import { nextTick, ref, useId, watch } from "vue";
import { NeButton, NeExpandable } from "@nethesis/vue-components";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
// Every collapsible of the app: NeExpandable with a trigger that tells
// screen readers whether the content is shown. Chevron down expands,
// chevron up collapses. `reveal` scrolls the page to the content when it
// opens, for long sections at the bottom.
const props = defineProps<{ label: string; reveal?: boolean }>();
const expanded = defineModel<boolean>({ required: true });
const id = useId();
const root = ref<HTMLElement>();
watch(expanded, async (open) => {
  if (!open || !props.reveal) return;
  await nextTick();
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  root.value?.scrollIntoView({
    behavior: still ? "auto" : "smooth",
    block: "start",
  });
});
</script>
<template>
  <div ref="root" :class="reveal ? 'scroll-mt-20' : ''">
    <NeExpandable :is-expanded="expanded" @set-expanded="expanded = $event">
      <template #trigger>
        <NeButton
          kind="tertiary"
          size="sm"
          class="-ml-2 text-left"
          :aria-expanded="expanded ? 'true' : 'false'"
          :aria-controls="id"
          >{{ label
          }}<template #suffix
            ><FontAwesomeIcon
              :icon="expanded ? faChevronUp : faChevronDown"
              class="size-3"
              aria-hidden="true" /></template
        ></NeButton>
      </template>
      <div :id="id">
        <slot />
      </div>
    </NeExpandable>
  </div>
</template>
