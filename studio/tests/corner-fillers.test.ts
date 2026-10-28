// Стык угловых фальш-панелей (волна 29.10, правка 1): сценарии «Поставить к стене», «За угол», шкафы вдоль двух стен, крыло до передней
// стены, угловая кухня Г/П, угловой шкаф — собраны функциями студии (scripts/corner-fillers-audit.ts) и проверены в координатах комнаты.
import test from 'node:test';
import assert from 'node:assert/strict';
import {scenarios,cornerReport} from '../scripts/corner-fillers-audit';
import {parts,initialModule,validate,RULES} from '../src/model';
import {newProject,applyAutoFillers,parseProject,projectErrors,bounds} from '../src/project';
import {createModule} from '../src/paletteBuild';
import {placeToWall} from '../src/wallPlacement';

const all=scenarios();
const get=(prefix:string)=>all.find(s=>s.name.startsWith(prefix))!;

test('угловой стык: ни в одном сценарии фальши не пересекают детали соседей и друг друга, проект без ошибок',()=>{
  for(const s of all){
    const r=cornerReport(s.project);
    assert.deepEqual(r.overlaps,[],s.name);
    assert.deepEqual(projectErrors(s.project),[],s.name);
  }
});

test('шкафы «За угол» (обе стороны, вдоль двух стен, крыло до передней стены): створки не упираются в соседа',()=>{
  for(const k of ['1','2','3','4','8']){const r=cornerReport(get(k).project);assert.deepEqual(r.doorsBlocked,[],get(k).name);}
});

test('общее правило стыка: фальш из фасада идёт насквозь до лица планки соседа + 27, планка лежит на ней пластью без щели и без нахлёста',()=>{
  for(const k of ['1','2','3','8']){
    const s=get(k),r=cornerReport(s.project);
    const strip=r.fillers.find(f=>{const a=s.project.modules.find(x=>x.id===f.mid)!;return f.id.startsWith('corner-filler')&&a.module.cornerKind==='strip';})!;
    const plank=r.fillers.find(f=>{const a=s.project.modules.find(x=>x.id===f.mid)!;return f.id.startsWith('corner-filler')&&a.module.cornerKind==='plank';})!;
    assert.ok(strip&&plank,s.name);
    // фальш из фасада в плоскости фасадов (толщина 16 поперёк), планка — вплотную перед ней (касание по плоскости)
    const alongX=strip.x1-strip.x0>strip.z1-strip.z0;
    if(alongX){
      assert.ok(Math.abs(strip.z1-plank.z0)<0.01,`${s.name}: планка на лице фальша (${strip.z1} / ${plank.z0})`);
      // глухая часть: до лица планки + 27 со стороны фасадов корпуса
      const gap=Math.min(Math.abs(strip.x0-plank.x0),Math.abs(strip.x1-plank.x1));
      assert.ok(Math.abs(gap-RULES.cornerGap)<0.6,`${s.name}: до лица планки ${gap}`);
    }else{
      assert.ok(Math.abs(strip.x1-plank.x0)<0.01,`${s.name}: планка на лице фальша`);
      const gap=Math.min(Math.abs(strip.z0-plank.z0),Math.abs(strip.z1-plank.z1));
      assert.ok(Math.abs(gap-RULES.cornerGap)<0.6,`${s.name}: до лица планки ${gap}`);
    }
    // в смете каждая панель — один раз: на угол две детали (по одной у каждого корпуса)
    assert.equal(r.fillers.filter(f=>f.id.startsWith('corner-filler')).length,2,s.name);
  }
});

test('кромка фальшей угла: 2 мм только на видимых торцах (у глухой части торец в угол — 0,4; у планки — передний торец)',()=>{
  const p=get('1').project;
  const strip=p.modules.find(a=>a.module.cornerKind==='strip')!.module,plank=p.modules.find(a=>a.module.cornerKind==='plank')!.module;
  assert.deepEqual(parts(strip).find(x=>x.id==='corner-filler:left')!.edge,[2,2,2,0.4]);
  assert.deepEqual(parts(plank).find(x=>x.id==='corner-filler:right')!.edge,[0.4,0.4,2,0.4]);
});

test('глухая часть сохраняется в файле; сосед уехал — ширина убирается вместе с фальшью; старый файл без ширины — планка 100',()=>{
  const p=get('1').project,a=p.modules.find(x=>x.module.cornerKind==='strip')!;
  assert.equal(a.module.cornerFillerWidth,647);
  assert.equal(parseProject(JSON.parse(JSON.stringify(p))).modules.find(x=>x.id===a.id)!.module.cornerFillerWidth,647);
  const moved=applyAutoFillers({...p,modules:p.modules.map(x=>x.id===a.id?x:{...x,z:x.z+800})});
  const m=moved.modules.find(x=>x.id===a.id)!.module;assert.equal(m.cornerFiller,undefined);assert.equal(m.cornerFillerWidth,undefined);
  const old=structuredClone(a.module);delete old.cornerFillerWidth;assert.equal(parts(old).find(x=>x.id==='corner-filler:left')!.size[0],100);
});

test('корпус почти целиком за соседом: понятная ошибка вместо створки отрицательной ширины',()=>{
  const m=createModule('wardrobe',600,2200,600,initialModule());m.cornerFiller='left';m.cornerKind='strip';m.cornerFillerWidth=647;
  assert.ok(validate(m).some(e=>/глухая часть 647/.test(e)),validate(m).join('; '));
});

test('«Поставить к стене» от конца стены: корпус с фальшью к стене встаёт в конец стены (было — уходил к началу)',()=>{
  let p=newProject(createModule('wardrobe',1000,2200,600,initialModule()));p.room={...p.room,width:3000,depth:3000};
  p=placeToWall(p,p.modules[0].id,'back','from-end');
  const b=bounds(p.modules[0]);assert.ok(Math.abs(b.x+b.w-3000)<0.6,`правый край ${b.x+b.w}`);assert.equal(p.modules[0].module.wallFiller?.right?.width,100);
});
