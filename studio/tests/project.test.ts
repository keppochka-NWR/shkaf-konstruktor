import {moveDivider} from '../src/operations';
import {drawingLevels,moduleDrawingSVG,drawingsHTML} from '../src/drawings';
import {projectContent} from '../src/projectStorage';
import {openingZone,roomWarnings} from '../src/roomWarnings';
import {nicheSize} from '../src/measurement';
import {frameDistance,frameHeight} from '../src/framing';
import test from "node:test";
import assert from "node:assert/strict";
import {
  newProject,
  parseProject,
  appendModule,
  projectErrors,
} from "../src/project";
import {
  initialModule, distribute,
  parts,
  boxes,
  shelfGaps,
  setShelfGap,
  validate,
  parseModule,
  drawerConfig,
  RULES,
} from "../src/model";
import { nest, details, quoteHTML, detailCSV, labelDetails, labelsHTML, specificationHTML } from "../src/exports";

test("Lamarty sheet format is exactly the user correction", () => {
  assert.equal(RULES.sheetW, 2750);
  assert.equal(RULES.sheetH, 1830);
});
test("v1 files migrate without modifying original data; v2 persists positions and quote", () => {
  const m = initialModule(),
    raw = JSON.stringify(m),
    p = parseProject(JSON.parse(raw));
  assert.deepEqual(p.modules[0].module, m);
  assert.equal(JSON.stringify(m), raw);
  p.offer = { customer: "Иван", price: "120000", notes: "Монтаж включён" };
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))), p);
});
test("append keeps original section IDs and creates independent copy", () => {
  const p = newProject(),
    n = appendModule(p, p.modules[0].module);
  assert.equal(p.modules.length, 1);
  assert.equal(n.modules.length, 2);
  assert.equal(n.modules[1].x, 650);
  assert.deepEqual(projectErrors(n), []);
  assert.notEqual(
    n.modules[1].module.sections[0].id,
    n.modules[0].module.sections[0].id,
  );
  n.modules[1].module.sections[0].shelves[0] = 0.3;
  assert.equal(n.modules[0].module.sections[0].shelves[0], 0.72);
});
test("room boundaries and overlap reject edits; touching side panels allowed", () => {
  const p = newProject(),
    n = appendModule(p, p.modules[0].module);
  n.modules[1].x -= 1;
  assert.match(projectErrors(n).join(" "), /пересекается/);
  n.modules[1].x = 3999;
  assert.match(projectErrors(n).join(" "), /границы/);
  n.room.height = 1999;
  assert.ok(projectErrors(n).length);
  assert.throws(() => parseProject({ ...p, modules: [] }));
  assert.throws(() => parseProject({ ...p, room: { ...p.room, width: NaN } }));
});
test("clear shelf openings plus panel thickness exactly fill section; editing fixes requested gap", () => {
  const m = initialModule(),
    s = m.sections[0],
    b = boxes(m)[0],
    g = shelfGaps(m, s.id);
  assert.ok(
    Math.abs(
      g.reduce((n, g) => n + g.height, 0) +
        s.shelves.length * 16 -
        (b.top - b.bottom - 376),
    ) < 0.2,
  );
  setShelfGap(m, s.id, 1, 350);
  assert.equal(shelfGaps(m, s.id)[1].height, 350);
  assert.deepEqual(validate(m), []);
  setShelfGap(m, s.id, 0, 300);
  assert.equal(shelfGaps(m, s.id)[0].height, 300);
  setShelfGap(m, s.id, 0, 2000);
  assert.ok(validate(m).length);
});
test("individual GTV 0FPO profile changes inner width, side length and bottom material", () => {
  const m = initialModule(),
    s = m.sections[0],
    b = boxes(m)[0];
  s.drawerConfigs = [
    { slide: "gtv0fpo", height: 140, length: 500 },
    drawerConfig(m, s, 1),
  ];
  assert.deepEqual(validate(m), []);
  const pp = parts(m),
    side = pp.find((p) => p.id === s.id + ":drawer:0:left")!,
    bottom = pp.find((p) => p.id === s.id + ":drawer:0:bottom")!;
  assert.equal(side.length, 490);
  assert.equal(bottom.size[0], b.width - 16 - 42);
  assert.equal(bottom.material, "board");
  assert.equal(bottom.thickness, 16);
  assert.equal(
    pp.find((p) => p.id === s.id + ":drawer:1:bottom")!.material,
    "board",
  );
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))), m);
  s.drawerConfigs[0].length = 300;
  assert.deepEqual(validate(m), []);
  s.drawerConfigs[0].length = 600;
  assert.match(validate(m).join(" "), /слишком длинная/);
});
test("drawer height participates in collision detection and mixed stack geometry", () => {
  const m = initialModule(),
    s = m.sections[0];
  s.drawerConfigs = [
    { slide: "ball", height: 300, length: 500 },
    { slide: "ball", height: 300, length: 500 },
  ];
  s.rod=true; s.rodAt=0.55;
  assert.ok(validate(m).length, "rod clearance must fail");
  s.rod = false;
  assert.deepEqual(validate(m), []);
  const pp = parts(m),
    a = pp.find((p) => p.id === s.id + ":drawer:0:left")!,
    b = pp.find((p) => p.id === s.id + ":drawer:1:left")!;
  assert.equal(b.position[1] - a.position[1], 340);
  assert.throws(() =>
    parseModule({
      ...m,
      sections: [
        {
          ...s,
          drawerConfigs: [{ slide: "invented", height: 100, length: 450 }],
        },
      ],
    }),
  );
});
test("sheet maps contain every detail exactly once, conserve grain and never overlap or cross margins", () => {
  let p = newProject();
  p = appendModule(p, p.modules[0].module);
  const ss = nest(p),
    seen = new Set<string>();
  for (const s of ss)
    for (const [i, a] of s.items.entries()) {
      assert.ok(!seen.has(a.detail.code));
      seen.add(a.detail.code);
      assert.equal(a.h, a.detail.length);
      assert.equal(a.w, a.detail.width);
      assert.ok(
        a.x >= 10 &&
          a.y >= 10 &&
          a.x + a.w <= s.width - 10 &&
          a.y + a.h <= s.height - 10,
      );
      for (const b of s.items.slice(0, i))
        assert.ok(
          a.x >= b.x + b.w + 10 ||
            b.x >= a.x + a.w + 10 ||
            a.y >= b.y + b.h + 10 ||
            b.y >= a.y + a.h + 10,
        );
    }
  assert.equal(seen.size, details(p).length);
  assert.throws(() => nest(p, -1));
});
test("exports escape customer and module HTML and never invent a price", () => {
  const p = newProject();
  p.modules[0].module.name = "<img src=x onerror=alert(1)>";
  const html = quoteHTML(p, "<script>alert(1)</script>", "", "<b>text</b>");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("после согласования"));
  assert.ok(detailCSV(p).startsWith("\uFEFF"));
});


