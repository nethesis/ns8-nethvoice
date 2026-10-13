// Runtime JSON schemas describe dynamic configuration. The executable graph stays typed.
export type JsonObject = Record<string, any>;
export interface Schema extends JsonObject {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  enum?: any[];
  items?: Schema;
}
export interface WorkflowNode {
  id: string;
  type: string;
  version: number;
  name: string;
  config: JsonObject;
  inputs: JsonObject;
}
export interface ToolBinding {
  tool_id: string;
  version: number;
  conversation: boolean;
  workflow: boolean;
  instructions: string;
  scope: { identity_field?: string; filters?: JsonObject };
  origins?: string[];
}
export interface Graph {
  schema_version: number;
  agent_id: string;
  name: string;
  description: string;
  entrypoints: string[];
  nodes: WorkflowNode[];
  edges: { source: string; outcome: string; target: string }[];
  input_schema: Schema;
  output_schema: Schema;
  layout: JsonObject;
  limits: JsonObject;
  permissions: Record<string, "allow" | "deny">;
  tool_grants: string[];
  tool_bindings?: ToolBinding[];
  provider_binding_ref: string | null;
  fallback: string | null;
  voice_settings?: JsonObject;
  text_provider?: { model: string; secret_ref: string };
  goal?: string;
  instructions?: string;
  capture_tool_content?: boolean;
}
export interface ToolDefinition {
  name: string;
  description: string;
  kind: "api" | "query" | "documents" | "telephony" | "subflow";
  input_schema: Schema;
  output_schema: Schema;
  config: JsonObject;
  execution_policy: "read_only" | "direct";
  timeout_seconds: number;
}
export interface Agent extends JsonObject {
  agent_id: string;
  name: string;
  kind: "builtin" | "agent" | "subflow" | "preset";
  status: string;
  entrypoints: string[];
  version: number;
  revision: number;
  enabled: boolean;
  draft?: Graph;
}
export interface Inventory extends JsonObject {
  agents: Agent[];
  definitions: JsonObject[];
  bindings: { id: string; name: string }[];
  blocks: JsonObject[];
  data_sources: JsonObject[];
  connector_operations: JsonObject[];
  tools: {
    tool_id: string;
    revision: number;
    published_version: number;
    draft: ToolDefinition;
  }[];
  tool_versions: {
    tool_id: string;
    version: number;
    definition: ToolDefinition;
    revoked: boolean;
  }[];
  dependencies: JsonObject[];
  routing_objects: JsonObject[];
}
