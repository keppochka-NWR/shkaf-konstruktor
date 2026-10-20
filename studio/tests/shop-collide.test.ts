// Ложное «Фасад распашной × Петля · чашка Ø35 (1 мм)» на новом шкафу с перегородкой (баг демо 20.10.2026).
// Причина: у двери на средней перегородке чашка стояла в 7,5 мм от плоскости стойки, как у двери на боковине. Но на перегородке
// фасад накрывает только половину стойки (7 мм, а не 14) — центр чашки оказывался в 14,5 мм от кромки: отверстие Ø35 выходило
// за кромку своего фасада на 3 мм и заходило в соседнюю створку на 1 мм. Теперь чашка — в 21,5 мм от кромки своего фасада везде.
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, section, parts, splitSection, boxes, type Module, type Part } from "../src/model";
import { partCollisions, hingeCollisions } from "../src/collisions";
import { createModule, createKupeWardrobe } from "../src/ModulePalette";
import { defaultDoorSplit } from "../src/quickMenu";
import { holes } from "../src/drilling";

function splitN(m0: Module, k: number) {
  let m = m0;
  for (let i = 1; i < k; i++) {
    const bb = boxes(m); let wi = 0; bb.forEach((b, j) => { if (b.width > bb[wi].width) wi = j; });
    m = splitSection(m, m.sections[wi].id);
  }
  return m;
}
const doorHinge = (c: { names: [string, string] }) => c.names.some((n) => /фасад/i.test(n)) && c.names.some((n) => /^Петля/.test(n));
const cupsOf = (ps: Part[]) => ps.filter((p) => p.id.includes(":hingecup:"));
const doorOfCup = (ps: Part[], cup: Part) => ps.find((p) => p.id === cup.id.replace(":hingecup:", ":door:").replace(/:\d+$/, ""))!;

test("демо 20.10: шкаф 1200×2200×600, 2 секции, полки 0.3/0.6 и 0.5 — без пересечений, чашка в теле своего фасада", () => {
  const m0 = createModule("empty", 1200, 2200, 600, initialModule());
  const m = splitSection(m0, m0.sections[0].id);
  m.sections[0].shelves = [0.3, 0.6]; m.sections[1].shelves = [0.5];
  const ps = parts(m);
  assert.deepEqual(partCollisions(ps, m), []);
  for (const cup of cupsOf(ps)) {
    const door = doorOfCup(ps, cup), c = cup.collide![0], dx = door.position[0], hw = door.size[0] / 2;
    // отверстие Ø35 — целиком в фасаде по ширине, центр в 21,5 мм от кромки со стороны петель
    assert.ok(c.position[0] - 17.5 >= dx - hw && c.position[0] + 17.5 <= dx + hw, cup.id + " за кромкой фасада");
    const edge = door.hinge === "left" ? dx - hw : dx + hw;
    assert.ok(Math.abs(Math.abs(c.position[0] - edge) - 21.5) < 0.01, cup.id + " от кромки " + Math.abs(c.position[0] - edge));
  }
  // присадка: отверстие чашки — в точке чашки (а не в 7,5 от перегородки)
  const hs = holes(m, ps).filter((h) => h.src.includes(":hingecup:"));
  assert.equal(hs.length, cupsOf(ps).length);
  for (const h of hs) {
    const cup = ps.find((p) => p.id === h.src)!; assert.ok(h.part.includes(":door:"), h.src + " не в фасаде");
    assert.ok(Math.abs(h.at[0] - cup.model!.origin![0]) < 0.01, h.src + " отверстие не в точке чашки");
  }
});

test("демо 20.10 как в сценарии мышью: «Шкаф QA» из двух section() — пересечений нет", () => {
  const m: Module = { ...initialModule(), name: "Шкаф QA", width: 1200, height: 2200, depth: 600, doors: true, sections: [section(), section()] };
  m.sections[0].shelves = [0.3, 0.6]; m.sections[1].shelves = [0.5];
  assert.deepEqual(partCollisions(parts(m), m), []);
});

test("дверь на боковине — чашка по-прежнему в 7,5 мм от стойки (21,5 от кромки), одна секция не меняется", () => {
  const m = createModule("empty", 600, 2200, 600, initialModule()), ps = parts(m);
  for (const cup of cupsOf(ps)) assert.ok(Math.abs(cup.model!.origin![0] - 23.5) < 0.01 || Math.abs(cup.model!.origin![0] - (600 - 23.5)) < 0.01, cup.id);
});

test("шаблоны «Добавить» × ширины 400–2400 × 1–4 секции × полки/деление по высоте/вкладные/бренды, купе — нет «фасад × петля»", () => {
  const bad: string[] = [];
  const check = (tag: string, m: Module) => {
    const cs = partCollisions(parts(m), m);
    for (const c of cs) if (doorHinge(c)) bad.push(`${tag}: ${c.names.join(" × ")} ${c.depth}`);
    for (const c of hingeCollisions(cs)) bad.push(`${tag}: ${c.names.join(" × ")} ${c.depth}`);
  };
  for (const kind of ["empty", "wardrobe", "drawers", "corner", "shelves", "desk"] as const) for (const w of [400, 600, 800, 1200, 1600, 2400]) for (let k = 1; k <= 4; k++) {
    let m: Module;
    try { m = createModule(kind, w, 2200, 600, initialModule()); } catch { continue; }
    if (k > 1 && (kind === "corner" || kind === "desk")) continue;
    m = splitN(m, k);
    const s1 = structuredClone(m); s1.sections.forEach((s, i) => { s.shelves = i % 2 ? [0.5] : [0.3, 0.6]; });
    if (kind === "shelves") s1.doors = true;
    check(`${kind} ${w} ${k}с`, m); check(`${kind} ${w} ${k}с полки`, s1);
    if (!s1.doors || s1.corner) continue;
    const sp = structuredClone(s1); sp.sections.forEach((s) => { s.doorSplit = defaultDoorSplit(sp, s); }); check(`${kind} ${w} ${k}с по высоте`, sp);
    const ins = structuredClone(s1); ins.doorMount = "inset"; check(`${kind} ${w} ${k}с вкладные`, ins);
    for (const b of ["pulse", "blum"] as const) { const hb = structuredClone(s1); hb.hingeBrand = b; check(`${kind} ${w} ${k}с ${b}`, hb); }
  }
  for (const w of [1200, 1800, 2400]) for (const pm of createKupeWardrobe(w, 2400, 600, initialModule())) check(`купе ${w}`, pm.module);
  assert.deepEqual(bad, []);
});