test('labels have one code per detail and refer to its actual sheet',()=>{
  const p=newProject(initialModule()),sheets=nest(p),labels=labelDetails(p);
  assert.equal(labels.length,details(p).length);
  assert.equal(new Set(labels.map(d=>d.code)).size,labels.length);
  for(const d of labels)assert.ok(sheets[d.sheet-1].items.some(a=>a.detail.code===d.code&&a.w===d.width&&a.h===d.length));
  p.modules[0].module.name='<script>alert(1)</script>';
  const html=labelsHTML(p);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('ПРОВЕРКА'));
});

test('project specification follows chosen drawers, back and room openings',()=>{
  const p=newProject(initialModule());p.modules[0].module.backType='groove';
  p.room.openings=[{id:'window',type:'window',wall:'back',offset:100,width:800,height:900,sill:1000}];
  const html=specificationHTML(p);assert.ok(html.includes('в паз'));assert.ok(html.includes('800 × 900'));assert.ok(html.includes('GTV Versalite'));assert.ok(html.includes('Дно ящиков ЛДСП16'));
});

test('measurement survives files and rejects impossible dates',()=>{
  const p=newProject();p.measurement={number:'З-123',date:'2026-09-06',notes:'Плинтус 80 мм'};
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))).measurement,p.measurement);
  assert.ok(specificationHTML(p).includes('З-123'));assert.ok(specificationHTML(p).includes('Плинтус 80 мм'));
  p.measurement.date='2026-02-30';assert.ok(projectErrors(p).length);
});

