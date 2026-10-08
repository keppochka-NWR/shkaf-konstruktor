import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guillotinePack,verifyGuillotine,GUILLOTINE_DEFAULTS,type GuillotinePart,type GuillotineResult} from '../src/guillotine';
import {nest,nestPlan,details,nestingHTML,GUILLOTINE_RULES} from '../src/exports';
import {newProject,parseProject,projectErrors,type Project} from '../src/project';
import {initialModule,id} from '../src/model';
import {estimate} from '../src/pricing';
import {createCornerModule} from '../src/cornerWardrobe';

// Датасет: обезличенные раскрои Базиса из PDF базы заказов (scripts/bazis-cutting-dataset.py).
type Group={group:string;sheet:[number,number];material:'ldsp'|'hdf';textured:boolean;parts:[number,number,number][];bazisSheets:number;trim?:number};
const data:Group[]=JSON.parse(readFileSync(new URL('./fixtures/cutting-bazis.json',import.meta.url),'utf8'));
const KERF=GUILLOTINE_DEFAULTS.kerf;
/** Обрезка как у Базиса в этом заказе (числа на полях карты), но не больше, чем позволяют самые длинные детали. */
function trimFor(g:Group){
  const [L0,W0]=g.sheet;let t=g.trim??GUILLOTINE_DEFAULTS.trim;
  for(const [L,W] of g.parts)t=Math.min(t,Math.max(Math.min((L0-L)/2,(W0-W)/2),g.textured?-Infinity:Math.min((L0-W)/2,(W0-L)/2)));
  return Math.max(0,Math.floor(t*2)/2);
}
const partsOf=(g:Group):GuillotinePart[]=>{let n=0;return g.parts.flatMap(([L,W,q])=>Array.from({length:q},()=>({id:String(++n),w:W,h:L,rot:!g.textured})));};
/** Независимая от verifyGuillotine проверка: каждая деталь ровно один раз, своего размера (поворот — только без текстуры),
 *  внутри поля после обрезки, и любые две детали разнесены не меньше чем на пропил хотя бы по одной оси. */
function assertSound(r:GuillotineResult,input:GuillotinePart[],width:number,height:number,label:string){
  const byId=new Map(input.map(p=>[p.id,p])),seen=new Set<string>();
  for(const u of r.unplaced){assert.ok(byId.has(u.id),label);seen.add(u.id);}
  for(const [si,s] of r.sheets.entries()){
    const v=verifyGuillotine({width,height,items:s.items},{kerf:r.kerf,trim:r.trim,maxStages:5});
    assert.ok(v.ok,`${label} лист ${si+1}: ${v.errors.join(' ')}`);
    assert.ok(v.stages<=5&&s.stages===v.stages,`${label} лист ${si+1}: стадий ${v.stages}`);
    for(const [i,a] of s.items.entries()){
      const p=byId.get(a.id);assert.ok(p,`${label}: лишняя деталь ${a.id}`);assert.ok(!seen.has(a.id),`${label}: деталь ${a.id} дважды`);seen.add(a.id);
      if(a.rotated){assert.ok(p.rot,`${label}: повёрнута текстурная деталь ${a.id}`);assert.deepEqual([a.w,a.h],[p.h,p.w]);}else assert.deepEqual([a.w,a.h],[p.w,p.h]);
      assert.ok(a.x>=r.trim-1e-6&&a.y>=r.trim-1e-6&&a.x+a.w<=width-r.trim+1e-6&&a.y+a.h<=height-r.trim+1e-6,`${label}: деталь ${a.id} в обрезке края`);
      for(const b of s.items.slice(0,i)){
        const gapX=Math.max(b.x-(a.x+a.w),a.x-(b.x+b.w)),gapY=Math.max(b.y-(a.y+a.h),a.y-(b.y+b.h));
        assert.ok(gapX>=r.kerf-0.01||gapY>=r.kerf-0.01,`${label}: детали ${a.id} и ${b.id} ближе пропила`);
      }
    }
  }
  assert.equal(seen.size,input.length,`${label}: потеряны детали`);
}

// Подвыборка ≈ треть датасета (каждая третья группа ЛДСП 2750×1830 и 2800×2070, каждая пятая ХДФ) — тест идёт несколько секунд.
const sample=data.filter((g,i)=>g.material==='hdf'?i%5===0:i%3===0);

