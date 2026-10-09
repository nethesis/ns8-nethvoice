#!/usr/bin/env python3
"""Import a local viewer service-account key through the encrypted PBX API."""
import argparse
import json
from pathlib import Path
import re
import shlex
import subprocess

REMOTE = '''import json,os,sys,urllib.request,urllib.error
value=json.load(sys.stdin)
request=urllib.request.Request('http://127.0.0.1:'+os.environ['HTTP_PORT']+'/api/agent/v1/application/secrets',data=json.dumps(value).encode(),method='POST',headers={'Authorization':'Bearer '+os.environ['API_TOKEN'],'X-Agents-Actor':'sheets-key-import','Content-Type':'application/json'})
try:
    with urllib.request.urlopen(request,timeout=15) as response:
        print('Viewer credential encrypted and stored; HTTP '+str(response.status))
except urllib.error.HTTPError as error:
    print('Credential import rejected; HTTP '+str(error.code));sys.exit(1)
'''

# Check and store the private Sheets credential through the PBX gateway.
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host',required=True,help='NS8 SSH host, not the public PBX URL')
    parser.add_argument('--module',required=True)
    parser.add_argument('--key-file',type=Path,required=True)
    parser.add_argument('--secret-id',default='phase5-sheets')
    args=parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9.-]+',args.host) or not re.fullmatch(r'nethvoice[0-9]+',args.module) or not re.fullmatch(r'[a-z][a-z0-9_-]{0,47}',args.secret_id):
        parser.error('Invalid host, module or credential ID')
    try:
        if args.key_file.stat().st_size>8192:raise ValueError()
        key=json.loads(args.key_file.read_text())
        if key.get('type')!='service_account' or not all(isinstance(key.get(field),str) and key[field] for field in ['client_email','private_key','private_key_id','project_id']):raise ValueError()
        if key.get('token_uri')!='https://oauth2.googleapis.com/token':raise ValueError()
        compact=json.dumps(key,separators=(',',':'))
        if len(compact)>4096:raise ValueError()
    except (OSError,ValueError,TypeError,AttributeError):
        parser.error('Expected a service-account JSON key of at most 4096 compact characters')
    command='runagent -m '+shlex.quote(args.module)+' podman exec -i satellite python -c '+shlex.quote(REMOTE)
    subprocess.run(['ssh','-o','BatchMode=yes', 'root@'+args.host,command],input=json.dumps({'secret_id':args.secret_id,'value':compact}).encode(),check=True)

if __name__=='__main__':main()