test('push drawers omit handles by default but explicit handle choice survives import',()=>{
  const p=newProject(),m=p.modules[0].module,s=m.sections[0];
  s.drawerConfigs=Array.from({length:s.drawers},()=>({slide:'gtv0fpo' as const,length:450,height:140}));
  assert.equal(parts(m).filter(d=>d.role==='handle'&&d.id.includes(':drawer:')).length,0);
  s.drawerConfigs[0].handle=true;
  assert.equal(parts(parseModule(JSON.parse(JSON.stringify(m)))).filter(d=>d.role==='handle'&&d.id.includes(':drawer:')).length,1);
  assert.ok(specificationHTML(p).includes('нет · Push'));
});

test('front framing uses projected width and safely fits narrow and wide screens',()=>{
  const size={x:1400,y:2200,z:600};
  for(const aspect of [.4,1,2]){
    const d=frameDistance(size,{x:0,y:0,z:1},aspect,34),tan=Math.tan(17*Math.PI/180);
    assert.ok(size.x/2/(d-size.z/2)/tan/aspect<1);
    assert.ok(size.y/2/(d-size.z/2)/tan<1);
  }
  const front=frameDistance(size,{x:0,y:0,z:1},.5,34);
  const former=(Math.max(2580,(1400+600+650)/.5)/(2*Math.tan(17*Math.PI/180)))*1.1;
  assert.ok(front<former*.7,'front view should no longer count depth as extra width');
});

test('inserted board back reduces usable depth and appears in board nesting',()=>{
  const p=newProject(),m=p.modules[0].module;m.backType='board';
  const back=parts(m).find(d=>d.id==='back')!;assert.equal(back.material,'board');assert.equal(back.thickness,16);assert.equal(back.size[0],m.width-32);
  const shelf=parts(m).find(d=>d.id.includes(':shelf:'))!;assert.equal(shelf.position[2]-shelf.size[2]/2,17);
  assert.ok(!parts(m).some(d=>d.material==='hdf'));assert.ok(!nest(p).some(s=>s.material==='hdf'));
  assert.equal(parseModule(JSON.parse(JSON.stringify(m))).backType,'board');
  m.backType='none';assert.ok(!parts(m).some(d=>d.id==='back'));assert.equal(parseModule(JSON.parse(JSON.stringify(m))).backType,'none');
});

test('copies preserve rotation and insertion finds another row when the first is full',()=>{
  const p=newProject();p.room.width=1500;p.modules[0].rotation=90;
  const copied=appendModule(p,p.modules[0].module,p.modules[0]);
  assert.equal(copied.modules[1].rotation,90);assert.equal(projectErrors(copied).length,0);
  assert.notEqual(copied.modules[1].module.sections[0].id,p.modules[0].module.sections[0].id);
  const next=appendModule(copied,p.modules[0].module);
  assert.equal(projectErrors(next).length,0);assert.ok(next.modules[2].z>600);
  assert.equal(p.modules.length,1);
});

test('niche limits follow workshop deductions and remain separate from room geometry',()=>{
  const p=newProject();p.measurement={number:'1',date:'',notes:'',niche:{width:2000,height:2700,depth:650,deviation:5}};
  assert.deepEqual(nicheSize(p.measurement.niche!),{width:1990,height:2670,depth:645,side:10});
  p.measurement.niche!.deviation=10;assert.equal(nicheSize(p.measurement.niche!).width,1985);
  const q=parseProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(q.measurement,p.measurement);assert.equal(q.room.width,4000);
});

test('drawer front material is independent from doors and follows file roundtrip',()=>{
  const m=initialModule();m.drawerFacadeDecor='Графит';const restored=parseModule(JSON.parse(JSON.stringify(m))),ds=parts(restored);
  assert.ok(ds.filter(d=>d.id.includes(':drawer:')&&d.id.endsWith(':facade')).every(d=>d.decor==='Графит'));
  assert.ok(ds.filter(d=>d.role==='door').every(d=>d.decor===m.facadeDecor));
  delete restored.drawerFacadeDecor;assert.ok(parts(restored).filter(d=>d.id.endsWith(':facade')).every(d=>d.decor===m.facadeDecor));
});

test('customer quote lists actual protective shelves and drawer front material',()=>{
  const p=newProject();p.modules[0].module.drawerFacadeDecor='Графит';const html=quoteHTML(p,'Клиент','100000','');
  assert.ok(html.includes('Фасады ящиков: Графит'));assert.ok(html.includes('Двери: Белый'));assert.ok(html.includes('Полок: 2 (включая полки над ящиками)'));assert.ok(html.includes('пантографов: 0'));
});

