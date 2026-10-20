// Расположение ручки распашного фасада (запрос Макса 20.10): снизу/сверху по центру, в углу напротив нижней/верхней петли.
import test from 'node:test';
import assert from 'node:assert/strict';
import {HANDLES,handleSpec,handleById,handleKind} from '../src/handles';
import {initialModule,parts,validate,parseModule,RULES,doorHandlePos,defaultHandlePos,handlePosIssue,setDoorHandlePos,setModuleHandlePos,handleDoors,setDoorHandleFloor,type HandlePos,type Module} from '../src/model';
import {kitchenWall,kitchenBase} from '../src/kitchen';
import {setDoorHinge} from '../src/facadeEditing';
import {mirrorModule} from '../src/operations';
import {newProject} from '../src/project';
import {holes} from '../src/drilling';

const pair=(m:Module,doorId:string)=>{const p=parts(m),d=p.find(x=>x.id===doorId)!,h=p.find(x=>x.id===doorId.replace(':door:',':handle:'))!;
  return {d,h,x0:d.position[0]-d.size[0]/2,x1:d.position[0]+d.size[0]/2,y0:d.position[1]-d.size[1]/2,y1:d.position[1]+d.size[1]/2};};
const wall=(w=600)=>kitchenWall(initialModule(),w);
const lens=[...new Map(HANDLES.filter(h=>h.len>=96&&h.len<=320&&handleKind(h)!=='profile').map(h=>[h.len,h])).values()];

test('умолчание: навесной — угол напротив нижней петли, нижний — напротив верхней, шкаф и пенал — по правилу',()=>{
  const w=wall(),b=kitchenBase(initialModule(),600),cab=initialModule();
  assert.equal(defaultHandlePos(w),'bottomCorner');assert.equal(defaultHandlePos(b),'topCorner');assert.equal(defaultHandlePos(cab),'rule');
  assert.equal(defaultHandlePos({kitchen:{role:'tall'}}),'rule');assert.equal(defaultHandlePos({kitchen:{role:'antresol'}}),'bottomCorner');
  // кухня с ручкой из проекта Базиса — не трогаем без ручного выбора
  assert.equal(defaultHandlePos({kitchen:{role:'wall',handle:{dy:50,from:'bottom',horizontal:false}}}),'rule');
  for(const id of handleDoors(w)){const {d,h,x0,x1,y0}=pair(w,id),tot=handleSpec(handleById(w.handleId)).total;
    assert.ok(h.size[1]>h.size[0],'вертикальная');assert.equal(h.position[0],d.hinge==='left'?x1-RULES.handleSide:x0+RULES.handleSide);
    assert.equal(h.position[1]-tot/2,y0+RULES.handleEdge,'низ ручки в 50 от нижнего края');}
  for(const id of handleDoors(b)){const {h,y1}=pair(b,id),tot=handleSpec(handleById(b.handleId)).total;assert.equal(h.position[1]+tot/2,y1-RULES.handleEdge,'верх ручки в 50 от верхнего края');}
  // шкаф — по центру высоты, как раньше
  const c=initialModule();c.doors=true;const id=handleDoors(c)[0];assert.ok(id);const r=pair(c,id);assert.equal(r.h.position[1],r.d.position[1]);
});

test('позиции для левой/правой петли: ширины и высоты 300–900, ручки 96–320 — внутри фасада, не на петлях',()=>{
  let checked=0,refused=0;
  for(const W of [300,450,600,750,900])for(const H of [360,600,900])for(const hd of lens)for(const side of ['left','right'] as const){
    const m=wall(W);m.height=H;m.handleId=hd.id;
    const id=handleDoors(m)[0];if(!id)continue;setDoorHinge(m,id,side);
    for(const pos of ['bottomCenter','bottomCorner','topCenter','topCorner'] as HandlePos[]){
      const n=structuredClone(m),issue=handlePosIssue(n,id,pos);
      if(issue){assert.throws(()=>setDoorHandlePos(n,id,pos));refused++;continue;}
      setDoorHandlePos(n,id,pos);const {h,x0,x1,y0,y1}=pair(n,id),sp=handleSpec(hd),horiz=pos.endsWith('Center');
      const [rw,rh]=horiz?[sp.total,sp.width]:[sp.width,sp.total];
      assert.ok(h.position[0]-rw/2>=x0-1e-6&&h.position[0]+rw/2<=x1+1e-6,`${W}×${H} ${hd.len} ${side} ${pos}: по ширине внутри`);
      assert.ok(h.position[1]-rh/2>=y0-1e-6&&h.position[1]+rh/2<=y1+1e-6,`${W}×${H} ${hd.len} ${side} ${pos}: по высоте внутри`);
      assert.equal(h.size[0]>h.size[1],horiz,'ориентация');
      if(horiz)assert.equal(h.position[0],(x0+x1)/2);
      else assert.equal(h.position[0],side==='left'?x1-RULES.handleSide:x0+RULES.handleSide,'угол — со стороны открывания');
      assert.equal(h.position[1],pos.startsWith('bottom')?(horiz?y0+RULES.handleCenterEdge:y0+RULES.handleEdge+sp.total/2):(horiz?y1-RULES.handleCenterEdge:y1-RULES.handleEdge-sp.total/2));
      const cups=parts(n).filter(p=>p.id.startsWith(id.replace(':door:',':hingecup:')+':'));assert.ok(cups.length>=2);
      for(const c of cups)assert.ok(!(Math.abs(c.position[0]-h.position[0])<(c.size[0]+rw)/2&&Math.abs(c.position[1]-h.position[1])<(c.size[1]+rh)/2),'не на чашке петли');
      checked++;}
  }
  assert.ok(checked>300,'проверено '+checked);assert.ok(refused>0,'узкие фасады отказывают горизонтальной длинной ручке');
  // 320 горизонтально на 300 — не помещается
  const m=wall(300);m.handleId=lens.find(h=>h.len===320)?.id??m.handleId;
  if(handleById(m.handleId).len===320)assert.match(handlePosIssue(m,handleDoors(m)[0],'bottomCenter')!,/не помещается/);
});

