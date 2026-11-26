<script setup lang="ts">
import { useId } from "vue";
import { NeButton, NeExpandable } from "@nethesis/vue-components";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
// Every collapsible of the app: NeExpandable with a trigger that tells
// screen readers whether the content is shown. Chevron down expands,
// chevron up collapses. `boxed` draws a border around the trigger and the
// content, for settings that belong to the field above.
defineProps<{ label: string; boxed?: boolean }>();
const expanded = defineModel<boolean>({ required: true });
const id = useId();
</script>
<template>
  <div :class="boxed ? 'border-line rounded-lg border px-4 py-3' : ''">
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
