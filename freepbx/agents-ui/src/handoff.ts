import { shallowRef } from "vue";

/**
 * A publication rejected in the Create agent drawer: the agent was saved as
 * a draft, and its page shows the error in context.
 */
export const publishHandoff = shallowRef<{
  agentId: string;
  error: unknown;
} | null>(null);
