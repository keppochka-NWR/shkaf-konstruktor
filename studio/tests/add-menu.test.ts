// Меню «Добавить» корпуса (хотелка Макса 18.10.2026): пункты зовут те же операции, что панель «Наполнение»,
// подсветка/push/скрытый крепёж переключаются, у кухонь Базиса и сырых модулей ничего не добавляется.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,id,boxes,parts,RULES,type Module} from '../src/model';
import {kitchenWall,kitchenBase} from '../src/kitchen';
import {newProject,type Project} from '../src/project';
import {insertItem,insertGlassShelf,type FillKind} from '../src/operations';
import {estimate} from '../src/pricing';
import {MESH} from '../src/mesh';
import {addMenuItem,type AddMenuOps} from '../src/addMenu';
import type {RadialItem} from '../src/RadialMenu';

const wardrobe=():Module=>({...initialModule(),name:'Шкаф',width:1000,height:2100,depth:560,doors:true,sections:[section(),section()]});
function project(m:Module):Project{const p=newProject({...initialModule(),sections:[section()]});p.modules=[{id:id(),x:200,y:0,z:200,rotation:0,module:m}];return p;}
type Call={op:string;kind?:FillKind;opt?:{meshId?:string;glass?:boolean}};
function spy(m:Module){const calls:Call[]=[];let mod=structuredClone(m);
  const ops:AddMenuOps={drop:(kind,opt)=>calls.push({op:'drop',kind,opt}),modify:u=>{calls.push({op:'modify'});const n=structuredClone(mod);u(n);mod=n;},split:()=>calls.push({op:'split'}),openKitchen:()=>calls.push({op:'kitchen'})};
  return {calls,ops,get mod(){return mod;}};}
const find=(items:RadialItem[]|undefined,idx:string):RadialItem=>{for(const i of items??[]){if(i.id===idx)return i;const c=i.children&&(()=>{try{return find(i.children,idx);}catch{return undefined;}})();if(c)return c;}throw Error('нет пункта '+idx);};
const leaves=(i:RadialItem):RadialItem[]=>i.children?i.children.flatMap(leaves):[i];

test('«Добавить» корпуса: две группы, у каждого пункта подсказка, всё — то, что студия уже строит',()=>{
  const m=wardrobe(),s=spy(m),item=addMenuItem(m,m.sections[0].id,s.ops);
  assert.deepEqual(item.children!.map(c=>c.label),['Наполнение','Улучшения']);
  for(const c of item.children!)assert.ok(c.children!.length<=8,'в кольце не больше восьми пунктов: '+c.label);
  for(const l of leaves(item))assert.ok(l.hint&&l.hint.length>8,'подсказка у «'+l.label+'»');
  assert.deepEqual(find(item.children,'fill-items').children!.map(c=>c.id),['add-shelf','add-shelf-glass','add-drawer','add-rod','add-pantograph','mesh','pullouts','add-split']);
  assert.deepEqual(find(item.children,'fill-upgrades').children!.map(c=>c.id),['add-light','add-push','add-hidden-fastening']);
});

test('наполнение зовёт dropFilling панели: полка, стекло, ящик, штанга, пантограф, каждая сетка каталога',()=>{
  const m=wardrobe(),s=spy(m),item=addMenuItem(m,m.sections[0].id,s.ops);
  for(const k of ['add-shelf','add-shelf-glass','add-drawer','add-rod','add-pantograph'])find(item.children,k).run!();
  for(const i of MESH)find(item.children,'add-mesh-'+i.id).run!();
  assert.deepEqual(s.calls.slice(0,5),[{op:'drop',kind:'shelf',opt:undefined},{op:'drop',kind:'shelf',opt:{glass:true}},{op:'drop',kind:'drawer',opt:undefined},{op:'drop',kind:'rod',opt:undefined},{op:'drop',kind:'pantograph',opt:undefined}]);
  assert.deepEqual(s.calls.slice(5).map(c=>c.opt?.meshId),MESH.map(i=>i.id),'все позиции каталога Лемана, как в списке панели');
  assert.ok(s.calls.slice(5).every(c=>c.kind==='mesh'));
  find(item.children,'add-split').run!();assert.equal(s.calls.at(-1)!.op,'split');
});

