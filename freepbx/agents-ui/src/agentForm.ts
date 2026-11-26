import type {
  Agent,
  Catalog,
  CleverAiConfiguration,
  Draft,
  ToolBinding,
} from "./types";

export type AgentType = "basic_voice" | "consultation" | "cleverai";
export type Step = "general" | "conversation" | "tools";
export type FieldErrors = Record<string, string>;

// Steps of the Create agent drawer, by agent type.
export function stepsFor(type: string): Step[] {
  if (type === "cleverai") return ["general"];
  if (type === "consultation") return ["general", "conversation"];
  return ["general", "conversation", "tools"];
}

// Where each form field lives: its create step and its edit page section.
const fieldSteps: Record<string, Step> = {
  name: "general",
  trunk: "general",
  language: "general",
  duration: "general",
  model: "conversation",
  voice: "conversation",
  greeting: "conversation",
  instructions: "conversation",
  chat_model: "conversation",
  backend_model: "conversation",
  backend_instructions: "conversation",
  reasoning_effort: "conversation",
  verbosity: "conversation",
  service_tier: "conversation",
  max_output_tokens: "conversation",
  destinations: "tools",
  consultation: "tools",
  lookback: "tools",
  goodbye: "tools",
};
// GPT-Live settings, in the order of the page.
export const advancedFields = [
  "backend_model",
  "reasoning_effort",
  "verbosity",
  "service_tier",
  "max_output_tokens",
  "backend_instructions",
];
// Order of the fields in the page, to find the first invalid one.
export const fieldOrder = [
  "name",
  "trunk",
  "language",
  "duration",
  "model",
  ...advancedFields,
  "voice",
  "greeting",
  "instructions",
  "chat_model",
  "destinations",
  "consultation",
  "lookback",
  "goodbye",
  "retention",
];

export function stepOf(field: string): Step | undefined {
  return fieldSteps[field];
}

export function firstInvalid(errors: FieldErrors): string | undefined {
  return (
    fieldOrder.find((key) => errors[key]) ||
    Object.keys(errors).find((key) => errors[key])
  );
}

// Maps the `field` of a REST validation error to the form field showing it.
export function formField(field: string | undefined): string | undefined {
  if (!field) return undefined;
  if (field === "name") return "name";
  const rules: [RegExp, string | ((match: RegExpMatchArray) => string)][] = [
    [/^draft\.provider_binding_id$/, "trunk"],
    [/^draft\.conversation\.language$/, "language"],
    [/^draft\.conversation\.model$/, "model"],
    [/^draft\.conversation\.voice$/, "voice"],
    [/^draft\.conversation\.greeting$/, "greeting"],
    [/^draft\.conversation\.instructions$/, "instructions"],
    [
      /^draft\.conversation\.options\.([a-z_]+)/,
      (match) => (advancedFields.includes(match[1]) ? match[1] : "model"),
    ],
    [/^draft\.conversation\.options$/, "model"],
    [/^draft\.max_call_duration_seconds$/, "duration"],
    [/^draft\.debug(\.|$)/, "retention"],
    [/^draft\.chat_model$/, "chat_model"],
    [/^draft\.consultation(\.|$)/, "consultation"],
    [/^draft\.tool_bindings(\.|$)/, "destinations"],
  ];
  for (const [pattern, target] of rules) {
    const match = field.match(pattern);
    if (match) return typeof target === "string" ? target : target(match);
  }
  return undefined;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function tool(draft: Draft, id: string): ToolBinding | undefined {
  return draft.tool_bindings.find((binding) => binding.tool_id === id);
}

// A new agent starts from the defaults of the catalog. Transfer starts off,
// so that the permitted destinations are an explicit choice.
export function newDraft(catalog: Catalog | undefined, type: string): Draft {
  const source =
    type === "consultation"
      ? catalog?.consultation_defaults
      : catalog?.draft_defaults;
  const draft: Draft = source
    ? clone(source)
    : {
        contract_version: 8,
        provider_binding_id: null,
        conversation: {
          language: "en",
          voice: "",
          greeting: "",
          instructions: "",
          model: null,
          options: null,
        },
        tool_bindings: [],
        fallback_destination_id: null,
        max_call_duration_seconds: type === "consultation" ? 60 : 600,
        debug: { transcription_enabled: false, retention_hours: 24 },
      };
  if (catalog?.default_language)
    draft.conversation.language = catalog.default_language;
  const transfer = tool(draft, "pbx.transfer");
  if (transfer && type !== "consultation") transfer.enabled = false;
  return draft;
}

export function newExternal(): CleverAiConfiguration {
  return {
    execution: "cleverai",
    provider_binding_id: null,
    fallback_destination_id: "hangup",
  };
}

const integer = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) && Number(value) >= min && Number(value) <= max;

export type Translate = (
  key: string,
  values?: Record<string, unknown>,
) => string;

/**
 * Client-side checks. A draft needs only the name and valid values; publishing
 * also needs what the agent uses to answer calls. Steps limit the check to
 * the fields of the given create steps.
 */
