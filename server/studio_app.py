"""Separate studio storage. Demo is opt-in and loopback-only; production uses email codes."""
import hashlib
import json
import os
import re
import secrets
import smtplib
import sqlite3
import ssl
import time
from contextlib import contextmanager
from email.message import EmailMessage
from pathlib import Path
from fastapi import FastAPI, Request, Response, HTTPException
from pydantic import BaseModel, Field
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

ROOT = Path(__file__).resolve().parent
COOKIE = 'studio_session'

class EmailBody(BaseModel):
    email: str = Field(max_length=120)
class CodeBody(EmailBody):
    code: str = Field(min_length=6, max_length=6, pattern=r'^\d{6}$')
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
    # STUDIO_OPEN_SIGNUP=1 — регистрация по почте: любой адрес получает код и кабинет (личные проекты и шаблоны).
    open_signup = cfg.get('STUDIO_OPEN_SIGNUP') == '1'
    admins = {e.strip().lower() for e in cfg.get('STUDIO_ADMINS', 'admin@example.test' if demo else '').split(',') if e.strip()}
    allowed = {e.strip().lower() for e in cfg.get('STUDIO_USERS', '').split(',') if e.strip()} | admins
    def permitted(email):
        return demo or open_signup or email in allowed
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
        CREATE TABLE IF NOT EXISTS codes(email TEXT, hash TEXT, expires INTEGER, attempts INTEGER DEFAULT 0, used INTEGER DEFAULT 0, created INTEGER);
        CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,email TEXT,expires INTEGER);
        CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,email TEXT,name TEXT,data TEXT,revision INTEGER,updated INTEGER,archived INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS revisions(project_id TEXT,revision INTEGER,data TEXT,name TEXT,updated INTEGER,PRIMARY KEY(project_id,revision));
        CREATE TABLE IF NOT EXISTS libraries(email TEXT PRIMARY KEY,data TEXT,updated INTEGER);
        ''')
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
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
            row=c.execute('SELECT email FROM sessions WHERE hash=? AND expires>?',(digest(token),int(time.time()))).fetchone()
        if not row: raise HTTPException(401,'Войдите в кабинет.')
        if not permitted(row['email']):raise HTTPException(401,'Доступ сотрудника отозван.')
        return {'email':row['email'],'role':'admin' if row['email'] in admins else 'manager'}
    @app.get('/api/studio/status')
    def status():
        return {'mode':'local-demo' if demo else 'server','ready':demo or bool(cfg.get('SMTP_HOST') and cfg.get('SMTP_USER') and cfg.get('SMTP_PASSWORD') and (allowed or open_signup)),'openSignup':open_signup}
    @app.post('/api/studio/auth/code')
    def request_code(body:EmailBody):
        email=body.email.strip().lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email):raise HTTPException(422,'Проверьте адрес почты.')
        if (demo and not email.endswith('@example.test')) or (not demo and not permitted(email)):raise HTTPException(403,'Этот адрес не добавлен в список сотрудников.')
        now=int(time.time())
        with connect() as c:
            if c.execute('SELECT COUNT(*) FROM codes WHERE email=? AND created>?',(email,now-3600)).fetchone()[0]>=6:raise HTTPException(429,'Слишком много кодов. Повторите позже.')
            code=f'{secrets.randbelow(1000000):06d}'
            c.execute('UPDATE codes SET used=1 WHERE email=?',(email,))
            c.execute('INSERT INTO codes(email,hash,expires,created) VALUES(?,?,?,?)',(email,digest(code),now+600,now))
        if not demo:
            try:
                msg=EmailMessage();msg['Subject']='Вход в мебельную студию';msg['From']=cfg.get('SMTP_FROM',cfg['SMTP_USER']);msg['To']=email;msg.set_content(f'Код входа: {code}\nДействует 10 минут.')
                with smtplib.SMTP_SSL(cfg['SMTP_HOST'],int(cfg.get('SMTP_PORT','465')),context=ssl.create_default_context(),timeout=15) as server:
                    server.login(cfg['SMTP_USER'],cfg['SMTP_PASSWORD']);server.send_message(msg)
            except Exception:
                with connect() as c:c.execute('UPDATE codes SET used=1 WHERE email=?',(email,))
                raise HTTPException(503,'Не удалось отправить код. Проверьте настройки почты сервера.')
        return {'ok':True,**({'demoCode':code} if demo else {})}
    @app.post('/api/studio/auth/verify')
    def verify(body:CodeBody,response:Response):
        email=body.email.strip().lower();now=int(time.time())
        with connect() as c:
            c.execute('BEGIN IMMEDIATE')
            row=c.execute('SELECT rowid,* FROM codes WHERE email=? AND used=0 ORDER BY rowid DESC LIMIT 1',(email,)).fetchone()
            if not row or row['expires']<now or row['attempts']>=5:raise HTTPException(400,'Код недействителен. Запросите новый.')
            if not secrets.compare_digest(row['hash'],digest(body.code)):
                c.execute('UPDATE codes SET attempts=attempts+1 WHERE rowid=?',(row['rowid'],));c.commit();raise HTTPException(400,'Неверный код.')
            c.execute('UPDATE codes SET used=1 WHERE rowid=?',(row['rowid'],))
            token=secrets.token_urlsafe(32);c.execute('INSERT INTO sessions VALUES(?,?,?)',(digest(token),email,now+604800))
        response.set_cookie(COOKIE,token,httponly=True,secure=not demo,samesite='strict',max_age=604800,path='/api/studio')
        return {'email':email,'role':'admin' if email in admins else 'manager'}
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
            rows=c.execute('SELECT id,email,name,revision,updated,archived FROM projects WHERE archived=?'+('' if all else ' AND email=?')+' ORDER BY updated DESC',(int(archived),) if all else (int(archived),u['email'])).fetchall()
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
