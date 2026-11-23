"""Versioned SIP adapter capabilities, separate from provider model availability."""
import json
from pathlib import Path

AGENT_CAPABILITIES = json.loads(Path(__file__).with_name('provider-models-v2.json').read_text())


def conversation_capability(provider, conversation):
    from .contract import StrictValidator
    if provider not in AGENT_CAPABILITIES or not isinstance(conversation, dict):
        raise ValueError('invalid_provider')
    item=next((x for x in AGENT_CAPABILITIES[provider]['models'] if x['id']==conversation.get('model')),None)
    if item is None:
        raise ValueError('invalid_provider_model')
    if 'options' not in conversation or not StrictValidator(item['options_schema']).is_valid(conversation['options']):
        raise ValueError('invalid_model_options')
    import re
    voice=conversation.get('voice')
    if not isinstance(voice,str) or not re.fullmatch(r'[a-z0-9_-]{1,128}',voice) or (item['voices'] and voice not in {v['id'] for v in item['voices']}):
        raise ValueError('invalid_voice')
    if item['id']=='gpt-live-1' and not conversation['options']['backend_instructions'].strip():
        raise ValueError('invalid_model_options')
    return item



def model_for_adapter(provider, profile, adapter):
    model = profile.get('model')
    item = next((item for item in AGENT_CAPABILITIES.get(provider, {}).get('models', [])
                 if item['id'] == model and item['adapter'] == adapter), None)
    if item is None:
        raise ValueError('invalid_provider_model')
    return model
