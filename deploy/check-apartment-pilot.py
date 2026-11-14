import sys,json,base64
from pathlib import Path
sys.path[:0]=['/mnt/c/YoConstructorTest-20261114','/opt/yo-assistant-deps']
from PIL import Image,ImageDraw
from studio_assistant import AssistantRequest,ask_codex
root=Path('/mnt/c/YoConstructorAI')
im=Image.new('RGB',(1000,650),'white');d=ImageDraw.Draw(im)
d.rectangle((50,100,550,475),outline='black',width=5);d.rectangle((550,100,925,475),outline='black',width=5)
d.text((200,200),'ROOM A\n4000 x 3000 mm\norigin X=0 Z=0',fill='black');d.text((650,200),'ROOM B\n3000 x 3000 mm\norigin X=4000 Z=0',fill='black')
note=Image.new('RGB',(800,600),'white');n=ImageDraw.Draw(note);n.text((40,40),'CONFIRMED MEASUREMENTS\nBoth rooms height: 2700 mm\nA: 4000 x 3000\nB: 3000 x 3000\nFurniture: none',fill='black')
im.save(root/'synthetic-apartment.pdf',save_all=True,append_images=[note])
body=AssistantRequest(message='Проанализируй обе страницы PDF. Добавь обе комнаты квартиры по указанным подтвержденным размерам и координатам. Существующую тестовую комнату оставь. Мебель не добавляй. Назови новые комнаты A и B.',context={'activeRoomId':'r1','rooms':[{'id':'r1','name':'Тестовая','dimensions':{'width':4000,'depth':3000,'height':2700},'modules':[]}]},attachments=[{'name':'synthetic-apartment.pdf','data':'data:application/pdf;base64,'+base64.b64encode((root/'synthetic-apartment.pdf').read_bytes()).decode()}])
cfg={'STUDIO_CODEX_NODE':'/mnt/c/Tools/Node/node-v26.13.0-win-x64/node.exe','STUDIO_CODEX_SCRIPT':'C:\\YoConstructorTest-20261114\\assistant_codex.cjs'}
result=ask_codex(cfg,body);(root/'apartment-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
assert len(result['rooms'])==2,result
assert sorted(r['width'] for r in result['rooms'])==[3000,4000],result
assert all(r['height']==2700 and r['depth']==3000 for r in result['rooms']),result
assert not result['furniture'],result
print(json.dumps({'ok':True,'pdfPages':2,'rooms':len(result['rooms']),'model':'gpt-6-astra'}))
