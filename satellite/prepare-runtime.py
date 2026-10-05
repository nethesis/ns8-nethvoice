#!/usr/bin/env python3
"""Materialize the pinned upstream source plus the reviewed Phase 5 patch."""
import argparse
import hashlib
import io
from pathlib import Path
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('destination', type=Path, help='New or empty source directory')
parser.add_argument('--source', type=Path, help='Optional local Satellite git checkout containing runtime-ref')
args = parser.parse_args()
ref = (ROOT/'runtime-ref').read_text().strip()
patch = ROOT/'phase5-runtime.patch'
expected = (ROOT/'phase5-runtime.sha256').read_text().split()[0]
if hashlib.sha256(patch.read_bytes()).hexdigest() != expected:
    raise SystemExit('Phase 5 runtime patch checksum mismatch')
destination = args.destination.resolve()
if destination.exists() and any(destination.iterdir()):
    raise SystemExit('Destination must be empty')
destination.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='satellite-source-') as temporary:
    source = args.source.resolve() if args.source else Path(temporary)/'upstream.git'
    if not args.source:
        subprocess.run(['git','init','--bare','--quiet',str(source)], check=True)
        subprocess.run(['git','-C',str(source),'fetch','--quiet','--depth=1','https://github.com/nethesis/satellite.git',ref],check=True)
    archive = subprocess.check_output(['git','-C',str(source),'archive',ref])
    with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
        # Only runtime source is assembled; no git metadata or development secrets.
        for member in bundle:
            path = Path(member.name)
            if not (path.parts[0] == 'agent' or len(path.parts) == 1 and (path.suffix == '.py' or path.name in ('README.md','requirements.txt'))):
                continue
            if path.is_absolute() or '..' in path.parts or not (member.isfile() or member.isdir()):
                raise SystemExit('Unsafe upstream source archive')
            target = destination/path
            if member.isdir(): target.mkdir(parents=True,exist_ok=True)
            else:
                target.parent.mkdir(parents=True,exist_ok=True)
                target.write_bytes(bundle.extractfile(member).read())
    # Running outside a repository prevents parent repository path filtering.
    subprocess.run(['git','init','--quiet',str(destination)],check=True)
    subprocess.run(['git','-C',str(destination),'apply','--check',str(patch)],check=True)
    subprocess.run(['git','-C',str(destination),'apply',str(patch)],check=True)
    import shutil
    shutil.rmtree(destination/'.git')
    (destination/'phase5-source.json').write_text('{"upstream_ref":"'+ref+'","patch_sha256":"'+expected+'","workflow_schema":1}\n')
print(destination)
