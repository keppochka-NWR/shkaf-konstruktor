import sys,json,base64
from pathlib import Path
sys.path[:0]=['/mnt/c/YoConstructorTest-20261114','/opt/yo-assistant-deps']
from PIL import Image,ImageDraw
from studio_assistant import AssistantRequest,ask_codex
root=Path('/mnt/c/YoConstructorAI');root.mkdir(exist_ok=True)
im=Image.new('RGB',(700,650),'white');d=ImageDraw.Draw(im)
d.rectangle((160,60,520,590),outline='black',width=5);d.line((340,60,340,590),fill='black',width=4)
for y in [190,320,450]:d.line((160,y,340,y),fill='black',width=3)
d.text((230,20),'WIDTH 1200 mm',fill='black');d.text((530,260),'HEIGHT\n2000 mm',fill='black');d.text((230,610),'DEPTH 550 mm',fill='black');im.save(root/'synthetic-wardrobe.png')
body=AssistantRequest(message='Создай по приложенному эскизу шкаф шириной 1200, высотой 2000, глубиной 550 мм. Две равные секции. Слева 3 полки, справа пустая секция. Ящиков, штанг и дверей нет. Размеры подтверждены мной. Верни предложение мебели для текущей комнаты r1.',context={'activeRoomId':'r1','rooms':[{'id':'r1','name':'Тест','dimensions':{'width':4000,'depth':3000,'height':2700},'modules':[]}]},attachments=[{'name':'synthetic-wardrobe.png','data':'data:image/png;base64,'+base64.b64encode((root/'synthetic-wardrobe.png').read_bytes()).decode()}])
cfg={'STUDIO_CODEX_NODE':'/mnt/c/Tools/Node/node-v26.13.0-win-x64/node.exe','STUDIO_CODEX_SCRIPT':'C:\\YoConstructorTest-20261114\\assistant_codex.cjs'}
result=ask_codex(cfg,body)
(root/'synthetic-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
assert len(result['furniture'])==1,result
m=result['furniture'][0];assert (m['width'],m['height'],m['depth'])==(1200,2000,550),m
assert len(m['sections'])==2 and m['sections'][0]['shelves']==3 and m['sections'][1]['shelves']==0,m
print(json.dumps({'ok':True,'model':'gpt-6-astra','furniture':len(result['furniture']),'dimensions':[m['width'],m['height'],m['depth']],'sections':len(m['sections'])}))
