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
