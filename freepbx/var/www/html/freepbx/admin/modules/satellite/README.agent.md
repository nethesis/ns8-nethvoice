# Satellite Agent webhook contract

This document defines the MVP contract between the Satellite FreePBX module,
the Asterisk dialplan, the OpenAI Realtime SIP trunk, and the webhook/runtime
that accepts voice-bot calls.

The FreePBX module owns configuration, storage, destination exposure, dialplan
entrypoints, and runtime workflow export. The webhook/runtime owns OpenAI call
acceptance, session creation, tool execution, transfer behavior, monitoring,
and hangup decisions.

The FreePBX module must not read, write, render, return, log, or validate
`OPENAI_API_KEY`. The webhook/runtime must get that key from its own runtime
environment.

## Call path

```text
FreePBX destination: satellite-agent,<workflow_uuid>,1
        |
        v
Asterisk context: satellite-agent
        |
        v
Dial(PJSIP/${OPENAI_PROJECT_ID}@openai-realtime,60)
        |
        v
OpenAI Realtime SIP incoming call
        |
        v
OpenAI webhook/runtime
        |
        v
FreePBX runtime workflow export
        |
        v
OpenAI call accept using the entry agent node
```

The MVP requires an existing PJSIP trunk named `openai-realtime`. Automatic
trunk provisioning is outside this contract.

## Required SIP headers

The generated `satellite-agent` dialplan adds these headers to calls sent to
the `openai-realtime` trunk:

| Header | Required | Value |
| --- | --- | --- |
| `X-NethVoice-Agent-Workflow` | yes | Satellite Agent workflow UUID |
| `X-NethVoice-Uniqueid` | yes | Asterisk `${UNIQUEID}` |
| `X-NethVoice-Linkedid` | yes | Asterisk `${CHANNEL(linkedid)}` |
| `X-NethVoice-Caller` | yes | Asterisk `${CALLERID(num)}` |

Headers contain identifiers only. They must not contain API keys, bearer
tokens, passwords, prompt text, tool arguments, or node JSON.

The webhook/runtime must reject or safely decline calls that do not include a
valid `X-NethVoice-Agent-Workflow` value.

## Webhook input normalization

The OpenAI webhook adapter should normalize the incoming call event into a
runtime object with at least these fields:

```json
{
  "workflow_uuid": "123e4567-e89b-42d3-a456-426614174000",
  "asterisk_uniqueid": "1777907274.715",
  "asterisk_linkedid": "1777907274.715",
  "caller": "3400069069",
  "openai_call_id": "call_id_from_webhook"
}
```

`workflow_uuid` comes from `X-NethVoice-Agent-Workflow`. The other Asterisk
fields come from the matching `X-NethVoice-*` headers and are used for
correlation, logging, and monitoring.

## Runtime workflow export

The runtime can load one expanded workflow document by workflow UUID. The
internal PHP callable is:

```php
FreePBX::Satellite()->exportRuntimeWorkflow($workflowUuid);
```

The minimal AJAX management/runtime bridge is also available through the
FreePBX module AJAX dispatcher:

```text
ajax.php?module=satellite&command=agent&action=runtime-export&workflow_uuid=<workflow_uuid>
```

The webhook/runtime must not require FreePBX database write access. It should
call an authenticated internal export adapter or an equivalent trusted bridge
that invokes the callable above.

Successful export returns one expanded graph document:

```json
{
  "workflow_uuid": "123e4567-e89b-42d3-a456-426614174000",
  "name": "Receptionist",
  "entry_node_uuid": "123e4567-e89b-42d3-a456-426614174001",
  "graph": {
    "entry": "123e4567-e89b-42d3-a456-426614174001",
    "nodes": [
      "123e4567-e89b-42d3-a456-426614174001"
    ],
    "edges": []
  },
  "nodes": {
    "123e4567-e89b-42d3-a456-426614174001": {
      "uuid": "123e4567-e89b-42d3-a456-426614174001",
      "name": "Receptionist",
      "type": "agent",
      "version": 1,
      "json": {
        "type": "agent",
        "model": "gpt-realtime-2",
        "voice": "alloy",
        "instructions": "Answer in Italian. Be concise.",
        "behavior": {
          "first_message": "Buongiorno, come posso aiutarla?"
        },
        "tools": [
          "hangup_call"
        ]
      }
    }
  }
}
```

Export fails closed when the workflow is missing, disabled, has an entry-node
mismatch, references missing nodes, or references disabled nodes. The runtime
must treat export failures as non-recoverable for that call and decline or hang
up without exposing internal details to the caller.

The export document contains workflow/node configuration only. It must not
contain OpenAI credentials or other secrets.

## Call accept behavior

For each OpenAI `realtime.call.incoming` event, the webhook/runtime should:

1. Extract and validate `X-NethVoice-Agent-Workflow` from the SIP headers.
2. Load the expanded workflow export for that UUID.
3. Read `entry_node_uuid` and resolve it in the exported `nodes` object.
4. Require the entry node to be enabled by export validation and to have type
   `agent` for the MVP call-entry path.
5. Create or accept the OpenAI Realtime call using the entry agent node JSON:
   `model`, `voice`, `instructions`, optional `behavior`, and declared `tools`.
6. Apply `behavior.first_message` as the initial assistant message when it is
   present.
7. Keep Asterisk identifiers from the SIP headers attached to runtime logs,
   metrics, and call state for correlation.

If the entry node is not an `agent`, if required agent fields are missing, or
if the OpenAI call cannot be accepted, the runtime must safely decline or hang
up the call.

## Tool behavior boundary

The workflow export may declare these MVP tools on agent nodes:

```text
transfer_call
hangup_call
send_webhook_event
```

The FreePBX module stores and validates node configuration, but it does not
execute tools. The webhook/runtime is responsible for mapping model tool calls
to deterministic actions.

Transfer execution details are intentionally left to the transfer milestone.
Until that milestone is complete, the runtime should either reject
`transfer_call` tool calls or route them to a safe fallback prompt or hangup.

## Failure behavior

The runtime should fail closed in these cases:

- Missing or invalid `X-NethVoice-Agent-Workflow` header
- Workflow export fails
- Entry node is missing from the export
- Entry node type is not `agent`
- OpenAI call accept fails
- A requested tool is not declared by the active agent node

Failure logs may include workflow UUID, OpenAI call id, Asterisk uniqueid,
linkedid, and caller number. They must not include `OPENAI_API_KEY` or other
secrets.

## Security requirements

- `OPENAI_API_KEY` is owned by the webhook/runtime environment, not by the
  FreePBX module.
- The FreePBX module does not persist OpenAI credentials.
- SIP headers contain identifiers only.
- Runtime export is read-only from the webhook/runtime perspective.
- The webhook/runtime does not need FreePBX database write access.
- Invalid workflow or node state blocks call acceptance.
- Runtime logs must avoid prompt, credential, and tool-argument leakage unless
  explicitly required by a secured operator workflow.

## Manual contract check

1. Create an enabled agent node.
2. Create an enabled workflow whose graph entry is that node UUID.
3. Create an enabled Satellite Agent destination for the workflow.
4. Reload FreePBX and confirm `dialplan show satellite-agent` contains the
   workflow extension.
5. Place a call to the destination and verify the OpenAI webhook receives
   `X-NethVoice-Agent-Workflow`.
6. Export the workflow through the internal runtime export path.
7. Confirm the runtime can accept the call using the entry agent node.
8. Confirm no OpenAI API key appears in the dialplan, SIP headers, export
   document, or FreePBX logs.