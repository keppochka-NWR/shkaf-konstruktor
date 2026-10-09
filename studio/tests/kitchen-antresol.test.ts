import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {initialModule,parts,validate,parseModule,facadeBottom,type Module} from '../src/model';
import {kitchenWall} from '../src/kitchen';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {hangersFromEtalon,fastenersAbsent,endsEdged,edgeFlags,underEccFromEtalon,noEdges,liftHingeX,confDepthFromEtalon,backClearY,faceGapOf,moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {compareModule,type RefModule,type RefPanel} from '../scripts/kitchen/compare';
import {estimate} from '../src/pricing';
import {newProject} from '../src/project';

// Антресоль 600×400×350 (как Базис k12 «А 1»): дно и крыша между боковинами, ХДФ в паз, навесы ABS.
const antresol=():Module=>{const m=kitchenWall(initialModule(),600);m.height=400;m.depth=350;m.kitchen={...m.kitchen!,role:'antresol'};return m;};
const hw=(name:string,category:string,pos:number[])=>({name,category,pos});

test('hangers recognizer: Bazis rule 15/20/0 gives no override, absent hangers give null',()=>{
  const std=[hw('Навес мебельный регулируемый ABS левый','навес',[16,385,20]),hw('Навес мебельный регулируемый ABS правый','навес',[584,385,20]),
    hw('Заглушка для мебельного навеса ABS левая','заглушка',[16,385,20]),hw('Заглушка для мебельного навеса ABS правая','заглушка',[584,385,20])];
  assert.deepEqual(hangersFromEtalon(std,16,584,400,0),{});
  assert.equal(hangersFromEtalon([],16,584,400,0),null);
  // имена перепутаны (k08 m09: «правый» у левой боковины) — сторона по положению, навесы по правилу, а не сквозь боковину в соседа (слияние n3)
  const swapped=[hw('Навес мебельный регулируемый ABS правый','навес',[16,385,20]),hw('Навес мебельный регулируемый ABS левый','навес',[584,385,20]),
    hw('Заглушка для мебельного навеса ABS правая','заглушка',[16,385,20]),hw('Заглушка для мебельного навеса ABS левая','заглушка',[584,385,20])];
  assert.deepEqual(hangersFromEtalon(swapped,16,584,400,0),{});
});

test('hangers recognizer: hangers above the body (k12: +285 over the top) and on a plank 100 mm from the side (k18) are kept as in Bazis',()=>{
  const up=hangersFromEtalon([hw('Навес мебельный регулируемый ABS левый','навес',[16,685,20]),hw('Навес мебельный регулируемый ABS правый','навес',[584,685,20])],16,584,400,0)!;
  assert.deepEqual(up.hangerAt,{left:[-285,20,0],right:[-285,20,0]});
  assert.match(up.note!,/выше корпуса на 300/);
  // k18 m14: навес в 99,2 мм от внутренней грани, на 25 ниже верха; заглушка — на боковине по правилу
  const k18=hangersFromEtalon([hw('Навес мебельный регулируемый ABS левый','навес',[115.2,485,20]),hw('Навес мебельный регулируемый ABS правый','навес',[464.2,485,20]),
    hw('Заглушка для мебельного навеса ABS левая','заглушка',[16,495,20]),hw('Заглушка для мебельного навеса ABS правая','заглушка',[565,495,20])],16,565,510,0)!;
  assert.deepEqual(k18.hangerAt,{left:[25,20,99.2],right:[25,20,100.8],caps:{left:[15,20,0],right:[15,20,0]}});
});

test('studio places hangers and caps from kitchen.hangerAt; a hanger off the side panel drills nothing, like Bazis',()=>{
  const m=antresol();m.kitchen!.hangerAt={left:[-285,20,0],right:[-285,20,0]};
  const ps=parts(m),h=ps.find(p=>p.id==='kitchen-hanger:left')!,c=ps.find(p=>p.id==='kitchen-hanger-cap:right')!;
  assert.deepEqual(h.model!.origin,[16,685,20]);assert.deepEqual(c.model!.origin,[584,685,20]);
  assert.equal(holes(m,ps).filter(x=>x.src.startsWith('kitchen-hanger')).length,0,'no hanger holes outside the sides');
  const std=antresol(),sh=holes(std).filter(x=>x.src.startsWith('kitchen-hanger'));
  assert.equal(sh.length,4,'rule position: 2 × D3×3 per side');
  const k18=antresol();k18.kitchen!.hangerAt={left:[25,20,100],right:[25,20,100],caps:{left:[15,20,0],right:[15,20,0]}};
  const p2=parts(k18);
  assert.deepEqual(p2.find(p=>p.id==='kitchen-hanger:right')!.model!.origin,[484,375,20]);
  assert.deepEqual(p2.find(p=>p.id==='kitchen-hanger-cap:right')!.model!.origin,[584,385,20]);
  assert.deepEqual(partCollisions(p2,k18),[]);
  // сохранение проекта
  const back=parseModule(JSON.parse(JSON.stringify(k18)));
  assert.deepEqual(back.kitchen!.hangerAt,k18.kitchen!.hangerAt);
});

test('hanger pressed up to 2 mm into the roof underside (Bazis k14 m04 1.2, k18 m09 2) is a contact, deeper is a collision',()=>{
  const at=(down:number)=>{const m=antresol();m.kitchen!.hangerAt={left:[down,20,0],right:[15,20,0]};return partCollisions(parts(m),m).filter(c=>/kitchen-hanger/.test(c.a+c.b));};
  assert.deepEqual(at(13),[]);
  assert.ok(at(5).some(c=>/kitchen-hanger:left/.test(c.a+c.b)&&(c.a==='top'||c.b==='top')),'10 mm into the roof is reported');
});

test('no fasteners in Bazis (k32): studio adds no confirmats, eccentrics or dowels',()=>{
  assert.equal(fastenersAbsent({key:'x',name:'x',archetype:'antresol',size:[600,690,560],panels:[],hardware:[],holes:[]}),true);
  assert.equal(fastenersAbsent({key:'x',name:'x',archetype:'antresol',size:[600,690,560],panels:[],hardware:[{i:0,name:'Конфирмат 7х50 мм, Zn',category:'конфирмат',pos:[0,8,63]}]}),false);
  const m=antresol();m.kitchen!.noFasteners=true;
  const ps=parts(m);
  assert.equal(ps.filter(p=>/^(fast|ecc|dowel):/.test(p.id)).length,0);
  assert.equal(antresol().kitchen!.noFasteners,undefined);
  assert.ok(parts(antresol()).some(p=>p.id.startsWith('fast:')),'default antresol keeps its confirmats');
  assert.equal(parseModule(JSON.parse(JSON.stringify(m))).kitchen!.noFasteners,true);
});

test('raised hanging body (bottom 14 above the module bottom): no plinth panel, facade down to the module bottom, no plinth-list error',()=>{
  const m=antresol();m.plinthHeight=14;m.kitchen!.plinth={height:95,off:true};m.kitchen!.bazis=true; // как ставит распознаватель: модуль из Базиса, щита под дном нет
  const ps=parts(m);
  assert.ok(!ps.some(p=>p.id==='plinth'),'hanging cabinets have no plinth');
  assert.equal(facadeBottom(m),0);
  assert.ok(!validate(m).some(e=>/цоколя/.test(e)));
  const w=initialModule();w.plinthHeight=14;assert.ok(validate(w).some(e=>/цоколя/.test(e)),'wardrobe rule unchanged');
  // слияние n3: подъём корпуса кухни — в пределах корпуса у любой кухни (m.kitchen: правила Базиса — для кухонь, n3-plinth/n3-tall);
  // список высот цоколя — только у шкафов (проверено выше)
  const own=antresol();own.plinthHeight=14;assert.ok(!validate(own).some(e=>/цоколя из списка/.test(e)),'kitchen: no wardrobe plinth list');
  // поднятое дно выше крыши (k18 m17: распознано дно на 494 при высоте 510) — студия говорит об этом, а не молчит
  const bad=antresol();bad.plinthHeight=380;assert.ok(validate(bad).some(e=>/выше крыши/.test(e)));
});

test('edge ends: top/bottom between sides edged at the ends only when Bazis edges them (k32)',()=>{
  const p=(edges:[string,number][]):RefPanel=>({i:0,name:'Дно',mat:'',thick:16,kind:'ldsp',box:[16,0,0,584,16,560],axis:'y',edges:edges.map(([side,thick])=>({side,thick}))} as unknown as RefPanel);
  assert.equal(endsEdged([p([['+z',1],['+x',1],['-z',1],['-x',1]])]),true);
  assert.equal(endsEdged([p([['+z',1],['-z',1]])]),false);
  const m=antresol();m.edgeScheme={t:1,endsX:true};
  const top=parts(m).find(q=>q.id==='top')!;
  assert.deepEqual(top.edge.filter(x=>x>0).length,4,'all four ends edged');
});

test('sides standing on the bottom with eccentrics (k16): recognizer reads insets/dowel offset, studio drills like Bazis',()=>{
  const B=(x0:number,y0:number,z0:number,x1:number,y1:number,z1:number)=>({x0,y0,z0,x1,y1,z1});
  const bottom=B(0,0,0,583,16,370),left=B(0,16,0,16,300,370),right=B(567,16,0,583,300,370);
  const ecc=(x:number,z:number)=>hw('Стяжка эксц. (компл.)','эксцентрик',[x,16,z]),dw=(x:number,z:number)=>hw('Шкант 8х30 мм','шкант',[x,0,z]);
  const r=underEccFromEtalon([ecc(0,307),ecc(0,83),ecc(583,307),ecc(583,83),dw(8,275),dw(8,115),dw(575,275),dw(575,115)],bottom,left,right)!;
  assert.deepEqual(r,{at:{back:83,front:63},sides:['left','right'],dowel:32});
  assert.equal(underEccFromEtalon([ecc(16,83)],bottom,left,right),null,'eccentric at the inner face is not this joint');
  const m=antresol();m.width=583;m.height=300;m.depth=370;m.bottomUnder=true;m.kitchen!.underEcc=r.at;m.dowels={offset:32};
  m.jointFastening={'bottom:left':'eccentric','bottom:right':'eccentric'};
  const ps=parts(m),e=ps.filter(p=>/^ecc:under:[a-z]+:\d$/.test(p.id)),d=ps.filter(p=>p.id.startsWith('dowel:under:'));
  assert.equal(e.length,4);assert.equal(d.length,4);
  assert.deepEqual(e.find(p=>p.id==='ecc:under:left:0')!.anchor,[0,16,83]);
  assert.deepEqual(d.find(p=>p.id==='dowel:under:left:0')!.anchor,[8,0,115]);
  assert.ok(!ps.some(p=>p.id.startsWith('fast:bottom:')),'no confirmats through the bottom on eccentric joints');
  const hs=holes(m,ps).filter(h=>h.src.startsWith('ecc:under:left:0'));
  assert.deepEqual(hs.map(h=>[h.part,h.d,h.depth,h.at.join(',')]).sort(),[['bottom',5,12,'8,16,83'],['left',15,12,'0,50,83'],['left',8,34,'8,16,83']].sort());
  assert.deepEqual(partCollisions(ps,m),[]);
});

test('edge flags follow the Bazis edging: under-bottom ends not edged (k28), rear ends with a nailed back (k31)',()=>{
  const P=(edges:[string,number][]):RefPanel=>({i:0,name:'',mat:'',thick:16,kind:'ldsp',box:[0,0,0,1,1,1],axis:'y',edges:edges.map(([side,thick])=>({side,thick}))} as unknown as RefPanel);
  assert.deepEqual(edgeFlags(P([['+z',1],['-z',1]]),P([['+z',0.4],['-z',0.4]]),P([['+z',0.4],['-z',0.4]]),true,'groove'),{underEnds:false});
  assert.deepEqual(edgeFlags(P([['+z',1],['-z',1]]),P([['+z',1],['-z',1],['+x',1],['-x',1]]),P([['+z',1],['-z',1]]),true,'nailed'),{rear:true});
  assert.deepEqual(edgeFlags(P([['+z',1]]),P([['+z',1],['+x',1],['-x',1]]),P([['+z',1]]),true,'nailed'),{});
  const m=antresol();m.bottomUnder=true;m.backType='nailed';m.edgeScheme={t:1,underEnds:false,rear:true};
  const ps=parts(m),bottom=ps.find(p=>p.id==='bottom')!,left=ps.find(p=>p.id==='left')!;
  assert.equal(bottom.edge.filter(x=>x>0).length,2,'bottom under the sides: front and rear only');
  assert.equal(left.edge.filter(x=>x>0).length,4,'side: all four with rear');
});

test('no edging in the Bazis project at all (k23): studio carcass has no edging either; wardrobes keep theirs',()=>{
  const P=(edges:unknown):RefPanel=>({i:0,name:'',mat:'',thick:16,kind:'ldsp',box:[0,0,0,1,1,1],axis:'y',edges} as unknown as RefPanel);
  assert.equal(noEdges([P([]),P([])]),true);
  assert.equal(noEdges([P([]),P([{side:'+z',thick:1}])]),false);
  assert.equal(noEdges([P(undefined)]),false,'no edge data is not "no edging"');
  const m=antresol();m.edgeScheme={t:0};
  assert.ok(parts(m).filter(p=>p.material==='board'&&p.role!=='door').every(p=>p.edge.every(x=>x===0)));
  assert.ok(parts(initialModule()).some(p=>p.edge.some(x=>x>0)),'wardrobe default edging unchanged');
});

test('lift-up front hinges at Bazis positions (k31 m13: 114.5 from the edges), rule positions give no override',()=>{
  assert.equal(liftHingeX([100,497],597,397),undefined,'rule: 100 mm from the edges');
  assert.deepEqual(liftHingeX([114.5,666.5],781,387),[114.5,666.5]);
  const m=antresol();m.width=784;m.sections=[{...m.sections[0],shelves:[],doorLeaves:1,doorHinges:['top'],hingeX:[114.5,666.5],hingeXFor:781}];
  const ps=parts(m),door=ps.find(p=>p.role==='door'&&p.hinge==='top')!,x0=door.position[0]-door.size[0]/2;
  const xs=ps.filter(p=>p.id.includes(':hingeplate:')).map(p=>Math.round((p.model!.origin![0]-x0)*10)/10).sort((a,b)=>a-b);
  assert.deepEqual(xs,[114.5,666.5]);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).sections[0].hingeX,[114.5,666.5]);
});