test('датасет Базиса: все карты гильотинные (≤ 5 стадий, пропил 4,4), детали на месте, листов не больше, чем у Базиса',()=>{
  let ours=0,bazis=0;const worse:string[]=[];
  for(const g of sample){
    const [L0,W0]=g.sheet,input=partsOf(g),r=guillotinePack(input,W0,L0,{trim:trimFor(g),iterations:GUILLOTINE_RULES.iterations});
    assert.equal(r.unplaced.length,0,g.group);
    assertSound(r,input,W0,L0,g.group);
    ours+=r.sheets.length;bazis+=g.bazisSheets;if(r.sheets.length>g.bazisSheets)worse.push(`${g.group}: ${g.bazisSheets} → ${r.sheets.length}`);
  }
  console.log(`подвыборка ${sample.length} групп: Базис ${bazis} листов, guillotine.ts ${ours}; хуже Базиса: ${worse.join(', ')||'нет'}`);
  assert.ok(sample.length>=100);
  assert.ok(ours<=bazis,`Σ листов ${ours} больше, чем у Базиса (${bazis})`);
  // Допуск: одна группа может проиграть лист (полный прогон бенча — 0 таких групп при 12 итерациях), но не больше.
  assert.ok(worse.length<=1,worse.join('; '));
});

test('гильотина детерминирована: тот же результат при повторе и при перемешанном порядке деталей',()=>{
  const g=data.find(g=>g.material==='ldsp'&&!g.textured&&g.parts.reduce((s,p)=>s+p[2],0)>60)!;
  const [L0,W0]=g.sheet,input=partsOf(g),a=guillotinePack(input,W0,L0,{trim:trimFor(g)}),b=guillotinePack(input,W0,L0,{trim:trimFor(g)});
  assert.deepEqual(a,b);
  const shuffled=[...input].sort((x,y)=>(Number(x.id)*7919)%101-(Number(y.id)*7919)%101);
  assert.deepEqual(guillotinePack(shuffled,W0,L0,{trim:trimFor(g)}),a);
  assertSound(guillotinePack(input,W0,L0,{trim:trimFor(g),seed:7}),input,W0,L0,'другой сид');
});

test('длинные и широкие детали не роняют раскрой: попадают в список «сращивать», остальные кроятся',()=>{
  const input:GuillotinePart[]=[
    {id:'цоколь',w:100,h:3000},{id:'планка',w:60,h:2740,rot:false},{id:'широкая',w:1900,h:500},{id:'поворот',w:1900,h:500,rot:true},
    {id:'бок',w:560,h:2400},{id:'полка',w:560,h:800}];
  const r=guillotinePack(input,1830,2750);
  assert.deepEqual(r.unplaced.map(u=>u.id).sort(),['планка','цоколь','широкая'].sort());
  assert.ok(r.unplaced.find(u=>u.id==='цоколь')!.reason.includes('сращивать'));
  assert.ok(r.unplaced.find(u=>u.id==='широкая')!.reason.includes('поворот запрещён'));
  assertSound(r,input,1830,2750,'длинные');
  assert.ok(r.sheets.flatMap(s=>s.items).find(a=>a.id==='поворот')!.rotated,'деталь без текстуры шире листа кладётся поперёк');
  assert.deepEqual(guillotinePack([],1830,2750).sheets,[]);
  assert.throws(()=>guillotinePack([{id:'1',w:10,h:10},{id:'1',w:20,h:20}],1830,2750));
  assert.throws(()=>guillotinePack([{id:'1',w:10,h:10}],1830,2750,{maxStages:3}));
});

test('случайные наборы: карты всегда гильотинные и полные, в том числе с поворотом и одинаковыми деталями',()=>{
  let seed=20261009;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let run=0;run<30;run++){
    const n=5+Math.floor(rand()*60),rot=run%2===0,input:GuillotinePart[]=[];
    for(let i=0;i<n;i++){const w=40+Math.round(rand()*900),h=40+Math.round(rand()*2600),q=1+Math.floor(rand()*3);for(let j=0;j<q;j++)input.push({id:`${i}.${j}`,w,h,rot});}
    const r=guillotinePack(input,1830,2750,{iterations:3});
    assert.equal(r.unplaced.length,0);assertSound(r,input,1830,2750,'случайный '+run);
  }
});

