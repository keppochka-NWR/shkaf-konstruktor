import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../src/catalog';
import {decorPrice,estimate,HINGE,HARDWARE_KIT} from '../src/pricing';
import {newProject,parseProject,applyCornerFillers,applyAutoFillers,projectErrors} from '../src/project';
import {roomWarnings} from '../src/roomWarnings';
import {parts,initialModule,validate,legCount,fastenerCounts,drawerPitch,drawerCapTop,distributeDrawers} from '../src/model';
import {insertItem} from '../src/operations';
import {specificationHTML,details} from '../src/exports';

test('every catalog decor has a purchase price from explicit list or Lamarty tier',()=>{
  assert.equal(catalog.length,133);
  for(const c of catalog){const d=decorPrice(c.n);assert.ok(d.price!==null&&d.price>=2150&&d.price<=4060,c.n);assert.ok(d.source.length>0);}
});

test('tier pricing follows Lamarty 2026 columns and explicit prices win',()=>{
  assert.deepEqual(decorPrice('Дуб Вотан'),{price:2690,source:'База закупки СФЗ / Победа'});
  assert.equal(decorPrice('Орех Бруно D*').price,3810);
  const luxBase=catalog.find(c=>c.tier==='ЛЮКС'&&!/\s[A-Z*]+$/.test(c.n))!;assert.equal(decorPrice(luxBase.n).price,3160);
  const premiumStar=catalog.find(c=>c.tier==='ПРЕМИУМ'&&/D\*$/.test(c.n)&&c.n!=='Орех Бруно D*')!;assert.equal(decorPrice(premiumStar.n).price,3780);
  assert.equal(decorPrice('Несуществующий декор').price,null);
});

test('estimate is complete for the default project and includes hinges, kit and slide prices',()=>{
  const p=newProject(),e=estimate(p);
  assert.equal(e.missing.length,0,e.missing.map(l=>l.label).join('; '));
  assert.ok(e.retail!==null&&e.retail>0);
  const hinge=e.lines.find(l=>l.id==='hinge')!;assert.equal(hinge.unitPrice,HINGE.price);assert.equal(hinge.label,HINGE.label);
  const kit=e.lines.find(l=>l.id==='kit')!;assert.equal(kit.quantity,p.modules.length);assert.equal(kit.unitPrice,HARDWARE_KIT.price);
  assert.ok(e.lines.some(l=>l.id.startsWith('slide:ball:')&&l.unitPrice!==null));
});

test('hidden slides use workshop purchase of DTC/Unihopper and unknown lengths stay open',()=>{
  const p=newProject();const s=p.modules[0].module.sections[0];
  s.drawerConfigs=[{slide:'gtv0fpo',height:140,length:300},{slide:'gtv0fpo',height:140,length:250}];
  const e=estimate(p);
  const known=e.lines.find(l=>l.id==='slide:gtv0fpo:300')!,unknown=e.lines.find(l=>l.id==='slide:gtv0fpo:250')!;
  assert.equal(known.unitPrice,1040);assert.match(known.source,/DTC F10D300H/);
  assert.equal(unknown.unitPrice,null);assert.equal(e.retail,null);
});

test('stand lighting adds LED strips per stand face and a retail line on top of the markup',()=>{
  const p=newProject(),m=p.modules[0].module;
  const base=estimate(p);assert.ok(!parts(m).some(x=>x.role==='light'));
  m.standLight=true;
  const strips=parts(m).filter(x=>x.role==='light');
  assert.equal(strips.length,2*m.sections.length);
  const h=m.height-(m.plinthHeight??80)-2*16;assert.ok(strips.every(s=>Math.abs(s.length-h)<0.01&&s.material==='metal'));
  const e=estimate(p),line=e.lines.find(l=>l.id==='light-stand')!;
  assert.equal(line.retail,true);assert.equal(line.unitPrice,3000);assert.ok(Math.abs(line.quantity-strips.length*h/1000)<0.01);
  assert.equal(e.knownCost,base.knownCost);
  assert.equal(e.retail,base.retail!+Math.round(line.quantity*3000));
  assert.deepEqual(parseProject(p).modules[0].module.standLight,true);
});