test('confirmat D5 depth as in the Bazis project (k31: 42), single value only',()=>{
  const ref=(depths:number[]):RefModule=>({key:'x',name:'x',archetype:'antresol',size:[1,1,1],panels:[],hardware:[{i:0,name:'Конфирмат 7х50 мм, Zn',category:'конфирмат',pos:[0,0,0]}],holes:depths.map(depth=>({panel:1,face:'-x',at:[0,0,0],dir:[1,0,0],d:5,depth,src:0}))});
  assert.equal(confDepthFromEtalon(ref([42,42])),42);
  assert.equal(confDepthFromEtalon(ref([35,35])),undefined);
  assert.equal(confDepthFromEtalon(ref([35,42])),undefined,'mixed depths are not one rule');
  const m=antresol();m.kitchen!.confDepth=42;
  assert.ok(holes(m).filter(h=>h.src.startsWith('fast:')&&h.d===5).every(h=>h.depth===42));
  assert.ok(holes(antresol()).filter(h=>h.src.startsWith('fast:')&&h.d===5).every(h=>h.depth===35));
});

test('edge ends per panel: only the bottom edged at the ends (k31 m13)',()=>{
  const P=(edges:[string,number][]):RefPanel=>({i:0,name:'',mat:'',thick:16,kind:'ldsp',box:[0,0,0,1,1,1],axis:'y',edges:edges.map(([side,thick])=>({side,thick}))} as unknown as RefPanel);
  assert.deepEqual(edgeFlags(P([['+z',1]]),P([['+z',1],['-z',1],['+x',1],['-x',1]]),P([['+z',1],['-z',1]]),false,'groove'),{endsX:'bottom'});
  const m=antresol();m.edgeScheme={t:1,endsX:'bottom'};
  const ps=parts(m);
  assert.equal(ps.find(p=>p.id==='bottom')!.edge.filter(x=>x>0).length,4);
  assert.equal(ps.find(p=>p.id==='top')!.edge.filter(x=>x>0).length,2);
});

