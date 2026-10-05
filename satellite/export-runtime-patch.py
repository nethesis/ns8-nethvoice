#!/usr/bin/env python3
"""Export reviewable Satellite changes against runtime-ref without modifying git indexes."""
import argparse
import hashlib
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source',type=Path)
args=parser.parse_args()
source=args.source.resolve();ref=(root/'runtime-ref').read_text().strip()
if subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()!=ref:
    raise SystemExit('Satellite checkout HEAD must match runtime-ref')
paths=['agent','api.py','requirements.txt']
patch=subprocess.check_output(['git','-C',str(source),'diff','--binary',ref,'--',*paths])
for name in subprocess.check_output(['git','-C',str(source),'ls-files','--others','--exclude-standard','--',*paths],text=True).splitlines():
    result=subprocess.run(['git','diff','--no-index','--binary','--','/dev/null',name],cwd=source,stdout=subprocess.PIPE)
    if result.returncode!=1: raise SystemExit('Could not export '+name)
    patch+=result.stdout
(root/'phase5-runtime.patch').write_bytes(patch)
(root/'phase5-runtime.sha256').write_text(hashlib.sha256(patch).hexdigest()+'  phase5-runtime.patch\n')
print(f'Exported {len(patch)} bytes')
