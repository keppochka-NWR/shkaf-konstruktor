"""Create an isolated pilot; do not overwrite the current service or database."""
import pathlib,shutil,sqlite3,subprocess,zipfile
root=pathlib.Path('/opt/yo-constructor-ai-20261114')
if root.exists():raise SystemExit('Pilot release already exists; inspect before changing it')
shutil.copytree('/opt/yo-constructor-test-20261114',root)
with zipfile.ZipFile('/mnt/c/YoConstructorTest-20261114/assistant-overlay.zip') as z:
    for name in z.namelist():
        if not (root/name).resolve().is_relative_to(root):raise SystemExit('Unsafe archive path')
    z.extractall(root)
state=pathlib.Path('/var/lib/yo-constructor-ai-pilot');state.mkdir(mode=0o700,exist_ok=False)
with sqlite3.connect('/var/lib/yo-constructor-test/studio-data.db') as source,sqlite3.connect(state/'studio-data.db') as target:source.backup(target)
(root/'run.sh').write_text('''#!/bin/sh
set -eu
umask 077
export STUDIO_DEMO=0
export STUDIO_SERVE_WEB=1
export STUDIO_DB=/var/lib/yo-constructor-ai-pilot/studio-data.db
export STUDIO_ORIGIN=https://desktop-8aqbtbm.tailddcb43.ts.net:8443
export STUDIO_PORT=8121
export PYTHONPATH=/opt/yo-assistant-deps
export STUDIO_CODEX_NODE=/mnt/c/Tools/Node/node-v26.13.0-win-x64/node.exe
export STUDIO_CODEX_SCRIPT='C:\\YoConstructorTest-20261114\\assistant_codex.cjs'
cd /opt/yo-constructor-ai-20261114
exec /opt/garderob/venv/bin/python server/run_studio.py >> /var/lib/yo-constructor-ai-pilot/server.log 2>&1
''',encoding='utf-8')
subprocess.run(['chown','-R','yo-studio:yo-studio',str(state)],check=True)
subprocess.run(['chmod','-R','a+rX',str(root)],check=True)
print('Isolated pilot installed; original release and database preserved')
