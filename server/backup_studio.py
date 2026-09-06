"""Consistent SQLite backup for studio projects, including committed WAL changes."""
import argparse
import os
import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent

def backup_database(source, directory):
    source=Path(source).resolve()
    if not source.is_file():
        raise FileNotFoundError('Studio database does not exist: '+str(source))
    directory=Path(directory).resolve()
    directory.mkdir(parents=True,exist_ok=True)
    output=directory/('studio-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:12]+'.db')
    # Exclusive reservation: an existing backup is never replaced.
    with output.open('xb'):
        pass
    try:
        with closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True,timeout=30)) as src, closing(sqlite3.connect(output,timeout=30)) as dst:
            names={row[0] for row in src.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if not {'projects','revisions','sessions','codes'}<=names:
                raise ValueError('This is not a studio database.')
            src.backup(dst,pages=256,sleep=.05)
            if dst.execute('PRAGMA quick_check').fetchone()[0]!='ok':
                raise ValueError('Backup integrity check failed.')
            counts={name:dst.execute('SELECT COUNT(*) FROM '+name).fetchone()[0] for name in ('projects','revisions')}
        return {'path':str(output),'bytes':output.stat().st_size,**counts}
    except Exception:
        output.unlink(missing_ok=True)
        raise

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Back up studio projects safely while SQLite is running.')
    parser.add_argument('--source',default=os.environ.get('STUDIO_DB',str(ROOT/'studio-data.db')))
    parser.add_argument('--directory',default=str(ROOT/'studio-backups'))
    args=parser.parse_args()
    info=backup_database(args.source,args.directory)
    print('Backup checked:',info['path'])
    print('Projects:',info['projects'],'Revisions:',info['revisions'],'Bytes:',info['bytes'])