test('plinth is 2 mm behind the front and facades drop onto it to 30 mm above the floor',()=>{
  const m=initialModule(),ps=parts(m);
  const plinthPart=ps.find(x=>x.id==='plinth')!;assert.ok(Math.abs(plinthPart.position[2]+8-(m.depth-2))<0.01);
  const door=ps.find(x=>x.role==='door')!;
  assert.ok(Math.abs(door.position[1]-door.size[1]/2-30)<0.01,'door bottom at 30');
  assert.ok(Math.abs(door.position[1]+door.size[1]/2-(m.height-2))<0.01,'door top gap 2');
  m.plinthHeight=0;const upperDoor=parts(m).find(x=>x.role==='door')!;assert.ok(Math.abs(upperDoor.position[1]-upperDoor.size[1]/2-2)<0.01,'no plinth: gap 2');
});

test('drawer facades are inset behind doors and overlay the stands in an open body',()=>{
  const m=initialModule();m.sections[0].shelves=[];m.sections[0].drawers=2;
  const inset=parts(m).find(x=>x.id.endsWith(':drawer:0:facade'))!;
  assert.ok(inset.size[0]<m.width-2*16,'inset facade narrower than the opening');
  assert.ok(inset.position[2]<m.depth,'inset facade sits inside the body');
  m.doors=false;const open=parts(m);
  const low=open.find(x=>x.id.endsWith(':drawer:0:facade'))!,up=open.find(x=>x.id.endsWith(':drawer:1:facade'))!;
  assert.ok(Math.abs(low.size[0]-(m.width-4))<0.01,'overlay facade spans the body minus 2 mm gaps');
  assert.ok(low.position[2]>m.depth,'overlay facade in front of the body');
  assert.ok(Math.abs(low.position[1]-low.size[1]/2-30)<0.01,'lowest facade drops to 30 mm above floor');
  assert.ok(Math.abs((up.position[1]-up.size[1]/2)-(low.position[1]+low.size[1]/2)-2)<0.01,'2 mm between overlay facades');
  assert.ok(!parts(m).some(x=>x.id.includes(':filler:')),'no fillers without doors');
});

test('handles come from the catalog: geometry length, price line and length check',()=>{
  const p=newProject(),m=p.modules[0].module;
  const def=estimate(p).lines.find(l=>l.id.startsWith('handle:'))!;assert.equal(def.id,'handle:uz819-128');assert.equal(def.unitPrice,100);
  m.handleId='lm86899315';
  const handles=parts(m).filter(x=>x.role==='handle');assert.ok(handles.length>0);assert.ok(handles.every(h=>h.length===128));
  const line=estimate(p).lines.find(l=>l.id==='handle:lm86899315')!;assert.equal(line.unitPrice,228);assert.match(line.source,/86899315/);
  assert.equal(parseProject(p).modules[0].module.handleId,'lm86899315');
  m.handleId='hexa1200b';assert.ok(validate(m).some(e=>e.includes('длиннее фасада')),'1200 handle does not fit a 568 drawer facade');
  m.handleId='нет такой';assert.ok(validate(m).some(e=>e.includes('каталога')));
});

