import type { Agent } from "./types";

export function agentStatus(agent: Agent): string {
  if (agent.agent_type === "cleverai")
    return agent.routable ? "ready" : "pending";
  if (!agent.workflow_version) return "draft";
  if (!agent.routable) return "pending";
  return agent.draft_version && agent.draft_version !== agent.workflow_version
    ? "modified"
    : "published";
}
