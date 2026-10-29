// Решение Макса 29.10.2026 (ветка claude/guides-plan): вспомогательные линии Q и ручки углов — и на «Плане»;
// размеры с клавиатуры при тяге за угол двумя числами «600;2400».
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule} from '../src/model';
import {newProject,localToRoom,type PlacedModule,type Project} from '../src/project';
import {cornerDims,parseCornerTyped,typedCornerPull,exactProblem,cornerPullFromDelta,snapAxis,widthPull,keepOpposite,cornerHandleTitle} from '../src/cornerStretch';
import {PLAN_LOOK,viewLook,viewAxes,guidesInView,makeGuide,candidateLines,nearestPlanLine,planDist,placeGuide,snapMoveToGuides} from '../src/guides';
import {planStretch} from '../src/rowResize';

const mod=(w=600,h=2000,d=550)=>({...initialModule(),name:'Шкаф',width:w,height:h,depth:d});
const at=(id:string,x:number,m=mod(),extra:Partial<PlacedModule>={}):PlacedModule=>({id,x,y:0,z:3,rotation:0,module:m,...extra});
function room(mods:PlacedModule[]):Project{const p=newProject();p.room={...p.room,width:5000,depth:3000,height:2700};p.modules=mods;return p;}

test('набор при тяге за угол: «600;2400» — оба, «600» — первый, «;2400» — второй; мусор — null',()=>{
  assert.deepEqual(parseCornerTyped('600;2400'),[600,2400]);
  assert.deepEqual(parseCornerTyped('600'),[600,undefined]);
  assert.deepEqual(parseCornerTyped('600;'),[600,undefined]);
  assert.deepEqual(parseCornerTyped(';2400'),[undefined,2400]);
  assert.deepEqual(parseCornerTyped('12,5;3'),[12.5,3]);
  for(const bad of ['',';','1;2;3','.;','6..0'])assert.equal(parseCornerTyped(bad),null,bad);
});

test('набранные размеры → тяга: порядок как в плашке вида, противоположный угол на месте, без привязок, точно',()=>{
  const a=at('a',1000);
  const f=typedCornerPull(a,cornerDims('front')!,['hi','hi'],'700;2100').pull!;
  assert.deepEqual([f.width,f.height,f.snap,f.exact],[{end:'hi',raw:100},{end:'hi',raw:100},false,{width:700,height:2100}]);
  const s=typedCornerPull(a,cornerDims('side')!,['lo','hi'],';2400').pull!;
  assert.equal(s.depth,undefined,'«;2400» сбоку — только высота');assert.deepEqual(s.height,{end:'hi',raw:400});
  const t=typedCornerPull(a,cornerDims('top')!,['lo','hi'],'800').pull!;
  assert.deepEqual([t.width,t.depth],[{end:'lo',raw:200},undefined],'сверху/план одно число — только ширина');
  assert.match(typedCornerPull(a,cornerDims('front')!,['hi','hi'],';0').problem!,/Высота должна быть больше нуля/);
  assert.equal(typedCornerPull(a,cornerDims('front')!,['hi','hi'],'').pull,undefined);
});

test('набранная высота/глубина — ровно (без шага 10 мм), левый угол — правый край на месте',()=>{
  const p=room([at('a',1000)]),a=p.modules[0];
  const pull=typedCornerPull(a,['width','height'],['lo','hi'],'733;2417').pull!;
  assert.equal(snapAxis(p,a,'height',pull.height!,pull.snap,pull.tol).size,2417);
  const w=widthPull(a,pull.width!,pull.snap,pull.tol),plan=planStretch(p,'a',w.side,w.raw,w.snap),n=plan.project!.modules[0];
  assert.equal(n.module.width,733);assert.equal(n.x+n.module.width,1600,'правый край на месте');
  const d=typedCornerPull(a,['width','depth'],['hi','lo'],';600').pull!;
  const moved=keepOpposite(a,{...a.module,depth:snapAxis(p,a,'depth',d.depth!,false,0).size},{depth:'lo'});
  assert.equal(moved.module.depth,600);assert.equal(localToRoom(moved,0,600).z,localToRoom(a,0,550).z,'тянут заднюю — фасад на месте');
});