test('kitchen back groove may sit deep in the body (k20 m05: 119 mm), wardrobe limit 8–30 unchanged',()=>{
  const m=antresol();m.backType='groove';m.grooveInset=119;
  assert.ok(!validate(m).some(e=>/Паз/.test(e)));
  const w=initialModule();w.backType='groove';w.grooveInset=119;
  assert.ok(validate(w).some(e=>/Паз/.test(e)),'wardrobe rule unchanged');
});

test('lift-up hinge cup centre 22 mm below the top edge of the front (Bazis k10/k12/k13/k23/k28/k31), drilled there',()=>{
  const m=antresol();m.sections=[{...m.sections[0],shelves:[],doorLeaves:1,doorHinges:['top']}];m.faceGap=2;
  const ps=parts(m),door=ps.find(p=>p.role==='door'&&p.hinge==='top')!,top=door.position[1]+door.size[1]/2;
  const cups=ps.filter(p=>p.id.includes(':hingecup:'));
  assert.equal(cups.length,2);
  for(const c of cups)assert.equal(c.model!.origin![1],top-22);
  const hs=holes(m,ps).filter(h=>h.d===35);
  assert.equal(hs.length,2);for(const h of hs)assert.equal(h.at[1],top-22);
});

test('antresol with two rows of lift-up fronts (k13 m02): the lower row hangs on the fixed shelf, 2 hinges per front',{skip:!existsSync('C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/k13.json')},()=>{
  const ref=(JSON.parse(readFileSync('C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/k13.json','utf8')).modules as RefModule[]).find(m=>m.key==='m02')!;
  const {module:m}=moduleFromEtalon(ref),ps=parts(m);
  assert.deepEqual(validate(m),[]);
  assert.equal(ps.filter(p=>p.role==='door'&&p.hinge==='top').length,2);
  assert.equal(ps.filter(p=>p.id.includes(':hingeplate:')).length,4);
  assert.deepEqual(partCollisions(ps,m),[]);
  const c=compareModule(ref,m);
  assert.equal(c.hardware.find(h=>h.category==='петля')!.maxPosDelta,0);
  assert.ok(!c.missing.length&&!c.extra.length);
  // жёсткая полка с 20 мм (за ХДФ): задний конфирмат — от задней кромки боковины, как у дна и крыши; торцы полки без кромки
  assert.equal(c.hardware.find(h=>h.category==='конфирмат')!.maxPosDelta,0);
  assert.equal(m.edgeScheme?.fixedEnds,false);
  assert.equal(c.pass,true);
});

