import { computed, ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { useUi } from "../stores/ui";
export function useDraftGuard(value: () => unknown) {
  const baseline = ref(JSON.stringify(value()));
  const ui = useUi();
  const dirty = computed(() => JSON.stringify(value()) !== baseline.value);
  function saved() {
    baseline.value = JSON.stringify(value());
  }
  onBeforeRouteLeave(() => !dirty.value || ui.confirmLeave());
  return { dirty, saved };
}