test('server project title stays distinct from the first module name in files',()=>{
  const p=newProject();p.cloud={id:'order-1',revision:2,owner:'manager@example.test',name:'Заказ — прихожая'};
  const q=parseProject(JSON.parse(JSON.stringify(p)));assert.equal(q.cloud?.name,'Заказ — прихожая');assert.notEqual(q.cloud?.name,q.modules[0].module.name);
});

test('orthographic working views use exact projected extents',()=>{
  const size={x:1400,y:2200,z:600};
  assert.equal(frameHeight(size,{x:0,y:0,z:1},1,1),2200);
  assert.equal(frameHeight(size,{x:0,y:0,z:1},.5,1),2800);
  assert.equal(frameHeight(size,{x:0,y:1,z:0},1,1),1400);
  assert.equal(frameHeight(size,{x:1,y:0,z:0},1,1),2200);
});

test('room warnings inspect all four walls and height without blocking project saves',()=>{
  const p=newProject();const a=p.modules[0];a.x=50;a.z=30;
  p.room.openings=[{id:'door',type:'door',wall:'back',offset:50,width:900,height:2100,sill:0}];
  assert.equal(roomWarnings(p).length,1);assert.deepEqual(projectErrors(p),[]);
  a.z=901;assert.equal(roomWarnings(p).length,1); // nailed back extends 3 mm
  a.z=903;assert.equal(roomWarnings(p).length,0);
  a.z=30;a.y=2200;p.room.height=4500;assert.equal(roomWarnings(p).length,0);
  a.y=0;p.room.openings[0]={...p.room.openings[0],type:'window',sill:2100,height:1000};
  assert.equal(roomWarnings(p).length,0);
  p.room.openings[0].sill=900;assert.equal(roomWarnings(p).length,1);
  for(const wall of ['back','front','left','right'] as const){
    const o:import('../src/project').Opening={...p.room.openings[0],type:'door' as const,wall,sill:0,height:2100};
    const z=openingZone(p.room,o);assert.equal(z.w,900);assert.equal(z.d,900);
    p.room.openings=[o];a.x=z.x+10;a.z=z.z+10;a.rotation=90;
    assert.equal(roomWarnings(p).length,1,wall);
  }
});

test('server content comparison ignores link metadata and key order but detects edits',()=>{
  const p=newProject(),copy=structuredClone(p);
  copy.cloud={id:'example',revision:4,owner:'manager@example.test',name:'Шкаф'};
  copy.room={height:p.room.height,depth:p.room.depth,width:p.room.width,openings:[]};
  assert.equal(projectContent(copy),projectContent(p));
  copy.modules[0].x+=10;assert.notEqual(projectContent(copy),projectContent(p));
  copy.modules[0].x-=10;copy.measurement={number:'123',date:'',notes:''};assert.notEqual(projectContent(copy),projectContent(p));
});