test('fixed shelf confirmats: studio wardrobes keep the inset from the shelf edges',()=>{
  const w=initialModule();w.sections=[{...w.sections[0],shelves:[0.5],fixed:[0]}];
  const sh=parts(w).find(p=>p.id===`${w.sections[0].id}:shelf:0`)!,z0=sh.position[2]-sh.size[2]/2;
  const cz=parts(w).filter(p=>p.id.startsWith(`fast:${sh.id}:left:`)).map(p=>p.model!.origin![2]).sort((a,b)=>a-b);
  if(cz.length)assert.equal(cz[0],z0+(w.confirmatInset??50));
});

test('estimate of a module from Bazis: no "мелочёвка корпуса" norm and no confirmat caps (none in any Bazis project); studio kitchens keep them',()=>{
  const lines=(m:Module)=>estimate(newProject(m)).lines.map(l=>l.id);
  // слияние n3: правила Базиса — у любой кухни (m.kitchen, n3-kitchens2/n3-additions): ни «мелочёвки», ни заглушек, ни подъёмника
  // без газлифта Базиса; шкаф студии — как раньше
  const own=antresol(),bz=antresol();bz.kitchen!.bazis=true;
  const wardrobe={...initialModule()};
  assert.ok(lines(wardrobe).includes('kit')&&lines(wardrobe).includes('confirmat-cap'),'wardrobe keeps the norm and caps');
  assert.ok(!lines(own).includes('kit')&&!lines(own).includes('confirmat-cap'));
  assert.ok(!lines(bz).includes('kit')&&!lines(bz).includes('confirmat-cap'));
  assert.ok(lines(bz).includes('confirmat-7x50'),'confirmats themselves stay — they are in Bazis');
  // подъёмный фасад без подъёмника в проекте: строки механизма нет ни у модуля из Базиса, ни у кухни студии
  const lift=(b:boolean)=>{const m=antresol();m.sections=[{...m.sections[0],shelves:[],doorLeaves:1,doorHinges:['top']}];if(b)m.kitchen!.bazis=true;return m;};
  assert.ok(!lines(lift(false)).includes('lift-mechanism'));
  assert.ok(!lines(lift(true)).includes('lift-mechanism'));
  assert.equal(parseModule(JSON.parse(JSON.stringify(bz))).kitchen!.bazis,true);
  // название фасада — как смета: у модуля из Базиса без подъёмника нет «механизм требует подбора»
  const door=(b:boolean)=>parts(lift(b)).find(p=>p.role==='door'&&p.hinge==='top')!.name;
  assert.match(door(false),/механизм требует подбора/);
  assert.doesNotMatch(door(true),/механизм|подбор/);assert.match(door(true),/без подъёмника/);
});

