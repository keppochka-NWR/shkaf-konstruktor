"""Loopback-only UI acceptance fixture. Never use these accounts on a real server."""
import sqlite3
import sys
import tempfile
from contextlib import closing
from pathlib import Path

ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'.studio-deps'))
import uvicorn
from fastapi.staticfiles import StaticFiles
from studio_app import create_app
from studio_accounts import hash_password, insert_account

if __name__=='__main__':
    build=ROOT/'.studio-preview'/'studio'
    if not (build/'index.html').is_file():raise RuntimeError('Build the isolated UI preview first.')
    with tempfile.TemporaryDirectory(prefix='studio-ui-') as directory:
        database=Path(directory)/'test.db'
        app=create_app(database,{'STUDIO_DEMO':'1'})
        hashed=hash_password('UI fixture password 2026')
        with closing(sqlite3.connect(database)) as connection,connection:
            insert_account(connection,'qa.admin','Администратор проверки','admin',hashed)
        app.mount('/studio',StaticFiles(directory=build,html=True))
        app.mount('/assets/tex',StaticFiles(directory=ROOT.parent/'web'/'assets'/'tex'))
        uvicorn.run(app,host='127.0.0.1',port=8186,log_level='warning')
