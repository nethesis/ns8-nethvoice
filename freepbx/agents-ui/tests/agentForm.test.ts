import { describe, expect, it } from "vitest";
import {
  firstInvalid,
  formField,
  mergeChanges,
  newDraft,
  stepOf,
  stepsFor,
  validateAgent,
} from "../src/agentForm";
import type { Catalog, Draft } from "../src/types";

const t = (key: string, values?: Record<string, unknown>) =>
  key + (values ? JSON.stringify(values) : "");
const catalog = {
  default_language: "it",
  draft_defaults: {
    contract_version: 8,
    provider_binding_id: null,
    conversation: { language: "en", voice: "", greeting: "", instructions: "", model: null, options: null },
    tool_bindings: [
      { tool_id: "pbx.transfer", tool_version: 2, enabled: true, config: { queues_enabled: true, queue_allowlist: [], extensions_enabled: false, extension_allowlist: [], recent_callers_enabled: true, recent_caller_lookback_days: 7 } },
      { tool_id: "telephony.hangup", tool_version: 1, enabled: false, config: { playback_timeout_seconds: 5 } },
    ],
    fallback_destination_id: "hangup",
    max_call_duration_seconds: 600,
    debug: { transcription_enabled: false, retention_hours: 24 },
  },
} as unknown as Catalog;
const input = (draft: Draft, values: Record<string, unknown> = {}) => ({
  type: "basic_voice",
  name: "Front desk",
  draft,
  external: { execution: "cleverai" as const, provider_binding_id: null, fallback_destination_id: "hangup" },
  assistants: [],
  ...values,
});

describe("agent form", () => {
  it("has the steps of the prototype for each agent type", () => {
    expect(stepsFor("basic_voice")).toEqual(["general", "conversation", "tools"]);
    expect(stepsFor("consultation")).toEqual(["general", "conversation"]);
    expect(stepsFor("cleverai")).toEqual(["general"]);
    expect(stepOf("voice")).toBe("conversation");
    expect(stepOf("destinations")).toBe("tools");
  });

  it("starts new agents with transfer off and the PBX language", () => {
    const draft = newDraft(catalog, "basic_voice");
    expect(draft.conversation.language).toBe("it");
    expect(draft.tool_bindings[0].enabled).toBe(false);
  });

  it("maps the fields of REST validation errors to form fields", () => {
    expect(formField("name")).toBe("name");
    expect(formField("draft.provider_binding_id")).toBe("trunk");
    expect(formField("draft.conversation.language")).toBe("language");
    expect(formField("draft.conversation.options.max_output_tokens")).toBe("max_output_tokens");
    expect(formField("draft.conversation.options.unknown")).toBe("model");
    expect(formField("draft.max_call_duration_seconds")).toBe("duration");
    expect(formField("draft.debug.retention_hours")).toBe("retention");
    expect(formField("draft.consultation.assistant_id")).toBe("consultation");
    expect(formField("draft.tool_bindings")).toBe("destinations");
    // Not a field of the form: shown as a notice.
    expect(formField("draft")).toBeUndefined();
    expect(formField("draft.fallback_destination_id")).toBeUndefined();
    expect(formField(undefined)).toBeUndefined();
  });

  it("checks values for a draft and what the agent needs to publish", () => {
    const draft = newDraft(catalog, "basic_voice");
    expect(validateAgent(input(draft, { name: " " }), false, t)).toEqual({ name: "agentEditor.errors.name" });
    expect(Object.keys(validateAgent(input(draft), true, t))).toEqual(["trunk", "instructions"]);
    draft.provider_binding_id = "trunk";
    draft.conversation.model = "gpt-live-1";
    draft.conversation.options = { max_output_tokens: 8, backend_instructions: "" };
    draft.tool_bindings[0].enabled = true;
    const errors = validateAgent(input(draft), true, t);
    expect(Object.keys(errors)).toEqual(["voice", "instructions", "max_output_tokens", "backend_instructions", "destinations"]);
    expect(firstInvalid(errors)).toBe("max_output_tokens");
    // Next checks only the fields of its step.
    expect(Object.keys(validateAgent(input(draft), true, t, ["tools"]))).toEqual(["destinations"]);
  });

  it("requires an assistant and a channel for consultation, even in a draft", () => {
    const draft = newDraft(catalog, "basic_voice");
    draft.consultation = { mode: "attended", phone: true, chat: false, assistant_id: null };
    expect(validateAgent(input(draft), false, t).consultation).toBe("agentEditor.errors.assistant");
    draft.consultation = { mode: "attended", phone: false, chat: false, assistant_id: "a" };
    expect(validateAgent(input(draft), false, t).consultation).toBe("agentEditor.errors.channels");
    draft.consultation.phone = true;
    expect(validateAgent(input(draft), false, t).consultation).toBeUndefined();
    expect(validateAgent(input(draft), true, t).consultation).toBe("agentEditor.errors.assistantUnavailable");
    expect(validateAgent(input(draft, { assistants: [{ agent_id: "a" }] }), true, t).consultation).toBeUndefined();
  });

  it("merges only the changed values into the version saved elsewhere", () => {
    const base = { name: "A", draft: { conversation: { greeting: "Hi", instructions: "X" }, tool_bindings: [{ tool_id: "t1", enabled: false, config: { a: 1 } }, { tool_id: "t2", enabled: false }] } };
    const mine = { name: "A", draft: { conversation: { greeting: "Hi", instructions: "Mine" }, tool_bindings: [{ tool_id: "t1", enabled: true, config: { a: 1 } }, { tool_id: "t2", enabled: false }] } };
    const theirs = { name: "B", draft: { conversation: { greeting: "Theirs", instructions: "X" }, tool_bindings: [{ tool_id: "t1", enabled: false, config: { a: 2 } }, { tool_id: "t2", enabled: true }] } };
    expect(mergeChanges(base, mine, theirs)).toEqual({
      name: "B",
      draft: { conversation: { greeting: "Theirs", instructions: "Mine" }, tool_bindings: [{ tool_id: "t1", enabled: true, config: { a: 2 } }, { tool_id: "t2", enabled: true }] },
    });
    // The same value changed on both sides: this page wins.
    expect(mergeChanges({ v: 1 }, { v: 2 }, { v: 3 })).toEqual({ v: 2 });
    // Other lists are replaced as a whole.
    expect(mergeChanges({ l: [1] }, { l: [1, 2] }, { l: [3] })).toEqual({ l: [1, 2] });
  });
});