test('HDF in the groove with its own bottom/top clearance as in Bazis (k28 m10: 2.5 / 1), symmetric case gives no override',()=>{
  const B=(x0:number,y0:number,z0:number,x1:number,y1:number,z1:number)=>({x0,y0,z0,x1,y1,z1});
  assert.deepEqual(backClearY(B(9,24.5,17,741,359,20),B(0,14,0,750,30,345),B(16,352,0,734,368,345),8,1),[2.5,1]);
  assert.equal(backClearY(B(9,9,17,591,391,20),B(16,0,0,584,16,350),B(16,384,0,584,400,350),8,1),undefined);
  const m=antresol();m.backType='groove';m.kitchen!.backClearY=[2.5,1];
  const back=parts(m).find(p=>p.id==='back')!;
  assert.equal(back.position[1]-back.size[1]/2,16-8+2.5);assert.equal(back.position[1]+back.size[1]/2,400-16+8-1);
  assert.deepEqual(partCollisions(parts(m),m),[]);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen!.backClearY,[2.5,1]);
});

test('single front gap: the gap shared by two of three edges (k23 m08: left 2.5, right and top 2 -> 2), symmetric -> unchanged',()=>{
  const B=(x0:number,y0:number,z0:number,x1:number,y1:number,z1:number)=>({x0,y0,z0,x1,y1,z1});
  assert.equal(faceGapOf(B(2.5,2,330,898,398,349),0,900,400),2);
  assert.equal(faceGapOf(B(1.5,1.5,330,598.5,398.5,349),0,600,400),1.5);
  assert.equal(faceGapOf(B(1,1,330,597,396,349),0,600,400),1,'all different -> left');
});

test('wall/antresol plinth: off only when Bazis has none (kitchen.plinth.off), otherwise kept like base/tall',()=>{
  // слияние n3: у навесного/антресоли без сведений о цоколе цоколя нет (n3-plinth); щит под дном в Базисе (lowFront) — цоколь есть
  const m=antresol();m.plinthHeight=100;
  assert.ok(!parts(m).some(p=>p.id==='plinth'),'no spec: no plinth on a hanging cabinet (n3-plinth)');
  m.kitchen!.lowFront=true;
  assert.ok(parts(m).some(p=>p.id==='plinth'),'panel under the bottom in Bazis: plinth stays');
  delete m.kitchen!.lowFront;m.kitchen!.plinth={height:95,off:true};
  assert.ok(!parts(m).some(p=>p.id==='plinth'),'Bazis has no panel under the raised bottom: no plinth');
  assert.equal(parseModule(JSON.parse(JSON.stringify(m))).kitchen!.plinth!.off,true);
});

test('fixed shelf back confirmat from the side edge only for a shelf standing on the HDF in the groove; nailed back keeps the shelf-edge inset',()=>{
  const shelfOf=(m:Module)=>{const ps=parts(m),sh=ps.find(p=>p.id===`${m.sections[0].id}:shelf:0`)!;return {ps,sh,z0:sh.position[2]-sh.size[2]/2,cz:ps.find(p=>p.id===`fast:${sh.id}:left:0`)!.model!.origin![2]};};
  const m=kitchenWall(initialModule(),600);m.height=700;m.depth=330;m.backType='groove';m.confirmatInset=54;m.sections=[{...m.sections[0],shelves:[0.5],fixed:[0]}];
  const bk=parts(m).find(p=>p.id==='back')!,front=bk.position[2]+bk.size[2]/2;
  m.shelfRear=(m.shelfRear??0)+front-shelfOf(m).z0; // полка задней кромкой на лицевой плоскости ХДФ (как k13 m02: ХДФ 17–20, полка с 20)
  const g=shelfOf(m);
  assert.equal(g.z0,front);assert.equal(g.cz,54,'on the HDF: from the side edge, like bottom and top');
  const n={...m,backType:'nailed' as const},s=shelfOf(n);
  assert.equal(s.cz,s.z0+54,'nailed back: from the shelf edge');
  const nb={...m,kitchen:undefined},w=shelfOf(nb);
  assert.equal(w.cz,w.z0+54,'not a kitchen: unchanged');
});

// Сверка с эталонами Базиса (вне репозитория — на другой машине пропуск).
const ET='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/';
const refOf=(k:string,key:string)=>(JSON.parse(readFileSync(ET+k+'.json','utf8')).modules as RefModule[]).find(m=>m.key===key)!;

