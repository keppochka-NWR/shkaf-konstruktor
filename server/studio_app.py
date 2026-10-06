"""Separate studio storage with administrator-created login/password accounts."""
import hashlib
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Literal
from fastapi import FastAPI, Request, Response, HTTPException
from pydantic import BaseModel, Field
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from studio_accounts import normalize_login, hash_password, verify_password, dummy_hash, public_account, insert_account

ROOT = Path(__file__).resolve().parent
COOKIE = 'studio_session'

class LoginBody(BaseModel):
    login: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)
class AccountBody(LoginBody):
    name: str = Field(min_length=1, max_length=80)
    role: Literal['manager', 'admin'] = 'manager'
class PasswordBody(BaseModel):
    password: str = Field(min_length=15, max_length=128)
class ChangePasswordBody(PasswordBody):
    currentPassword: str = Field(min_length=1, max_length=128)
class ActiveBody(BaseModel):
    active: bool
class LibraryBody(BaseModel):
    items: list = Field(max_length=30)
class SaveBody(BaseModel):
    id: str = Field(pattern=r'^[A-Za-z0-9_-]{1,64}$')
    name: str = Field(min_length=1, max_length=100)
    revision: int = Field(ge=0)
    data: dict

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def create_app(db_path=None, config=None, static_root=None):
    cfg = dict(os.environ if config is None else config)
    demo = cfg.get('STUDIO_DEMO') == '1'
    database = Path(db_path or cfg.get('STUDIO_DB', ROOT / 'studio-data.db'))
    database.parent.mkdir(parents=True, exist_ok=True)
    @contextmanager
    def connect():
        c = sqlite3.connect(database, timeout=10)
        c.row_factory = sqlite3.Row
        c.execute('PRAGMA journal_mode=WAL')
        try:
            with c:
                yield c
        finally:
            c.close()
    with connect() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,email TEXT,expires INTEGER);
        CREATE TABLE IF NOT EXISTS accounts(email TEXT PRIMARY KEY,login TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('manager','admin')),password_hash TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS login_attempts(bucket TEXT NOT NULL,created INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS login_attempts_time ON login_attempts(created);
        CREATE INDEX IF NOT EXISTS login_attempts_bucket ON login_attempts(bucket,created);
        CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,email TEXT,name TEXT,data TEXT,revision INTEGER,updated INTEGER,archived INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS revisions(project_id TEXT,revision INTEGER,data TEXT,name TEXT,updated INTEGER,PRIMARY KEY(project_id,revision));
        CREATE TABLE IF NOT EXISTS libraries(email TEXT PRIMARY KEY,data TEXT,updated INTEGER);
        ''')
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    # Do not echo password inputs in Pydantic validation errors.
    from fastapi.exceptions import RequestValidationError
    from fastapi.responses import JSONResponse
    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        return JSONResponse({'detail':'Проверьте введённые данные и длину полей.'}, status_code=422)
    @app.middleware('http')
    async def guard(request: Request, call_next):
        from fastapi.responses import JSONResponse
        if demo and request.client and request.client.host not in ('127.0.0.1', '::1', 'testclient'):
            return JSONResponse({'detail':'Демо доступно только на этом компьютере.'}, status_code=403)
        if request.method not in ('GET','HEAD','OPTIONS'):
            if request.headers.get('x-studio-request') != '1':
                return JSONResponse({'detail':'Обновите страницу.'},status_code=403)
            origin = request.headers.get('origin')
            expected = cfg.get('STUDIO_ORIGIN', str(request.base_url).rstrip('/'))
            if origin and origin != expected:
                return JSONResponse({'detail':'Недопустимый источник запроса.'},status_code=403)
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        return response
    def user(request):
        token=request.cookies.get(COOKIE,'')
        with connect() as c:
            row=c.execute('SELECT a.* FROM sessions s JOIN accounts a ON a.email=s.email WHERE s.hash=? AND s.expires>? AND a.active=1',(digest(token),int(time.time()))).fetchone()
        if not row: raise HTTPException(401,'Войдите в кабинет.')
        return public_account(row)
    def administrator(request):
        u=user(request)
        if u['role']!='admin':raise HTTPException(403,'Нужны права администратора.')
        return u
    def limit_login(request, login):
        now=int(time.time())
        buckets=[('login:'+digest(login),10),('ip:'+digest(request.client.host if request.client else 'unknown'),50)]
        with connect() as c:
            c.execute('BEGIN IMMEDIATE')
            c.execute('DELETE FROM login_attempts WHERE created<=?',(now-900,))
            for bucket,limit in buckets:
                if c.execute('SELECT COUNT(*) FROM login_attempts WHERE bucket=?',(bucket,)).fetchone()[0]>=limit:
                    raise HTTPException(429,'Слишком много попыток входа. Повторите через 15 минут.',headers={'Retry-After':'900'})
            c.executemany('INSERT INTO login_attempts VALUES(?,?)',[(bucket,now) for bucket,_ in buckets])
    def issue_session(c, owner, response):
        now=int(time.time());token=secrets.token_urlsafe(32)
        c.execute('DELETE FROM sessions WHERE expires<=?',(now,))
        c.execute('INSERT INTO sessions VALUES(?,?,?)',(digest(token),owner,now+604800))
        response.set_cookie(COOKIE,token,httponly=True,secure=not demo,samesite='strict',max_age=604800,path='/api/studio')
    def password_hash(value):
        try:return hash_password(value)
        except ValueError as exc:raise HTTPException(422,str(exc))
    @app.get('/api/studio/status')
    def status():
        with connect() as c:ready=bool(c.execute("SELECT 1 FROM accounts WHERE active=1 AND role='admin' LIMIT 1").fetchone())
        return {'mode':'local-demo' if demo else 'server','ready':ready,'auth':'password','openSignup':False}
    @app.post('/api/studio/auth/login')
    def login(body:LoginBody,request:Request,response:Response):
        username=body.login.strip().lower()
        limit_login(request,username)
        with connect() as c:row=c.execute('SELECT * FROM accounts WHERE login=?',(username,)).fetchone()
        valid=verify_password(body.password,row['password_hash'] if row else dummy_hash())
        if not valid or not row or not row['active']:raise HTTPException(401,'Неверный логин или пароль.')
        with connect() as c:
            c.execute('BEGIN IMMEDIATE')
            current=c.execute('SELECT * FROM accounts WHERE email=? AND active=1',(row['email'],)).fetchone()
            if not current or current['password_hash']!=row['password_hash']:raise HTTPException(401,'Повторите вход.')
            c.execute('DELETE FROM sessions WHERE hash=?',(digest(request.cookies.get(COOKIE,'')),))
            issue_session(c,row['email'],response)
            c.execute('DELETE FROM login_attempts WHERE bucket=?',('login:'+digest(username),))
        return public_account(current)
    @app.post('/api/studio/auth/password')
    def change_password(body:ChangePasswordBody,request:Request,response:Response):
        u=user(request);limit_login(request,u['login'])
        with connect() as c:row=c.execute('SELECT password_hash FROM accounts WHERE email=?',(u['email'],)).fetchone()
        if not verify_password(body.currentPassword,row['password_hash']):raise HTTPException(400,'Текущий пароль неверный.')
        new_hash=password_hash(body.password)
        with connect() as c:
            c.execute('BEGIN IMMEDIATE')
            result=c.execute('UPDATE accounts SET password_hash=? WHERE email=? AND password_hash=? AND active=1',(new_hash,u['email'],row['password_hash']))
            if not result.rowcount:raise HTTPException(409,'Учётная запись изменилась. Повторите вход.')
            c.execute('DELETE FROM sessions WHERE email=?',(u['email'],))
            issue_session(c,u['email'],response)
        return {'ok':True}
    @app.get('/api/studio/accounts')
    def accounts(request:Request):
        administrator(request)
        with connect() as c:rows=c.execute('SELECT * FROM accounts ORDER BY login').fetchall()
        return {'items':[public_account(r) for r in rows]}
    @app.post('/api/studio/accounts')
    def create_account(body:AccountBody,request:Request):
        administrator(request)
        try:username=normalize_login(body.login)
        except ValueError as exc:raise HTTPException(422,str(exc))
        hashed=password_hash(body.password)
        try:
            with connect() as c:
                owner=insert_account(c,username,body.name,body.role,hashed)
                row=c.execute('SELECT * FROM accounts WHERE email=?',(owner,)).fetchone()
        except sqlite3.IntegrityError:raise HTTPException(409,'Этот логин уже занят.')
        except ValueError as exc:raise HTTPException(422,str(exc))
        return public_account(row)
    @app.post('/api/studio/accounts/{username}/password')
    def reset_password(username:str,body:PasswordBody,request:Request):
        u=administrator(request)
        if username==u['login']:raise HTTPException(400,'Для своего аккаунта используйте «Изменить пароль».')
        hashed=password_hash(body.password)
        with connect() as c:
            c.execute('BEGIN IMMEDIATE')
            row=c.execute('SELECT email FROM accounts WHERE login=?',(username,)).fetchone()
            if not row:raise HTTPException(404,'Сотрудник не найден.')
            c.execute('UPDATE accounts SET password_hash=? WHERE email=?',(hashed,row['email']))
            c.execute('DELETE FROM sessions WHERE email=?',(row['email'],))
            c.execute('DELETE FROM login_attempts WHERE bucket=?',('login:'+digest(username),))
        return {'ok':True}
    @app.post('/api/studio/accounts/{username}/active')
    def set_active(username:str,body:ActiveBody,request:Request):
        u=administrator(request)
        if username==u['login']:raise HTTPException(400,'Нельзя отключить собственный аккаунт.')
        with connect() as c:
            c.execute('BEGIN IMMEDIATE')
            row=c.execute('SELECT * FROM accounts WHERE login=?',(username,)).fetchone()
            if not row:raise HTTPException(404,'Сотрудник не найден.')
            if not body.active and row['role']=='admin' and c.execute("SELECT COUNT(*) FROM accounts WHERE active=1 AND role='admin'").fetchone()[0]<=1:
                raise HTTPException(409,'Должен остаться хотя бы один администратор.')
            c.execute('UPDATE accounts SET active=? WHERE login=?',(int(body.active),username))
            c.execute('DELETE FROM sessions WHERE email=?',(row['email'],))
        return {'ok':True}
    @app.get('/api/studio/me')
    def me(request:Request):return user(request)
    @app.post('/api/studio/logout')
    def logout(request:Request,response:Response):
        with connect() as c:c.execute('DELETE FROM sessions WHERE hash=?',(digest(request.cookies.get(COOKIE,'')),))
        response.delete_cookie(COOKIE,path='/api/studio');return {'ok':True}
    @app.get('/api/studio/projects')
    def listing(request:Request,all:bool=False,archived:bool=False):
        u=user(request)
        if all and u['role']!='admin':raise HTTPException(403,'Нужны права администратора.')
        with connect() as c:
            rows=c.execute('SELECT p.id,p.email,p.name,p.revision,p.updated,p.archived,COALESCE(a.name,p.email) AS ownerName FROM projects p LEFT JOIN accounts a ON a.email=p.email WHERE p.archived=?'+('' if all else ' AND p.email=?')+' ORDER BY p.updated DESC',(int(archived),) if all else (int(archived),u['email'])).fetchall()
        return {'items':[dict(r) for r in rows]}
    @app.get('/api/studio/projects/{pid}')
    def load(pid:str,request:Request):
        u=user(request)
        with connect() as c:row=c.execute('SELECT * FROM projects WHERE id=?',(pid,)).fetchone()
        if not row or (row['email']!=u['email'] and u['role']!='admin'):raise HTTPException(404,'Проект не найден.')
        return {**dict(row),'data':json.loads(row['data'])}
    @app.get('/api/studio/projects/{pid}/revisions')
    def history(pid:str,request:Request):
        u=user(request)
        with connect() as c:
            row=c.execute('SELECT email,revision FROM projects WHERE id=?',(pid,)).fetchone()
            if not row or (row['email']!=u['email'] and u['role']!='admin'):raise HTTPException(404,'Проект не найден.')
            rows=c.execute('SELECT revision,name,updated FROM revisions WHERE project_id=? ORDER BY revision DESC LIMIT 100',(pid,)).fetchall()
        return {'items':[dict(r) for r in rows],'currentRevision':row['revision']}
    @app.get('/api/studio/projects/{pid}/revisions/{revision}')
    def load_revision(pid:str,revision:int,request:Request):
        u=user(request)
        with connect() as c:
            project=c.execute('SELECT email,revision FROM projects WHERE id=?',(pid,)).fetchone()
            if not project or (project['email']!=u['email'] and u['role']!='admin'):raise HTTPException(404,'Проект не найден.')
            row=c.execute('SELECT * FROM revisions WHERE project_id=? AND revision=?',(pid,revision)).fetchone()
        if not row:raise HTTPException(404,'Версия не найдена.')
        return {**dict(row),'data':json.loads(row['data']),'email':project['email'],'currentRevision':project['revision']}
    @app.post('/api/studio/projects')
    def save(body:SaveBody,request:Request):
        u=user(request)
        try:data=json.dumps(body.data,ensure_ascii=False,allow_nan=False)
        except ValueError:raise HTTPException(422,'Некорректные числа в проекте.')
        if len(data.encode())>500000:raise HTTPException(413,'Проект слишком большой.')
        if body.data.get('version')!=3 or not isinstance(body.data.get('modules'),list) or not 1<=len(body.data['modules'])<=40:raise HTTPException(422,'Нужен проект новой студии.')
        with connect() as c:
            c.execute('BEGIN IMMEDIATE')
            row=c.execute('SELECT * FROM projects WHERE id=?',(body.id,)).fetchone()
            if row and row['email']!=u['email']:raise HTTPException(403,'Сохраните чужой проект как свою копию.')
            if (row['revision'] if row else 0)!=body.revision:raise HTTPException(409,'На сервере более новая версия. Откройте её или сохраните свою копию.')
            revision=body.revision+1;now=int(time.time())
            c.execute('INSERT INTO projects VALUES(?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET name=excluded.name,data=excluded.data,revision=excluded.revision,updated=excluded.updated',(body.id,u['email'],body.name,data,revision,now))
            c.execute('INSERT INTO revisions VALUES(?,?,?,?,?)',(body.id,revision,data,body.name,now))
        return {'id':body.id,'revision':revision,'updated':now}
    # Личная библиотека шаблонов (часто используемые корпуса и группы) — по одной записи на сотрудника.
    @app.get('/api/studio/library')
    def library_get(request:Request):
        u=user(request)
        with connect() as c:row=c.execute('SELECT data,updated FROM libraries WHERE email=?',(u['email'],)).fetchone()
        return {'items':json.loads(row['data']) if row else [],'updated':row['updated'] if row else None}
    @app.post('/api/studio/library')
    def library_put(body:LibraryBody,request:Request):
        u=user(request)
        try:data=json.dumps(body.items,ensure_ascii=False,allow_nan=False)
        except ValueError:raise HTTPException(422,'Некорректные числа в шаблонах.')
        if len(data.encode())>1500000:raise HTTPException(413,'Библиотека слишком большая.')
        for item in body.items:
            if not isinstance(item,dict) or not isinstance(item.get('name'),str) or not item['name'].strip() or len(item['name'])>80 or not (isinstance(item.get('module'),dict) or isinstance(item.get('group'),list)):raise HTTPException(422,'Проверьте шаблоны: нужны название и корпус или группа.')
        now=int(time.time())
        with connect() as c:c.execute('INSERT INTO libraries VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET data=excluded.data,updated=excluded.updated',(u['email'],data,now))
        return {'ok':True,'count':len(body.items),'updated':now}
    @app.post('/api/studio/projects/{pid}/archive')
    def archive(pid:str,request:Request,archived:bool=True):
        u=user(request)
        with connect() as c:
            c.execute('UPDATE projects SET archived=? WHERE id=? AND email=?',(int(archived),pid,u['email']))
        return {'ok':True}
    if static_root is not None:
        web=Path(static_root).resolve()
        if not (web/'studio'/'index.html').is_file():
            raise RuntimeError('Studio build not found. Build studio before serving the web interface.')
        app.mount('/studio',StaticFiles(directory=web/'studio',html=True),name='studio-web')
        app.mount('/assets/tex',StaticFiles(directory=web/'assets'/'tex'),name='studio-textures')
        @app.get('/')
        def home():
            return RedirectResponse('/studio/')
    return app
