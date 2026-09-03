"""Облачный бэкенд конструктора: аккаунты по коду на почту + проекты в базе.

Один файл, паттерн «Просчитано». Без .env работает в DEV-режиме:
код входа возвращается прямо в ответе и пишется в консоль.
Прод: .env рядом с этим файлом (DEV_MODE=0, SMTP_*), деплой как Просчитано.
"""
import hashlib
import json
import re
import secrets
import smtplib
import sqlite3
import ssl
import threading
from datetime import datetime, timedelta, timezone
from email.header import Header
from email.mime.text import MIMEText
from pathlib import Path

from fastapi import FastAPI, Header as HeaderDep, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent
WEB = ROOT.parent / "web"
DB = ROOT / "data.db"

def _env():
    out = {}
    p = ROOT / ".env"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                out[k.strip()] = v.strip()
    return out

ENV = _env()
DEV = ENV.get("DEV_MODE", "1") != "0"

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

_local = threading.local()

def db():
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(DB, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        _local.conn = conn
    return conn

def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def ts(minutes=0, days=0):
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes, days=days)) \
        .strftime("%Y-%m-%dT%H:%M:%SZ")

def sha(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

with sqlite3.connect(DB) as _c:
    _c.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, created_at TEXT);
    CREATE TABLE IF NOT EXISTS codes (
        id INTEGER PRIMARY KEY, email TEXT, code_hash TEXT, expires_at TEXT,
        attempts INTEGER DEFAULT 0, used INTEGER DEFAULT 0, created_at TEXT);
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY, user_id INTEGER, token_hash TEXT UNIQUE, expires_at TEXT);
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT, data TEXT,
        updated_at TEXT);
    """)


class ApiError(Exception):
    def __init__(self, status, error, message):
        self.status, self.error, self.message = status, error, message


@app.exception_handler(ApiError)
def _err(request, exc: ApiError):
    return JSONResponse(status_code=exc.status,
                        content={"ok": False, "error": exc.error, "message": exc.message})


def send_code_email(email, code):
    host, user = ENV.get("SMTP_HOST", ""), ENV.get("SMTP_USER", "")
    if DEV or not host or not user:
        print("[dev] код входа для %s: %s" % (email, code), flush=True)
        return
    try:
        msg = MIMEText("Ваш код входа: %s\n\nКод действует 10 минут." % code, "plain", "utf-8")
        msg["Subject"] = Header("Код входа · Конструктор шкафов", "utf-8")
        msg["From"] = ENV.get("SMTP_FROM", user)
        msg["To"] = email
        with smtplib.SMTP_SSL(host, int(ENV.get("SMTP_PORT", "465")),
                              context=ssl.create_default_context(), timeout=20) as srv:
            srv.login(user, ENV.get("SMTP_PASSWORD", ""))
            srv.sendmail(msg["From"], [email], msg.as_string())
    except Exception as exc:
        print("[mail failed]", exc, flush=True)


def current_user(authorization: str = HeaderDep(default="")):
    if not authorization.startswith("Bearer "):
        raise ApiError(401, "no_auth", "Войдите в аккаунт.")
    row = db().execute(
        "SELECT u.id, u.email, s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id"
        " WHERE s.token_hash=?", (sha(authorization[7:].strip()),)).fetchone()
    if row is None or row["expires_at"] < now():
        raise ApiError(401, "bad_token", "Сессия истекла, войдите заново.")
    return {"id": row["id"], "email": row["email"]}


class EmailBody(BaseModel):
    email: str

class VerifyBody(BaseModel):
    email: str
    code: str

class ProjectBody(BaseModel):
    id: str
    name: str = "Шкаф"
    data: dict


@app.post("/api/auth/request-code")
def request_code(body: EmailBody):
    email = body.email.strip().lower()
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$", email) or len(email) > 120:
        raise ApiError(422, "bad_email", "Проверьте адрес почты.")
    conn = db()
    recent = conn.execute("SELECT COUNT(*) FROM codes WHERE email=? AND created_at>?",
                          (email, ts(minutes=-60))).fetchone()[0]
    if recent >= 4:
        raise ApiError(429, "rate_limited", "Слишком много запросов кода, подождите час.")
    code = "%06d" % secrets.randbelow(1000000)
    conn.execute("UPDATE codes SET used=1 WHERE email=? AND used=0", (email,))
    conn.execute("INSERT INTO codes (email, code_hash, expires_at, created_at) VALUES (?,?,?,?)",
                 (email, sha(code), ts(minutes=10), now()))
    conn.commit()
    send_code_email(email, code)
    out = {"ok": True}
    if DEV:
        out["dev_code"] = code
    return out


@app.post("/api/auth/verify")
def verify(body: VerifyBody):
    email = body.email.strip().lower()
    code = re.sub(r"\D", "", body.code or "")
    conn = db()
    row = conn.execute("SELECT * FROM codes WHERE email=? AND used=0 ORDER BY id DESC LIMIT 1",
                       (email,)).fetchone()
    if row is None or row["attempts"] >= 5:
        raise ApiError(400, "bad_code", "Неверный код. Запросите новый.")
    if row["expires_at"] < now():
        raise ApiError(410, "code_expired", "Код устарел, запросите новый.")
    if row["code_hash"] != sha(code):
        conn.execute("UPDATE codes SET attempts=attempts+1 WHERE id=?", (row["id"],))
        conn.commit()
        raise ApiError(400, "bad_code", "Неверный код.")
    conn.execute("UPDATE codes SET used=1 WHERE id=?", (row["id"],))
    u = conn.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
    if u is None:
        cur = conn.execute("INSERT INTO users (email, created_at) VALUES (?,?)", (email, now()))
        uid = cur.lastrowid
    else:
        uid = u["id"]
    token = secrets.token_urlsafe(32)
    conn.execute("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?,?,?)",
                 (uid, sha(token), ts(days=180)))
    conn.commit()
    return {"ok": True, "token": token, "email": email}


@app.get("/api/me")
def me(user: dict = None, authorization: str = HeaderDep(default="")):
    u = current_user(authorization)
    return {"ok": True, "email": u["email"]}


@app.get("/api/projects")
def list_projects(authorization: str = HeaderDep(default="")):
    u = current_user(authorization)
    rows = db().execute(
        "SELECT id, name, updated_at FROM projects WHERE user_id=? ORDER BY updated_at DESC",
        (u["id"],)).fetchall()
    return {"ok": True, "items": [dict(r) for r in rows]}


@app.post("/api/projects")
def save_project(body: ProjectBody, authorization: str = HeaderDep(default="")):
    u = current_user(authorization)
    if not re.match(r"^[A-Za-z0-9_\-\.]{1,64}$", body.id):
        raise ApiError(422, "bad_id", "Некорректный id проекта.")
    data = json.dumps(body.data, ensure_ascii=False)
    if len(data) > 400_000:
        raise ApiError(413, "too_big", "Проект слишком большой.")
    conn = db()
    own = conn.execute("SELECT user_id FROM projects WHERE id=?", (body.id,)).fetchone()
    if own and own["user_id"] != u["id"]:
        raise ApiError(403, "forbidden", "Это чужой проект.")
    conn.execute(
        "INSERT INTO projects (id, user_id, name, data, updated_at) VALUES (?,?,?,?,?)"
        " ON CONFLICT(id) DO UPDATE SET name=excluded.name, data=excluded.data,"
        " updated_at=excluded.updated_at",
        (body.id, u["id"], body.name.strip()[:60] or "Шкаф", data, now()))
    conn.commit()
    return {"ok": True, "id": body.id}


@app.get("/api/projects/{pid}")
def get_project(pid: str, authorization: str = HeaderDep(default="")):
    u = current_user(authorization)
    row = db().execute("SELECT * FROM projects WHERE id=? AND user_id=?",
                       (pid, u["id"])).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "Проект не найден.")
    return {"ok": True, "name": row["name"], "data": json.loads(row["data"])}


@app.delete("/api/projects/{pid}")
def delete_project(pid: str, authorization: str = HeaderDep(default="")):
    u = current_user(authorization)
    db().execute("DELETE FROM projects WHERE id=? AND user_id=?", (pid, u["id"]))
    db().commit()
    return {"ok": True}


@app.middleware("http")
async def no_cache_static(request: Request, call_next):
    resp = await call_next(request)
    # статика без кэша: правки видны сразу, никакой возни с Ctrl+F5
    if not request.url.path.startswith("/api") and not request.url.path.startswith("/assets/tex"):
        resp.headers["Cache-Control"] = "no-cache"
    return resp


app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