// Цоколь из ЛДСП под другим именем: щит под поднятым дном навесного («Фронтальная» k14 m03, «13-ФП» k32 m13) — цоколь модуля,
// он не пропадает; у антресоли без такого щита (k28 m10) цоколя нет.
for(const [k,key,name,h] of [['k14','m03','Фронтальная',255],['k32','m13','13-ФП',312]] as const)
  test(`etalon ${k}/${key}: plinth panel under the raised bottom of a wall module ("${name}") is kept`,{skip:!existsSync(ET+k+'.json')},()=>{
    const ref=refOf(k,key),{module:m}=moduleFromEtalon(ref);
    assert.notEqual(m.kitchen!.plinth?.off,true);
    const pl=parts(m).find(p=>p.id==='plinth')!;
    assert.ok(pl,'plinth part');assert.equal(pl.size[1],h);
    const c=compareModule(ref,m);
    assert.ok(!c.missing.some(x=>x.name===name&&/ldsp/.test(x.cls)),'Bazis panel is not missing');
    assert.ok(c.pairs.some(p=>p.ref.name===name&&p.studio.id==='plinth'&&p.delta===0),'flush with the side fronts, as in Bazis');
  });
test('etalon k28/m10: antresol without a panel under the bottom has no plinth (plinth.off)',{skip:!existsSync(ET+'k28.json')},()=>{
  const {module:m}=moduleFromEtalon(refOf('k28','m10'));
  assert.equal(m.kitchen!.plinth?.off,true);
  assert.ok(!parts(m).some(p=>p.id==='plinth'));
});
// ХДФ в пазу промежуточной горизонтали: зазор сверху считается от крыши студии (под верхом боковин), а не от горизонтали Базиса
// над боковинами (k13 m04 «+ полка»: было −18 по высоте; k17 m07: 689,5 вместо 705,5) — размер как в Базисе.
for(const [k,key,w,h] of [['k13','m04',682,327],['k17','m07',1014,705.5],['k21','m07',972,705.5]] as const)
  test(`etalon ${k}/${key}: HDF size as in Bazis when the top horizontal stands above the sides`,{skip:!existsSync(ET+k+'.json')},()=>{
    const ref=refOf(k,key),{module:m}=moduleFromEtalon(ref),b=parts(m).find(p=>p.id==='back')!;
    assert.deepEqual([b.size[0],b.size[1]],[w,h]);
    const hdf=ref.panels.filter(p=>p.kind==='hdf').map(p=>[p.box[1],p.box[4]]);
    assert.ok(hdf.some(([y0,y1])=>Math.abs(y0-(b.position[1]-h/2))<0.05&&Math.abs(y1-(b.position[1]+h/2))<0.05),'same height position');
  });
// Крыша Базиса на боковинах (над торцами, во всю ширину; k17 m07, k21 m07): студия так не строит — «не поддержано» (модуль идёт как
// в Базисе), без ложной заметки «навесы выше корпуса на 16 мм»; крыша между боковинами (k12 m05) — без этой причины (n4-antresol).
for(const [k,key,over] of [['k17','m07',true],['k21','m07',true],['k12','m05',false]] as const)
  test(`etalon ${k}/${key}: roof on top of the sides is ${over?'':'not '}reported as unsupported`,{skip:!existsSync(ET+k+'.json')},()=>{
    const {unsupported,notes}=moduleFromEtalon(refOf(k,key));
    assert.equal(unsupported.some(u=>/крыша на боковинах/.test(u)),over);
    if(over) assert.ok(!notes.some(n=>/навесы Базиса выше корпуса/.test(n)),'hangers under a roof on the sides are not «above the carcass»');
  });
// Шкант под боковиной вскрывает паз подсветки дна (k31 m03/m04 — 3 мм, как в самом проекте Базиса: D8×12 сверху, паз 8 снизу):
// студия повторяет как есть и помечает пересечение «как в проекте Базиса», не прячет его; у модуля не из Базиса пометки нет.
for(const key of ['m03','m04'])
  test(`etalon k31/${key}: dowel hole opening into the light groove is shown as a Bazis project defect`,{skip:!existsSync(ET+'k31.json')},()=>{
    const {module:m}=moduleFromEtalon(refOf('k31',key));
    const c=partCollisions(parts(m),m);
    assert.ok(c.length>0&&c.every(x=>x.bazis&&/dowel:under:/.test(x.a+' '+x.b)&&/groove:/.test(x.a+' '+x.b)),'only the Bazis dowel × groove, flagged');
    assert.ok(c.every(x=>x.depth<=3.05),'no deeper than in Bazis');
    const own={...m,kitchen:{...m.kitchen!,bazis:undefined}} as Module;
    assert.ok(partCollisions(parts(own),own).every(x=>!x.bazis),'not flagged for a module that is not from Bazis');
  });
// Лишний (третий) эксцентрик Базиса в углу у левой боковины (k28 m12, z=8) не отменяет эксцентрики боковины: обе боковины на стяжках
// с той же парой, что справа, а не на конфирматах студии (их нет в Базисе, и они выходили в паз подсветки на 8 мм).
test('etalon k28/m12: a stray corner eccentric keeps both sides on eccentrics, no studio confirmat in the light groove',{skip:!existsSync(ET+'k28.json')},()=>{
  const {module:m}=moduleFromEtalon(refOf('k28','m12'));
  assert.equal(m.jointFastening?.['bottom:left'],'eccentric');
  assert.equal(m.jointFastening?.['bottom:right'],'eccentric');
  assert.deepEqual([m.kitchen!.underEcc!.back,m.kitchen!.underEcc!.front],[70.5,50.5],'the regular pair, not the stray corner eccentric');
  const c=partCollisions(parts(m),m);
  assert.ok(c.every(x=>x.bazis),'only the Bazis dowel × groove remains');
});
// Задний конфирмат жёсткой полки нижнего шкафа (набивной ХДФ) — от кромки полки, не в точке вертикального конфирмата дна (k10 m11/m12/m14, k15 m03).
for(const [k,key] of [['k10','m11'],['k10','m12'],['k10','m14'],['k15','m03']] as const)
  test(`etalon ${k}/${key}: shelf confirmat does not hit the bottom confirmat`,{skip:!existsSync(ET+k+'.json')},()=>{
    const {module:m}=moduleFromEtalon(refOf(k,key)),ps=parts(m);
    // задние (…:0); передние пересечения (…:1) — старые, до работы по антресолям: полка распознана ниже, чем в Базисе
    const bad=partCollisions(ps,m).filter(c=>[c.a,c.b].some(x=>/^fast:bottom:\w+:0$/.test(x))&&[c.a,c.b].some(x=>/^fast:.*shelf:\d+:\w+:0$/.test(x)));
    assert.deepEqual(bad,[]);
  });

