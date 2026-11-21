from pathlib import Path
import zipfile
root=Path('/opt/yo-constructor-test-20261114/web/studio').resolve()
stage=root/'review-services-20261121a'
assert root.is_dir() and not stage.exists()
with zipfile.ZipFile('/mnt/c/YoPremialCatalog/services-resize-light-2111.zip') as z:
 for name in z.namelist():
  dest=(stage/name).resolve()
  assert dest.is_relative_to(stage) and (name in ('index.html','version.json') or name.startswith('assets/'))
  dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(z.read(name))
for name in ('textures','tex','models','vernissage','catalogs'):
 if (root/name).is_dir():(stage/name).symlink_to(root/name,target_is_directory=True)
print('Staged',stage)
