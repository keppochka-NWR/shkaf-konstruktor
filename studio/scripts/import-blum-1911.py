from pathlib import Path
import openpyxl,json,hashlib,re,decimal,collections
source=Path(r'C:\Users\My PC\Downloads\Прайс Блюм.xlsx');s=openpyxl.load_workbook(source,read_only=True,data_only=True).active
items=collections.defaultdict(list);omitted=[]
for row,r in enumerate(s.iter_rows(min_row=7,values_only=True),7):
 if not r[0]:continue
 if not r[5]:omitted.append(row);continue
 if not isinstance(r[13],(int,float)):raise ValueError(f'No price: {row}')
 article=str(r[0]).strip();name=str(r[5]).strip();unit=re.sub(r'[()]','',name.split(',')[-1]).strip()
 items[article].append(dict(row=row,name=name,price=r[13],stock=r[14],unit=unit))
out=[]
for article,rs in items.items():
 price=max(decimal.Decimal(str(r['price'])) for r in rs);selected=[r for r in rs if decimal.Decimal(str(r['price']))==price];units=sorted(set(r['unit'] for r in rs));stocks=sorted(set(r['stock'] for r in rs if isinstance(r['stock'],(int,float))))
 out.append(dict(article=article,name=selected[0]['name'],clientPrice=float((price*decimal.Decimal('1.6')).quantize(decimal.Decimal('.01'),rounding=decimal.ROUND_HALF_UP)),unit=units[0] if len(units)==1 else None,unitVariants=units,stockSnapshot=stocks[0] if len(stocks)==1 else None,stockVariants=stocks,rows=[r['row'] for r in rs],priceConflict=len({r['price'] for r in rs})>1))
meta=dict(source='Прайс Блюм.xlsx',sheet=s.title,date='2026-10-16',currency='RUB',includesVat=True,multiplier=1.6,duplicatePolicy='maximum',sha256=hashlib.sha256(source.read_bytes()).hexdigest(),sourceRows=sum(map(len,items.values())),omittedHeadingRows=omitted)
Path('src/blumPriceCatalog.ts').write_text('// Generated from the user supplied workbook. Client prices only; stock is a dated snapshot, not live availability.\nexport const blumPriceSource='+json.dumps(meta,ensure_ascii=False)+' as const;\nexport const blumPriceCatalog='+json.dumps(out,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
Path('reports/blum-import-1911.json').write_text(json.dumps(dict(metadata=meta,uniqueArticles=len(out),conflicts=[i for i in out if i['priceConflict']],ambiguousUnits=[i for i in out if i['unit'] is None]),ensure_ascii=False,indent=2),encoding='utf-8')
print('Imported',len(out),'unique articles,',sum(i['priceConflict'] for i in out),'price conflicts,',sum(i['unit'] is None for i in out),'ambiguous units; omitted',len(omitted),'heading/subtotal rows')
