#!/usr/bin/env python3
"""Run via runagent on nethvoice57. Defaults to read-only aggregate inspection."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

CONFIG=['voice_agent_audit','voice_agent_drafts','voice_agent_versions','voice_agent_agents']
EVENTS=['voice_agent_transcripts','voice_agent_run_events','voice_agent_pending_calls','voice_agent_runs']
HELPER='/var/www/html/freepbx/rest/lib/agents/reset-development.php'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--apply',action='store_true',help='Clear the development agent data after protected backup and zero-call gates')
args=parser.parse_args()
if os.environ.get('MODULE_ID')!='nethvoice57' or os.environ.get('NETHVOICE_HOST')!='voice2.makako.sf.nethserver.net':
    raise SystemExit('development_target_mismatch')
os.umask(0o077)
state=Path(os.environ['AGENT_STATE_DIR'])

def run(command):
    result=subprocess.run(command,capture_output=True)
    if result.returncode:
        raise RuntimeError('development_reset_command_failed')
    return result.stdout

def zero_calls():
    result=run(['podman','exec','freepbx','asterisk','-rx','core show channels count']).decode()
    if not re.search(r'^0 active channels$',result,re.M) or not re.search(r'^0 active calls$',result,re.M):
        raise RuntimeError('zero_call_gate_failed')

try:
    inspection=json.loads(run(['podman','exec','freepbx','php',HELPER]))
    if not args.apply:
        print(json.dumps({'dry_run':True,**inspection}))
        raise SystemExit(0)
    zero_calls()
    backup=state/('agent-reset-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    backup.mkdir(mode=0o700,exist_ok=False)
    manifest={'target':'nethvoice57','before':inspection,'files':{},'images':{}}
    for name in ['freepbx','voice-agent','satellite']:
        manifest['images'][name]=run(['podman','inspect',name,'--format','{{.Image}}']).decode().strip()
    for name in ['environment','agent.env','passwords.env','voice-agent.env']:
        source=state/name
        if source.is_file():
            shutil.copyfile(source,backup/name)
            os.chmod(backup/name,0o600)
    for schema,tables in [('asterisk',CONFIG),('asteriskcdrdb',EVENTS)]:
        target=backup/(schema+'-agent-data.sql')
        with target.open('wb') as output:
            output.write(b'SET FOREIGN_KEY_CHECKS=0;\n')
            command=['podman','exec','mariadb','sh','-c',
                'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb-dump --single-transaction --no-create-info --skip-triggers --skip-comments --skip-add-locks --skip-lock-tables --complete-insert --hex-blob "$@"',
                'dump',schema,*tables]
            result=subprocess.run(command,stdout=output,stderr=subprocess.PIPE)
            if result.returncode: raise RuntimeError('agent_backup_failed')
            output.write(b'\nSET FOREIGN_KEY_CHECKS=1;\n')
    for name in ['freepbx','voice-agent']:
        unit=Path(os.environ['AGENT_INSTALL_DIR'])/'systemd/user'/(name+'.service')
        shutil.copyfile(unit,backup/unit.name)
        os.chmod(backup/unit.name,0o600)
        dropins=unit.with_name(unit.name+'.d')
        if dropins.is_dir(): shutil.copytree(dropins,backup/dropins.name)
    for file in backup.rglob('*'):
        if file.is_file():
            os.chmod(file,0o600)
            manifest['files'][str(file.relative_to(backup))]=hashlib.sha256(file.read_bytes()).hexdigest()
    (backup/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    for name,digest in manifest['files'].items():
        file=backup/name
        if file.stat().st_mode&0o077 or hashlib.sha256(file.read_bytes()).hexdigest()!=digest:
            raise RuntimeError('agent_backup_verification_failed')
    zero_calls()
    run(['systemctl','--user','stop','voice-agent.service'])
    if run(['systemctl','--user','show','voice-agent.service','-p','ActiveState','--value']).strip()!=b'inactive':
        raise RuntimeError('runner_not_stopped')
    zero_calls()
    outbox_backup=backup/'outbox'
    outbox_backup.mkdir(mode=0o700)
    copy_outbox="""from pathlib import Path
import os,re,shutil
for p in Path('/source').iterdir():
    if p.is_file() and re.fullmatch(r'[a-f0-9-]{36}\\.(json|tmp)',p.name):
        target=Path('/backup')/p.name
        shutil.copyfile(p,target);os.chmod(target,0o600)
"""
    # UID 0 is root only in this rootless maintenance container; it maps to the
    # module user, allowing a protected copy of the stopped runner's private data.
    run(['podman','run','--rm','--pull=never','--network=none','--user=0',
         '--volume=voice-agent-events:/source:ro,z','--volume='+str(outbox_backup)+':/backup:Z',
         '--entrypoint=python',manifest['images']['voice-agent'],'-c',copy_outbox])
    for file in outbox_backup.iterdir():
        if file.stat().st_mode&0o077: raise RuntimeError('outbox_backup_permissions')
        manifest['files'][str(file.relative_to(backup))]=hashlib.sha256(file.read_bytes()).hexdigest()
    (backup/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    cleared=json.loads(run(['podman','exec','--env','VOICE_AGENT_DEVELOPMENT_RESET=clear-development-agent-data:nethvoice57','freepbx','php',HELPER,'--clear']))
    outbox="""from pathlib import Path
import re
for p in Path('/var/lib/voice-agent').iterdir():
    if p.is_file() and re.fullmatch(r'[a-f0-9-]{36}\\.(json|tmp)',p.name): p.unlink()
"""
    run(['podman','run','--rm','--pull=never','--network=none','--user=65532:65532','--volume=voice-agent-events:/var/lib/voice-agent:Z','--entrypoint=python',manifest['images']['voice-agent'],'-c',outbox])
    run(['systemctl','--user','start','voice-agent.service'])
    zero_calls()
    print(json.dumps({'reset':cleared,'backup':str(backup),'backup_verified':True,'runner_started':True}))
except Exception:
    # Do not expose DB output, credentials or retained communications metadata.
    # Once stopped, keep the runner stopped on failure until recovery is reviewed.
    print(json.dumps({'error':'development_agent_reset_failed','backup':str(backup) if 'backup' in globals() else None}))
    raise SystemExit(1)
