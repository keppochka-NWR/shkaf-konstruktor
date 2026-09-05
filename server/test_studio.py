import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent/'.studio-deps'))
from fastapi.testclient import TestClient
from studio_app import create_app

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
    def test_ownership_and_admin(self):
        self.assertEqual(self.a.post('/api/studio/projects',json=self.payload()).status_code,200)
        self.assertEqual(self.b.get('/api/studio/projects/test-project').status_code,404)
        self.assertEqual(self.b.post('/api/studio/projects',json=self.payload(1)).status_code,403)
        self.assertEqual(self.b.get('/api/studio/projects?all=true').status_code,403)
        self.assertEqual(len(self.admin.get('/api/studio/projects?all=true').json()['items']),1)
        self.assertEqual(self.admin.get('/api/studio/projects/test-project').status_code,200)
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
