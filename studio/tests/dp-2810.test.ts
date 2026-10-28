// Дизайн-проект dp-2810 (все зоны, кроме кухни): функции, дописанные для сборки по ДП, и сама сборка (scripts/dp-2810-rooms.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, section, validate, parts, parseModule, type Module } from "../src/model";
import { assembleModule } from "../src/paletteBuild";
import { setWorktopMaterial } from "../src/kitchen";
import { partCollisions } from "../src/collisions";
import { estimate } from "../src/pricing";
import { nest } from "../src/exports";
import { appendModule, projectErrors, type Project } from "../src/project";
import { sideFacadeSpec, vernissageFacadePrice, normalizeVernissage } from "../src/facadesVernissage";
import { buildZone, ZONES, itemOf, type ZoneId } from "../scripts/dp-2810-rooms";

const look = (decor: string): Module => ({ ...initialModule(), decor, facadeDecor: decor });
const enamel = { milling: "63", cover: "enamel-matte" as const, enamelColor: "RAL 9001", thickness: 19 as const, twoSided: true };
const cabinet = (): Module => { const m = { ...initialModule(), name: "Шкаф", width: 900, height: 2400, depth: 429, decor: "Кремовый", facadeDecor: "Кремовый", sections: [section()] }; m.sections[0].doorLeaves = 2; return m; };
const room = (w = 3000, d = 3000, h = 2714): Project["room"] => ({ width: w, depth: d, height: h, openings: [] });

test("видимый бок из фасада: МДФ Вернисаж №15 гладкий в эмали фасадов, с одной стороны, вне раскроя ЛДСП, своей строкой сметы", () => {
  const m = cabinet(); m.vernissage = enamel; m.sidePanels = { right: { height: 2400, depth: 429 + 18, facade: true } };
  assert.deepEqual(validate(m), []);
  const p = parts(m).find((x) => x.id === "side-panel:right")!;
  assert.ok(p.external && p.sideFacade, "бок — сторонний участок");
  assert.equal(p.size[0], 19, "толщина — как у фасадов (МДФ 19)");
  assert.deepEqual(p.edge, [0, 0, 0, 0], "кромки цеха нет");
  // лицо бока заподлицо с лицом фасадов модуля
  const door = parts(m).find((x) => x.role === "door")!;
  assert.ok(Math.abs((p.position[2] + p.size[2] / 2) - (door.position[2] + door.size[2] / 2)) < 0.01);
  const spec = sideFacadeSpec(enamel);
  assert.equal(spec.milling, "15"); assert.equal(spec.cover, "enamel-matte"); assert.equal(spec.enamelColor, "RAL 9001"); assert.equal(spec.twoSided, undefined, "бок — покраска с одной стороны");
  const pr: Project = { version: 3, room: room(), modules: [{ id: "a", x: 0, y: 0, z: 3, rotation: 0, module: m }] };
  assert.ok(!nest(pr).some((s) => s.items.some((q) => q.detail.name.includes("Видимый бок"))), "в раскрой ЛДСП не идёт");
  const e = estimate(pr), line = e.lines.find((l) => l.id.endsWith(":side"))!;
  assert.ok(line, "строка «Видимые бока МДФ»");
  assert.ok(Math.abs(line.quantity - 2.4 * 0.447) < 0.001, "площадь бока 2400 × 447");
  assert.equal(line.unitPrice, vernissageFacadePrice(spec, 2400, 447).perM2);
  // без фасадов Вернисаж — понятная ошибка; сохранение и загрузка сохраняют флажок
  const bad = cabinet(); bad.sidePanels = { left: { height: 2400, depth: 447, facade: true } };
  assert.ok(validate(bad).some((x) => /Видимый бок из фасадного материала/.test(x)));
  assert.equal(parseModule(JSON.parse(JSON.stringify(m))).sidePanels?.right?.facade, true);
  // обычная боковая фальшпанель — как была (ЛДСП 16 с кромкой 2)
  const plain = cabinet(); plain.sidePanels = { right: { height: 2400, depth: 447 } };
  const q = parts(plain).find((x) => x.id === "side-panel:right")!;
  assert.equal(q.size[0], 16); assert.ok(!q.external); assert.deepEqual(q.edge, [2, 2, 2, 2]);
});

