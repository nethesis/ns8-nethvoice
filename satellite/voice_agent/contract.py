"""Validate and detach a pinned published configuration."""
import copy
import json
from pathlib import Path
from jsonschema import Draft202012Validator, validators

# PHP treats configuration integers strictly; JSON's 20.0 must not bypass it.
StrictValidator = validators.extend(Draft202012Validator, type_checker=
    Draft202012Validator.TYPE_CHECKER.redefine('integer', lambda checker, value: type(value) is int))

SCHEMA = json.loads(Path(__file__).with_name("published-v8.schema.json").read_text())
VALIDATOR = StrictValidator(SCHEMA)
VALIDATOR9 = StrictValidator(json.loads(Path(__file__).with_name('published-v9.schema.json').read_text()))
MAX_SNAPSHOT_BYTES = 64 * 1024


def validate_snapshot(snapshot: dict, *, project_legacy: bool = False) -> dict:
    """Keep the validated input form for downstream checks of its byte bound."""
    try:
        if not isinstance(snapshot, dict):
            raise ValueError("invalid_snapshot")
        for field in ("contract_version", "workflow_version", "max_call_duration_seconds"):
            if type(snapshot.get(field)) is not int:
                raise ValueError("invalid_snapshot")
        if len(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")).encode()) > MAX_SNAPSHOT_BYTES:
            raise ValueError("invalid_snapshot")
        version = snapshot.get('contract_version')
        if version not in (8, 9):
            raise ValueError("invalid_snapshot")
        snapshot = copy.deepcopy(snapshot)
        legacy_queue_configs = []
        bindings = snapshot.get('tool_bindings')
        if isinstance(bindings, list):
            for binding in bindings:
                if not isinstance(binding, dict) or binding.get('tool_id') != 'pbx.transfer':
                    continue
                config = binding.get('config')
                if isinstance(config, dict) and 'queue_denylist' in config and 'queue_allowlist' not in config:
                    # Both fields share the same value schema.
                    config['queue_allowlist'] = config.pop('queue_denylist')
                    legacy_queue_configs.append(config)
        if not (VALIDATOR9 if version == 9 else VALIDATOR).is_valid(snapshot):
            raise ValueError("invalid_snapshot")
        if version == 9:
            config = snapshot['consultation']
            if snapshot['role'] == 'public' and snapshot['chat_model'] is not None:
                raise ValueError('invalid_snapshot')
            if snapshot['role'] == 'consultation':
                if (config != dict(mode='direct', phone=False, chat=False, assistant_id=None)
                        or snapshot['fallback_destination_id'] != 'hangup'
                        or any(b['enabled'] for b in snapshot['tool_bindings'])):
                    raise ValueError('invalid_snapshot')
            elif config['mode'] == 'attended':
                if not (config['phone'] or config['chat']) or not config['assistant_id'] or config['assistant_id'] == snapshot['agent_id']:
                    raise ValueError('invalid_snapshot')
            elif config['assistant_id'] is not None or config['phone'] or config['chat']:
                raise ValueError('invalid_snapshot')
        if snapshot["destination_id"] != "agent:" + snapshot["agent_id"]:
            raise ValueError("invalid_snapshot")
        if len({b['tool_id'] for b in bindings}) != len(bindings) or any(type(b['tool_version']) is not int for b in bindings):
            raise ValueError('invalid_snapshot')
        if snapshot['debug']['transcription_enabled'] and snapshot['provider'] != 'openai':
            raise ValueError('invalid_snapshot')
        from .models import conversation_capability
        conversation_capability(snapshot['provider'],snapshot['conversation'])
        for binding in snapshot['tool_bindings']:
            descriptions = binding['config'].get('descriptions', [])
            if len({d['destination_id'] for d in descriptions}) != len(descriptions):
                raise ValueError('invalid_snapshot')
        for config in legacy_queue_configs:
            if project_legacy:
                # A historical denylist cannot establish an explicit queue grant.
                config['queue_allowlist'] = []
            else:
                config['queue_denylist'] = config.pop('queue_allowlist')
        return snapshot
    except (TypeError, OverflowError, UnicodeError) as exc:
        raise ValueError("invalid_snapshot") from exc