for(const [k,key] of [['k12','m05'],['k18','m14'],['k32','m16'],['k16','m08'],['k31','m03'],['k23','m06'],['k31','m13'],['k20','m05'],['k28','m10'],['k23','m08'],['k19','m05']] as const)
  test(`etalon ${k}/${key}: antresol recognized and matches Bazis`,{skip:!existsSync(ET+k+'.json')},()=>{
    const ref=(JSON.parse(readFileSync(ET+k+'.json','utf8')).modules as RefModule[]).find(m=>m.key===key)!;
    const {module:m}=moduleFromEtalon(ref);
    assert.deepEqual(validate(m),[]);
    assert.equal(compareModule(ref,m).pass,true);
  });

// n4-antresol: конфирматы стяжки и гвозди ХДФ — как в Базисе (k03: стяжка 100 под крышей, по 2 конфирмата в боковинах и 2 через крышу)
test('rail confirmats recognizer: two per side and through the top (k03), one centered gives no override',async()=>{
  const {railConfirmats,hdfNails}=await import('../scripts/kitchen/recognize-common');
  const b={x0:16,y0:274,z0:3,x1:584,y1:374,z1:19},c=(pos:number[])=>hw('Конфирмат 7х50 мм, Zn','конфирмат',pos);
  const k03=[c([0,308,11]),c([0,340,11]),c([600,308,11]),c([600,340,11]),c([76,390,11]),c([524,390,11]),c([0,382,278.5]),c([600,8,54.5])];
  assert.deepEqual(railConfirmats(b,k03,0,600,16,390),{conf:[34,66],topConf:[60,508]});
  assert.deepEqual(railConfirmats(b,[c([0,324,11]),c([600,324,11])],0,600,16,390),{});
  // стяжка не под крышей — конфирматы крыши к ней не относятся
  assert.deepEqual(railConfirmats({...b,y0:100,y1:200},[c([76,390,11])],0,600,16,390),{});
  const n=hdfNails([{name:'Гвоздь',category:'прочее',pos:[24,381.5,0],quat:[0.7071,0,-0.7071,0]},hw('Конфирмат 7х50 мм, Zn','конфирмат',[0,8,54.5])],0,0);
  assert.deepEqual(n,[{at:[24,381.5],quat:[0.7071,0,-0.7071,0]}]);
});

test('studio places rail confirmats and HDF nails from the Bazis project, only for kitchens; fields survive save/load',()=>{
  const m=antresol();m.kitchen!.hangers=false;m.backType='nailed';m.backGap=1;m.rails=[{place:'rear-top',height:100,conf:[34,66],topConf:[60,508]}];
  m.kitchen!.nails=[{at:[24,8.5],quat:[0.7071,0,-0.7071,0]},{at:[576,391.5]}];
  const ps=parts(m),o=(id:string)=>ps.find(p=>p.id===id)?.model?.origin;
  const top=m.height-16,ry0=top-100;
  assert.deepEqual(o('fast:rail:rear-top:left:0')?.slice(0,2),[0,ry0+34]);
  assert.deepEqual(o('fast:rail:rear-top:right:1')?.slice(0,2),[600,ry0+66]);
  assert.deepEqual(o('fast:rail:rear-top:top:0')?.slice(0,2),[76,m.height]);
  assert.deepEqual(o('fast:rail:rear-top:top:1')?.slice(0,2),[524,m.height]);
  const back=ps.find(p=>p.id==='back')!,nails=ps.filter(p=>p.id.startsWith('kitchen-nail:'));
  assert.equal(nails.length,2);
  assert.deepEqual(nails[0].position,[24,8.5,back.position[2]-back.size[2]/2]);
  assert.deepEqual(partCollisions(ps,m).filter(c=>/kitchen-nail|rail:rear-top/.test(c.a+c.b)),[]);
  const back2=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(back2.rails,m.rails);assert.deepEqual(back2.kitchen!.nails,m.kitchen!.nails);
  // шкаф студии (не кухня): поля стяжки Базиса не действуют — один конфирмат по центру, как раньше
  const w=initialModule();w.rails=[{place:'rear-top',height:100,conf:[34,66],topConf:[60]}];
  const wp=parts(w);
  assert.equal(wp.some(p=>/^fast:rail:rear-top:(top|\w+:1)/.test(p.id)),false);
});

for(const [k,key] of [['k03','m06'],['k03','m08']] as const)
  test(`etalon ${k}/${key}: rail confirmats and HDF nails as in Bazis`,{skip:!existsSync(ET+k+'.json')},()=>{
    const ref=(JSON.parse(readFileSync(ET+k+'.json','utf8')).modules as RefModule[]).find(m=>m.key===key)!;
    const {module:m}=moduleFromEtalon(ref);
    assert.deepEqual(validate(m),[]);
    assert.equal(compareModule(ref,m).pass,true);
  });

