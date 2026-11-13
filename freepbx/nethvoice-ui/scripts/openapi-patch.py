#!/usr/bin/env python3
"""Apply schema patches to the legacy REST openapi.yaml (lossless PyYAML round trip).
stdin: YAML {schemas: {Name: schema}, operations: [{path, method, summary?, tag?, params?, request?, responses: {code: schema|null}, descriptions?: {code: text}}]}
"""
import sys, yaml
from pathlib import Path
import fcntl
SPEC=str(Path(__file__).resolve().parent.parent.parent / 'var/www/html/freepbx/rest/openapi.yaml')
_lock=open(Path(__file__).resolve().parent.parent / 'node_modules/.openapi-patch.lock','w'); fcntl.flock(_lock, fcntl.LOCK_EX)
patch=yaml.safe_load(sys.stdin)
doc=yaml.safe_load(open(SPEC))
comp=doc.setdefault('components',{}).setdefault('schemas',{})
for name,schema in (patch.get('schemas') or {}).items():
    comp[name]=schema
DESC={'200':'Successful response','201':'Created','204':'No content','400':'Bad request','401':'Invalid credentials','403':'Forbidden','404':'Not found','409':'Conflict','422':'Validation failed','500':'Internal server error'}
for op in patch.get('operations') or []:
    path=doc['paths'].setdefault(op['path'],{})
    m=op['method'].lower()
    o=path.get(m)
    if o is None:
        o={'summary':op.get('summary',''),'tags':[op.get('tag','Misc')],'responses':{}}
        oid=m+'_'+op['path'].strip('/').replace('/','_').replace('{','').replace('}','').replace('-','_')
        o['operationId']=oid
        path[m]=o
    if 'summary' in op: o['summary']=op['summary']
    if 'params' in op: o['parameters']=op['params']
    if 'security' in op: o['security']=op['security']
    if 'request' in op:
        if op['request'] is None: o.pop('requestBody',None)
        else:
            ct=op.get('request_content_type','application/json')
            o['requestBody']={'required':True,'content':{ct:{'schema':op['request']}}}
    for code,schema in (op.get('responses') or {}).items():
        code=str(code)
        r={'description':(op.get('descriptions') or {}).get(code) or (op.get('descriptions') or {}).get(int(code) if code.isdigit() else code) or DESC.get(code,'Response')}
        if schema is not None:
            ct=(op.get('response_content_types') or {}).get(code,'application/json')
            r['content']={ct:{'schema':schema}}
        o.setdefault('responses',{})[code]=r
open(SPEC,'w').write(yaml.dump(doc,sort_keys=False,default_flow_style=False,width=80,allow_unicode=True))
print('patched',len(patch.get('operations') or []),'operations,',len(patch.get('schemas') or {}),'schemas')
