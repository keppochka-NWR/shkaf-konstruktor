// Бенч раскроя: датасет карт Базиса (tests/fixtures/cutting-bazis.json) — nest() студии сейчас, старая гильотина
// nestGuillotine и новый движок guillotine.ts; плюс проекты студии (examples) с флагом calculation.cuttingEngine.
//   npx tsx scripts/cutting-bench.ts [--limit=N] [--iterations=K] [--set=ldsp|hdf|all] [--report=<путь.md>] [--json=<путь.json>]
// Отчёт печатается в консоль (markdown) и, с --report, пишется в файл.
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {packRectangles} from '../src/packing';
import {guillotinePack,verifyGuillotine,GUILLOTINE_DEFAULTS} from '../src/guillotine';
import {parseProject} from '../src/project';
import {estimate} from '../src/pricing';
import {nestPlan} from '../src/exports';

type Group={group:string;sheet:[number,number];material:'ldsp'|'hdf';textured:boolean;decorKind:string;rotated:number;rotatedTypes?:[number,number][];parts:[number,number,number][];bazisSheets:number;bazisCardFill:number[];bazisLastOffcut?:[number,number];trim?:number;kim?:number;kimWithOffcuts?:number;cuts?:number};
const arg=(name:string)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.split('=').slice(1).join('=');
const limit=Number(arg('limit')??Infinity),iterations=Number(arg('iterations')??GUILLOTINE_DEFAULTS.iterations),set=arg('set')??'all';
const here=dirname(fileURLToPath(import.meta.url));
const data:Group[]=JSON.parse(readFileSync(join(here,'../tests/fixtures/cutting-bazis.json'),'utf8'));
type Rect={id:string;w:number;h:number;rot:boolean};
type Map_={width:number;height:number;items:{id:string;x:number;y:number;w:number;h:number}[]};

