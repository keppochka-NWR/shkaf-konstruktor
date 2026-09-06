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
  initialModule,
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
