// Критик релиза 22.10, раунд 2: K3 (карточка КП изделия «после финального расчёта» — не «0 ₽»), K4 (доли цен изделий монотонны по
// материалу, без целолистового шага отдельной сметы), K5 (панель «Двери купе под ключ» = графа «Двери купе» сметы),
// K6 (шкаф-купе 2600: обе установки дверей — одинаково, предел — лист корпуса и система ARISTO).
import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate,kupeLdspPerM2,MARKUP_DEFAULT} from '../src/pricing';
import {moduleQuote,modulePrices,PENDING_ITEM_PRICE} from '../src/itemPrices';
import {quoteHTML,QUOTE_PENDING_PRICE} from '../src/exports';
import {clientSheet} from '../src/estimateXlsx';
import {newProject,parseProject,type Project} from '../src/project';
import {initialModule,validate,kupeBodyMax} from '../src/model';
import {kitchenTemplate} from '../src/kitchenProject';
import {KITCHEN} from '../src/kitchen';
import {createKitchenRow,createKupeWardrobe} from '../src/ModulePalette';
import {kupeLines,kupeTotal} from '../src/kupe';
import {KUPE_FILLS} from '../src/kupeData';

const src={decor:'Белый',facadeDecor:'Белый'};
/** кухонные модули по отдельности в большой комнате: навесные на своей высоте */
function kitchenSet(kinds:[Parameters<typeof kitchenTemplate>[0],number][]):Project{
  const p:Project={...newProject(),room:{...newProject().room,width:10000,depth:5000,height:2700}};let x=100;
  p.modules=kinds.map(([k,w],i)=>{const m=kitchenTemplate(k,w,src);const a={id:'k'+i,x,y:k==='wall'?KITCHEN.baseHeight+KITCHEN.worktopThickness+KITCHEN.wallGap:0,z:3,rotation:0,module:m};x+=m.width+300;return a;});
  return p;
}

test('K4: доли цен изделий монотонны по материалу — навесной 600 дороже 400, угловой 900 дороже нижнего 400; сумма = итог',()=>{
  const p=kitchenSet([['wall',400],['wall',600],['base-corner',900],['base-doors',400],['base-doors',600]]),e=estimate(p);
  const items=modulePrices(p,e.retail)!;assert.ok(items,'цены изделий есть');
  assert.equal(items.reduce((s,v)=>s+v,0),e.retail,'сумма карточек = итог');
  const [w4,w6,c9,b4,b6]=items;
  assert.ok(w6>w4,`навесной 600 (${w6}) > 400 (${w4})`);
  assert.ok(b6>b4,`нижний 600 (${b6}) > 400 (${b4})`);
  assert.ok(c9>b4,`угловой 900 (${c9}) > нижний 400 (${b4})`);
});

test('K3: изделие только из позиций «после финального расчёта» (столешница) — в КП и Excel «цена после финального расчёта», не 0 ₽',()=>{
  const p:Project={...newProject(),room:{...newProject().room,width:3600},modules:createKitchenRow(3000,initialModule())};
  const e=estimate(p),q=moduleQuote(p,e.retail)!;assert.ok(q);
  assert.equal(q.prices.reduce((s,v)=>s+v,0),e.retail,'сумма = итог');
  const wt=p.modules.findIndex(a=>a.module.worktop);assert.ok(wt>=0,'в ряду есть столешница');
  assert.equal(q.prices[wt],0);assert.equal(q.pending[wt],true,'столешница — после финального расчёта');
  const html=quoteHTML(p,'Тест',String(e.retail),'',undefined,{cost:e,items:q.prices,pending:q.pending});
  assert.ok(html.includes(QUOTE_PENDING_PRICE),'карточка столешницы — «цена после финального расчёта конструктором»');
  assert.ok(!/class="q-price">0 ₽/.test(html),'нет карточки «0 ₽»');
  assert.equal(QUOTE_PENDING_PRICE,PENDING_ITEM_PRICE);
  const sh=JSON.stringify(clientSheet(p,e).rows);
  assert.ok(sh.includes(PENDING_ITEM_PRICE),'Excel «Кратко для клиента» — та же подпись');
  // одно изделие только из позиций после расчёта — без цены изделия (не «итог целиком»)
  const only={...p,modules:[p.modules[wt]]};
  assert.equal(moduleQuote(only,1000),null);
});

test('K5: панель «Двери купе под ключ» = графа «Двери купе» сметы (одно округление) — шкафы-купе, разные полотна по дверям',()=>{
  let n=0;
  for(const mount of ['inside','free'] as const)for(const [w,h] of [[2400,2600],[2400,2400],[1800,2400]])for(let i=0;i<KUPE_FILLS.length;i+=9){
    const mods=createKupeWardrobe(w,h,600,initialModule(),undefined,mount),k=mods.find(a=>a.module.kupe)!;
    k.module.kupe={...k.module.kupe!,fills:Array.from({length:k.module.kupe!.doors},(_,j)=>j===1?KUPE_FILLS[i].n:'Зеркало Серебро 4мм')};
    const panel=kupeTotal(kupeLines(k.module,x=>kupeLdspPerM2(x,MARKUP_DEFAULT)));
    const e=estimate({...newProject(),room:{...newProject().room,width:3000,height:2800},modules:mods});
    assert.equal(panel,e.split.kupe,`${mount} ${w}×${h} ${KUPE_FILLS[i].n}`);n++;
  }
  assert.ok(n>=40,'проверено '+n);
});

test('K6: шкаф-купе 2600 принимается при обеих установках дверей; выше листа корпуса — одинаково нет',()=>{
  for(const mount of ['inside','free'] as const){
    const mods=createKupeWardrobe(2400,2600,600,initialModule(),undefined,mount);
    for(const a of mods)assert.deepEqual(validate(a.module),[],`${mount}: ${a.module.name}`);
    assert.throws(()=>createKupeWardrobe(2400,kupeBodyMax()+20,600,initialModule(),undefined,mount),/Высота|высота/,mount+': выше листа');
  }
  // корпус «двери отдельно» помечен и переживает файл проекта
  const free=createKupeWardrobe(2400,2600,600,initialModule(),undefined,'free'),p={...newProject(),modules:free};
  const back=parseProject(JSON.parse(JSON.stringify(p)));
  assert.ok(back.modules.filter(a=>!a.module.kupe).every(a=>a.module.kupeBody===true));
  // обычный шкаф — прежний предел 2500
  assert.ok(validate({...initialModule(),height:2600}).some(e=>/Высота/.test(e)));
});
