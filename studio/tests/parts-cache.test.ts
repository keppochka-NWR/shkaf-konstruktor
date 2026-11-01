// Ревью 31.10 (скорость): «Наполнение как у этого» на 3 модулях — 16 с, Ctrl+Z — 10,5 с. parts() не запоминался, а поиск свободной
// высоты петли проверял каждую пробную высоту против всех деталей модуля. Тесты: (a) память parts() — копия, правка на месте видна,
// результат тот же, что без памяти; (b) панель «Фасады выделенных» — одно вычисление всех полей; (c) отсечка по габаритам точная.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,splitSection,type Module,type Part} from '../src/model';
import {createModule} from '../src/paletteBuild';
import {applySectionTemplate} from '../src/quickMenu';
import {partBounds,boundsGap,partPenetration} from '../src/collisions';
import {groupFacadeSummary,groupFacadeValue,GROUP_FIELDS,type GroupFacadeField} from '../src/groupFacades';
import {newProject,type Project} from '../src/project';

const wardrobe=()=>{const w=createModule('wardrobe',1000,2100,600,initialModule());const m=splitSection(w,w.sections[0].id);applySectionTemplate(m,m.sections[0].id,'drawers-shelves');return m;};
/** Тот же модуль с другим порядком ключей: другой JSON — расчёт заново, без памяти. */
const fresh=(m:Module)=>parts(Object.fromEntries(Object.entries(structuredClone(m)).reverse()) as Module);

test('(a) parts() из памяти — то же, что расчёт заново, и всегда своя копия (список и детали)',()=>{
  const m=wardrobe(),a=parts(m),b=parts(m);
  assert.deepEqual(b,a);assert.notEqual(b,a);assert.notEqual(b[0],a[0]);assert.notEqual(b[0].position,a[0].position);
  assert.deepEqual(fresh(m),a,'как без памяти');
  assert.ok(a.some(p=>p.role==='hinge'),'петли есть — горячий путь проверен');
  // вызывающий правит список и детали (applyCutouts, раскрой) — память не портится
  const pos=a[0].position[0];a[0].position[0]+=999;(a[0] as Part&{x?:number}).x=1;a.length=3;b.pop();
  const c=parts(m);assert.equal(c.length,b.length+1);assert.equal(c[0].position[0],pos);assert.equal((c[0] as Part&{x?:number}).x,undefined);
  // копия модуля (structuredClone групповых правок, разбор проекта) — тот же ответ
  assert.deepEqual(parts(structuredClone(m)),c);
});

test('(a) модуль поправили на месте — parts() считает заново',()=>{
  const m=wardrobe(),w0=Math.max(...parts(m).map(p=>p.position[0]+p.size[0]/2));
  m.width+=200;const w1=Math.max(...parts(m).map(p=>p.position[0]+p.size[0]/2));
  assert.ok(Math.abs(w1-w0-200)<1,`шире на 200: ${w0} → ${w1}`);
  m.sections[0].drawers=0;m.sections[0].drawerConfigs=undefined;
  assert.ok(!parts(m).some(p=>p.role==='drawer'&&p.sectionId===m.sections[0].id),'ящики убраны — их нет');
  assert.deepEqual(parts(m),fresh(m));
});

test('(b) «Фасады выделенных»: все поля одним вызовом = по полю; правка модуля на месте видна (память «нет фасадов»)',()=>{
  const p0=newProject(),a=wardrobe(),b=createModule('shelves',800,2000,400,initialModule());
  const p:Project={...p0,room:{...p0.room,width:8000},modules:[{id:'a',x:50,z:30,y:0,rotation:0,module:a},{id:'b',x:1400,z:30,y:0,rotation:0,module:b}]};
  const s=groupFacadeSummary(p,['a','b']);
  for(const f of Object.keys(GROUP_FIELDS) as GroupFacadeField[])assert.deepEqual(s[f],groupFacadeValue(p,['a','b'],f),f);
  assert.equal(s.facadeDecor.applicable,1,'стеллаж без фасадов — не считается');
  a.doors=false;
  assert.equal(groupFacadeValue(p,['a','b'],'facadeDecor').applicable,parts(a).some(q=>q.role==='door'||q.facadeSide||q.id.endsWith(':facade'))?1:0,'двери сняли на месте — ответ пересчитан');
});

test('(c) отсечка по габаритам точная: зазор габаритов > 5,5 мм у петли без поворота — partPenetration ≤ −зазор',()=>{
  let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const part=(o:Partial<Part>):Part=>({id:'x',name:'x',size:[10,10,10],position:[0,0,0],length:10,width:10,thickness:10,role:'body',material:'board',decor:'',grain:'length',grainAxis:0,edge:[0,0,0,0],...o} as Part);
  let checked=0;
  for(let k=0;k<4000;k++){
    const hinge=part({role:'hinge',material:'metal',size:[20,50,70],position:[rnd()*400,rnd()*400,rnd()*400],collide:[{size:[20+rnd()*20,30+rnd()*40,40+rnd()*40],position:[rnd()*400,rnd()*400,rnd()*400]},{size:[35,35,12.5],position:[rnd()*400,rnd()*400,rnd()*400]}]});
    const o=part({size:[5+rnd()*300,5+rnd()*300,5+rnd()*300],position:[rnd()*500,rnd()*500,rnd()*500],rotY:rnd()<0.5?0:rnd()*360,rotZ:rnd()<0.7?0:rnd()*360});
    const hb=partBounds(hinge),ob=partBounds(o);assert.ok(hb.aligned);
    const g=boundsGap(hb,ob);if(g<=5.5)continue;checked++;
    assert.ok(partPenetration(hinge,o)<=-g+1e-9,`зазор ${g}, SAT ${partPenetration(hinge,o)}`);
  }
  assert.ok(checked>1000,'проверено '+checked);
  assert.equal(partBounds(part({rotY:30})).aligned,false,'повёрнутая деталь — без отсечки');
});
