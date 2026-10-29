// Палитра, корпус ровно в остаток до стены (находка 29.10): комната 3000×2000, три «Комода» 800 + 800 + 779 (h850, d500), «Комод» 600
// → «справа свободно 600 из 600 мм, у стены нужна фальшпанель 21 мм (16 + 5)». «Поставить отдельно (перед шкафами)» ставил корпус
// обычной расстановкой — в остаток у стены, фальш при сохранении расширял его на соседа: «Изменение не применено: «Комод» пересекается
// с «Комод»». Теперь — место перед рядом (вплотную к линии фасадов), проверенное с автофальшами; остальные две кнопки — как были.
import test from "node:test";
import assert from "node:assert/strict";
import { appendModule, appendModuleGroup, applyAutoFillers, bounds, projectErrors, type Project } from "../src/project";
import { initialModule } from "../src/model";
import { createModule } from "../src/paletteBuild";
import { rowShortage, rowShortageText } from "../src/rowFit";

const chest = (w: number) => createModule("drawers", w, 850, 500, initialModule());
function run(): Project {
  let p: Project = { version: 3, room: { width: 3000, depth: 2000, height: 2700, openings: [] }, modules: [] };
  for (const w of [800, 800, 779]) p = applyAutoFillers(appendModule(p, chest(w)));
  assert.deepEqual(projectErrors(p), []);
  return p;
}

test("палитра: «Комод» 600 ровно в остаток до стены — «Поставить отдельно» ставит перед рядом без пересечения", () => {
  const p = run(), m = chest(600), s = rowShortage(p, m)!;
  assert.deepEqual([s.free, s.filler, s.withFiller, s.withoutFiller], [600, 21, 579, 600]);
  assert.match(rowShortageText(m.name, s), /справа свободно 600 из 600 мм, у стены нужна фальшпанель 21 мм \(16 \+ 5\).* Или поставить отдельно — встанет перед шкафами\.$/);
  // было: обычная расстановка — пересечение с соседом после автофальшей
  assert.match(projectErrors(applyAutoFillers(appendModule(p, m))).join(" "), /пересекается/);
  // теперь: место перед рядом, как обещает кнопка
  assert.ok(s.apart, "место перед рядом найдено");
  const r = appendModuleGroup(p, [{ id: "apart", x: s.apart!.x, y: 0, z: s.apart!.z, rotation: 0, module: m }], false, true).project;
  assert.deepEqual(projectErrors(r), []);
  const row = r.modules.slice(0, 3).map(bounds), b = bounds(r.modules.at(-1)!), front = Math.max(...row.map((x) => x.z + x.d));
  assert.equal(b.z, front, "вплотную к линии фасадов ряда, перед шкафами");
  assert.ok(b.x >= 0 && b.x + b.w <= 3000 && b.z + b.d <= 2000, "в комнате");
  assert.deepEqual(r.modules.slice(0, 3).map((a) => [a.x, a.z]), p.modules.map((a) => [a.x, a.z]), "ряд не сдвинут");
  // две другие кнопки — как были: 579 с фальшем и 600 без фальша встают в ряд
  assert.deepEqual(projectErrors(applyAutoFillers(appendModule(p, chest(579)))), []);
  assert.deepEqual(projectErrors(applyAutoFillers(appendModule(p, { ...chest(600), autoFillersOff: true }))), []);
});

test("палитра: перед рядом места нет (комната неглубокая) — кнопки «Поставить отдельно» нет, текст без неё", () => {
  const p = { ...run() }; p.room = { ...p.room, depth: 900 };
  const s = rowShortage(p, chest(600))!;
  assert.equal(s.apart, null);
  assert.doesNotMatch(rowShortageText("Комод", s), /поставить отдельно/);
});