test("Вернисаж: смена плёнки на эмаль убирает плёнку — строка сметы и подпись по цвету эмали (сборка мышью dp-2810)", () => {
  const v = normalizeVernissage({ milling: "63", cover: "enamel-matte", film: "Моно белый", enamelColor: "RAL 9001", thickness: 19, twoSided: true });
  assert.equal(v.film, undefined); assert.equal(v.enamelColor, "RAL 9001"); assert.equal(v.twoSided, true);
  const back = normalizeVernissage({ ...v, cover: "film" });
  assert.ok(back.film, "обратно на плёнку — плёнка по умолчанию категории"); assert.equal(back.twoSided, undefined);
});

test("столешница палитры над подвесной тумбой (ванная): ложится на самый высокий верх, а не на низкую тумбу рядом; акрил 40", () => {
  const hang = assembleModule("hanging-drawer", 825, 400, 431, look("Кремовый"));
  const low = assembleModule("drawers", 550, 770, 279, look("Кремовый"));
  const p: Project = { version: 3, room: room(2700, 1775), modules: [
    { id: "low", x: 0, y: 0, z: 3, rotation: 0, module: low },
    { id: "v1", x: 600, y: 470, z: 3, rotation: 0, module: hang }, { id: "v2", x: 1425, y: 470, z: 3, rotation: 0, module: structuredClone(hang) }] };
  const top = assembleModule("worktop", 1650, 40, 460, look("Кремовый"));
  const n = appendModule(p, top), t = n.modules.at(-1)!;
  assert.equal(t.y, 870, "верх подвесной тумбы 470 + 400");
  assert.equal(t.x, 600, "над подвесными корпусами");
  assert.equal(t.module.worktop!.material, "ldsp"); assert.equal(t.module.worktop!.thickness, 32, "шкафная столешница ЛДСП 32, как над комодами");
  setWorktopMaterial(t.module, "acrylic", 40);
  assert.equal(t.module.height, 40);
  assert.deepEqual(projectErrors(n), []);
  // тумбы на полу — как было: столешница на них (заказ 7437584)
  const floor: Project = { version: 3, room: room(), modules: [{ id: "c", x: 0, y: 0, z: 3, rotation: 0, module: assembleModule("drawers", 800, 700, 450, look("Кремовый")) }] };
  assert.equal(appendModule(floor, assembleModule("worktop", 800, 32, 300, look("Кремовый"))).modules.at(-1)!.y, 700);
});

test("подвесной ящик палитры 900 × 150 (консоль прихожей): короб не ниже 68, проверку проходит; при глубине 400 — короче направляющая, без упора в навесы", () => {
  const m = assembleModule("hanging-drawer", 900, 150, 400, look("Дуб Галиано"));
  assert.deepEqual(validate(m), []);
  const c = m.sections[0].drawerConfigs![0];
  assert.equal(c.height, 68);
  assert.ok(c.length < 350, "направляющая короче — короб уходит от навесов");
  assert.deepEqual(partCollisions(parts(m), m).filter((x) => x.names.some((n) => /Навес/.test(n))), []);
  // корпус 200 — как было (заказ 7437584)
  assert.equal(assembleModule("hanging-drawer", 800, 200, 282, look("Клауд")).sections[0].drawerConfigs![0].height, 104);
});

test("dp-2810: все 7 зон собираются функциями без ошибок проекта и проверки модулей; изделия и цена по большей модели", () => {
  for (const z of Object.keys(ZONES) as ZoneId[]) {
    const { project, items } = buildZone(z);
    assert.deepEqual(projectErrors(project), [], z);
    for (const a of project.modules) assert.deepEqual(validate(a.module), [], `${z} ${a.id}`);
    assert.ok(project.calculation?.maxModel, "цена по большей модели (решение Макса 26.10)");
    for (const i of items) assert.ok(project.modules.some((a) => itemOf(a.id) === i.key), `${z}: изделие ${i.key}`);
    const e = estimate(project);
    assert.ok(e.retail !== null && e.retail > 0, z);
  }
  // видимые бока — у шкафа лоджии, пенала под стиральную машину и тумбы ванной
  const has = (z: ZoneId, item: string) => buildZone(z).project.modules.filter((a) => itemOf(a.id) === item).some((a) => parts(a.module).some((p) => p.sideFacade));
  assert.ok(has("loggia", "wardrobe")); assert.ok(has("shower", "washer")); assert.ok(has("bath", "vanity"));
  // столешница ванной — акрил 40 на высоте 870 над подвесной тумбой
  const top = buildZone("bath").project.modules.find((a) => a.module.worktop)!;
  assert.equal(top.module.worktop!.material, "acrylic"); assert.equal(top.y, 870);
});
