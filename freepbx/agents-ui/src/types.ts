export type JsonObject = Record<string, unknown>;
export interface Draft {
  provider_binding_id: string | null;
  conversation: {
    language: string;
    voice: string;
    greeting: string;
    instructions: string;
  };
  tool_bindings: ToolBinding[];
  fallback_destination_id: string | null;
  max_call_duration_seconds: number;
}
export interface Agent extends JsonObject {
  agent_id: string;
  name: string;
  kind: "builtin" | "custom";
  legacy?: boolean;
  destination_id: string;
  enabled: boolean;
  revision: number;
  workflow_version: number | null;
  sync_status: string;
  routable: boolean;
  draft: Draft;
  published: (Draft & { workflow_version: number }) | null;
}
export interface Trunk extends JsonObject {
  binding_id: string;
  name: string;
  provider: string;
  revision: number;
  sync_status: string;
  openai_project_id?: string;
  grok_phone_number?: string;
  sip_auth_mode?: string;
  sip_auth_username?: string;
  api_key_configured: boolean;
  api_key_source: "stored" | "environment" | "missing";
  webhook_secret_configured: boolean;
}
export interface Catalog {
  tools: ToolDefinition[];
  extensions: { id: string; name: string }[];
  providers: string[];
  default_language: string;
  languages: { id: string; label: string }[];
  provider_credentials: Record<string, { environment_available: boolean }>;
}
export interface Run extends JsonObject {
  run_id: string;
  agent_id: string;
  agent_name?: string;
  workflow_version: number;
  started_at: string;
  ended_at: string | null;
  outcome: string;
  error_code: string | null;
  events?: {
    event_id: string;
    event_type: string;
    occurred_at: string;
    error_code: string | null;
    tool_id?: string | null;
    destination_id?: string | null;
  }[];
}

export interface ConfigurationField {
  type: "integer" | "array";
  title: string;
  minimum?: number;
  maximum?: number;
  "x-inventory"?: "extensions";
}
export interface ToolDefinition {
  id: string;
  version: number;
  name: string;
  description: string;
  defaults: Record<string, number | string[]>;
  configuration_schema: { properties: Record<string, ConfigurationField> };
}
export interface ToolBinding {
  tool_id: string;
  tool_version: number;
  enabled: boolean;
  config: Record<string, number | string[]>;
}
