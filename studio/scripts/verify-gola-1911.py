import requests,json,datetime
from pathlib import Path
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor
base=Path('data/premial/site-catalog-20261116.json');rows=json.loads(base.read_text(encoding='utf-8'))['items'];targets=[x for x in rows if any(v in x['name'].lower() for v in ['джаз','комби']) and 'профиль' in x['name'].lower()]
def one(x):
 r=requests.get(x['url'],timeout=30);r.raise_for_status();s=BeautifulSoup(r.text,'html.parser')
 for el in s.select('[data-data]'):
  try:d=json.loads(el['data-data'])
  except:continue
  if isinstance(d,dict) and str(d.get('id'))==x['id'] and d.get('article'):
   prices=[p for p in d.get('prices',[]) if p.get('title')=='Розничная цена'];av=s.select('[itemprop="availability"]');stock=None if len(av)!=1 else av[0].get('href','').endswith('/InStock');return dict(article=d['article'],name=x['name'],url=x['url'],sitePrice=prices[0]['discount']['value'] if len(prices)==1 else None,checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),inStock=stock,availability='В наличии' if stock else 'Нет в наличии' if stock is False else 'Не подтверждено')
 raise ValueError(x['url'])
with ThreadPoolExecutor(max_workers=3) as pool:result=list(pool.map(one,targets))
Path('reports/premial-gola-1911.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print('verified',len(result))
for x in result:
 if 'Хром матовый' in x['name'] and '6000' in x['name'] and 'СВЕТ' not in x['name']:print(x['article'],x['name'],x['sitePrice'])
