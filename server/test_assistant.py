import unittest
import base64
from unittest.mock import patch
from fastapi.testclient import TestClient
from test_studio import StudioTests
from studio_assistant import content_files,Attachment,Proposal

class AssistantTests(StudioTests):
    def test_auth_and_unconfigured(self):
        with TestClient(self.app,headers={'x-studio-request':'1'}) as guest:
            self.assertEqual(guest.post('/api/studio/assistant',json={'message':'Привет','context':{}}).status_code,401)
        self.assertFalse(self.a.get('/api/studio/assistant/status').json()['configured'])
        self.assertEqual(self.a.post('/api/studio/assistant',json={'message':'Привет','context':{}}).status_code,503)
    def test_no_code_or_extra_properties(self):
        with self.assertRaises(Exception):Proposal.model_validate({'message':'x','warnings':[],'questions':[],'rooms':[],'furniture':[],'code':'delete files'})
    def test_invalid_attachment_and_size(self):
        for data in ['https://example.test/private','data:image/png;base64,AAAA']:
            r=self.a.post('/api/studio/assistant',json={'message':'Разбери','context':{},'attachments':[{'name':'image.png','data':data}]})
            self.assertEqual(r.status_code,422)
    def test_schema_validated_response_and_no_project_mutation(self):
        result={'message':'Уточните размеры','warnings':[],'questions':[{'question':'Фасады?','options':['ЛДСП','МДФ краска']}],'rooms':[],'furniture':[]}
        with patch('studio_assistant.ask_openai',return_value=result):
            response=self.a.post('/api/studio/assistant',json={'message':'Разбери шкаф','context':{}})
        self.assertEqual(response.json(),result)
        self.assertEqual(self.a.get('/api/studio/projects').json()['items'],[])
        self.assertEqual(len(self.a.get('/api/studio/assistant/history/default').json()['messages']),2)
        self.assertEqual(self.b.get('/api/studio/assistant/history/default').json()['messages'],[])
    def test_validated_dimensions_and_required_operations(self):
        valid={'message':'ok','warnings':[],'questions':[],'rooms':[],'furniture':[],'updates':[]}
        self.assertEqual(Proposal.model_validate(valid).message,'ok')
        valid['rooms']=[{'name':'x','width':4000,'height':2700,'depth':3000,'x':0,'z':0}]
        Proposal.model_validate(valid)
        valid['rooms'][0]['width']=float('nan')
        with self.assertRaises(Exception):Proposal.model_validate(valid)

if __name__=='__main__':unittest.main()