export function validateAgent(
  input: {
    type: string;
    name: string;
    draft: Draft;
    external: CleverAiConfiguration;
    assistants: { agent_id: string }[];
  },
  publishing: boolean,
  t: Translate,
  steps?: Step[],
): FieldErrors {
  const errors: FieldErrors = {};
  const { draft } = input;
  const external = input.type === "cleverai";
  if (!input.name.trim()) errors.name = t("agentEditor.errors.name");
  const binding = external
    ? input.external.provider_binding_id
    : draft.provider_binding_id;
  if ((publishing || external) && !binding)
    errors.trunk = t("agentEditor.errors.trunk");
  if (!external) {
    if (!integer(draft.max_call_duration_seconds, 30, 3600))
      errors.duration = t("agentEditor.errors.range", { min: 30, max: 3600 });
    const conversation = draft.conversation;
    if (publishing && binding && !conversation.model)
      errors.model = t("agentEditor.errors.model");
    if (publishing && binding && conversation.model && !conversation.voice)
      errors.voice = t("agentEditor.errors.voice");
    if (publishing && !conversation.instructions.trim())
      errors.instructions = t("agentEditor.errors.instructions");
    if (conversation.model === "gpt-live-1") {
      const options = conversation.options || {};
      if (!integer(options.max_output_tokens, 16, 8192))
        errors.max_output_tokens = t("agentEditor.errors.range", {
          min: 16,
          max: 8192,
        });
      if (!String(options.backend_instructions ?? "").trim())
        errors.backend_instructions = t(
          "agentEditor.errors.backendInstructions",
        );
    }
    if (
      draft.debug.transcription_enabled &&
      !integer(draft.debug.retention_hours, 1, 24)
    )
      errors.retention = t("agentEditor.errors.range", { min: 1, max: 24 });
    const transfer = tool(draft, "pbx.transfer");
    const hangup = tool(draft, "telephony.hangup");
    if (input.type === "basic_voice" && transfer?.enabled) {
      const config = transfer.config;
      const count = (key: string) =>
        Array.isArray(config[key]) ? (config[key] as unknown[]).length : 0;
      if (
        publishing &&
        !(config.queues_enabled === true && count("queue_allowlist")) &&
        !(config.extensions_enabled === true && count("extension_allowlist"))
      )
        errors.destinations = t("agentEditor.errors.destinations");
      if (
        config.recent_callers_enabled === true &&
        !integer(config.recent_caller_lookback_days, 1, 90)
      )
        errors.lookback = t("agentEditor.errors.range", { min: 1, max: 90 });
    }
    // The server rejects an attended transfer without an assistant even
    // in a draft, so this check applies to drafts too.
    const consultation = draft.consultation;
    if (input.type === "basic_voice" && consultation?.mode === "attended") {
      if (!consultation.assistant_id)
        errors.consultation = t("agentEditor.errors.assistant");
      else if (!consultation.phone && !consultation.chat)
        errors.consultation = t("agentEditor.errors.channels");
      else if (
        publishing &&
        !input.assistants.some((a) => a.agent_id === consultation.assistant_id)
      )
        errors.consultation = t("agentEditor.errors.assistantUnavailable");
    }
    if (
      input.type === "basic_voice" &&
      hangup?.enabled &&
      !integer(hangup.config.playback_timeout_seconds, 1, 10)
    )
      errors.goodbye = t("agentEditor.errors.range", { min: 1, max: 10 });
  }
  if (!steps) return errors;
  return Object.fromEntries(
    Object.entries(errors).filter(([key]) => {
      const step = stepOf(key);
      return !step || steps.includes(step);
    }),
  );
}

type Json = unknown;
const isObject = (value: Json): value is Record<string, Json> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const same = (a: Json, b: Json) => JSON.stringify(a) === JSON.stringify(b);
const keyed = (value: Json): value is { tool_id: string }[] =>
  Array.isArray(value) &&
  value.every((item) => isObject(item) && typeof item.tool_id === "string");

/**
 * Three-way merge used when the agent changed elsewhere: starting from the
 * version saved by someone else (`theirs`), apply only the values the user
 * changed (`mine` differs from `base`, the version the user opened). Tool
 * bindings are matched by tool ID; other lists are replaced as a whole.
 */
export function mergeChanges(base: Json, mine: Json, theirs: Json): Json {
  if (same(base, mine)) return clone(theirs);
  if (isObject(base) && isObject(mine) && isObject(theirs)) {
    const result: Record<string, Json> = {};
    for (const key of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      if (!(key in mine)) {
        if (!(key in base)) result[key] = clone(theirs[key]);
        continue;
      }
      result[key] =
        key in theirs
          ? mergeChanges(base[key], mine[key], theirs[key])
          : clone(mine[key]);
    }
    return result;
  }
  if (keyed(base) && keyed(mine) && keyed(theirs)) {
    const find = (list: { tool_id: string }[], id: string) =>
      list.find((item) => item.tool_id === id);
    const ids = [
      ...theirs.map((item) => item.tool_id),
      ...mine
        .map((item) => item.tool_id)
        .filter((id) => !find(theirs, id) && !find(base, id)),
    ];
    return ids
      .map((id) => {
        const mineItem = find(mine, id),
          theirsItem = find(theirs, id),
          baseItem = find(base, id);
        if (!mineItem) return baseItem ? undefined : clone(theirsItem);
        if (!theirsItem) return clone(mineItem);
        return mergeChanges(baseItem, mineItem, theirsItem);
      })
      .filter((item) => item !== undefined);
  }
  return clone(mine);
}

// Draft as the server last stored it, for the conflict merge.
export function savedState(agent: Agent) {
  return { name: agent.name, draft: clone(agent.draft) };
}
