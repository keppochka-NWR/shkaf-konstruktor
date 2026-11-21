from pathlib import Path
import shutil,datetime,hashlib,json
root=Path('/opt/yo-constructor-test-20261114/web/studio').resolve()
stage=root/'review-services-20261121a'
manifest=json.loads(Path('/mnt/c/YoPremialCatalog/release-2111-manifest.json').read_text())
for name,digest in manifest.items():
 p=(stage/name).resolve();assert p.is_relative_to(stage) and p.is_file()
 assert hashlib.sha256(p.read_bytes()).hexdigest()==digest
backup=root.parent/('studio-before-services-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir()
for name in manifest:
 dest=root/name
 if dest.is_file():
  b=backup/name;b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest,b)
for name in sorted(manifest,key=lambda n:n=='index.html'):
 dest=(root/name).resolve();assert dest.is_relative_to(root)
 dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(stage/name,dest)
print('Installed. Backup:',backup)
print((root/'version.json').read_text())