/** Порт nestGuillotine из exports.ts на «сырые» детали: без поворотов, обрезка 10, промежуток gap. */
function classicGuillotine(parts:Rect[],width:number,height:number,gap=10):Map_[]{
  type Free={x:number;y:number;w:number;h:number};const result:(Map_&{free:Free[]})[]=[];
  for(const d of [...parts].sort((a,b)=>b.h*b.w-a.h*a.w)){
    if(d.w>width-20||d.h>height-20)throw Error('не помещается');
    let best:{s:(typeof result)[number];i:number;score:number}|undefined;
    for(const s of result)s.free.forEach((f,i)=>{if(f.w>=d.w&&f.h>=d.h){const score=f.w*f.h-d.w*d.h;if(!best||score<best.score)best={s,i,score};}});
    if(!best){const s={width,height,items:[],free:[{x:10,y:10,w:width-20,h:height-20}]};result.push(s);best={s,i:0,score:0};}
    const {s,i}=best,f=s.free.splice(i,1)[0];s.items.push({id:d.id,x:f.x,y:f.y,w:d.w,h:d.h});
    const rw=f.w-d.w-gap,bh=f.h-d.h-gap;
    if(rw>0)s.free.push({x:f.x+d.w+gap,y:f.y,w:rw,h:d.h});if(bh>0)s.free.push({x:f.x,y:f.y+d.h+gap,w:f.w,h:bh});
  }
  return result.map(({free,...s})=>s);
}
/** Порт nest() (прямые корпуса): минимум из классической гильотины и шести вариантов MaxRects. */
function classicNest(parts:Rect[],width:number,height:number,gap=10):Map_[]{
  let best=classicGuillotine(parts,width,height,gap);
  const footprint=(s:Map_[])=>Math.max(...s.at(-1)!.items.map(p=>p.y+p.h));
  for(const order of ['area','height','width'] as const)for(const fit of ['short','area'] as const){
    const packed=packRectangles(parts,width-20,height-20,gap,order,fit);
    if(packed.length>best.length)continue;
    const candidate=packed.map(items=>({width,height,items:items.map(a=>({id:a.id,x:a.x+10,y:a.y+10,w:a.w,h:a.h}))}));
    if(candidate.length<best.length||footprint(candidate)<footprint(best))best=candidate;
  }
  return best;
}
const median=(v:number[])=>{if(!v.length)return NaN;const s=[...v].sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const pct=(v:number)=>Number.isFinite(v)?(v*100).toFixed(1).replace('.',',')+' %':'—';
const n1=(v:number)=>Number.isFinite(v)?String(Math.round(v*10)/10).replace('.',','):'—';
const n2=(v:number)=>Number.isFinite(v)?v.toFixed(2).replace('.',','):'—';
const sign=(v:number)=>(v>0?'+':v<0?'−':'±')+Math.abs(v);

type EngineStat={sheets:number;bazisOfDone:number;fails:number;guill:number;within5:number;total:number;maxStages:number;fills:number[];lastOff:number[];ms:number[];perGroup:Map<string,number>};
const newStat=():EngineStat=>({sheets:0,bazisOfDone:0,fails:0,guill:0,within5:0,total:0,maxStages:0,fills:[],lastOff:[],ms:[],perGroup:new Map()});
/** Учёт карт движка: гильотинность и стадии — verifyGuillotine (для старых движков с их промежутком 10 и обрезкой 10). */
function account(st:EngineStat,g:Group,maps:Map_[],kerf:number,trim:number,ms:number){
  st.sheets+=maps.length;st.bazisOfDone+=g.bazisSheets;st.ms.push(ms);st.perGroup.set(g.group,maps.length);
  const A=g.sheet[0]*g.sheet[1];
  maps.forEach((m,i)=>{
    const v=verifyGuillotine(m,{kerf,trim,maxStages:99});st.total++;
    const guillotine=v.ok;
    if(guillotine){st.guill++;st.maxStages=Math.max(st.maxStages,v.stages);if(v.stages<=5)st.within5++;}
    const area=m.items.reduce((s,a)=>s+a.w*a.h,0);
    if(i<maps.length-1)st.fills.push(area/A);
    else st.lastOff.push(guillotine?Math.max(0,...v.offcuts.map(o=>o.w*o.h)):NaN);
  });
}
function trimFor(g:Group,rot:boolean){
  // Обрезка — как у Базиса в этом заказе (числа на полях карты: обычно 12, бывает 10/9/8/5/3);
  // если её нет в PDF — 12, и меньше только если иначе деталь не помещается.
  const [L0,W0]=g.sheet;let t=g.trim??GUILLOTINE_DEFAULTS.trim;
  for(const [L,W] of g.parts){
    const a=Math.min((L0-L)/2,(W0-W)/2),b=rot?Math.min((L0-W)/2,(W0-L)/2):-Infinity;
    t=Math.min(t,Math.max(a,b));
  }
  return Math.max(0,Math.floor(t*2)/2);
}

type Bucket={groups:Group[];bazis:number;bazisFills:number[];bazisLastOff:number[];classic:EngineStat;old:EngineStat;fresh:EngineStat;strict:EngineStat;lb:number;worse:{g:Group;ours:number;strict:number;lb:number}[];better:{g:Group;ours:number}[];equal:number;trimBelow12:number};
const groups=data.filter(g=>set==='all'||g.material===set).slice(0,limit);
const keyOf=(g:Group)=>`${g.material==='hdf'?'ХДФ':'ЛДСП'} ${g.sheet[0]}×${g.sheet[1]}`;
const buckets=new Map<string,Bucket>();
const t0=Date.now();
for(const [gi,g] of groups.entries()){
  const k=keyOf(g);
  if(!buckets.has(k))buckets.set(k,{groups:[],bazis:0,bazisFills:[],bazisLastOff:[],classic:newStat(),old:newStat(),fresh:newStat(),strict:newStat(),lb:0,worse:[],better:[],equal:0,trimBelow12:0});
  const b=buckets.get(k)!;b.groups.push(g);b.bazis+=g.bazisSheets;
  b.bazisFills.push(...g.bazisCardFill.slice(0,-1).map(v=>v/100));
  b.bazisLastOff.push(g.bazisLastOffcut?g.bazisLastOffcut[0]*g.bazisLastOffcut[1]:0);
  const [L0,W0]=g.sheet,width=W0,height=L0,rot=!g.textured;
  const rotTypes=new Set((g.rotatedTypes??[]).map(([L,W])=>L+'x'+W));
  let n=0;const parts:Rect[]=g.parts.flatMap(([L,W,q])=>Array.from({length:q},()=>({id:String(++n),w:W,h:L,rot})));
  n=0;const strictParts:Rect[]=g.parts.flatMap(([L,W,q])=>Array.from({length:q},()=>({id:String(++n),w:W,h:L,rot:rotTypes.has(L+'x'+W)})));
  const area=parts.reduce((s,p)=>s+p.w*p.h,0);
  // сейчас в студии: обрезка 10, промежуток 10
  let s=Date.now();
  try{const m=classicNest(parts,width,height,10);account(b.classic,g,m,10,10,Date.now()-s);}catch{b.classic.fails++;}
  s=Date.now();
  try{const m=classicGuillotine(parts,width,height,10);account(b.old,g,m,10,10,Date.now()-s);}catch{b.old.fails++;}
  // новый движок: пропил 4,4; обрезка как у Базиса в этом заказе
  const trim=trimFor(g,rot);if(trim<GUILLOTINE_DEFAULTS.trim)b.trimBelow12++;
  s=Date.now();
  const r=guillotinePack(parts,width,height,{trim,iterations});
  const ms=Date.now()-s;
  if(r.unplaced.length){b.fresh.fails++;console.warn('не помещается',g.group,r.unplaced.slice(0,2));}
  account(b.fresh,g,r.sheets.map(sh=>({width,height,items:sh.items})),r.kerf,r.trim,ms);
  // строгий вариант: поворачиваются только типоразмеры, которые Базис сам хоть раз повернул
  s=Date.now();
  const rs=guillotinePack(strictParts,width,height,{trim:trimFor(g,false),iterations});
  account(b.strict,g,rs.sheets.map(sh=>({width,height,items:sh.items})),rs.kerf,rs.trim,Date.now()-s);
  const lb=Math.ceil(area/((width-2*trim)*(height-2*trim))-1e-9);b.lb+=lb;
  const ours=r.sheets.length;
  if(ours>g.bazisSheets)b.worse.push({g,ours,strict:rs.sheets.length,lb});else if(ours<g.bazisSheets)b.better.push({g,ours});else b.equal++;
  if((gi+1)%40===0)console.error(`${gi+1}/${groups.length} групп, ${((Date.now()-t0)/1000).toFixed(1)} с`);
}

// ---- проекты студии: флаг cuttingEngine
type Side={sheets:number;ldsp:number;retail:number|null;bySheet:number;byMarkup:number|null;model:string};
type ProjectRow={name:string;classic:Side;guillotine:Side;unplaced:number;ms:number}|{name:string;error:string};
const projects:ProjectRow[]=[];
for(const sub of ['../examples','../examples/orders']){
  const path=join(here,sub);
  for(const f of readdirSync(path).filter(f=>f.endsWith('.json')).sort()){
    // имя файла заказа содержит фамилию клиента — в отчёт идёт только номер
    const name=sub.endsWith('orders')?'заказ-пример №'+f.split('-')[0]:f.replace('.project.json','');
    try{
      const p=parseProject(JSON.parse(readFileSync(join(path,f),'utf8')));
      const run=(engine:'classic'|'guillotine')=>{const q=structuredClone(p);q.calculation={...(q.calculation??{markup:2.2,overrides:{}}),cuttingEngine:engine};const s=Date.now(),plan=nestPlan(q),ms=Date.now()-s,e=estimate(q,plan.sheets);return {plan,e,ms};};
      const a=run('classic'),b=run('guillotine');
      const pick=(x:ReturnType<typeof run>):Side=>({sheets:x.plan.sheets.length,ldsp:x.e.ldspSheets,retail:x.e.retail,bySheet:x.e.bySheet,byMarkup:x.e.byMarkup,model:x.e.model});
      projects.push({name,classic:pick(a),guillotine:pick(b),unplaced:b.plan.unplaced.length,ms:b.ms});
    }catch(e){projects.push({name,error:e instanceof Error?e.message:String(e)});}
  }
}

// ---- отчёт
const lines:string[]=[];const out=(s='')=>lines.push(s);
const totalSec=((Date.now()-t0)/1000).toFixed(0);
out(`Прогон ${new Date().toISOString().slice(0,16).replace('T',' ')} UTC: групп ${groups.length}, итераций нового движка ${iterations}, всё вместе ${totalSec} с.`);
for(const [k,b] of buckets){
  const parts=b.groups.reduce((s,g)=>s+g.parts.reduce((t,p)=>t+p[2],0),0),rotGroups=b.groups.filter(g=>!g.textured).length;
  out();out(`### ${k}: ${b.groups.length} групп, ${parts} деталей (поворот разрешён в ${rotGroups} группах)`);out();
  out('| Движок | Σ листов | к Базису | гильотинных карт | из них ≤ 5 стадий | макс. стадий | КИМ, медиана (кроме последнего листа) | время на группу, ср. / макс. |');
  out('|---|---|---|---|---|---|---|---|');
  out(`| Базис (PDF «Раскрой…») | **${b.bazis}** | — | 100 % | 100 % | ≤ 5 | ${pct(median(b.bazisFills))} | до 10 с на плиту (настройка) |`);
  const row=(name:string,st:EngineStat)=>out(`| ${name} | ${st.sheets}${st.fails?` (ещё ${st.fails} гр. не раскроены)`:''} | ${sign(st.sheets-st.bazisOfDone)}${st.fails?` (на ${b.groups.length-st.fails} гр.)`:''} | ${pct(st.guill/Math.max(1,st.total))} | ${pct(st.within5/Math.max(1,st.total))} | ${st.maxStages} | ${pct(median(st.fills))} | ${n1(st.ms.reduce((s,v)=>s+v,0)/Math.max(1,st.ms.length))} / ${Math.max(0,...st.ms)} мс |`);
  row('nest() студии сейчас (MaxRects + старая гильотина; промежуток 10, обрезка 10)',b.classic);
  row('nestGuillotine (старая гильотина, без поворотов)',b.old);
  row('**guillotine.ts** (пропил 4,4; обрезка как у Базиса; ≤ 5 стадий)',b.fresh);
  row('guillotine.ts, строго: поворот только у типоразмеров, которые повернул Базис',b.strict);
  out();
  out(`Нижняя граница по площади (обрезка учтена, пропил нет): ${b.lb}. guillotine.ts против Базиса по группам: лучше — ${b.better.length}, так же — ${b.equal}, хуже — ${b.worse.length}. Обрезка Базиса меньше 12 мм в ${b.trimBelow12} группах (взята его).`);
  out(`Крупнейший цельный обрезок последнего листа, медиана: guillotine.ts ${n2(median(b.fresh.lastOff)/1e6)} м², Базис ${n2(median(b.bazisLastOff)/1e6)} м² (у Базиса — крупнейший «Обрезок» последней карты).`);
  if(b.worse.length){
    out();out('Группы, где guillotine.ts хуже Базиса:');out();
    out('| Группа | Деталей | Поворот | Нижняя граница | Базис | guillotine.ts | строго | nest() сейчас |');out('|---|---|---|---|---|---|---|---|');
    for(const w of b.worse)out(`| ${w.g.group} | ${w.g.parts.reduce((s,p)=>s+p[2],0)} | ${w.g.textured?'нет':'да'} | ${w.lb} | ${w.g.bazisSheets} | ${w.ours} | ${w.strict} | ${b.classic.perGroup.get(w.g.group)??'не раскроено'} |`);
  }
  if(b.better.length){
    out();out(`Группы, где guillotine.ts лучше Базиса: ${b.better.map(x=>`${x.g.group} (${x.g.bazisSheets} → ${x.ours}${x.g.textured?'':', поворот'})`).join('; ')}.`);
  }
}
if(projects.length){
  out();out('### Проекты студии (examples): флаг calculation.cuttingEngine');out();
  out('| Проект | Листов сейчас → гильотина | из них ЛДСП | Цена по выбранной модели сейчас → гильотина | Время гильотины |');out('|---|---|---|---|---|');
  const money=(v:number|null)=>v===null?'смета не завершена':v.toLocaleString('ru-RU')+' ₽';
  for(const p of projects){
    if('error' in p){out(`| ${p.name} | ошибка: ${p.error} | | | |`);continue;}
    out(`| ${p.name} | ${p.classic.sheets} → ${p.guillotine.sheets}${p.unplaced?` (+${p.unplaced} дет. не помещаются)`:''} | ${p.classic.ldsp} → ${p.guillotine.ldsp} | ${money(p.classic.retail)} → ${money(p.guillotine.retail)} (${p.classic.model==='sheet'?'за лист':'коэффициент'}) | ${p.ms} мс |`);
  }
}
const text=lines.join('\n');
console.log(text);
const report=arg('report');if(report){mkdirSync(dirname(report),{recursive:true});writeFileSync(report,text,'utf8');}
const json=arg('json');if(json){mkdirSync(dirname(json),{recursive:true});writeFileSync(json,JSON.stringify({iterations,buckets:[...buckets].map(([k,b])=>({k,bazis:b.bazis,lb:b.lb,classic:b.classic.sheets,old:b.old.sheets,fresh:b.fresh.sheets,strict:b.strict.sheets,perGroup:Object.fromEntries(b.groups.map(g=>[g.group,{bazis:g.bazisSheets,classic:b.classic.perGroup.get(g.group)??null,fresh:b.fresh.perGroup.get(g.group),strict:b.strict.perGroup.get(g.group)}]))})),projects},null,1));}
