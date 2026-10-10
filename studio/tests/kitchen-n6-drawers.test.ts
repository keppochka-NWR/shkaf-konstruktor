import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {initialModule,parts,parseModule,validate,type Module,type GolaCut} from '../src/model';
import {kitchenBase,hardwareRows} from '../src/kitchen';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {golaFromContour,golaCutEdges,moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {golaTies} from '../scripts/kitchen/recognize-common';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';

// k10 m11 Базиса: боковина 704×568, верхний вырез 0–57 (R5), средний 352–409,5 — скруглён только нижний угол, в верхнем — «5»
const K10_CUTS:GolaCut[]=[{top0:0,top1:57,depth:26,r:5},{top0:352,top1:409.5,depth:26,r:5,sharpTop:true}];
const gola=(ties?:NonNullable<Module['kitchen']>['golaTies'],cuts=K10_CUTS)=>{const m=kitchenBase(initialModule(),600,'doors');m.edgeScheme={t:0.5};m.gola={cuts:cuts.map(c=>({...c}))};if(ties)m.kitchen!.golaTies=ties;return m;};
const side=(m:Module,id='left')=>parts(m).find(p=>p.id===id)!;

test('Gola tie («5» Базиса): through D5 on side thickness at the upper corner of the middle cut, drill direction by project side',()=>{
  const m=gola({left:1,right:-1}),l=side(m),r=side(m,'right'),hs=holes(m);
  const top=l.position[1]+l.size[1]/2,front=l.position[2]+l.size[2]/2;
  const hl=hs.find(h=>h.src==='kitchen-tie:left')!,hr=hs.find(h=>h.src==='kitchen-tie:right')!;
  assert.deepEqual([hl.d,hl.depth,hl.part],[5,16,'left']);assert.deepEqual(hl.dir,[1,0,0]);
  assert.deepEqual(hl.at,[l.position[0]-l.size[0]/2,top-352,front-26],'левая: с левой пласти, верх среднего выреза, глубина выреза');
  assert.deepEqual(hr.dir,[-1,0,0]);assert.equal(hr.at[0],r.position[0]+r.size[0]/2,'правая: с правой пласти (сверлил Базис так)');
  assert.equal(hr.part,'right');
  // точка привязки — служебная (как kitchen-svc): в списке фурнитуры модуля её нет
  assert.ok(!hardwareRows(parts(m)).some(([n])=>/Стяжка соседнего/.test(n)));
  assert.deepEqual(partCollisions(parts(m),m).filter(x=>x.a.startsWith('kitchen-tie')||x.b.startsWith('kitchen-tie')),[],'стяжка ничего не пересекает');
});

test('Gola tie: depth from project when not equal to the cut (k17: 27 at cut 26); none without golaTies or without a middle cut',()=>{
  const m=gola({left:1,depth:27}),l=side(m),front=l.position[2]+l.size[2]/2;
  assert.equal(holes(m).find(h=>h.src==='kitchen-tie:left')!.at[2],front-27);
  assert.ok(!holes(m).some(h=>h.src==='kitchen-tie:right'),'правой нет в проекте — нет и в студии');
  assert.ok(!parts(gola()).some(p=>p.id.startsWith('kitchen-tie')),'без golaTies — ничего (правило 2)');
  assert.ok(!parts(gola({left:1,right:1},[K10_CUTS[0]])).some(p=>p.id.startsWith('kitchen-tie')),'без среднего выреза — нет угла, нет стяжки');
  // шкаф студии (не кухня) — правил Базиса нет
  const w=initialModule();w.gola={cuts:K10_CUTS.map(c=>({...c}))};assert.ok(!parts(w).some(p=>p.id.startsWith('kitchen-tie')));
});

test('Gola: sharp upper corner and per-cut edging give Bazis edge lengths (k10: only top cut + top wall of middle, k15: both)',()=>{
  // k10 m11: перед 294,5 + 295 + 52 + 7,85; верх 542 + 21; −y — только верхняя стенка среднего 26 (низ без кромки)
  const a=gola();a.gola!.cuts[0].edged=true;a.gola!.cuts[1].edgedTop=true;a.gola!.bareBottom=true;
  const la=side(a);assert.equal(la.edgeLen!['+z'],Math.round((la.size[1]-57-57.5+52+Math.PI*2.5)*10)/10);
  assert.equal(la.edgeLen!['+y'],la.size[2]-26+21);assert.equal(la.edgeLen!['-y'],26);
  // k15 m04: оба выреза кромлены, у среднего одна дуга: 52 + 7,85 каждый; −y — стенка 26 + нижний торец, если он кромится
  const b=gola(undefined,[{top0:0,top1:57,depth:26,r:5,edged:true},{top0:385,top1:442,depth:26,r:5,sharpTop:true,edged:true}]);
  const lb=side(b);assert.equal(lb.edgeLen!['+z'],Math.round((lb.size[1]-114+2*(52+Math.PI*2.5))*10)/10);
  assert.equal(lb.edgeLen!['-y'],lb.size[2]+26);
  // сохранение/чтение проекта
  const m=gola({left:1,right:-1,depth:27});m.gola!.bareBottom=true;m.gola!.cuts[1].edgedTop=true;
  const p=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(p.kitchen!.golaTies,{left:1,right:-1,depth:27});assert.equal(p.gola!.bareBottom,true);
  assert.equal(p.gola!.cuts[1].sharpTop,true);assert.equal(p.gola!.cuts[1].edgedTop,true);
  assert.deepEqual(validate(p),[]);
});

test('Gola recognizer: sharp corner from contour, edged cuts by edge lengths, bare bottom end',()=>{
  // контур k10 m11 (y, z): средний 410,5–468 с дугой только внизу, верхний 763–820
  const arc=(y:number,z:number)=>Array.from({length:11},(_,i)=>{const a=Math.PI/2*i/10;return [y+5-5*Math.cos(a),z+5-5*Math.sin(a)] as [number,number];});
  const contour:[number,number][]=[[116,3],[116,571],[410.5,571],[410.5,550],...arc(410.5,545).slice(1),[468,545],[468,571],[763,571],[763,550],...arc(763,545).slice(1),[820,545],[820,3]];
  const gc=golaFromContour({contour,contourPlane:'yz'},820,571);
  assert.equal(gc.length,2);assert.ok(!gc[0].sharpTop,'верхний открытый — не «острый средний»');assert.equal(gc[1].sharpTop,true);
  const e=[{side:'+z',thick:0.5,len:294.5},{side:'+z',thick:0.5,len:295},{side:'+z',thick:0.5,len:52},{side:'+z',thick:0.5,len:7.85},{side:'+y',thick:0.5,len:542},{side:'+y',thick:0.5,len:21},{side:'-y',thick:0.5,len:26}];
  const r=golaCutEdges(gc,e,704,294.5+295+52+7.85);
  assert.equal(gc[0].edged,true);assert.ok(!gc[1].edged);assert.equal(gc[1].edgedTop,true);assert.equal(r.bareBottom,true);
  // нижний торец кромлен (k17 m02: 560 + 26) — не «голый»
  const g2=golaFromContour({contour,contourPlane:'yz'},820,571);
  assert.equal(golaCutEdges(g2,[...e.slice(0,6),{side:'-y',thick:0.5,len:560},{side:'-y',thick:0.5,len:26}],704,649.35).bareBottom,false);
});

test('Gola tie recognizer: «5» at the middle-cut corner → side and drill direction; elsewhere (k11-like) — not a Gola tie',()=>{
  const b={x0:0,y0:116,z0:3,x1:16,y1:820,z1:571},br={x0:584,y0:116,z0:3,x1:600,y1:820,z1:571};
  const hw=[{i:12,name:'5',category:'прочее',pos:[0,468,545],host:1,service:true,mesh:null},{i:13,name:'5',category:'прочее',pos:[600,468,545],host:2,service:true,mesh:null}];
  const hs=[{src:12,dir:[1,0,0],d:5,through:true},{src:13,dir:[-1,0,0],d:5,through:true}];
  const sides=[{side:'left' as const,i:1,b},{side:'right' as const,i:2,b:br}];
  assert.deepEqual(golaTies(hw,hs,sides,K10_CUTS),{left:1,right:-1});
  // k17: на 1 мм глубже выреза — глубина по проекту
  assert.deepEqual(golaTies([{...hw[0],pos:[0,468,544]}],hs,sides,K10_CUTS),{left:1,depth:27});
  // «5» не в углу (k11: 32 от кромки на высоте полки) — не стяжка Gola
  assert.equal(golaTies([{...hw[0],pos:[0,251,32]}],hs,sides,K10_CUTS),undefined);
  assert.equal(golaTies(hw,hs,sides,[K10_CUTS[0]]),undefined,'нет среднего выреза');
  assert.equal(golaTies([{...hw[0],name:'5x12'}],hs,sides,K10_CUTS),undefined,'другая служебная запись');
});

// Эталоны Базиса лежат вне репозитория — на другой машине тесты пропускаются.
const ED='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const refOf=(k:string,key:string)=>(JSON.parse(readFileSync(`${ED}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
test('Bazis ties statistics: every «5» on a Gola side sits at the upper corner of the middle cut; recognized modules match Bazis holes',{skip:!existsSync(ED)},()=>{
  let onGola=0,atCorner=0;
  for(const f of readdirSync(ED).filter(f=>/^k\d\d\.json$/.test(f))){
    for(const m of JSON.parse(readFileSync(`${ED}/${f}`,'utf8')).modules as (RefModule&{hardware:{name:string;host?:number;pos:number[]}[]})[]){
      for(const h of m.hardware.filter(h=>h.name.trim()==='5')){
        const p=m.panels.find(q=>q.i===h.host);if(!p||p.contourPlane!=='yz')continue;
        const cuts=golaFromContour(p as {contour?:[number,number][];contourPlane?:string},p.box[4],p.box[5]).filter(c=>c.top0>0);if(!cuts.length)continue;
        onGola++;const ft=p.box[4]-h.pos[1],ff=p.box[5]-h.pos[2];
        if(cuts.some(c=>Math.abs(c.top0-ft)<0.6&&Math.abs(c.depth-ff)<=1.5))atCorner++;
      }
    }
  }
  assert.equal(onGola,23);assert.equal(atCorner,23,'все «5» на боковинах с Gola — в углу среднего выреза');
  for(const [k,key] of [['k10','m12'],['k15','m04'],['k17','m05'],['k30','m13']]){
    const ref=refOf(k,key),{module:m,unsupported}=moduleFromEtalon(ref),c=compareModule(ref,m);
    assert.ok(m.kitchen!.golaTies,`${k} ${key}: стяжки распознаны`);
    assert.ok(honestPass(c,validate(m),unsupported),`${k} ${key}: PASS — ${JSON.stringify({h:c.holes&&[c.holes.missing,c.holes.extra],e:c.edges?.bad,hw:c.hardware.filter(h=>h.ref!==h.studio)})}`);
  }
});

test('Bazis modules with middle Gola cuts and no «5» get no ties (k06 m03, k27 m02, k31 m16)',{skip:!existsSync(ED)},()=>{
  for(const [k,key] of [['k06','m03'],['k27','m02'],['k31','m16']]){
    const m=moduleFromEtalon(refOf(k,key)).module;
    assert.ok(m.gola?.cuts.some(c=>c.top0>0),`${k} ${key}: средний вырез есть`);
    assert.equal(m.kitchen!.golaTies,undefined);assert.ok(!parts(m).some(p=>p.id.startsWith('kitchen-tie')));
  }
});

test('Base module: bottom joint fastened in Bazis only at one side (k10 m11: confirmats only under the right side) — the other side bare, as in Bazis',{skip:!existsSync(ED)},()=>{
  const ref=refOf('k10','m11'),{module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual(m.kitchen!.jointNone,['bottom:left']);
  const ps=parts(m);assert.ok(!ps.some(p=>/^fast:.*bottom.*left|^fast:bottom:left/.test(p.id)&&p.position[0]<m.width/2),'слева у дна конфирматов нет');
  const c=compareModule(ref,m);assert.ok(honestPass(c,validate(m),unsupported),JSON.stringify({h:c.holes&&[c.holes.missing,c.holes.extra],hw:c.hardware.filter(h=>h.ref!==h.studio)}));
  // обе стороны с крепежом (k10 m12) — правило модуля, jointNone нет
  assert.equal(moduleFromEtalon(refOf('k10','m12')).module.kitchen!.jointNone,undefined);
});
test('Gola cut in one side only (GolaCut.side): the other side stays rectangular, the profile stops at its face, tie only where the cut is',()=>{
  // k30 m12: средний вырез только в правой боковине (в нём стяжка «5»), верхний — в обеих
  const m=gola({right:1},[{top0:0,top1:57,depth:26,r:5},{top0:368.5,top1:440.5,depth:26,r:5,sharpTop:true,side:'right'}]);
  const l=side(m),r=side(m,'right');
  assert.equal(l.golaCuts!.length,1);assert.equal(r.golaCuts!.length,2);
  assert.equal(l.edgeLen!['+z'],l.size[1]-57);assert.equal(r.edgeLen!['+z'],r.size[1]-57-72);
  const c=parts(m).find(p=>p.id.startsWith('gola:C'))!,lx=l.position[0]+l.size[0]/2;
  assert.ok(Math.abs(c.position[0]-c.size[0]/2-lx)<1e-6,'профиль C упирается в пласть левой боковины');assert.ok(Math.abs(c.position[0]+c.size[0]/2-m.width)<1e-6);
  assert.deepEqual(partCollisions(parts(m),m).filter(x=>(x.a.startsWith('gola:C')||x.b.startsWith('gola:C'))&&[x.a,x.b].some(id=>id==='left'||id==='right')),[],'профиль C не пересекает боковину без выреза');
  assert.ok(holes(m).some(h=>h.src==='kitchen-tie:right'));
  assert.equal(parseModule(JSON.parse(JSON.stringify(m))).gola!.cuts[1].side,'right');
  // в правой вырезов нет вовсе (k30 m14): правая — прямоугольник
  const n=gola(undefined,K10_CUTS.map(c=>({...c,side:'left' as const})));assert.equal(side(n,'right').golaCuts,undefined);
});

test('Bazis k30: per-side Gola cuts recognized (m12 — middle only right, m14 — right side without cuts), m12 PASS',{skip:!existsSync(ED)},()=>{
  const r12=refOf('k30','m12'),a=moduleFromEtalon(r12);
  assert.deepEqual(a.module.gola!.cuts.map(c=>c.side??'both'),['both','right']);assert.deepEqual(a.module.kitchen!.golaTies,{right:1});
  const c=compareModule(r12,a.module);assert.ok(honestPass(c,validate(a.module),a.unsupported),JSON.stringify({e:c.edges?.bad,h:c.holes&&[c.holes.missing,c.holes.extra]}));
  const b=moduleFromEtalon(refOf('k30','m14')).module;assert.ok(b.gola!.cuts.every(c=>c.side==='left'));
  assert.equal(compareModule(refOf('k30','m14'),b).edges!.bad.length,0,'кромка боковин — как в Базисе');
});
test('Blind front next to drawers (kitchen.blindFronts): a facade like the drawer ones, no box and no hardware; saved and read back',{skip:!existsSync(ED)},()=>{
  // k29 m03: два ящика Axis (фасад 597–936), под ними глухой фасад 102–593 без петель и направляющих
  const ref=refOf('k29','m03'),{module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual(m.kitchen!.blindFronts,[{y0:102,y1:593}]);
  const ps=parts(m),bf=ps.find(p=>p.id==='kd-blind:0:facade')!,kf=ps.find(p=>p.id.startsWith('kd:')&&p.id.endsWith(':facade'))!;
  assert.deepEqual([bf.size[0],bf.size[2],bf.position[0],bf.position[2],bf.decor],[kf.size[0],kf.size[2],kf.position[0],kf.position[2],kf.decor],'как фасад ящика');
  assert.equal(bf.size[1],491);assert.ok(!ps.some(p=>p.id.startsWith('kd-blind')&&!p.id.endsWith(':facade')),'ни короба, ни крепежа');
  assert.ok(!holes(m).some(h=>h.part.startsWith('kd-blind')),'отверстий в глухом фасаде нет (в Базисе нет)');
  const c=compareModule(ref,m);assert.ok(honestPass(c,validate(m),unsupported),JSON.stringify({miss:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name)}));
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen!.blindFronts,[{y0:102,y1:593}]);
  // фасад с фурнитурой на нём (дверь на петлях) — не глухой: в модулях с петлями поле не ставится
  for(const [k,key] of [['k10','m12'],['k15','m04']])assert.equal(moduleFromEtalon(refOf(k,key)).module.kitchen!.blindFronts,undefined);
});