test('подсветка, push и скрытый крепёж переключаются туда и обратно (как галочки панели)',()=>{
  const m=wardrobe(),s=spy(m);
  find(addMenuItem(s.mod,m.sections[0].id,s.ops).children,'add-light').run!();assert.equal(s.mod.standLight,true);
  const on=addMenuItem(s.mod,m.sections[0].id,s.ops);assert.equal(find(on.children,'add-light').label,'Убрать подсветку');assert.ok(find(on.children,'add-light').active);
  find(on.children,'add-light').run!();assert.equal('standLight' in s.mod,false,'повторно — поле снято, как у галочки «Подсветка в стойках»');
  find(addMenuItem(s.mod,m.sections[0].id,s.ops).children,'add-push').run!();assert.equal(s.mod.doorOpen,'push');
  find(addMenuItem(s.mod,m.sections[0].id,s.ops).children,'add-push').run!();assert.equal('doorOpen' in s.mod,false);
  find(addMenuItem(s.mod,m.sections[0].id,s.ops).children,'add-hidden-fastening').run!();assert.equal(s.mod.fastening,'eccentric');
  find(addMenuItem(s.mod,m.sections[0].id,s.ops).children,'add-hidden-fastening').run!();assert.equal('fastening' in s.mod,false);
  const p=project({...wardrobe(),standLight:true});assert.ok(estimate(p).lines.some(l=>l.id==='light-stand')||estimate(p).retailExtras>0,'подсветка уже считается сметой');
});

test('выдвижной тремпель и снятие пантографа — те же правки секции, что чипы и кнопка панели',()=>{
  const m=wardrobe(),sid=m.sections[1].id,s=spy(m);
  find(addMenuItem(s.mod,sid,s.ops).children,'pullouts-2').run!();assert.equal(s.mod.sections[1].pullouts,2);assert.equal(s.mod.sections[0].pullouts,undefined);
  find(addMenuItem(s.mod,sid,s.ops).children,'pullouts-0').run!();assert.equal('pullouts' in s.mod.sections[1],false);
  const pm=wardrobe();pm.sections[0].pantograph=true;const ps=spy(pm),it=find(addMenuItem(pm,pm.sections[0].id,ps.ops).children,'add-pantograph');
  assert.equal(it.label,'Убрать пантограф');it.run!();assert.equal(ps.mod.sections[0].pantograph,false);assert.equal(ps.mod.sections[0].rod,false);
});

test('стеклянная полка: вставка как у панели + отметка стекла; новая полка ниже не переносит стекло',()=>{
  const p=project(wardrobe()),a=p.modules[0],sid=a.module.sections[0].id,b=boxes(a.module).find(x=>x.id===sid)!;
  const g=insertGlassShelf(p,a.id,sid,b.bottom+1200),s1=g.modules[0].module.sections[0];
  assert.equal(s1.shelves.length,1);assert.deepEqual(s1.glassShelves,[0]);
  assert.ok(parts(g.modules[0].module).some(d=>d.role==='shelf'&&d.material==='glass'),'в 3D и деталировке — стекло');
  assert.ok(estimate(g).lines.some(l=>l.id==='glass-shelf'),'строка сметы «Стеклянная полка» уже есть');
  const lower=insertItem(g,'shelf',a.id,sid,b.bottom+400),s2=lower.modules[0].module.sections[0];
  assert.equal(s2.shelves.length,2);assert.deepEqual(s2.glassShelves,[1],'стекло осталось у верхней полки');
  const plain=insertItem(p,'shelf',a.id,sid,b.bottom+1200);assert.equal(plain.modules[0].module.sections[0].glassShelves,undefined,'обычная полка — ЛДСП');
});

test('кухни (и кухни Базиса), сырой модуль, купе: в «Добавить» ничего не появляется',()=>{
  for(const k of [kitchenWall(initialModule(),630),kitchenBase(initialModule(),600),{...kitchenWall(initialModule(),630),bazis:true as const}]){
    const s=spy(k),it=addMenuItem(k,k.sections[0].id,s.ops);assert.equal(it.children,undefined);it.run!();assert.deepEqual(s.calls,[{op:'kitchen'}]);
  }
  const raw:Module={...initialModule(),sections:[section()],raw:{panels:[],hardware:[],counts:{}} as unknown as Module['raw']};
  const r=addMenuItem(raw,raw.sections[0].id,spy(raw).ops);assert.equal(r.disabled,true);assert.equal(r.children,undefined);assert.match(r.hint!,/Базис/);
  const kupe={...initialModule(),sections:[section()],kupe:{} as Module['kupe']};assert.equal(addMenuItem(kupe,kupe.sections[0].id,spy(kupe).ops).disabled,true);
});

test('угловой корпус и предел секций: недоступное в панели недоступно и в меню',()=>{
  const m=wardrobe();m.sections=Array.from({length:RULES.maxSections},()=>section());
  assert.equal(find(addMenuItem(m,m.sections[0].id,spy(m).ops).children,'add-split').disabled,true);
  const c={...wardrobe(),corner:{level:'lower'} as unknown as Module['corner']},ci=addMenuItem(c,c.sections[0].id,spy(c).ops);
  for(const k of ['add-pantograph','mesh','add-split','pullouts','add-shelf-glass'])assert.equal(find(ci.children,k).disabled,true,k);
  assert.ok(!find(ci.children,'add-shelf').disabled);
});
