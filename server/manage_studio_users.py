"""Local administrator bootstrap/recovery. Passwords never go into command arguments."""
import argparse
import getpass
import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / '.studio-deps'))
from studio_app import create_app, digest
from studio_accounts import hash_password, insert_account, normalize_login


def main():
    parser = argparse.ArgumentParser(description='Учётные записи мебельной студии')
    parser.add_argument('action', choices=['create', 'reset-password', 'list'])
    parser.add_argument('--db', default=os.environ.get('STUDIO_DB', str(ROOT / 'studio-data.db')))
    parser.add_argument('--login')
    parser.add_argument('--name')
    parser.add_argument('--role', choices=['manager', 'admin'], default='manager')
    parser.add_argument('--legacy-email', help='Привязать старые проекты этого владельца к новому логину')
    args = parser.parse_args()
    create_app(args.db, config={})
    connection = sqlite3.connect(args.db)
    connection.row_factory = sqlite3.Row
    try:
        if args.action == 'list':
            for row in connection.execute('SELECT login,name,role,active FROM accounts ORDER BY login'):
                print(f"{row['login']} | {row['name']} | {row['role']} | {'active' if row['active'] else 'disabled'}")
            return 0
        login = normalize_login(args.login or '')
        if args.action == 'create' and not args.name:
            parser.error('Для создания укажите --name и --role.')
        password = getpass.getpass('Пароль (15–128 символов): ')
        if password != getpass.getpass('Повторите пароль: '):
            raise ValueError('Пароли не совпадают.')
        hashed = hash_password(password)
        password = None
        with connection:
            connection.execute('BEGIN IMMEDIATE')
            if args.action == 'create':
                if not connection.execute("SELECT 1 FROM accounts WHERE role='admin' AND active=1").fetchone() and args.role != 'admin':
                    raise ValueError('Первым создайте администратора: --role admin.')
                owner = args.legacy_email.strip().lower() if args.legacy_email else None
                insert_account(connection, login, args.name, args.role, hashed, owner=owner)
            else:
                row = connection.execute('SELECT email FROM accounts WHERE login=?', (login,)).fetchone()
                if not row:
                    raise ValueError('Логин не найден.')
                connection.execute('UPDATE accounts SET password_hash=? WHERE login=?', (hashed, login))
                connection.execute('DELETE FROM sessions WHERE email=?', (row['email'],))
                connection.execute('DELETE FROM login_attempts WHERE bucket=?', ('login:' + digest(login),))
        print('Учётная запись создана.' if args.action == 'create' else 'Пароль изменён, прежние сессии отозваны.')
        return 0
    except (ValueError, sqlite3.IntegrityError) as exc:
        print('Ошибка: ' + ('Логин или прежний владелец уже привязан.' if isinstance(exc, sqlite3.IntegrityError) else str(exc)), file=sys.stderr)
        return 1
    finally:
        connection.close()


if __name__ == '__main__':
    raise SystemExit(main())
