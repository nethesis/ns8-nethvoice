"""The environment-only retention knob survives restore without a UI/API field."""
import io
import json
from pathlib import Path
import runpy
from types import SimpleNamespace
from unittest.mock import patch


def test_restore_preserves_monitoring_retention():
    restored={}
    agent=SimpleNamespace(set_env=lambda name,value:restored.update({name:value}))
    request={'environment':{'VOICE_AGENT_MONITORING_RETENTION_DAYS':'120','UNRELATED_SECRET':'synthetic'}}
    source=Path(__file__).resolve().parents[2]/'imageroot/actions/restore-module/20copyenv'
    with patch.dict('sys.modules',{'agent':agent}),patch('sys.stdin',io.StringIO(json.dumps(request))):
        runpy.run_path(str(source))
    assert restored.get('VOICE_AGENT_MONITORING_RETENTION_DAYS')=='120'
    assert 'UNRELATED_SECRET' not in restored