test('Lemana mesh replaces a drawer: geometry, price, width check and files',()=>{
  const p=newProject(),a=p.modules[0];a.module.width=480;a.module.doors=false;a.module.sections[0].shelves=[];a.module.sections[0].drawers=0;delete a.module.sections[0].drawerConfigs;
  const n=insertItem(p,'mesh',a.id,a.module.sections[0].id,100,undefined,'lm85127628');
  const s=n.modules[0].module.sections[0];assert.equal(s.drawers,1);assert.equal(s.drawerConfigs![0].mesh,'lm85127628');assert.equal(s.drawerConfigs![0].height,185);
  const ps=parts(n.modules[0].module);
  assert.ok(ps.some(x=>x.id.endsWith(':drawer:0:mesh')&&x.material==='metal'),'mesh part');
  assert.ok(!ps.some(x=>x.id.endsWith(':drawer:0:facade')||x.id.endsWith(':drawer:0:bottom')||x.id.includes(':drawer:0:slide')),'no board box, facade or slides');
  assert.ok(ps.some(x=>x.id.endsWith(':drawer-cap')),'shelf above the group stays');
  const e=estimate(n),line=e.lines.find(l=>l.id==='mesh:lm85127628')!;assert.equal(line.unitPrice,711);assert.match(line.source,/85127628/);
  assert.ok(!e.lines.some(l=>l.id.startsWith('slide:')),'no slide line for mesh');
  assert.equal(parseProject(n).modules[0].module.sections[0].drawerConfigs![0].mesh,'lm85127628');
  assert.ok(specificationHTML(n).includes('85127628'));
  assert.throws(()=>insertItem(p,'mesh',a.id,a.module.sections[0].id,100,undefined,'lm91587996'),/864–924/,'shoe rack 864 does not fit a 480 body');
  const shallow=structuredClone(p);shallow.modules[0].module.depth=500;
  assert.throws(()=>insertItem(shallow,'mesh',shallow.modules[0].id,shallow.modules[0].module.sections[0].id,100,undefined,'lm85127628'),/глубина корпуса от 560/,'basket 560 deep needs a 560 body when open');
  const withDoors=structuredClone(p);withDoors.modules[0].module.doors=true;withDoors.modules[0].module.width=504;
  assert.ok(parts(insertItem(withDoors,'mesh',withDoors.modules[0].id,withDoors.modules[0].module.sections[0].id,100,undefined,'lm85127628').modules[0].module).some(x=>x.id.endsWith(':mesh')),'600 deep body with doors takes the 560 basket (20 mm behind the door)');
  const wide=structuredClone(p);wide.modules[0].module.width=900;
  assert.throws(()=>insertItem(wide,'mesh',wide.modules[0].id,wide.modules[0].module.sections[0].id,100,undefined,'lm85127628'),/440–500/,'basket 440 in an 868 opening is rejected with a size hint');
});

test('corner filler appears when a body meets another at 90 degrees and disappears when moved away',()=>{
  const p=newProject();p.modules[0].x=700;p.modules[0].z=3;p.modules[0].rotation=0; // корпус A по задней стене (3 мм — набивная задняя стенка)
  const B={...p.modules[0],id:'b',x:3,z:0,rotation:90 as const,module:{...structuredClone(p.modules[0].module),name:'B'}}; // корпус B по левой стене, торцом в угол
  p.modules.push(B);
  // A стоит вплотную к фасаду B: боковина A (левая) примыкает к B под 90°
  p.modules[0].x=3+B.module.depth+18;
  const n=applyCornerFillers(p),a=n.modules[0],b=n.modules[1];
  assert.equal(a.module.cornerFiller,'left');
  assert.equal(b.module.cornerFiller,undefined);
  const f=parts(a.module).find(x=>x.id==='corner-filler:left')!,door=parts(a.module).find(x=>x.role==='door')!;
  assert.equal(f.size[0],100,'facade-material strip 100 wide');assert.equal(f.decor,a.module.facadeDecor);assert.ok(Math.abs(f.position[2]-door.position[2])<0.01,'strip flush with the doors');
  assert.ok(Math.abs((door.position[0]-door.size[0]/2)-(f.position[0]+f.size[0]/2)-3)<0.01,'3 mm gap between strip and door');
  assert.equal(fastenerCounts(a.module).eccentrics,4);
  assert.equal(projectErrors(n).length,0,projectErrors(n).join('; '));
  assert.ok(Math.abs(a.x-(3+B.module.depth+18))<0.01,'A stays in place: the strip sits inside the facade span');
  const open=structuredClone(a.module);open.doors=false;const plank=parts(open).find(x=>x.id==='corner-filler:left')!;assert.deepEqual(plank.size,[16,open.height,100],'without doors the corner filler is an edge plank');
  assert.ok(estimate(n).lines.some(l=>l.id.startsWith('sheet:')),'filler goes to sheets');
  const far=applyCornerFillers({...n,modules:[{...a,x:a.x+500},b]});
  assert.equal(far.modules[0].module.cornerFiller,undefined);
  assert.equal(parseProject(n).modules[0].module.cornerFiller,'left');
});

