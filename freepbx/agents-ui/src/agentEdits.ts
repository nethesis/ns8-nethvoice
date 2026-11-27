import type { Agent } from "./types";

export type AgentEdits = Pick<Agent, "name" | "draft">;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function merge(original: unknown, edited: unknown, latest: unknown): unknown {
  if (JSON.stringify(original) === JSON.stringify(edited)) return latest;
  if (isObject(original) && isObject(edited) && isObject(latest)) {
    return Object.fromEntries(
      [...new Set([...Object.keys(edited), ...Object.keys(latest)])]
        .filter(
          (key) => Object.hasOwn(edited, key) || !Object.hasOwn(original, key),
        )
        .map((key) => [key, merge(original[key], edited[key], latest[key])]),
    );
  }
  // Tool bindings have stable IDs. Keep remote edits to unrelated tool settings.
  if (
    Array.isArray(original) &&
    Array.isArray(edited) &&
    Array.isArray(latest)
  ) {
    const ids = (items: unknown[]) =>
      items.map((item) => (isObject(item) ? item.tool_id : undefined));
    const keys = ids(original);
    if (
      keys.every((id) => typeof id === "string") &&
      JSON.stringify(keys) === JSON.stringify(ids(edited)) &&
      JSON.stringify(keys) === JSON.stringify(ids(latest))
    ) {
      return edited.map((value, index) =>
        merge(original[index], value, latest[index]),
      );
    }
  }
  return edited;
}

export function mergeAgentEdits(
  original: AgentEdits,
  edited: AgentEdits,
  latest: AgentEdits,
): AgentEdits {
  const result = merge(original, edited, latest) as AgentEdits;
  const draft = {
    ...result.draft,
    fallback_destination_id: latest.draft.fallback_destination_id,
  };
  if (
    "conversation" in original.draft &&
    "conversation" in edited.draft &&
    "conversation" in latest.draft &&
    "conversation" in draft
  ) {
    const voiceSettings = (value: typeof draft) => ({
      trunk: value.provider_binding_id,
      model: value.conversation.model,
      voice: value.conversation.voice,
      options: value.conversation.options,
    });
    const before = voiceSettings(original.draft);
    const local = voiceSettings(edited.draft);
    const remote = voiceSettings(latest.draft);
    const identityChanged =
      before.trunk !== remote.trunk ||
      before.model !== remote.model ||
      before.trunk !== local.trunk ||
      before.model !== local.model;
    if (identityChanged && JSON.stringify(local) !== JSON.stringify(before)) {
      // The selection and its options must still describe the same provider model.
      draft.provider_binding_id = local.trunk;
      Object.assign(draft.conversation, {
        model: local.model,
        voice: local.voice,
        options: local.options,
      });
    }
  }
  return { ...result, draft };
}
