<script setup lang="ts">
import { nextTick, ref, useId, watch } from "vue";
import { NeButton, NeExpandable } from "@nethesis/vue-components";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
// Every collapsible of the app: NeExpandable with a trigger that tells
// screen readers whether the content is shown. Chevron down expands,
// chevron up collapses. `boxed` draws a border around the trigger and the
// content, for settings that belong to the field above. `reveal` scrolls
// the page to the content when it opens, for long sections at the bottom.
const props = defineProps<{
  label: string;
  boxed?: boolean;
  reveal?: boolean;
}>();
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
  <div
    ref="root"
    :class="[
      boxed ? 'border-line rounded-lg border px-4 py-3' : '',
      reveal ? 'scroll-mt-20' : '',
    ]"
  >
    <NeExpandable
      :is-expanded="expanded"
      :full-width="boxed"
      @set-expanded="expanded = $event"
    >
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
      <div :id="id" :class="boxed ? 'border-divider border-t pt-6 pb-3' : ''">
        <slot />
      </div>
    </NeExpandable>
  </div>
</template>