test('review drawings use actual part elevations and escape user labels',()=>{
 const p=newProject(),m=p.modules[0].module;m.name='<script>test</script>';
 const levels=drawingLevels(m),actual=parts(m);
 assert.ok(levels.some(l=>l.name.includes('Обязательная')));
 assert.ok(levels.some(l=>l.name.includes('фасад')));
 for(const level of levels){const d=actual.find(d=>d.id===level.id)!;assert.equal(level.bottom,Math.round((d.position[1]-d.size[1]/2)*10)/10);assert.equal(level.top,Math.round((d.position[1]+d.size[1]/2)*10)/10);}
 const svg=moduleDrawingSVG(m),html=drawingsHTML(p);
 assert.ok(!svg.includes('NaN'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('без присадки'));
});

test('divider drag resizes only adjacent sections and rejects an unusable result atomically',()=>{
 const p=newProject(),m=p.modules[0].module;m.width=900;m.sections=Array.from({length:3},(_,i)=>({id:'s'+i,weight:1,shelves:[],drawers:0,rod:false}));
 const before=boxes(m),n=moveDivider(p,p.modules[0].id,'s1',35),after=boxes(n.modules[0].module);
 assert.ok(Math.abs(after[0].width-before[0].width-35)<.001);assert.ok(Math.abs(after[1].width-before[1].width+35)<.001);assert.equal(after[2].width,before[2].width);
 assert.deepEqual(boxes(m),before);assert.throws(()=>moveDivider(p,p.modules[0].id,'s1',200),/180/);assert.throws(()=>moveDivider(p,p.modules[0].id,'s0',10));
 assert.equal(n.modules[0].module.width,900);
});

test('manual rod height respects the nearest shelf and pantograph stays inside its clear space',()=>{
 const m=initialModule(),s=m.sections[0];s.drawers=0;s.shelves=[];s.rod=true;s.rodAt=.8;
 assert.deepEqual(validate(m),[]);s.shelves=[.6];assert.ok(validate(m).some(e=>e.includes('900')));
 s.shelves=[.8];assert.ok(validate(m).some(e=>e.includes('пересекает полку')));
 s.rod=false;s.pantograph=true;s.shelves=[];s.rodAt=.8;assert.deepEqual(validate(m),[]);
 s.rodAt=.1;assert.ok(validate(m).some(e=>e.includes('внутреннюю высоту')));
 s.rodAt=.8;s.shelves=[.7];assert.ok(validate(m).some(e=>e.includes('Пантограф пересекает')));
 s.shelves=[.3];assert.deepEqual(validate(m),[]);
});

test('minimum shelf clearance is measured between panel faces, including the drawer cap',()=>{
 const m=initialModule(),s=m.sections[0];s.drawers=0;s.shelves=[];
 const h=boxes(m)[0].top-boxes(m)[0].bottom;
 s.shelves=[88/h,184/h];assert.deepEqual(validate(m),[]);assert.equal(shelfGaps(m,s.id)[0].height,80);assert.equal(shelfGaps(m,s.id)[1].height,80);
 s.shelves=[80/h];assert.ok(validate(m).some(e=>e.includes('80 мм')));
 s.shelves=[88/h,176/h];assert.ok(validate(m).some(e=>e.includes('80 мм')));
 s.drawers=1;s.shelves=[284/h];assert.deepEqual(validate(m),[]);assert.equal(shelfGaps(m,s.id)[0].height,80);
 s.shelves=[276/h];assert.ok(validate(m).some(e=>e.includes('80 мм')));
});

test('distribute shelves produces equal clear openings above the base or drawer cap',()=>{
 for(const drawers of [0,2])for(const count of [1,3,5]){
  const m=initialModule(),s=m.sections[0];s.drawers=drawers;s.shelves=distribute(m,s,count);
  assert.deepEqual(validate(m),[]);const gaps=shelfGaps(m,s.id).map(g=>g.height);assert.ok(Math.max(...gaps)-Math.min(...gaps)<=.1);
 }
 const m=initialModule(),s=m.sections[0];s.drawers=0;s.rod=true;s.rodAt=.65;s.shelves=distribute(m,s,2);assert.deepEqual(validate(m),[]);assert.ok(s.shelves.every(y=>y>s.rodAt!));
});

test('ceiling advisory uses workshop clearance and raised module height',()=>{const p=newProject();p.room.height=2029;assert.equal(roomWarnings(p).length,1);assert.match(roomWarnings(p)[0].message,/29 мм/);assert.deepEqual(projectErrors(p),[]);p.room.height=2030;assert.equal(roomWarnings(p).length,0);p.modules[0].y=500;p.room.height=2529;assert.match(roomWarnings(p)[0].message,/29 мм/);assert.equal(roomWarnings(p)[0].openingId,undefined);});

test('technologist specification carries placement advisories and escaped module names',()=>{const p=newProject();p.room.height=2020;p.modules[0].module.name='<img src=x>';const html=specificationHTML(p);assert.ok(html.includes('Проверить перед согласованием'));assert.ok(html.includes('до потолка 20 мм'));assert.ok(html.includes('от задней стены 27'));assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(!html.includes('<img src=x>'));p.room.height=2700;assert.ok(!specificationHTML(p).includes('Проверить перед согласованием'));});


test('closed handles protruding through each wall produce advisory without blocking placement',()=>{
 for(const rotation of [0,90,180,270] as const){
  const p=newProject(),a=p.modules[0];a.rotation=rotation;
  if(rotation===0)a.z=p.room.depth-a.module.depth-18;
  if(rotation===90)a.x=p.room.width-a.module.depth-18;
  if(rotation===180)a.z=18;
  if(rotation===270)a.x=18;
  assert.deepEqual(projectErrors(p),[]);
  assert.equal(roomWarnings(p).filter(w=>w.kind?.startsWith('closed-wall')).length,1);
  assert.match(roomWarnings(p)[0].message,/26 мм/);
  if(rotation===0)a.z-=26;if(rotation===90)a.x-=26;if(rotation===180)a.z+=26;if(rotation===270)a.x+=26;
  assert.equal(roomWarnings(p).length,0);
 }
});


import {placementHTML,placementSVG} from '../src/placementPlan';
test('placement document includes every module, opening, mounting offset and escaped customer data',()=>{
 const p=newProject();p.modules[0].rotation=90;p.modules[0].x=300;p.modules[0].z=100;p.modules[0].y=200;p.room.height=2220;
 p.modules[0].module.name='<script>bad</script>';p.offer={customer:'A & B <client>',price:'',notes:''};
 p.room.openings=[{id:'window',type:'window',wall:'right',offset:100,width:1200,height:1400,sill:800}];
 p.measurement={number:'<N>',date:'2026-09-06',notes:'Плинтус & розетка'};
 const svg=placementSVG(p),html=placementHTML(p);
 assert.equal((svg.match(/data-module=/g)||[]).length,1);assert.equal((svg.match(/data-opening=/g)||[]).length,1);assert.match(svg,/stroke-dasharray="5 3"/);
 assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);assert.ok(!html.includes('<script>'));assert.match(html,/A &amp; B &lt;client&gt;/);assert.match(html,/Плинтус &amp; розетка/);
 assert.match(html,/<td>297<\/td><td>100<\/td><td>200<\/td><td>90°/);assert.match(html,/Окно О1/);assert.match(html,/до потолка 20 мм/);
 p.modules[0].module.width=901;assert.throws(()=>placementSVG(p));
});


