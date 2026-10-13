import type { Graph, JsonObject, ToolBinding, WorkflowNode } from "./types";

export const objectSchema = () => ({
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
});
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const operationKey = (r: JsonObject) =>
  `${r.connector_id}.${r.operation_id}.v${r.version}`;
export const toolKey = (b: Pick<ToolBinding, "tool_id" | "version">) =>
  `tool.${b.tool_id}.v${b.version}`;
export function identifier(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `a-${base.slice(0, 36) || "agent"}-${crypto.randomUUID().slice(0, 6)}`;
}
export function upgrade(graph: Graph): Graph {
  return {
    ...clone(graph),
    schema_version: 2,
    tool_bindings: clone(graph.tool_bindings || []),
    goal: graph.goal || "",
    instructions: graph.instructions || "",
    capture_tool_content: graph.capture_tool_content || false,
  };
}
export function blankGraph(id: string, name: string, channel: string): Graph {
  return {
    schema_version: 2,
    agent_id: id,
    name,
    description: "",
    entrypoints: [channel],
    provider_binding_ref: null,
    fallback: null,
    input_schema: objectSchema(),
    output_schema: objectSchema(),
    permissions: {},
    tool_grants: [],
    tool_bindings: [],
    goal: "",
    instructions: "",
    limits: {
      max_steps: 100,
      max_duration_seconds: 300,
      max_context_bytes: 32768,
    },
    layout: {
      start: { x: 40, y: 170 },
      conversation: { x: 360, y: 170 },
      end: { x: 700, y: 90 },
      fallback: { x: 700, y: 320 },
    },
    nodes: [
      {
        id: "start",
        type: channel === "voice" ? "start.call" : "start.api",
        version: 1,
        name: "Start",
        config: {},
        inputs: {},
      },
      {
        id: "conversation",
        type: "conversation.collect",
        version: 1,
        name: "Conversation",
        config: {
          prompt:
            "Follow the agent goal and instructions. Select the appropriate exit outcome.",
          output_schema: objectSchema(),
          outcomes: ["resolved"],
          max_turns: 5,
          tool_mode: "inherit",
          tools: [],
        },
        inputs: {},
      },
      {
        id: "end",
        type: "end",
        version: 1,
        name: "End",
        config: { status: "completed" },
        inputs: {},
      },
      {
        id: "fallback",
        type: "end",
        version: 1,
        name: "Fallback",
        config: { status: "fallback" },
        inputs: {},
      },
    ],
    edges: [
      { source: "start", outcome: "success", target: "conversation" },
      { source: "conversation", outcome: "resolved", target: "end" },
      { source: "conversation", outcome: "error", target: "fallback" },
      { source: "conversation", outcome: "timeout", target: "fallback" },
    ],
  };
}
export function ports(node: WorkflowNode, blocks: JsonObject[]) {
  if (["conversation.collect", "conversation.decision"].includes(node.type))
    return [...(node.config.outcomes || []), "error", "timeout"];
  return blocks.find((block) => block.type === node.type)?.outcomes || [];
}
export function effectiveTools(graph: Graph, node: WorkflowNode) {
  const enabled = (graph.tool_bindings || [])
    .filter((b) => b.conversation)
    .map(toolKey);
  return node.config.tool_mode === "inherit"
    ? enabled
    : enabled.filter((id) => (node.config.tools || []).includes(id));
}
export function removeBinding(graph: Graph, key: string) {
  const updated = clone(graph);
  updated.tool_bindings = (updated.tool_bindings || []).filter(
    (binding) => toolKey(binding) !== key,
  );
  for (const node of updated.nodes)
    if (Array.isArray(node.config.tools))
      node.config.tools = node.config.tools.filter((id: string) => id !== key);
  // Explicit nodes remain visible, so the user can repair them and publication identifies the node.
  return updated;
}
export function graphErrors(graph: Graph, blocks: JsonObject[]) {
  const errors: string[] = [];
  const ids = new Set(graph.nodes.map((node) => node.id));
  const grants = new Set(
    (graph.tool_bindings || []).filter((b) => b.workflow).map(toolKey),
  );
  for (const node of graph.nodes)
    if (node.type === "tool.invoke" && !grants.has(toolKey(node.config.tool)))
      errors.push(node.id);
  for (const edge of graph.edges)
    if (
      !ids.has(edge.source) ||
      !ids.has(edge.target) ||
      !ports(
        graph.nodes.find((n) => n.id === edge.source)!,
        blocks,
      ).includes(edge.outcome)
    )
      errors.push(edge.source);
  return [...new Set(errors)];
}
export async function base64(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("upload_too_large");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