test('wall fillers are 100x16 edge strips: full height, flush with the facade, 5 mm off the wall',()=>{
  const p=newProject();const a=p.modules[0];a.x=0;a.z=3; // левая боковина у левой стены, корпус с дверями
  const n=applyAutoFillers(p),m=n.modules[0].module;
  assert.deepEqual(m.wallFiller,{left:{kind:'edge',width:100}});
  assert.ok(n.modules[0].x>=16+5-0.01,'body moved off the wall by strip + 5 mm gap');
  const strip=parts(m).find(x=>x.id==='wall-filler:left')!;assert.deepEqual(strip.size,[16,m.height,100]);assert.ok(Math.abs(strip.position[2]+50-(m.depth+18))<0.01,'flush with the facade face');assert.equal(strip.position[0],-8);
  assert.equal(projectErrors(n).length,0,projectErrors(n).join('; '));
  // старые файлы со «стандартной» ФП читаются как планка торцом 100
  const legacy=structuredClone(n);(legacy.modules[0].module as any).wallFiller={left:{kind:'standard',width:50}};assert.deepEqual(parseProject(legacy).modules[0].module.wallFiller,{left:{kind:'edge',width:100}});
  // ширину планки менеджер может изменить в допустимых пределах
  m.wallFiller={left:{kind:'edge',width:120}};assert.equal(validate(m).length,0);m.wallFiller={left:{kind:'edge',width:40}};assert.ok(validate(m).some(e=>e.includes('планка')));m.wallFiller={left:{kind:'edge',width:100}};
  // угловая фальш без фасадов — планка 100×16, выступает на 40 вперёд
  const c=initialModule();c.doors=false;c.cornerFiller='right';const cf=parts(c).find(x=>x.id==='corner-filler:right')!;assert.deepEqual(cf.size,[16,c.height,100]);assert.ok(Math.abs(cf.position[2]+50-(c.depth+40))<0.01);c.doors=true;
  // опоры: 4 на нижний корпус, 6 от 900, 0 на антресоли
  assert.equal(legCount(c),4);c.width=900;assert.equal(legCount(c),6);assert.equal(legCount(c,400),0);c.plinthHeight=0;assert.equal(legCount(c),0);
  assert.equal(estimate(n).lines.find(l=>l.id==='legs')!.quantity,4);
  const q=newProject();q.modules[0].x=0;q.modules[0].z=3;
  // открытый стеллаж без фасадов и ящиков — ФП не нужна
  const r=newProject();r.modules[0].x=0;r.modules[0].z=3;r.modules[0].module.doors=false;r.modules[0].module.sections[0].drawers=0;delete r.modules[0].module.sections[0].drawerConfigs;
  assert.equal(applyAutoFillers(r).modules[0].module.wallFiller,undefined);
  // отодвинули от стены — ФП снимается
  const far=applyAutoFillers({...n,modules:[{...n.modules[0],x:400}]});assert.equal(far.modules[0].module.wallFiller,undefined);
});

test('facade size rules: 640 wide up to 920 high, 600 above, 360 minimum, straightener advice',()=>{
  const m=initialModule();m.width=640;m.height=900;m.sections[0].shelves=[];m.sections[0].drawers=0;delete m.sections[0].drawerConfigs;
  assert.equal(validate(m).length,0,validate(m).join('; '));
  assert.equal(parts(m).filter(p=>p.role==='door').length,1,'one 636 mm door is allowed under 920 mm high');
  m.height=1000;assert.equal(parts(m).filter(p=>p.role==='door').length,2,'above 920 mm the same width splits into two doors');
  m.width=600;m.height=400;m.plinthHeight=150;assert.ok(parts(m).find(p=>p.role==='door')!.length>=360,'400 body on a 150 plinth still gives a 368 door');
  m.height=2000;m.width=560;delete m.plinthHeight;const p=newProject(m);
  assert.ok(specificationHTML(p).includes('выпрямитель'),'specification recommends a straightener for tall wide doors');
  p.room.ceiling='stretch';p.room.height=2000+20;assert.ok(!roomWarnings(p).some(w=>w.kind==='ceiling'));
  p.room.height=2000+25;p.room.ceiling='stationary';assert.ok(roomWarnings(p).some(w=>w.kind==='ceiling'));
});

