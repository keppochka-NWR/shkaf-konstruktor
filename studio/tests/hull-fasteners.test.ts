// Критик 28.10.2026: крепёж корпуса в смете — угловой шкаф без единой детали крепежа; у шкафов не считались цоколь, фальшпанели к стене
// и сборка коробов ящиков; угловой шкаф «без ручки» рисовал условную ручку 900, а смета подставляла первую ручку каталога (UZ 819).
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts} from '../src/model';
import {createModule} from '../src/paletteBuild';
import {estimate} from '../src/pricing';
import {newProject,type Project} from '../src/project';
import {hullFasteners,boxJointConfirmats,fillerScrewCount} from '../src/hullFasteners';
import {cornerProject,CORNER_DEFAULT} from '../src/cornerWardrobe';
import {DEFAULT_HANDLE} from '../src/handles';

const line=(p:Project,id:string)=>estimate(p).lines.find(l=>l.id===id);
const one=(m:ReturnType<typeof initialModule>):Project=>({...newProject(),modules:[{id:'a',x:100,y:0,z:33,rotation:0,module:m}]});

test('угловой шкаф: крепёж корпуса в смете — конфирматы (с заглушками) по 2 на стык, эксцентрики цоколя и планки, сборка коробов',()=>{
  const p=cornerProject(CORNER_DEFAULT),[main,upper]=p.modules.map(a=>hullFasteners(a.module));
  // низ: дно, общая полка, 2 полки над ящиками — по 2 стыка × 2; 2 перегородки — по 2 сверху и снизу; крыши нет (общая с антресолью)
  assert.equal(main.confirmats,4*4+2*4);
  assert.equal(main.eccentrics,2+2,'цоколь и передняя планка 80 — по эксцентрику на торец (снаружи не видно)');
  assert.equal(main.boxConfirmats,6*(4*boxJointConfirmats(190)+4),'6 ящиков: 4 стыка стенок + дно снизу по 2 на боковину');
  assert.equal(upper.confirmats,2*4,'антресоль: дно и крыша');
  const e=estimate(p),conf=e.lines.find(l=>l.id==='confirmat')!,cap=e.lines.find(l=>l.id==='confirmat-cap')!,ecc=e.lines.find(l=>l.id==='eccentric')!;
  assert.equal(conf.quantity,main.confirmats+upper.confirmats+main.boxConfirmats);
  assert.equal(cap.quantity,main.confirmats+upper.confirmats,'заглушки — только на головки снаружи корпуса');
  assert.equal(ecc.quantity,4);
});

test('угловой шкаф «без ручки»: ни условной ручки в модели, ни «первой ручки каталога» в смете; выбранная ручка — в модели и смете',()=>{
  const p=cornerProject(CORNER_DEFAULT);
  assert.equal(p.modules[0].module.handleId,'none');
  assert.equal(parts(p.modules[0].module).filter(x=>x.role==='handle').length,0);
  assert.ok(!estimate(p).lines.some(l=>l.id.startsWith('handle:')),'в смете нет '+DEFAULT_HANDLE);
  p.modules[0].module.handleId='hexa1200b';
  const h=parts(p.modules[0].module).filter(x=>x.role==='handle');
  assert.equal(h.length,1);assert.match(h[0].name,/HEXA L-1200/);assert.equal(h[0].size[1],1200);
  const l=line(p,'handle:hexa1200b')!;assert.ok(l);assert.equal(l.quantity,1);assert.equal(l.unitPrice,2400,'торцевая 2 ₽/мм');
});

test('шкаф студии: эксцентрики цоколя, конфирматы коробов ящиков, саморезы фальшпанели к стене',()=>{
  const m=createModule('wardrobe',900,2200,600,initialModule());m.sections[0].drawers=2;m.wallFiller={left:{kind:'edge',width:100}};
  const h=hullFasteners(m),ps=parts(m),boxes=ps.filter(x=>/:drawer:\d+:bottom$/.test(x.id)).length;
  assert.ok(ps.some(x=>x.id==='plinth'));assert.equal(h.eccentrics,2,'цоколь 80: по эксцентрику на торец');
  assert.equal(boxes,2);assert.ok(h.boxConfirmats>=boxes*(4+4));
  assert.equal(h.fillerScrews,fillerScrewCount(2200));assert.equal(fillerScrewCount(2200),6);
  const e=estimate(one(m)),before=estimate(one({...m,wallFiller:undefined}));
  assert.equal(e.lines.find(l=>l.id==='screw-4x30-filler')!.quantity,6);
  assert.ok(e.lines.find(l=>l.id==='eccentric')!.quantity>=2);
  assert.equal(e.lines.find(l=>l.id==='confirmat-cap')!.quantity+h.boxConfirmats,e.lines.find(l=>l.id==='confirmat')!.quantity,'короба — без заглушек');
  assert.ok(!before.lines.some(l=>l.id==='screw-4x30-filler'));
});

test('кухни и модули Базиса — крепёж по проекту Базиса, студия ничего не добавляет',()=>{
  const m=createModule('wardrobe',900,2200,600,initialModule());
  assert.deepEqual(hullFasteners({...m,kitchen:{role:'base'} as never}),{confirmats:0,eccentrics:0,boxConfirmats:0,fillerScrews:0});
  assert.deepEqual(hullFasteners({...m,bazis:true} as never),{confirmats:0,eccentrics:0,boxConfirmats:0,fillerScrews:0});
});