test('набранная ширина не помещается (сосед в 200 мм) — отказ с причиной, как у поля панели',()=>{
  const p=room([at('a',1000),at('b',1800)]),a=p.modules[0];
  const pull=typedCornerPull(a,['width','height'],['hi','hi'],'900').pull!;
  const w=widthPull(a,pull.width!,false,0),plan=planStretch(p,'a',w.side,w.raw,w.snap);
  const got=plan.project!.modules[0].module;assert.equal(got.width,800);
  assert.match(exactProblem(got,pull.exact)!,/Ширина 900 мм не получается: здесь можно не больше 800 мм/);
  assert.equal(exactProblem({width:900,height:2000,depth:550},pull.exact),undefined);
  assert.equal(exactProblem(got,undefined),undefined,'тяга мышью — без проверки точности');
});

test('план: ход курсора → тяга угла; при повороте корпуса — по его осям',()=>{
  const a=at('a',1000);
  const p=cornerPullFromDelta(a,['width','depth'],['hi','hi'],{x:100,y:0,z:50},true,10);
  assert.deepEqual([p.width,p.depth],[{end:'hi',raw:100},{end:'hi',raw:50}]);
  const q=cornerPullFromDelta(a,['width','depth'],['lo','lo'],{x:100,y:0,z:50},true,10);
  assert.deepEqual([q.width,q.depth],[{end:'lo',raw:-100},{end:'lo',raw:-50}],'левый задний угол вправо-вперёд — меньше');
  const r=at('r',1000,mod(),{rotation:90});
  const ax=localToRoom(r,1,0),o=localToRoom(r,0,0),wx={x:ax.x-o.x,z:ax.z-o.z};
  const s=cornerPullFromDelta(r,['width','depth'],['hi','hi'],{x:wx.x*70,y:0,z:wx.z*70},true,10);
  assert.equal(s.width!.raw,70);assert.equal(s.depth!.raw,0);
});

test('линии «Плана» и вида «Сверху» — общие: одно направление взгляда, одни координаты помещения',()=>{
  assert.deepEqual(PLAN_LOOK,viewLook('top'));
  assert.deepEqual(viewAxes(PLAN_LOOK),{h:{x:1,y:0,z:0},v:{x:0,y:0,z:-1}});
  const fromTop=makeGuide('t',viewLook('top')!,{x:1,y:0,z:0},2200),fromPlan=makeGuide('p',PLAN_LOOK,{x:0,y:0,z:-1},-1000),front=makeGuide('f',viewLook('front')!,{x:1,y:0,z:0},1600);
  assert.deepEqual(guidesInView([fromTop,fromPlan,front],PLAN_LOOK).map(g=>g.id),['t','p']);
  assert.deepEqual(guidesInView([fromTop,fromPlan,front],viewLook('top')).map(g=>g.id),['t','p']);
});

test('Q на плане: кандидаты — края корпуса (X и Z), стены, линии; ближайшая к мыши в пределах допуска',()=>{
  const p=room([at('a',1000)]),g=makeGuide('g',PLAN_LOOK,{x:1,y:0,z:0},2200);
  const lines=candidateLines(p.modules,PLAN_LOOK,'a',p.room,[g]);
  const right=lines.find(l=>l.what==='край «Шкаф»'&&l.n.x===1&&l.at===1600)!,front=lines.find(l=>l.what==='край «Шкаф»'&&l.n.z===-1&&l.at===-553)!;
  assert.ok(right&&front);
  assert.ok(lines.some(l=>l.what==='стена'&&l.n.z===-1&&l.at===-3000),'фасадная стена');
  assert.ok(lines.some(l=>l.guideId==='g'));
  assert.equal(nearestPlanLine(lines.filter(l=>!l.what.startsWith('кромка')),{x:1604,y:0,z:300},10),right);
  assert.equal(nearestPlanLine([right],{x:1640,y:0,z:300},10),undefined);
  assert.equal(planDist({x:0,y:0,z:5},{x:-10,y:0,z:0},{x:10,y:0,z:0}),5);
  // от фасада корпуса вниз по плану (к фасадной стене) на 400 — линия z = 953
  const pl=placeGuide(front,{x:1300,y:0,z:700},400);
  assert.equal(pl.sign,-1);assert.equal(pl.at,-953);
});

test('перетаскивание корпуса на плане привязывается к линии плана (фасад к z = 1000)',()=>{
  const a=at('a',1000),g=makeGuide('g',PLAN_LOOK,{x:0,y:0,z:-1},-1000);
  const next=snapMoveToGuides(a,{x:1000,y:0,z:445},{x:1000,y:0,z:445},[g],10);
  assert.equal(next.z,450);assert.equal(next.x,1000);
});

test('подсказка ручки — порядок набора по виду',()=>{
  assert.match(cornerHandleTitle(['width','depth']),/«ширина;глубина».*только ширина.*только глубина/);
  assert.match(cornerHandleTitle(['depth','height']),/«глубина;высота»/);
});
