export type JsonObject = Record<string, unknown>;
export interface Draft {
  contract_version: 8;
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
export interface CleverAiConfiguration {
  execution: "cleverai";
  provider_binding_id: string | null;
  fallback_destination_id: string | null;
}
export interface Agent extends JsonObject {
  agent_type?: "basic_voice" | "cleverai";
  agent_id: string;
  name: string;
  kind: "builtin" | "custom";
  destination_id: string;
  enabled: boolean;
  revision: number;
  workflow_version: number | null;
  draft_version: number | null;
  sync_status: string;
  routable: boolean;
  draft: Draft | CleverAiConfiguration;
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
  monitoring_version: 2;
  provider?: string | null;
  adapter?: string | null;
  model?: string | null;
  duration_ms?: number | null;
  setup_duration_ms?: number | null;
  first_output_ms?: number | null;
  trace_status?: "recording" | "complete" | "partial";
  incomplete?: boolean;
  usage?: Record<string, number> | null;
  usage_complete?: boolean;
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
      fields?: string[];
      descriptions?: boolean;
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
    recent_callback_eligible?: boolean;
  }[];
  next_offset: number | null;
  total: number;
  modules: Record<string, boolean>;
  unavailable_ids: string[];
}

export interface TraceEvent extends JsonObject {
  event_id: string;
  event_type: string;
  occurred_at: string;
  error_code?: string | null;
  tool_id?: string | null;
  destination_id?: string | null;
  result_count?: number | null;
  span_id?: string | null;
  parent_span_id?: string | null;
  phase?: string | null;
  status?: string | null;
  elapsed_ms?: number | null;
  duration_ms?: number | null;
  http_status?: number | null;
  provider_code?: string | null;
}
export interface Histogram {
  samples: number;
  mean_ms: number | null;
  p50_ms: number | null;
  p95_ms: number | null;
  approximate: boolean;
}
export interface Performance extends Histogram {
  id: string;
  status: string;
  invocations?: number;
}
export interface MonitoringSummary {
  resolution?: "day" | "month";
  from: string;
  to: string;
  coverage: {
    total_runs: number;
    instrumented_runs: number;
    partial_runs: number;
    incomplete_runs: number;
  };
  outcomes: { outcome: string; count: number }[];
  trends: { day: string; outcome: string; count: number }[];
  latencies: Record<string, Histogram>;
  latency_trends?: (Histogram & { day: string; metric: string })[];
  phases: Performance[];
  tools: Performance[];
  errors: { phase: string; error_code: string; count: number }[];
}
export interface MonitoringHealth {
  active_calls?: number;
  spool_writable?: boolean;
  stale: boolean;
  observed_at: string | null;
  ari_connected?: boolean;
  degraded?: boolean;
  queue_depth?: number;
  oldest_pending_seconds?: number;
  dropped?: number;
  retries?: number;
  last_write_at?: string | null;
}