test('nailed HDF with an air gap from the body (kitchen.backAir, k01 m14 — 2 mm as in Bazis): back and nails move back, body stays',()=>{
  const m=antresol();m.backType='nailed';m.backGap=1;m.kitchen!.nails=[{at:[24,8.5]}];
  const z0=(ps:ReturnType<typeof parts>)=>{const b=ps.find(p=>p.id==='back')!;return b.position[2]-b.size[2]/2;};
  const a=parts(m);m.kitchen!.backAir=2;const b=parts(m);
  assert.equal(z0(b),z0(a)-2);
  assert.equal(b.find(p=>p.id==='kitchen-nail:0')!.position[2],z0(b));
  assert.deepEqual(b.find(p=>p.id==='left')?.position,a.find(p=>p.id==='left')?.position);
  assert.equal(parseModule(JSON.parse(JSON.stringify(m))).kitchen!.backAir,2);
});

for(const [k,key] of [['k13','m03'],['k01','m14']] as const)
  test(`etalon ${k}/${key}: top in front of a deep HDF / HDF with air gap recognized as in Bazis`,{skip:!existsSync(ET+k+'.json')},()=>{
    const ref=(JSON.parse(readFileSync(ET+k+'.json','utf8')).modules as RefModule[]).find(m=>m.key===key)!;
    const {module:m}=moduleFromEtalon(ref);
    assert.deepEqual(validate(m),[]);
    assert.equal(compareModule(ref,m).pass,true);
  });
test('service through holes of the Bazis project (k28 m14: D10 for a wire) are drilled as in Bazis; screws and meshes are not taken',async()=>{
  const {serviceHoles}=await import('../scripts/kitchen/recognize-common');
  const hw2=[{i:0,name:'10',category:'прочее',pos:[0,200,10],service:true,mesh:null},{i:1,name:'3x3',category:'прочее',pos:[16,99,545],service:true,mesh:null},{i:2,name:'Гвоздь',category:'прочее',pos:[24,8,0],mesh:'281de529218b'}];
  const hs=[{src:0,at:[0,200,10],dir:[1,0,0],d:10,depth:16,through:true},{src:1,at:[16,99,545],dir:[1,0,0],d:3,depth:3,through:false}];
  assert.deepEqual(serviceHoles(hw2,hs,0,0),[{at:[0,200,10],dir:[1,0,0],d:10,depth:16}]);
  const m=antresol();m.kitchen!.svcHoles=[{at:[0,200,10],dir:[1,0,0],d:10,depth:16}];
  const h=holes(m).filter(x=>x.src==='kitchen-svc:0');
  assert.equal(h.length,1);assert.equal(h[0].part,'left');assert.equal(h[0].d,10);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen!.svcHoles,m.kitchen!.svcHoles);
});

test('etalon k28/m14: service holes as in Bazis',{skip:!existsSync(ET+'k28.json')},()=>{
  const ref=(JSON.parse(readFileSync(ET+'k28.json','utf8')).modules as RefModule[]).find(m=>m.key==='m14')!;
  const {module:m}=moduleFromEtalon(ref);
  assert.deepEqual(validate(m),[]);
  assert.equal(compareModule(ref,m).pass,true);
});
test('confirmats tying the body to its neighbour (k15 m12: from inside through the left side outward) are placed and drilled as in Bazis',async()=>{
  const {outConfirmats}=await import('../scripts/kitchen/recognize-common');
  const hw3=[{i:0,name:'Конфирмат 7х50 мм, Zn',category:'конфирмат',pos:[16,52,371]},{i:1,name:'Конфирмат 7х50 мм, Zn',category:'конфирмат',pos:[0,8,61.5]}];
  const hs=[{src:0,at:[16,52,371],dir:[-1,0,0],d:8},{src:0,at:[0,52,371],dir:[1,0,0],d:5},{src:1,at:[0,8,61.5],dir:[1,0,0],d:8}];
  assert.deepEqual(outConfirmats(hw3,hs,0,975,16,0),[{side:'left',y:52,z:371}]);
  const m=antresol();m.kitchen!.outConf=[{side:'left',y:52,z:300}];
  const ps=parts(m),c=ps.find(p=>p.id==='fast:out:left:0')!;
  assert.deepEqual(c.model?.origin,[16,52,300]);
  const h=holes(m,ps).filter(x=>x.src==='fast:out:left:0');
  assert.deepEqual(h.map(x=>[x.part,x.d,x.at[0],x.dir[0]]),[['left',8,16,-1],['left',5,0,1]]);
  assert.deepEqual(partCollisions(ps,m).filter(x=>/fast:out/.test(x.a+x.b)),[]);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen!.outConf,m.kitchen!.outConf);
});

test('etalon k15/m12: neighbour confirmats as in Bazis',{skip:!existsSync(ET+'k15.json')},()=>{
  const ref=(JSON.parse(readFileSync(ET+'k15.json','utf8')).modules as RefModule[]).find(m=>m.key==='m12')!;
  const {module:m}=moduleFromEtalon(ref);
  assert.deepEqual(validate(m),[]);
  assert.equal(compareModule(ref,m).pass,true);
});