test('aluminium framed doors: geometry, workshop pricing formula, limits, cut list and files',()=>{
  const p=newProject(),m=p.modules[0].module;m.sections[0].shelves=[];m.sections[0].drawers=0;delete m.sections[0].drawerConfigs;
  const ldsp=estimate(p);
  m.alu={profile:'F1-09',color:'silver',insert:'mirror-silver'};
  const doors=parts(m).filter(x=>x.role==='door');assert.equal(doors.length,1);assert.equal(doors[0].material,'alu');assert.equal(doors[0].size[2],20);
  assert.ok(!details(p).some(d=>d.code&&/Фасад/.test(d.name||'')),'alu door is not a board detail');
  const e=estimate(p),line=(id:string)=>e.lines.find(l=>l.id===id)!;
  const perimeter=2*(doors[0].length+doors[0].width)/1000,area=doors[0].length*doors[0].width/1e6;
  assert.ok(Math.abs(line('alu-profile:F1-09:silver').quantity-perimeter)<0.01);assert.equal(line('alu-profile:F1-09:silver').unitPrice,447.17);
  assert.ok(Math.abs(line('alu-insert:mirror-silver').quantity-area)<0.01);assert.equal(line('alu-insert:mirror-silver').unitPrice,1530);
  assert.equal(line('alu-film').unitPrice,90);assert.equal(line('alu-seal').unitPrice,13);assert.equal(line('alu-corners').quantity,1);
  assert.equal(line('alu-hinge-hole-narrow').unitPrice,150);assert.equal(line('alu-hinge-hole-narrow').quantity,line('hinge').quantity);
  assert.equal(line('alu-handle-hole').unitPrice,70);
  assert.ok(e.retail!==null&&ldsp.retail!==null&&e.retail>ldsp.retail,'mirror frame costs more than an LDSP door');
  m.alu.profile='F1-19';assert.equal(estimate(p).lines.find(l=>l.id==='alu-hinge-hole')!.unitPrice,40,'wide profile: plain hinge hole');
  assert.equal(parseProject(p).modules[0].module.alu!.profile,'F1-19');
  assert.ok(specificationHTML(p).includes('алюминиевой рамке'));
  m.height=2200;assert.ok(validate(m).some(x=>x.includes('не выше 2000')),'alu door above 2000 is rejected');
  m.height=2000;m.alu={profile:'нет',color:'silver',insert:'mirror-silver'};assert.ok(validate(m).some(x=>x.includes('из каталога')));
});

test('price models: markup vs 23 000 per LDSP sheet; fasteners drawn and counted',()=>{
  const p=newProject(),e=estimate(p);
  assert.equal(e.model,'markup');assert.equal(e.sheetPrice,23000);assert.ok(e.ldspSheets>=1);
  assert.equal(e.bySheet,e.ldspSheets*23000+e.retailExtras);assert.equal(e.retail,e.byMarkup);
  assert.ok(e.perSheet!==null&&e.perSheet<23000,'markup 2.2 yields less than 23 000 per sheet on the default body');
  p.calculation={markup:2.2,overrides:{},model:'sheet',sheetPrice:24000};
  const s=estimate(p);assert.equal(s.retail,s.ldspSheets*24000+s.retailExtras);assert.equal(parseProject(p).calculation!.model,'sheet');
  p.calculation.sheetPrice=100;assert.ok(projectErrors(p).length);
  const m=p.modules[0].module,fc=fastenerCounts(m),fast=parts(m).filter(x=>x.role==='fastener');
  assert.equal(fast.length,fc.confirmats);assert.ok(fc.confirmats>=8,'bottom and top give 8 confirmats');
  assert.ok(fast.every(f=>f.material==='metal'));
  const lines=estimate(newProject()).lines;assert.equal(lines.find(l=>l.id==='confirmat')!.quantity,fc.confirmats);assert.equal(lines.find(l=>l.id==='shelf-holder')!.quantity,fc.shelfHolders);
  assert.ok(!details(newProject()).some(d=>d.role==='fastener'),'fasteners are not board details');
});