test('перевес петель и зеркало: угловая ручка переезжает в другой угол, центр — на месте',()=>{
  const m=wall(450),id=handleDoors(m)[0];setDoorHinge(m,id,'left');
  const a=pair(m,id);assert.equal(a.h.position[0],a.x1-RULES.handleSide);
  setDoorHinge(m,id,'right');const b=pair(m,id);assert.equal(b.h.position[0],b.x0+RULES.handleSide);assert.equal(b.h.position[1],a.h.position[1]);
  const proj=newProject(structuredClone(m)),mir=mirrorModule(proj,proj.modules[0].id).modules[0].module,c=pair(mir,id);
  assert.equal(c.d.hinge,'left');assert.equal(c.h.position[0],c.x1-RULES.handleSide);
  // двустворчатый: зеркало меняет расположения створок местами
  const two=wall(900),ids=handleDoors(two);assert.equal(ids.length,2);setDoorHandlePos(two,ids[0],'bottomCenter');
  const p2=newProject(structuredClone(two)),m2=mirrorModule(p2,p2.modules[0].id).modules[0].module;
  assert.deepEqual(m2.sections[0].handlePos?.slice(0,2),[null,'bottomCenter']);
});

test('откидной/подъёмный фасад: снизу по центру — горизонтально у нижнего края',()=>{
  const m=wall(600),id=handleDoors(m)[0];setDoorHinge(m,id,'top');
  const r=pair(m,id);assert.ok(r.h.size[0]>r.h.size[1]);assert.equal(r.h.position[1],r.y0+40,'как раньше');
  setDoorHandlePos(m,id,'bottomCenter');assert.equal(pair(m,id).h.position[1],r.y0+RULES.handleCenterEdge);
  setDoorHandlePos(m,id,'topCorner');const t=pair(m,id);assert.ok(t.h.size[0]>t.h.size[1]);assert.equal(t.h.position[1],t.y1-RULES.handleCenterEdge);
});

test('для всех фасадов модуля, по правилу, высота от пола; количество ручек не меняется',()=>{
  const m=wall(900),before=parts(m).filter(p=>p.role==='handle').length;
  const r=setModuleHandlePos(m,'bottomCenter');assert.deepEqual(r,{done:2,skipped:0});
  for(const id of handleDoors(m))assert.equal(doorHandlePos(m,m.sections[0],Number(id.split(':door:')[1])),'bottomCenter');
  assert.equal(parts(m).filter(p=>p.role==='handle').length,before);
  setModuleHandlePos(m,'rule');const id=handleDoors(m)[0],q=pair(m,id);assert.equal(q.h.position[1],q.d.position[1],'по правилу — центр по высоте, как раньше');
  // высота от пола у кухни переводит створку на правило; другое расположение — сбрасывает высоту
  const n=wall(600),nid=handleDoors(n)[0];setDoorHandleFloor(n,nid,300);assert.equal(doorHandlePos(n,n.sections[0],0),'rule');
  setDoorHandlePos(n,nid,'bottomCorner');assert.equal(n.sections[0].handleFloor,undefined);
  setModuleHandlePos(n,null);assert.equal(n.sections[0].handlePos,undefined);
});

test('сохранение и загрузка, неверное значение — ошибка проверки, старые проекты без поля',()=>{
  const m=wall(900),ids=handleDoors(m);setDoorHandlePos(m,ids[1],'topCenter');
  const back=parseModule(JSON.parse(JSON.stringify(m)));assert.deepEqual(back.sections[0].handlePos,[null,'topCenter',null,null]);assert.deepEqual(parts(back),parts(m));
  assert.deepEqual(validate(back),validate(m));
  const bad=structuredClone(m);bad.sections[0].handlePos=['diagonal' as HandlePos];assert.ok(validate(bad).some(e=>e.includes('расположение ручки')));
  assert.equal(JSON.stringify(wall()).includes('handlePos'),false,'новый модуль без поля — умолчание');
  const old=initialModule();old.doors=true;assert.equal(JSON.stringify(parseModule(JSON.parse(JSON.stringify(old)))).includes('handlePos'),false);
});

test('ручка Базиса: без выбора — место по проекту; с выбором — новое место, отверстия по ручке',()=>{
  const m:Module={...wall(600),kitchen:{role:'wall',handle:{dy:60,from:'bottom',horizontal:false,holes:{d:5,depth:18,gap:160}}}},id=handleDoors(m)[0];
  const a=pair(m,id);assert.equal(a.h.position[1],a.y0+60);
  setDoorHandlePos(m,id,'bottomCenter');const b=pair(m,id);assert.ok(b.h.size[0]>b.h.size[1]);assert.equal(b.h.position[1],b.y0+RULES.handleCenterEdge);
  const hs=holes(m).filter(h=>h.src.startsWith(id.replace(':door:',':handle:')+':'));assert.equal(hs.length,2);
  assert.equal(hs[0].at[1],hs[1].at[1],'отверстия горизонтально');assert.equal(Math.abs(hs[0].at[0]-hs[1].at[0]),160);
});