test('placement plan combines labels of identical stacked footprints',()=>{
 const p=newProject(),a=p.modules[0];p.room.height=3000;
 const top=structuredClone(a);top.id='upper-plan';top.y=2000;top.module.height=600;top.module.sections=[];
 top.module.sections=[{id:'upper-section',weight:1,shelves:[],drawers:0,rod:false}];p.modules.push(top);
 assert.match(placementSVG(p),/>1 \/ 2<\/text>/);assert.equal((placementSVG(p).match(/data-module=/g)||[]).length,2);
});


test('room obstacles survive files, validate dimensions and warn only at intersecting heights',()=>{
 const p=newProject();p.room.obstacles=[{id:'beam',name:'Балка',type:'beam',x:100,z:100,y:2300,width:300,depth:300,height:300}];
 assert.deepEqual(projectErrors(p),[]);assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))).room.obstacles,p.room.obstacles);assert.equal(roomWarnings(p).filter(w=>w.kind==='obstacle-beam').length,0);
 p.room.obstacles[0].y=1900;assert.equal(roomWarnings(p).filter(w=>w.kind==='obstacle-beam').length,1);assert.equal(roomWarnings(p).find(w=>w.kind==='obstacle-beam')!.obstacleId,'beam');assert.deepEqual(projectErrors(p),[]);
 assert.match(placementHTML(p),/data-obstacle="beam"/);assert.match(placementHTML(p),/Объекты замера/);
 for(const change of [{width:0},{x:-1},{height:NaN},{type:'unknown'},{name:''},{y:2700}]){const bad=structuredClone(p);Object.assign(bad.room.obstacles![0],change);assert.throws(()=>parseProject(bad));}
 const duplicate=structuredClone(p);duplicate.room.obstacles!.push({...duplicate.room.obstacles![0]});assert.throws(()=>parseProject(duplicate));
 const malformed=structuredClone(p) as any;malformed.room.obstacles=[null];assert.throws(()=>parseProject(malformed));
});


test('new module placement searches around measured obstacles and respects their elevation',()=>{
 const p=newProject(),a=p.modules[0];p.room.obstacles=[{id:'column',name:'Колонна',type:'column',x:650,z:0,y:0,width:300,depth:700,height:2700}];
 const n=appendModule(p,a.module,a);assert.deepEqual(projectErrors(n),[]);assert.equal(roomWarnings(n).filter(w=>w.kind==='obstacle-column').length,0);assert.equal(n.modules[1].x,950);
 p.room.obstacles[0].type='beam';p.room.obstacles[0].y=2300;p.room.obstacles[0].height=300;
 const under=appendModule(p,a.module,a);assert.equal(under.modules[1].x,650);assert.equal(roomWarnings(under).filter(w=>w.kind==='obstacle-column').length,0);
});


