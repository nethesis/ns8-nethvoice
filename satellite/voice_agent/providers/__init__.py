"""Provider-specific protocols chosen from the pinned conversation configuration."""
from .realtime import OpenAIAdapter, GrokAdapter, ProviderError
from .webhook import verify_webhook

def create_adapter(binding):
    if binding["provider"] == "openai":
        if binding.get('adapter') in ('live', 'live_ws'):
            from .live_primary import OpenAILiveWebSocketSession
            return OpenAILiveWebSocketSession(binding)
        return OpenAIAdapter(binding)
    if binding["provider"] == "grok":
        return GrokAdapter(binding)
    raise ValueError("invalid_provider")
