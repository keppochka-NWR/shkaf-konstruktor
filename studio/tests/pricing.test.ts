import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../src/catalog';
import {decorPrice,estimate,HINGE,HARDWARE_KIT} from '../src/pricing';
import {newProject,parseProject} from '../src/project';
import {parts,initialModule,validate} from '../src/model';

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

test('estimate falls back to the tier price for decors outside the explicit list',()=>{
  const p=newProject();p.modules[0].module.decor='Титан';
  const e=estimate(p),line=e.lines.find(l=>l.id==='sheet:Титан')!;
  assert.equal(line.unitPrice,decorPrice('Титан').price);assert.match(line.source,/Прайс Lamarty/);
});