import {persistProject,ProjectStorageConflict,CURRENT_PROJECT,DAMAGED_PROJECT} from '../src/projectStorage';
test('autosave preserves a damaged source before replacing it, including failure and older backups',()=>{
 const original='broken source',data=new Map([[CURRENT_PROJECT,original],[DAMAGED_PROJECT,'older damaged source']]),order:string[]=[],p=newProject();
 const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{order.push(key);data.set(key,value);}};
 persistProject(storage,p,original);assert.equal(data.get(DAMAGED_PROJECT),original);assert.equal(data.get(order[0]),'older damaged source');assert.equal(order.at(-1),CURRENT_PROJECT);assert.deepEqual(JSON.parse(data.get(CURRENT_PROJECT)!),p);
 const count=data.size;persistProject(storage,p,original);assert.equal(data.size,count);
 data.set(CURRENT_PROJECT,'new broken');assert.throws(()=>persistProject({...storage,setItem:()=>{throw Error('quota');}},p,'new broken'));assert.equal(data.get(CURRENT_PROJECT),'new broken');
});


test('room reductions identify the measured object or opening that no longer fits',()=>{
 const p=newProject();p.room.openings=[{id:'window',type:'window',wall:'back',offset:2000,width:1200,height:1400,sill:900}];assert.deepEqual(projectErrors(p),[]);
 const narrow=structuredClone(p);narrow.room.width=2000;assert.match(projectErrors(narrow)[0],/Проём 1/);assert.throws(()=>parseProject(narrow),/Проём 1/);assert.equal(p.room.width,4000);
 const invalid=structuredClone(p);invalid.room.openings![0].id='';assert.throws(()=>parseProject(invalid),/Проём 1/);
 p.room.openings=[];p.room.obstacles=[{id:'column',name:'Колонна у входа',type:'column',x:1800,z:0,y:0,width:300,depth:300,height:2700}];p.room.width=2000;assert.match(projectErrors(p)[0],/Колонна у входа/);
});


test('autosave rejects a stale browser tab before writing the project or damaged backups',()=>{
 const p=newProject(),data=new Map<string,string>(),writes:string[]=[];const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{writes.push(k);data.set(k,v);}};
 const original=persistProject(storage,p,undefined,null),a=structuredClone(p);a.modules[0].module.name='Новый вариант';const saved=persistProject(storage,a,undefined,original);assert.equal(data.get(CURRENT_PROJECT),saved);
 writes.length=0;assert.throws(()=>persistProject(storage,p,'damaged',original),ProjectStorageConflict);assert.equal(writes.length,0);assert.equal(data.get(CURRENT_PROJECT),saved);assert.equal(data.has(DAMAGED_PROJECT),false);
 data.delete(CURRENT_PROJECT);assert.throws(()=>persistProject(storage,p,undefined,saved),ProjectStorageConflict);assert.equal(writes.length,0);
});


test('niche advisories compare the closed composition and height from floor without blocking editing',()=>{
 const p=newProject();p.measurement={number:'Н-1',date:'',notes:'',niche:{width:610,height:2030,depth:652,deviation:0}};
 assert.equal(roomWarnings(p).filter(w=>w.kind?.startsWith('niche-')).length,0);
 p.measurement.niche!.deviation=10;
 let warnings=roomWarnings(p).filter(w=>w.kind?.startsWith('niche-'));
 assert.equal(warnings.length,1);assert.equal(warnings[0].kind,'niche-w');assert.match(warnings[0].message,/595 мм/);
 p.measurement.niche!.depth=650;p.modules[0].y=20;
 warnings=roomWarnings(p).filter(w=>w.kind?.startsWith('niche-'));
 assert.deepEqual(warnings.map(w=>w.kind),['niche-w','niche-d','niche-h']);assert.match(warnings[2].message,/2020 мм/);
 assert.deepEqual(projectErrors(p),[]);assert.match(specificationHTML(p),/Ниша: ширина мебели/);assert.match(placementHTML(p),/Ниша: глубина мебели/);
 const second=structuredClone(p.modules[0]);second.id='niche-second';second.x+=700;p.modules.push(second);
 warnings=roomWarnings(p).filter(w=>w.kind==='niche-w');assert.equal(warnings[0].moduleId,second.id);assert.match(warnings[0].message,/1300 мм/);
 delete p.measurement.niche;assert.equal(roomWarnings(p).filter(w=>w.kind?.startsWith('niche-')).length,0);
});
