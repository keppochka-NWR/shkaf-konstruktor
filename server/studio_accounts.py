"""Password accounts; the legacy `email` column is now an immutable owner key."""
import hashlib
import re
import secrets
import time
from functools import lru_cache
from threading import BoundedSemaphore

# OWASP scrypt baseline; bound concurrent memory use per server process.
_hash_slots = BoundedSemaphore(2)


def normalize_login(login):
    login = login.strip().lower()
    if not re.fullmatch(r'[a-z0-9][a-z0-9._-]{2,63}', login):
        raise ValueError('Логин: 3–64 символа, латинские буквы, цифры, точка, дефис или подчёркивание.')
    return login


def _derive(password, salt):
    with _hash_slots:
        return hashlib.scrypt(password.encode('utf-8'), salt=salt, n=2**17, r=8, p=1,
                              maxmem=256*1024*1024, dklen=32)


def hash_password(password):
    if not 15 <= len(password) <= 128 or not password.strip():
        raise ValueError('Пароль: от 15 до 128 символов. Можно использовать фразу с пробелами.')
    salt = secrets.token_bytes(16)
    return 'scrypt-v1$' + salt.hex() + '$' + _derive(password, salt).hex()


@lru_cache(maxsize=1)
def dummy_hash():
    return hash_password(secrets.token_urlsafe(32))


def verify_password(password, encoded):
    try:
        scheme, salt, expected = encoded.split('$')
        if scheme != 'scrypt-v1' or len(salt) != 32 or len(expected) != 64:
            return False
        return secrets.compare_digest(_derive(password, bytes.fromhex(salt)), bytes.fromhex(expected))
    except (ValueError, TypeError):
        return False


def public_account(row):
    return {'email': row['email'], 'login': row['login'], 'name': row['name'],
            'role': row['role'], 'active': bool(row['active'])}


def insert_account(connection, login, name, role, password_hash, owner=None):
    login = normalize_login(login)
    name = name.strip()
    if not name or len(name) > 80 or role not in ('manager', 'admin'):
        raise ValueError('Укажите имя сотрудника и роль: менеджер или администратор.')
    # Preserve an old project's email key only through explicit local migration.
    owner = owner or 'user:' + secrets.token_hex(16)
    connection.execute('INSERT INTO accounts VALUES(?,?,?,?,?,1,?)',
                       (owner, login, name, role, password_hash, int(time.time())))
    connection.execute('DELETE FROM sessions WHERE email=?', (owner,))
    return owner
