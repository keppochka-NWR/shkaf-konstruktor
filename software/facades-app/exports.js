(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'),require('./visuals.js'));
  else root.FacadeExport=factory(root.FacadeCore,root.FacadeVisuals);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,V){
  'use strict';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(x,n=2)=>Number(x).toLocaleString('ru-RU',{maximumFractionDigits:n});
  const rub=x=>fmt(x)+' ₽';
  const value=x=>x==null?'не задано':fmt(x);
  const hasPrices=row=>row.lines.some(line=>line.total!=null);
  const CSS=`
    :root{font-family:Arial,sans-serif;color:#183047;background:#e9edf1;font-size:13px;line-height:1.4}
    *{box-sizing:border-box}body{margin:0}.toolbar{padding:14px 24px;background:#172c3d;color:white;display:flex;justify-content:space-between;align-items:center;gap:12px}.toolbar button{border:0;border-radius:6px;padding:10px 18px;background:#3157db;color:#fff;font:inherit;cursor:pointer}.document{max-width:1120px;margin:24px auto;padding:34px;background:white;box-shadow:0 4px 24px #172c3d16}h1{font-size:28px;line-height:1.15;margin:0 0 8px}h2{font-size:21px;margin:0 0 6px}h3{font-size:14px;margin:14px 0 7px}.eyebrow{letter-spacing:.1em;color:#607183;font-size:11px;text-transform:uppercase;margin:0 0 9px}.muted,.note{color:#617183}.note{font-size:11px;margin:8px 0;overflow-wrap:anywhere}.meta{white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0}.spec{width:100%;border-collapse:collapse;margin:18px 0;font-size:12px}.spec th,.spec td{border-bottom:1px solid #d9e0e5;padding:8px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.spec th{background:#f2f5f7;font-size:11px;color:#526579}.number{white-space:nowrap}.total{padding:15px;background:#f1f5f5;border-left:4px solid #5a7282;margin:15px 0}.total strong{font-size:19px}.incomplete{color:#9e4d12}.part{border-top:2px solid #344f63;padding-top:20px;margin-top:30px;break-before:page}.part-title{display:flex;justify-content:space-between;gap:20px;align-items:start}.part-title .count{font-size:15px;white-space:nowrap}.description{margin:7px 0;color:#526579;overflow-wrap:anywhere}.view{margin:0;border:1px solid #dce3e8;border-radius:5px;background:#fff}.view svg{display:block;width:100%;height:auto}.view figcaption{padding:7px 11px;background:#f5f7f9;font-size:11px;color:#556b7b}.appearance{width:58%;margin:14px auto}.drawings{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.compact{margin:7px 0}.compact td,.compact th{padding:5px}.warnings{font-size:11px;color:#795122;margin:10px 0;padding-left:18px}.footer{font-size:10px;color:#6c7b88;border-top:1px solid #dce3e8;padding-top:9px;margin-top:16px}.no-print{display:block}
    @media screen and (max-width:720px){.document{padding:18px;margin:0}.drawings,.detail-grid{grid-template-columns:1fr}.appearance{width:100%}.spec{font-size:11px}.toolbar{position:static}.part-title{display:block}}
    @media print{@page{size:A4 portrait;margin:11mm}:root{background:white;font-size:10px}body{background:white}.no-print{display:none}.document{max-width:none;margin:0;padding:0;box-shadow:none}h1{font-size:23px}h2{font-size:17px}h3{font-size:11px;margin:8px 0 4px}.spec{font-size:9px;margin:12px 0}.spec th{font-size:9px}.spec td,.spec th{padding:5px 4px}.part{margin-top:0;padding-top:0;border-top:0;break-before:page;page-break-before:always}.part-visuals{break-inside:avoid-page;page-break-inside:avoid}.description{margin:4px 0}.appearance{width:48%;margin:7px auto}.drawings{grid-template-columns:1fr 1fr;gap:8px;margin:7px 0;break-inside:avoid-page;page-break-inside:avoid}.view,.total{break-inside:avoid}.view figcaption{font-size:9px;padding:4px 7px}.detail-grid{grid-template-columns:1fr 1fr;gap:14px;break-inside:avoid-page;page-break-inside:avoid}.compact{margin:4px 0}.note,.warnings{font-size:9px;margin:5px 0}.total{padding:10px}.total strong{font-size:15px}.footer{font-size:8px;margin-top:8px}.part-title .count{font-size:11px}thead{display:table-header-group}tr{break-inside:avoid}}
  `;
  async function fetchImage(path,options){
    if(/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z\d+/=\s]+$/i.test(path))return path;
    if(!/^assets\/[\w./%-]+$/.test(path)||path.split('/').includes('..'))throw Error('Неподдерживаемый путь образца: '+path);
    let data;
    if(options.assetLoader)data=await options.assetLoader(path);
    else{
      const base=options.baseURL||(typeof document!=='undefined'?document.baseURI:null);
      if(!base)throw Error('Для экспорта изображений нужен адрес каталога');
      const response=await fetch(new URL(path,base));
      if(!response.ok)throw Error('Образец не загружен: '+path+' ('+response.status+')');
      const blob=await response.blob();
      data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Не удалось встроить образец: '+path));reader.readAsDataURL(blob);});
    }
    if(!/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z\d+/=\s]+$/i.test(data||''))throw Error('Не удалось встроить изображение: '+path);
    return data;
  }
  function drillingTable(p){
    const d=p.drilling,rows=V.drillingRows(p);
    if(!d.enabled)return '<p class="note">Присадка не задана для этой позиции.</p>';
    return '<p class="note">Вид сзади. X — от левого края, Y — от верхнего края обратной стороны. Сторона: '+(d.side==='left'?'левая':'правая')+'. Координаты относятся к каждой детали этой позиции.</p><table class="spec compact"><thead><tr><th>№</th><th>X, мм</th><th>Y, мм</th><th>Ø, мм</th><th>Глубина, мм</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r.n+'</td><td>'+value(r.x)+'</td><td>'+value(r.y)+'</td><td>'+value(r.diameter)+'</td><td>'+value(r.depth)+'</td></tr>').join('')+'</tbody></table>'+(!rows.length?'<p class="incomplete">Координаты не заданы.</p>':'')+(d.depth==null?'<p class="note incomplete">Глубина отверстий не задана.</p>':'');
  }
  function pricingTable(p){
    const row=C.calculatePart(p);
    return '<table class="spec compact"><thead><tr><th>Работа / материал</th><th>Объём</th><th>Ставка</th><th>Сумма</th></tr></thead><tbody>'+row.lines.map(l=>'<tr><td>'+esc(l.label)+'</td><td>'+fmt(l.amount,4)+' '+esc(l.unit)+'</td><td>'+(l.rate==null?'Ставка не задана':rub(l.rate))+'</td><td>'+(l.total==null?'Не оценено':rub(l.total))+'</td></tr>').join('')+'</tbody></table><p><b>'+(!hasPrices(row)?'Цена не рассчитана':(row.complete?'Стоимость позиции: ':'Учтённая часть: ')+rub(row.known))+'</b></p>'+(row.complete?'':'<p class="incomplete note">'+(hasPrices(row)?'Стоимость позиции неполная. ':'')+'Не оценено: '+esc(row.missing.join('; '))+'.</p>')+(p.rateNote?'<p class="note">Источник ставки: '+esc(p.rateNote)+'</p>':'');
  }
  async function html(project,catalog={},legacy={},options={}){
    if(!C||!V)throw Error('Не загружены расчёт и визуализация фасадов');
    const combined=Object.assign({},catalog,legacy),valid=C.parseProject(project,combined);
    const images={...(options.images||{})};
    await Promise.all(V.imagesFor(valid,combined,legacy).map(async path=>{images[path]=await fetchImage(images[path]||path,options);}));
    const est=C.estimate(valid),client=options.client??valid.client??'',comment=options.comment??valid.comment??'';
    const dated=options.date||new Date().toLocaleDateString('ru-RU');
    let body='<div class="no-print toolbar"><span>Коммерческое предложение · автономная копия</span><button type="button" onclick="window.print()">Печать / сохранить PDF</button></div><main class="document"><section class="overview"><p class="eyebrow">Ё Софт · фасады</p><h1>Коммерческое предложение</h1><h2>'+esc(valid.name)+'</h2><p class="muted">'+esc(dated)+' · '+est.qty+' шт. · '+fmt(est.area,3)+' м² · '+valid.parts.length+' поз.</p>'+(client?'<p class="meta"><b>Клиент:</b> '+esc(client)+'</p>':'')+(comment?'<p class="meta"><b>Комментарий:</b> '+esc(comment)+'</p>':'');
    body+='<table class="spec"><thead><tr><th>№ / позиция</th><th>Исполнение</th><th>H × W × T, мм</th><th>Кол.</th><th>Площадь, м²</th><th>Стоимость</th></tr></thead><tbody>';
    valid.parts.forEach((p,i)=>{const row=est.rows[i];body+='<tr><td><b>'+(i+1)+'. '+esc(p.name)+'</b></td><td>'+esc(V.describe(p,combined,legacy))+'</td><td>'+fmt(p.h)+' × '+fmt(p.w)+' × '+fmt(p.t)+'</td><td>'+p.qty+'</td><td>'+fmt(row.area,4)+'</td><td>'+(!hasPrices(row)?'<span class="incomplete">Цена не рассчитана</span>':row.complete?rub(row.known):'<span class="incomplete">Не полностью оценено</span><br>Учтено '+rub(row.known))+'</td></tr>';});
    body+='</tbody></table><div class="total"><strong>'+(!est.rows.some(hasPrices)?'Цена не рассчитана':(est.missing?'Учтённая часть заказа: ':'Стоимость заказа по заданным ставкам: ')+rub(est.known))+'</strong>'+(est.rounding?'<p>Округление по заказу: '+rub(est.rounding)+'</p>':'')+'<p>'+(est.missing?'Не оценено '+est.missing+' составляющих. Итоговая стоимость заказа не определена. Неоценённые работы и материалы перечислены в расчёте каждой позиции.':'Все расчётные строки имеют заданные ставки.')+'</p></div><p class="note">Состав каждой позиции и замечания приведены далее. Условия оплаты, доставки и монтажа согласуются отдельно, если они не включены в указанные ставки.</p></section>';
    valid.parts.forEach((p,i)=>{
      const warnings=C.warnings(p,combined),prefix='quote_'+i+'_'+p.id;
      const svgOptions={images};
      body+='<section class="part" data-position-id="'+esc(p.id)+'"><div class="part-visuals"><div class="part-title"><div><p class="eyebrow">Позиция '+(i+1)+' из '+valid.parts.length+'</p><h2>'+esc(p.name)+'</h2></div><strong class="count">'+p.qty+' шт. · H '+fmt(p.h)+' × W '+fmt(p.w)+' × T '+fmt(p.t)+' мм</strong></div><p class="description">'+esc(V.describe(p,combined,legacy))+'</p><figure class="view appearance">'+V.front(p,combined,legacy,{...svgOptions,dimensions:false,idPrefix:prefix+'_visual'})+'<figcaption>Визуализация выбранного исполнения</figcaption></figure><p class="note">'+esc(V.note(p,combined,legacy))+'</p><div class="drawings"><figure class="view">'+V.front(p,combined,legacy,{...svgOptions,dimensions:true,idPrefix:prefix+'_front'})+'<figcaption>Габаритный чертёж · лицевая сторона</figcaption></figure><figure class="view">'+V.back(p,combined,legacy,{...svgOptions,dimensions:true,idPrefix:prefix+'_back'})+'<figcaption>Размерная схема · обратная сторона и присадка</figcaption></figure></div></div><div class="detail-grid"><div><h3>Присадка каждой детали</h3>'+drillingTable(p)+'</div><div><h3>Расчёт позиции · '+p.qty+' шт.</h3>'+pricingTable(p)+'</div></div>'+(warnings.length?'<h3>Требует проверки / согласования</h3><ul class="warnings">'+warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>':'')+'<p class="footer">Все размеры в мм. Эскизы и ручная присадка требуют проверки относительно фурнитуры и корпуса до изготовления. Это не управляющая программа для станка.</p></section>';
    });
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(valid.name)+' — КП фасадов</title><style>'+CSS+'</style></head><body>'+body+'</main></body></html>';
  }
  return {html,drillingTable};
});