test('verifyGuillotine ловит «мельницу», пересечение, пропил меньше 4,4 и шестую стадию',()=>{
  const sheet=(items:{x:number;y:number;w:number;h:number}[])=>({width:300,height:300,items:items.map((a,i)=>({...a,id:String(i+1)}))});
  const ok=verifyGuillotine(sheet([{x:0,y:0,w:100,h:300},{x:104.4,y:0,w:195.6,h:100},{x:104.4,y:104.4,w:195.6,h:195.6}]),{kerf:4.4,trim:0});
  assert.ok(ok.ok,ok.errors.join(' '));assert.equal(ok.stages,2);
  const pinwheel=verifyGuillotine(sheet([{x:0,y:0,w:200,h:100},{x:200,y:0,w:100,h:200},{x:100,y:200,w:200,h:100},{x:0,y:100,w:100,h:200},{x:100,y:100,w:100,h:100}]),{kerf:0,trim:0});
  assert.ok(!pinwheel.ok&&pinwheel.errors.some(e=>e.includes('не гильотинная')));
  const overlap=verifyGuillotine(sheet([{x:0,y:0,w:150,h:150},{x:100,y:100,w:150,h:150}]),{kerf:0,trim:0});
  assert.ok(!overlap.ok&&overlap.errors.some(e=>e.includes('пересекаются')));
  const narrow=verifyGuillotine(sheet([{x:0,y:0,w:100,h:300},{x:102,y:0,w:100,h:300}]),{kerf:4.4,trim:0});
  assert.ok(!narrow.ok,'зазор 2 мм меньше пропила');
  const stair=verifyGuillotine(sheet([{x:0,y:0,w:10,h:300},{x:10,y:0,w:290,h:10},{x:10,y:10,w:10,h:290},{x:20,y:10,w:280,h:10},{x:20,y:20,w:10,h:280},{x:30,y:20,w:270,h:10},{x:30,y:30,w:270,h:270}]),{kerf:0,trim:0,maxStages:5});
  assert.equal(stair.stages,6);assert.ok(!stair.ok&&stair.errors.some(e=>e.includes('стадий')));
  const edge=verifyGuillotine(sheet([{x:5,y:20,w:100,h:100}]),{kerf:4.4,trim:12});
  assert.ok(!edge.ok&&edge.errors.some(e=>e.includes('обрезку')));
});

const wardrobes=(count:number)=>{const p=newProject();p.room={width:6000,depth:6000,height:2700};p.modules=Array.from({length:count},(_,i)=>({id:id(),x:(i%8)*650,z:30+Math.floor(i/8)*700,y:0,module:initialModule()}));return p;};
const withEngine=(p:Project,cuttingEngine:'classic'|'guillotine'):Project=>({...p,calculation:{...(p.calculation??{markup:2.2,overrides:{}}),cuttingEngine}});

test('флаг раскроя: по умолчанию карты и смета как раньше; «guillotine» — карты гильотинные и смета по ним',()=>{
  for(const count of [1,3,10]){
    const p=wardrobes(count),classic=nest(p);
    assert.deepEqual(nest(withEngine(p,'classic')),classic);
    assert.ok(classic.every(s=>s.guillotine===undefined));
    assert.deepEqual(estimate(withEngine(p,'classic')),estimate(p));
    const q=withEngine(p,'guillotine'),plan=nestPlan(q);
    assert.equal(plan.engine,'guillotine');assert.deepEqual(plan.unplaced,[]);
    assert.deepEqual(nest(q),plan.sheets);
    const codes=plan.sheets.flatMap(s=>s.items.map(a=>a.detail.code)).sort();
    assert.deepEqual(codes,details(p).map(d=>d.code).sort());
    for(const s of plan.sheets){
      const v=verifyGuillotine({width:s.width,height:s.height,items:s.items.map(a=>({...a,id:a.detail.code}))},{kerf:GUILLOTINE_RULES.kerf,trim:s.guillotine!.trim});
      assert.ok(v.ok,v.errors.join(' '));assert.ok(s.guillotine!.stages<=5);
    }
    const e=estimate(q);
    assert.equal(e.ldspSheets,plan.sheets.filter(s=>s.material!=='hdf').length);
    assert.equal(e.lines.find(l=>l.id==='work')!.quantity,plan.sheets.length);
    console.log(`${count} шкаф(ов): классика ${classic.length} листов, гильотина ${plan.sheets.length}`);
    assert.ok(nestingHTML(q).includes('гильотина как в Базисе'));
  }
});

test('флаг раскроя переживает сохранение/загрузку и проверяется; угловые корпуса остаются на прежнем раскрое',()=>{
  const p=withEngine(wardrobes(2),'guillotine');
  const back=parseProject(JSON.parse(JSON.stringify(p)));
  assert.equal(back.calculation?.cuttingEngine,'guillotine');
  assert.equal(parseProject(JSON.parse(JSON.stringify(wardrobes(1)))).calculation,undefined);
  const bad={...p,calculation:{...p.calculation!,cuttingEngine:'laser' as never}};
  assert.ok(projectErrors(bad).some(e=>e.includes('Движок раскроя')));
  assert.throws(()=>parseProject(JSON.parse(JSON.stringify(bad))));
  const cp=newProject(createCornerModule());cp.room.width=6500;cp.room.depth=5000;
  const corner=withEngine(cp,'guillotine');
  assert.equal(nestPlan(corner).engine,'classic');
  assert.deepEqual(nest(corner),nest({...corner,calculation:undefined}));
});
