import { describe, expect, it } from "vitest";
import { agentStatus } from "../src/agentStatus";
import type { Agent } from "../src/types";

const agent = (values: Partial<Agent>) =>
  ({
    agent_type: "basic_voice",
    workflow_version: 1,
    draft_version: 1,
    routable: true,
    enabled: true,
    sync_status: "synced",
    ...values,
  }) as Agent;

describe("agent status", () => {
  it("reports synchronization failures instead of pending", () => {
    expect(agentStatus(agent({ sync_status: "error", routable: false }))).toBe(
      "error",
    );
    expect(
      agentStatus(agent({ agent_type: "cleverai", sync_status: "error" })),
    ).toBe("error");
  });
  it("keeps the other states", () => {
    expect(agentStatus(agent({}))).toBe("published");
    expect(agentStatus(agent({ draft_version: 2 }))).toBe("modified");
    expect(agentStatus(agent({ routable: false, sync_status: "pending" }))).toBe(
      "pending",
    );
    expect(agentStatus(agent({ workflow_version: null }))).toBe("draft");
  });
});