test('drawer facade height is independent from the box side height',()=>{
  const m=initialModule();m.sections[0].shelves=[];m.sections[0].drawers=2;m.sections[0].drawerConfigs=[{slide:'ball',height:140,length:500},{slide:'ball',height:140,length:500,facadeH:300}];
  assert.equal(drawerPitch(m.sections[0].drawerConfigs[0]),180);assert.equal(drawerPitch(m.sections[0].drawerConfigs[1]),303,'pitch grows to the facade plus gap');
  const ps=parts(m),f0=ps.find(p=>p.id.endsWith(':drawer:0:facade'))!,f1=ps.find(p=>p.id.endsWith(':drawer:1:facade'))!,side1=ps.find(p=>p.id.endsWith(':drawer:1:left'))!;
  assert.equal(f0.size[1],177);assert.equal(f1.size[1],300);assert.equal(side1.size[1],140,'box stays 140 while the facade is 300');
  assert.ok(f1.position[1]-f1.size[1]/2>f0.position[1]+f0.size[1]/2,'facades do not overlap');
  assert.equal(validate(m).length,0,validate(m).join('; '));
  m.sections[0].drawerConfigs[1].facadeH=20;assert.ok(validate(m).some(e=>e.includes('высота фасада ящика')));
  m.sections[0].drawerConfigs[1].facadeH=300;assert.equal(parseProject(newProject(m)).modules[0].module.sections[0].drawerConfigs![1].facadeH,300);
});

test('floor height of the shelf above drawers distributes drawers equally; glass top replaces the LDSP top',()=>{
  const m=initialModule(),s=m.sections[0];s.shelves=[];s.drawers=3;s.drawerConfigs=[{slide:'ball',height:140,length:500},{slide:'ball',height:100,length:500},{slide:'ball',height:200,length:500,facadeH:300}];
  const before=drawerCapTop(m,s);assert.ok(before>0);
  const cfg=distributeDrawers(m,s,800);s.drawerConfigs=cfg;
  assert.ok(cfg.every(c=>c.height===cfg[0].height&&c.facadeH===undefined),'equal boxes, facades follow the pitch');
  assert.ok(Math.abs(drawerCapTop(m,s)-800)<=3,'cap top lands on the requested height (rounded to whole mm pitch)');
  assert.equal(validate(m).length,0,validate(m).join('; '));
  assert.throws(()=>distributeDrawers(m,s,300),/Слишком низко/);assert.throws(()=>distributeDrawers(m,s,1500),/Слишком высоко/);
  m.topGlass='glass-clear';const ps=parts(m),top=ps.find(p=>p.id==='top')!,left=ps.find(p=>p.id==='left')!;
  assert.equal(top.material,'glass');assert.equal(top.size[1],4);assert.equal(top.size[0],m.width);assert.equal(left.size[1],m.height-4,'sides shortened under the glass');
  assert.ok(!ps.some(p=>p.id.startsWith('fast:top')),'no confirmats into a glass top');
  const p=newProject(m),e=estimate(p);
  assert.equal(e.lines.find(l=>l.id==='glass-top:glass-clear')!.unitPrice,970);assert.ok(e.lines.some(l=>l.id==='glass-top-temper')&&e.lines.some(l=>l.id==='glass-top-polish'));
  assert.ok(!details(p).some(d=>d.id==='top'),'glass top is not in the board cut list');
  assert.equal(parseProject(p).modules[0].module.topGlass,'glass-clear');
  m.topGlass='нет';assert.ok(validate(m).some(x=>x.includes('Стеклянная крыша')));
});

test('estimate falls back to the tier price for decors outside the explicit list',()=>{
  const p=newProject();p.modules[0].module.decor='Титан';
  const e=estimate(p),line=e.lines.find(l=>l.id==='sheet:Титан')!;
  assert.equal(line.unitPrice,decorPrice('Титан').price);assert.match(line.source,/Прайс Lamarty/);
});
