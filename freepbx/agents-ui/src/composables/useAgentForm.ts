import { computed, nextTick, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import axios from "axios";
import { errorCode } from "../api";
import {
  advancedFields,
  firstInvalid,
  formField,
  newDraft,
  newExternal,
  validateAgent,
  type FieldErrors,
  type Step,
} from "../agentForm";
import type { Agent, Catalog, CleverAiConfiguration, Draft } from "../types";

/** Form state shared by the Create agent drawer and the agent page. */
export function useAgentForm(catalog: Ref<Catalog | undefined>) {
  const { t, te } = useI18n();
  const name = ref("");
  const agentType = ref<string>("basic_voice");
  const draft = ref<Draft>(newDraft(undefined, "basic_voice"));
  const external = ref<CleverAiConfiguration>(newExternal());
  const errors = ref<FieldErrors>({});
  const advancedOpen = ref(false);
  const isExternal = computed(() => agentType.value === "cleverai");
  const configuration = computed(() =>
    isExternal.value ? external.value : draft.value,
  );
  const binding = computed(() => configuration.value.provider_binding_id);
  const snapshot = () =>
    JSON.stringify({ name: name.value, draft: configuration.value });
  const baseline = ref("");
  const dirty = computed(
    () => !!baseline.value && snapshot() !== baseline.value,
  );
  function markSaved() {
    baseline.value = snapshot();
  }
  function reset(type: string) {
    agentType.value = type;
    name.value = "";
    draft.value = newDraft(catalog.value, type);
    external.value = newExternal();
    errors.value = {};
    advancedOpen.value = false;
  }
  function load(agent: Agent) {
    name.value = agent.name;
    agentType.value = agent.agent_type || "basic_voice";
    if ("execution" in agent.draft)
      external.value = JSON.parse(JSON.stringify(agent.draft));
    else draft.value = JSON.parse(JSON.stringify(agent.draft));
    markSaved();
  }
  function validate(publishing: boolean, steps?: Step[]) {
    errors.value = validateAgent(
      {
        type: agentType.value,
        name: name.value,
        draft: draft.value,
        external: external.value,
        assistants: catalog.value?.consultation_assistants || [],
      },
      publishing,
      t,
      steps,
    );
    if (advancedFields.some((key) => errors.value[key]))
      advancedOpen.value = true;
    return !Object.keys(errors.value).length;
  }
  /**
   * Shows a REST validation error on its field. Returns the field, or
   * undefined when the error is not about a field of the form.
   */
  function serverError(error: unknown): string | undefined {
    if (!axios.isAxiosError(error)) return undefined;
    const field = formField(error.response?.data?.field);
    if (!field) return undefined;
    const code = errorCode(error);
    // A text for the error on this field, for the error, or the generic one.
    const key =
      [
        "agentEditor.fieldErrors." + code + "_" + field,
        "agentEditor.fieldErrors." + code,
        "error." + code,
      ].find((item) => te(item)) || "agentEditor.fieldErrors.invalid_field";
    errors.value = { ...errors.value, [field]: t(key) };
    if (advancedFields.includes(field)) advancedOpen.value = true;
    return field;
  }
  /** Text of an error that is not about a field. */
  function errorMessage(error: unknown) {
    const code = errorCode(error);
    const key = ["agentEditor.serverErrors." + code, "error." + code].find(
      (item) => te(item),
    );
    return t(key || "error.request_failed");
  }
  function clearError(key: string) {
    if (errors.value[key]) errors.value = { ...errors.value, [key]: "" };
  }
  /** Scrolls to the first invalid field inside `root` and focuses it. */
  async function focusFirstError(root?: HTMLElement | null) {
    const key = firstInvalid(errors.value);
    if (!key) return;
    await nextTick();
    const container = (root || document).querySelector<HTMLElement>(
      `[data-field="${key}"]`,
    );
    if (!container) return;
    container.scrollIntoView({ block: "center" });
    container
      .querySelector<HTMLElement>(
        "input:not([type=hidden]):not([disabled]), textarea, button:not([disabled])",
      )
      ?.focus({ preventScroll: true });
  }
  return {
    name,
    agentType,
    draft,
    external,
    errors,
    advancedOpen,
    isExternal,
    configuration,
    binding,
    snapshot,
    baseline,
    dirty,
    markSaved,
    reset,
    load,
    validate,
    serverError,
    errorMessage,
    clearError,
    focusFirstError,
  };
}
export type AgentForm = ReturnType<typeof useAgentForm>;
