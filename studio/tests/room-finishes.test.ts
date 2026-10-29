// Отделка помещения (список Макса 29.10.2026): каталог Лемана ПРО, масштаб текстур, сохранение в файле, цена не меняется.
import test from 'node:test';
import assert from 'node:assert/strict';
import {FINISHES,finishUnit,floorUv,wallUv,parseRoomFinish,withFinish,setWallFinish,finishFits,finishById,finishSize,texturePxPerMm,keepFinish,defaultAlong,FINISH_WALLS,type FinishItem} from '../src/roomFinishes';
import {newProject,parseProject,type Room} from '../src/project';
import {estimate} from '../src/pricing';
import {nest} from '../src/exports';
import {parts} from '../src/model';
import {activeRoom,migrateRoomDocument,updateRoom} from '../src/roomDocument';

const of=(k:FinishItem['kind'])=>FINISHES.filter(f=>f.kind===k);

test('каталог: группы ламинат / плитка / обои по ~20 позиций, артикул и ссылка Лемана ПРО у каждой', () => {
  assert.ok(of('laminate').length>=20,'ламинат');
  assert.ok(of('tile').length>=20,'плитка');
  assert.ok(of('wallpaper').length>=18,'обои');
  const ids=new Set<string>();
  for(const f of FINISHES){
    assert.ok(!ids.has(f.id),'артикул повторяется: '+f.id);ids.add(f.id);
    assert.equal(f.id,f.article);
    assert.match(f.article,/^\d{8}$/,f.name);
    assert.ok(f.url.startsWith('https://lemanapro.ru/product/')&&f.url.endsWith('-'+f.article+'/'),f.url);
    assert.ok(f.name.length>10&&f.brand&&f.colour,f.id);
    for(const c of f.tone)assert.match(c,/^#[0-9a-f]{6}$/,f.id);
    assert.equal(finishById(f.id),f);
  }
});

test('каталог: размеры правдоподобны (доска, плитка, рулон), рисунок по группе', () => {
  for(const f of of('laminate')){
    const [l,w]=f.size;assert.ok(l>=500&&l<=2500&&w>=90&&w<=300&&l>w,f.id+' доска '+f.size);
    assert.ok(['plank','herringbone'].includes(f.look),f.id);assert.ok(f.grade&&f.grade>=31&&f.grade<=34,f.id);
  }
  for(const f of of('tile')){
    const [l,w]=f.size;assert.ok(l>=150&&l<=1600&&w>=150&&w<=1200&&l>=w,f.id+' плитка '+f.size);
    assert.ok(['plain','stone','marble','concrete','terrazzo','wood','mosaic'].includes(f.look),f.id);assert.ok(f.surface,f.id);
  }
  for(const f of of('wallpaper')){
    assert.ok([530,1060].includes(f.size[0]),f.id+' ширина рулона');assert.ok(f.size[1]>=10000&&f.size[1]<=10050,f.id+' длина рулона');
    assert.ok(f.repeat===undefined||(f.repeat>=0&&f.repeat<=1000),f.id);
    assert.ok(['plain','texture','stripes','geometric','floral','concrete','abstract'].includes(f.look),f.id);
  }
  // на пол — ламинат и напольная плитка, на стены — обои и настенная плитка
  assert.ok(FINISHES.filter(f=>finishFits(f,'floor')).every(f=>f.kind!=='wallpaper'&&f.surface!=='wall'));
  assert.ok(FINISHES.filter(f=>finishFits(f,'wall')).every(f=>f.kind!=='laminate'&&f.surface!=='floor'));
});

test('обои: раппорт клиенту — только из карточки (неизвестный не показывается, нет «по умолчанию» у половины), марка без догадок', () => {
  const wps=of('wallpaper'),counts=new Map<number,number>();
  for(const f of wps)if(f.repeat)counts.set(f.repeat,(counts.get(f.repeat)??0)+1);
  assert.ok([...counts.values()].every(n=>n<=3),'один и тот же раппорт у многих обоев — похоже на значение по умолчанию: '+JSON.stringify([...counts]));
  for(const f of wps.filter(f=>f.repeat===undefined))assert.ok(!finishSize(f).includes('раппорт'),f.id);
  assert.match(finishSize(finishById('82283853')!),/раппорт 32 см/);
  assert.match(finishSize(finishById('82061801')!),/без подбора рисунка/);
  assert.equal(finishById('16582308')!.brand,'марка не указана','марка «Цветов» не подтверждена карточкой');
  assert.ok(!finishUnit(finishById('92330909')!).h||finishUnit(finishById('92330909')!).h>=530,'раппорт текстуры без известного шага — условный');
});

test('масштаб: доска, плитка и рулон в раппорте — настоящего размера, раппорт стыкуется без зазоров', () => {
  for(const f of FINISHES){
    const u=finishUnit(f);
    if(f.kind==='wallpaper'){assert.equal(u.w,f.size[0],f.id);continue;}
    if(f.look==='herringbone')continue;
    for(const r of u.rects){assert.equal(r.w,f.size[0],f.id);assert.equal(r.h,f.size[1],f.id);}
    if(f.kind==='laminate'){assert.equal(u.w,2*f.size[0]);assert.equal(u.h%f.size[1],0);}
    else{assert.equal(u.w%f.size[0],0);assert.equal(u.h%f.size[1],0);}
  }
});

test('видеопамять: текстура любой позиции ≤ 1024 px по стороне (≤ 4 МБ), не грубее 0,3 px/мм', () => {
  for(const f of FINISHES){
    const u=finishUnit(f),px=texturePxPerMm(u,1024),w=Math.round(u.w*px),h=Math.round(u.h*px);
    assert.ok(w<=1024&&h<=1024&&w*h*4<=4.2e6,`${f.id}: ${w}×${h}`);
    assert.ok(px>=0.3,'детализация '+f.id+' '+px.toFixed(2)+' px/мм');/* швы и фаски рисуются не тоньше 1 px (finishTextures.ts) */
  }
});

test('ёлочка: планки длиной как в карточке, ширина подогнана < 4 %, раппорт покрыт планками ровно один раз', () => {
  for(const f of FINISHES.filter(f=>f.look==='herringbone')){
    const u=finishUnit(f),[L,W]=f.size;
    assert.ok(u.rotate45);assert.ok(Math.abs((u.plankWidth??0)-W)/W<0.04,f.id+' ширина '+u.plankWidth);
    for(const r of u.rects)assert.equal(Math.max(r.w,r.h),L,f.id);
    let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
    for(let i=0;i<4000;i++){
      const x=rnd()*u.w,y=rnd()*u.h,hits=u.rects.filter(r=>x>r.x+1e-6&&x<r.x+r.w-1e-6&&y>r.y+1e-6&&y<r.y+r.h-1e-6).length;
      const onEdge=u.rects.some(r=>x>=r.x-1e-3&&x<=r.x+r.w+1e-3&&y>=r.y-1e-3&&y<=r.y+r.h+1e-3)&&hits===0;
      if(!onEdge)assert.equal(hits,1,`${f.id}: точка ${x.toFixed(1)},${y.toFixed(1)} покрыта ${hits} раз`);
    }
  }
});

test('текстурные координаты: шаг раппорта в мм, направление укладки, ёлочка под 45°', () => {
  const f=FINISHES.find(f=>f.kind==='laminate'&&f.look==='plank')!,u=finishUnit(f);
  assert.deepEqual(floorUv(u.w,0,u,'width'),[1,0]);
  assert.deepEqual(floorUv(0,u.h,u,'width'),[0,1]);
  assert.deepEqual(floorUv(u.w,0,u,'depth'),[0,u.w/u.h],'вдоль глубины: x комнаты идёт поперёк доски');
  assert.deepEqual(floorUv(0,u.w,u,'depth'),[1,0]);
  const h=finishUnit(FINISHES.find(f=>f.look==='herringbone')!),[s,t]=floorUv(1000,0,h);
  assert.ok(Math.abs(Math.hypot(s*h.w,t*h.h)-1000)<1e-6,'поворот на 45° не меняет масштаб');
  const wp=finishUnit(FINISHES.find(f=>f.kind==='wallpaper')!);
  assert.deepEqual(wallUv(wp.w,0,wp),[1,0],'по стене: один рулон на ширину');
  assert.equal(defaultAlong({width:3000,depth:4500}),'depth');assert.equal(defaultAlong({width:4000,depth:3000}),'width');
});

const lam=of('laminate')[0],wallpaper=of('wallpaper')[0],wallTile=FINISHES.find(f=>f.kind==='tile'&&f.surface==='wall')!;
function finished(){
  const p=newProject();
  let room=withFinish(p.room,{floor:{id:lam.id,along:'depth'}});
  room=setWallFinish(room,FINISH_WALLS,{id:wallpaper.id});
  room=setWallFinish(room,['back'],{id:wallTile.id});
  room=setWallFinish(room,['left'],{paint:'#a8ab8a'});
  return {...p,room};
}

test('сохранение: отделка пола и каждой стены переживает файл проекта и документ комнат', () => {
  const p=finished();
  assert.deepEqual(p.room.finish,{floor:{id:lam.id,along:'depth'},walls:{back:{id:wallTile.id},left:{paint:'#a8ab8a'},right:{id:wallpaper.id},front:{id:wallpaper.id}}});
  const back=parseProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(back.room.finish,p.room.finish,'файл → проект');
  let d=migrateRoomDocument(newProject());d=updateRoom(d,d.activeRoomId,p);
  const again=parseProject(JSON.parse(JSON.stringify(activeRoom(d).project)));
  assert.deepEqual(again.room.finish,p.room.finish,'документ комнат');
  // убрали всё — поля нет в файле
  let room=setWallFinish(p.room,FINISH_WALLS,undefined);room=withFinish(room,{...room.finish,floor:undefined});
  assert.equal('finish' in room,false);
  assert.equal(parseProject(JSON.parse(JSON.stringify(newProject()))).room.finish,undefined,'старый файл без отделки');
});

test('замер из Базиса в пустую комнату: отделка пола и стен остаётся (новое помещение без своей)', () => {
  const old=finished().room,bazis:Room={width:3200,depth:2600,height:2650,openings:[],walls:{thickness:200}};
  const next=keepFinish(old,bazis);
  assert.deepEqual(next.finish,old.finish);assert.equal(next.width,3200);
  assert.equal(keepFinish(newProject().room,bazis),bazis,'без отделки — помещение как есть');
  const own={...bazis,finish:{floor:{id:wallTile.id}}};assert.equal(keepFinish(old,own),own,'своя отделка нового помещения главнее');
});

test('чтение файла: мусор в отделке не мешает открыть проект', () => {
  assert.equal(parseRoomFinish(5),undefined);
  assert.equal(parseRoomFinish({floor:{id:7},walls:{back:{paint:'red'},left:'x'}}),undefined);
  assert.deepEqual(parseRoomFinish({floor:{id:'85999876',along:'diag'},walls:{back:{paint:'#AABBCC'},top:{id:'1'}}}),{floor:{id:'85999876'},walls:{back:{paint:'#aabbcc'}}});
  const p=newProject() as unknown as {room:Record<string,unknown>};p.room.finish={floor:'плитка',walls:null};
  assert.doesNotThrow(()=>parseProject(JSON.parse(JSON.stringify(p))));
});

test('цена и детали не меняются от отделки (только показ)', () => {
  const plain=newProject(),p={...plain,room:finished().room};
  assert.deepEqual(parts(p.modules[0].module),parts(plain.modules[0].module));
  const a=estimate(plain,nest(plain)),b=estimate(p,nest(p));
  assert.equal(b.retail,a.retail);assert.equal(b.ldspSheets,a.ldspSheets);
  assert.deepEqual(b.lines.map(l=>[l.id,l.quantity,l.unitPrice]),a.lines.map(l=>[l.id,l.quantity,l.unitPrice]));
  assert.ok(!b.lines.some(l=>/ламинат|обои|плитк|леман/i.test(String((l as {name?:string}).name??''))),'в смете нет строк отделки');
});
