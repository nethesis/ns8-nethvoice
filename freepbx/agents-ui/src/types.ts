export type JsonObject = Record<string, unknown>;
export interface Draft {
  contract_version?: number;
  provider_binding_id: string | null;
  conversation: {
    model: string | null;
    options: Record<string, string | number> | null;
    language: string;
    voice: string;
    greeting: string;
    instructions: string;
  };
  tool_bindings: ToolBinding[];
  fallback_destination_id: string | null;
  max_call_duration_seconds: number;
  debug: { transcription_enabled: boolean; retention_hours: number };
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
  draft_version: number;
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
  draft_defaults: Draft;
  extensions: { id: string; name: string }[];
  providers: string[];
  default_language: string;
  languages: { id: string; label: string }[];
  provider_credentials: Record<string, { environment_available: boolean }>;
}
export interface ModelField {
  type: "string" | "integer";
  title: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  "x-control"?: "textarea";
}
export interface ConversationModel {
  id: string;
  label: string;
  adapter: "realtime" | "live" | "grok";
  status: "supported" | "experimental";
  voices: { id: string; label: string }[];
  voice_source?: "provider_api";
  options_schema: {
    type: "object" | "null";
    properties?: Record<string, ModelField>;
  };
  defaults: Record<string, string | number> | null;
}
export interface ModelCatalog {
  items: ConversationModel[];
  backend_models: { id: string; label: string }[];
  source:
    | "provider_api"
    | "cached_provider_api"
    | "adapter_catalog"
    | "provider_managed";
  selection: "selectable" | "provider_managed";
  default_model: string;
  discovery_error?: string;
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
    result_count?: number | null;
  }[];
  transcripts?: {
    role: "caller" | "assistant";
    text: string;
    occurred_at: string;
    interrupted: boolean;
    truncated: boolean;
  }[];
}

export interface ConfigurationField {
  type: "integer" | "array" | "boolean";
  title: string;
  minimum?: number;
  maximum?: number;
  "x-inventory"?: "extensions" | "queues" | "ivrs";
  "x-control"?: "destination-descriptions" | "destination-list";
}
export interface ToolDefinition {
  id: string;
  version: number;
  name: string;
  description: string;
  editor?: {
    automatic?: boolean;
    descriptions_field?: string;
    categories?: {
      enabled_field: string;
      destinations_field: string;
      inventory: string;
      selection: "allowlist" | "denylist";
    }[];
  };
  defaults: Record<string, ConfigurationValue>;
  configuration_schema: { properties: Record<string, ConfigurationField> };
}
export interface ToolBinding {
  tool_id: string;
  tool_version: number;
  enabled: boolean;
  config: Record<string, ConfigurationValue>;
}

export interface DescriptionOverride {
  destination_id: string;
  description: string;
}
export type ConfigurationValue =
  number | boolean | string[] | DescriptionOverride[];
export interface DestinationPage {
  items: {
    id: string;
    type: string;
    name: string;
    description: string;
    available: boolean;
    permitted: boolean;
  }[];
  next_offset: number | null;
  total: number;
  modules: Record<string, boolean>;
  unavailable_ids: string[];
}
