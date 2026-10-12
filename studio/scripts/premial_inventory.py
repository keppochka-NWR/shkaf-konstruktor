"""Inventory vendor CAD archives without executing their contents.

Keep original CP866 names in a manifest; extract to portable numbered paths.
"""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1] / 'reports/premial-source'
rows = []
for archive in sorted(ROOT.glob('cad-*.zip')):
    with zipfile.ZipFile(archive, metadata_encoding='cp866') as z:
        for n, info in enumerate(z.infolist()):
            if info.is_dir():
                continue
            ext = Path(info.filename).suffix.lower()
            data = z.read(info)
            dest = ROOT / 'extracted' / archive.stem / f'{n:04}{ext}'
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            rows.append(dict(archive=archive.name, sourceName=info.filename,
                             file=str(dest.relative_to(ROOT)).replace('\\', '/'),
                             bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
(ROOT / 'inventory.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
from collections import Counter
print('Files:', len(rows), dict(Counter(Path(r['file']).suffix for r in rows)))
for a in sorted(set(r['archive'] for r in rows)):
    subset = [r for r in rows if r['archive'] == a]
    print(a, len(subset), subset[0]['sourceName'], Path(ROOT / subset[0]['file']).read_bytes()[:12].hex())
