import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent/'.studio-deps'))
from fastapi.testclient import TestClient
from studio_app import create_app
from backup_studio import backup_database
import sqlite3
from contextlib import closing

class StudioTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.app=create_app(Path(self.tmp.name)/'test.db',{'STUDIO_DEMO':'1'})
        self.a=self.login('one@example.test');self.b=self.login('two@example.test');self.admin=self.login('admin@example.test')
    def tearDown(self):
        self.a.close();self.b.close();self.admin.close();self.tmp.cleanup()
    def login(self,email):
        c=TestClient(self.app,headers={'x-studio-request':'1'})
        result=c.post('/api/studio/auth/code',json={'email':email})
        self.assertEqual(result.status_code,200)
        result=c.post('/api/studio/auth/verify',json={'email':email,'code':result.json()['demoCode']})
        self.assertEqual(result.status_code,200)
        self.assertIn('httponly',result.headers['set-cookie'].lower())
        return c
    def payload(self,revision=0):return {'id':'test-project','name':'Шкаф','revision':revision,'data':{'version':3,'modules':[{}]}}
    def test_personal_library_is_stored_per_user_and_validated(self):
        self.assertEqual(self.a.get('/api/studio/library').json(),{'items':[],'updated':None})
        items=[{'name':'Платяной 600','module':{'version':1,'width':600}},{'name':'Прихожая','group':[{'x':0,'z':0,'module':{}}]}]
        r=self.a.post('/api/studio/library',json={'items':items});self.assertEqual(r.status_code,200);self.assertEqual(r.json()['count'],2)
        self.assertEqual(self.a.get('/api/studio/library').json()['items'],items)
        self.assertEqual(self.b.get('/api/studio/library').json()['items'],[],'другой сотрудник не видит чужие шаблоны')
        self.assertEqual(self.a.post('/api/studio/library',json={'items':[{'name':'','module':{}}]}).status_code,422)
        self.assertEqual(self.a.post('/api/studio/library',json={'items':[{'name':'x'}]}).status_code,422)
        self.assertEqual(self.a.post('/api/studio/library',json={'items':[{'name':'n','module':{}}]*31}).status_code,422)
        r=self.a.post('/api/studio/library',json={'items':[]});self.assertEqual(r.json()['count'],0)
    def test_open_signup_lets_any_email_register_by_code(self):
        closed=create_app(Path(self.tmp.name)/'closed.db',{'STUDIO_USERS':'staff@firm.ru'})
        c=TestClient(closed,headers={'x-studio-request':'1'})
        self.assertEqual(c.post('/api/studio/auth/code',json={'email':'new@client.ru'}).status_code,403)
        opened=create_app(Path(self.tmp.name)/'open.db',{'STUDIO_OPEN_SIGNUP':'1'})
        o=TestClient(opened,headers={'x-studio-request':'1'})
        self.assertTrue(o.get('/api/studio/status').json()['openSignup'])
        # без SMTP код не уйдёт (503), но адрес принят — это и есть регистрация по почте
        self.assertEqual(o.post('/api/studio/auth/code',json={'email':'new@client.ru'}).status_code,503)
    def test_combined_web_server_exposes_only_editor_assets(self):
        root=Path(self.tmp.name)/'web'
        (root/'studio'/'assets').mkdir(parents=True)
        (root/'assets'/'tex').mkdir(parents=True)
        (root/'studio'/'index.html').write_text('<!doctype html><title>Studio fixture</title>',encoding='utf-8')
        (root/'studio'/'assets'/'app.js').write_text('/* fixture */',encoding='utf-8')
        (root/'assets'/'tex'/'wood.jpg').write_bytes(b'fixture')
        (root/'secret.txt').write_text('private',encoding='utf-8')
        app=create_app(Path(self.tmp.name)/'web.db',{'STUDIO_DEMO':'1'},static_root=root)
        with TestClient(app) as c:
            self.assertIn('Studio fixture',c.get('/').text)
            self.assertEqual(c.get('/studio/assets/app.js').status_code,200)
            self.assertEqual(c.get('/assets/tex/wood.jpg').status_code,200)
            self.assertEqual(c.get('/api/studio/status').status_code,200)
            for path in ['/secret.txt','/server/studio-data.db','/assets/catalog-lamarty.js','/studio/%2e%2e/secret.txt']:
                self.assertEqual(c.get(path).status_code,404,path)
        with self.assertRaises(RuntimeError):
            create_app(Path(self.tmp.name)/'missing.db',{'STUDIO_DEMO':'1'},static_root=root/'missing')

    def test_live_database_backup_preserves_projects_and_versions(self):
        self.assertEqual(self.a.post('/api/studio/projects',json=self.payload()).status_code,200)
        self.assertEqual(self.a.post('/api/studio/projects',json=self.payload(1)).status_code,200)
        source=Path(self.tmp.name)/'test.db'
        # Hold a WAL connection open to exercise the online SQLite backup path.
        with closing(sqlite3.connect(source)) as live:
            live.execute('PRAGMA journal_mode=WAL')
            result=backup_database(source,Path(self.tmp.name)/'backups')
            self.assertEqual(result['projects'],1)
            self.assertEqual(result['revisions'],2)
            with closing(sqlite3.connect(result['path'])) as copy:
                self.assertEqual(copy.execute('SELECT revision FROM projects').fetchone()[0],2)
                self.assertEqual(copy.execute('PRAGMA quick_check').fetchone()[0],'ok')
            again=backup_database(source,Path(self.tmp.name)/'backups')
            self.assertNotEqual(result['path'],again['path'])
            self.assertTrue(Path(result['path']).exists())
        with self.assertRaises(FileNotFoundError):
            backup_database(Path(self.tmp.name)/'missing.db',Path(self.tmp.name)/'backups')

    def test_room_obstacles_survive_save_and_revision_history(self):
        body=self.payload()
        obstacle={'id':'column','type':'column','name':'Колонна у входа','x':1800,'y':0,'z':0,'width':300,'depth':300,'height':2700}
        body['data']['room']={'width':4000,'depth':3000,'height':2700,'obstacles':[obstacle]}
        self.assertEqual(self.a.post('/api/studio/projects',json=body).status_code,200)
        loaded=self.a.get('/api/studio/projects/test-project').json()['data']
        self.assertEqual(loaded['room']['obstacles'],[obstacle])
        body['revision']=1
        body['data']['room']['obstacles'][0]['x']=2100
        self.assertEqual(self.a.post('/api/studio/projects',json=body).status_code,200)
        previous=self.admin.get('/api/studio/projects/test-project/revisions/1').json()['data']
        self.assertEqual(previous['room']['obstacles'][0]['x'],1800)
        current=self.a.get('/api/studio/projects/test-project').json()['data']
        self.assertEqual(current['room']['obstacles'][0]['x'],2100)

    def test_ownership_and_admin(self):
        self.assertEqual(self.a.post('/api/studio/projects',json=self.payload()).status_code,200)
        self.assertEqual(self.b.get('/api/studio/projects/test-project').status_code,404)
        self.assertEqual(self.b.post('/api/studio/projects',json=self.payload(1)).status_code,403)
        self.assertEqual(self.b.get('/api/studio/projects?all=true').status_code,403)
        self.assertEqual(len(self.admin.get('/api/studio/projects?all=true').json()['items']),1)
        self.assertEqual(self.admin.get('/api/studio/projects/test-project').status_code,200)
    def test_concurrent_saves_preserve_one_winner_and_exact_history(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        self.assertEqual(self.a.post('/api/studio/projects',json=self.payload()).status_code,200)
        second=self.login('one@example.test')
        barrier=Barrier(2)
        def save(args):
            client,name=args
            body=self.payload(1);body['name']=name;body['data']['note']=name
            barrier.wait(timeout=5)
            return name,client.post('/api/studio/projects',json=body)
        try:
            with ThreadPoolExecutor(max_workers=2) as workers:
                results=list(workers.map(save,[(self.a,'Вариант A'),(second,'Вариант B')]))
            self.assertEqual(sorted(response.status_code for _,response in results),[200,409])
            winner=next(name for name,response in results if response.status_code==200)
            current=self.a.get('/api/studio/projects/test-project').json()
            self.assertEqual(current['revision'],2)
            self.assertEqual(current['name'],winner)
            self.assertEqual(current['data']['note'],winner)
            history=self.a.get('/api/studio/projects/test-project/revisions').json()
            self.assertEqual([item['revision'] for item in history['items']],[2,1])
            self.assertEqual(self.a.get('/api/studio/projects/test-project/revisions/2').json()['data']['note'],winner)
        finally:
            second.close()

    def test_revision_archive_restore(self):
        self.a.post('/api/studio/projects',json=self.payload())
        self.assertEqual(self.a.post('/api/studio/projects',json=self.payload()).status_code,409)
        self.assertEqual(self.a.post('/api/studio/projects',json=self.payload(1)).json()['revision'],2)
        self.a.post('/api/studio/projects/test-project/archive')
        self.assertEqual(self.a.get('/api/studio/projects').json()['items'],[])
        self.assertEqual(len(self.a.get('/api/studio/projects?archived=true').json()['items']),1)
        self.a.post('/api/studio/projects/test-project/archive?archived=false')
        self.assertEqual(len(self.a.get('/api/studio/projects').json()['items']),1)
    def test_history_access_and_non_destructive_restore(self):
        old=self.payload();old['data']['note']='Первый вариант'
        self.a.post('/api/studio/projects',json=old)
        new=self.payload(1);new['data']['note']='Второй вариант'
        self.a.post('/api/studio/projects',json=new)
        path='/api/studio/projects/test-project/revisions'
        self.assertEqual(self.b.get(path).status_code,404)
        self.assertEqual(self.b.get(path+'/1').status_code,404)
        self.assertEqual([r['revision'] for r in self.admin.get(path).json()['items']],[2,1])
        restored=self.a.get(path+'/1').json()
        self.assertEqual(restored['currentRevision'],2)
        self.assertEqual(restored['data']['note'],'Первый вариант')
        self.assertEqual(self.a.get('/api/studio/projects/test-project').json()['data']['note'],'Второй вариант')
        body=self.payload(restored['currentRevision']);body['data']=restored['data']
        self.assertEqual(self.a.post('/api/studio/projects',json=body).json()['revision'],3)
        self.assertEqual(self.a.get(path+'/2').json()['data']['note'],'Второй вариант')
        self.assertEqual(self.a.get(path+'/99').status_code,404)
    def test_csrf_and_logout(self):
        self.assertEqual(self.a.post('/api/studio/projects',json=self.payload(),headers={'origin':'https://outside.example'}).status_code,403)
        self.a.post('/api/studio/logout')
        self.assertEqual(self.a.get('/api/studio/projects').status_code,401)
    def test_code_replay_and_limits(self):
        email='retry@example.test';c=TestClient(self.app,headers={'x-studio-request':'1'})
        code=c.post('/api/studio/auth/code',json={'email':email}).json()['demoCode']
        self.assertEqual(c.post('/api/studio/auth/verify',json={'email':email,'code':code}).status_code,200)
        self.assertEqual(c.post('/api/studio/auth/verify',json={'email':email,'code':code}).status_code,400)
        for i in range(5):self.assertEqual(c.post('/api/studio/auth/code',json={'email':email}).status_code,200)
        self.assertEqual(c.post('/api/studio/auth/code',json={'email':email}).status_code,429)
        c.close()
    def test_demo_never_sends_real_email(self):
        self.assertEqual(self.a.post('/api/studio/auth/code',json={'email':'someone@real.example'}).status_code,403)

if __name__=='__main__':unittest.main(verbosity=2)
