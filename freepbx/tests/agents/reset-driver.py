"""Development maintenance safety gates; no real Podman or NS8 operations."""
import contextlib
import io
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
from unittest.mock import patch

script=Path(__file__).resolve().parents[3]/'local_testing/reset-voice-agents.py'
with tempfile.TemporaryDirectory() as temporary:
    environment={'MODULE_ID':'nethvoice57','NETHVOICE_HOST':'voice2.makako.sf.nethserver.net',
                 'AGENT_STATE_DIR':temporary,'AGENT_INSTALL_DIR':temporary}
    calls=[]
    def execute(command,**kwargs):
        calls.append(command)
        if command[-1]=='/var/www/html/freepbx/rest/lib/agents/reset-development.php':
            return subprocess.CompletedProcess(command,0,json.dumps({'tables':{},'preserves_trunks':True}).encode(),b'')
        if command[-1]=='core show channels count':
            return subprocess.CompletedProcess(command,0,b'1 active channels\n1 active calls\n',b'')
        raise AssertionError('unexpected_mutation')
    def check(arguments):
        with patch.dict(os.environ,environment),patch.object(sys,'argv',[str(script),*arguments]),patch('subprocess.run',execute),contextlib.redirect_stdout(io.StringIO()) as output:
            try:runpy.run_path(str(script),run_name='__main__')
            except SystemExit as error:return error.code,output.getvalue()
        raise AssertionError('exit_required')
    status,output=check([])
    assert status==0 and json.loads(output)['dry_run']
    assert len(calls)==1
    calls.clear();status,output=check(['--apply'])
    assert status==1 and json.loads(output)['error']=='development_agent_reset_failed'
    assert len(calls)==2 and not list(Path(temporary).iterdir())
    calls.clear();environment['MODULE_ID']='unrelated-module'
    status,output=check(['--apply'])
    assert status=='development_target_mismatch' and not calls
print('Development reset driver is read-only by default and denies wrong targets/active calls')
