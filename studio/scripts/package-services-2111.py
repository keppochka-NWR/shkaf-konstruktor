from pathlib import Path
import zipfile,json,hashlib,subprocess
base=Path.cwd();build=base/'dist-release-20261121-services-v3'
source=hashlib.sha256()
for p in sorted((base/'src').glob('*')):
 if p.is_file():source.update(p.name.encode());source.update(p.read_bytes())
version={'release':'20261121-prices-services-resize-light','sourceHead':subprocess.check_output(['git','rev-parse','--short','HEAD'],text=True).strip(),'sourceSha256':source.hexdigest(),'mode':'client-prices','builtAt':'2026-11-21'}
(build/'version.json').write_text(json.dumps(version),encoding='utf8')
files=[build/'index.html',build/'version.json',*sorted((build/'assets').glob('*'))]
archive=base.parent/'deploy/services-resize-light-2111.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in files:
  if p.is_file():z.write(p,p.relative_to(build).as_posix())
manifest={p.relative_to(build).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.is_file()}
(base/'reports/release-2111-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print('Packaged',len(manifest),'files',archive.stat().st_size,'bytes',version['release'])
