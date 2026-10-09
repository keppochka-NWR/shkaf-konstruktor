// Пересечения деталей РАЗНЫХ модулей проекта кухни в мире (whole.ts, раздел 3) — отдельно, чтобы правила проверялись тестом.
import { parts, type Part } from "../../src/model";
import { localToRoom, type PlacedModule, type Project } from "../../src/project";
import { allowedContact } from "../../src/collisions";

export type Box = number[];
const r1 = (v: number) => Math.round(v * 10) / 10;
/** Габарит детали студии в мире (повороты модуля — кратно 90°). */
export function studioBox(a: PlacedModule, q: Part): Box {
  const [cx, cy, cz] = q.position, [sx, sy, sz] = q.size, p0 = localToRoom(a, cx - sx / 2, cz - sz / 2), p1 = localToRoom(a, cx + sx / 2, cz + sz / 2), y = a.y ?? 0;
  return [Math.min(p0.x, p1.x), y + cy - sy / 2, Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), y + cy + sy / 2, Math.max(p0.z, p1.z)];
}
export const pen = (A: Box, B: Box) => Math.min(...[0, 1, 2].map((i) => Math.min(A[i + 3], B[i + 3]) - Math.max(A[i], B[i])));
export const isBoard = (q: Part) => q.material === "board" || q.material === "hdf" || q.material === "glass";

export function interModule(p: Project, off: number[] = [0, 0, 0]) {
  // фурнитура сырых модулей (raw:h*) в студии — точка Базиса с условным кубом 10 мм, а не форма изделия; у Базиса фурнитура
  // в пересечения не входит — сравниваем одинаково (иначе петля/навес/клипса у соседней детали дают «пересечение» 3–5 мм)
  // объекты «Ряда» (с 1a7d673 каждый цоколь, стеновая панель, столешница — свой объект) — одна группа, как «ряд» у Базиса:
  // стык цоколя фронтального и бокового внутри ряда — не пересечение разных модулей (n4-kitchens3)
  const all = p.modules.flatMap((a, i) => parts(a.module).filter((q) => q.material !== "alu" && !q.id.startsWith("raw:h")).map((q) => ({ i: a.module.raw?.row ? -1 : i, n: a.module.name, q, b: studioBox(a, q).map((v, t) => v - off[t % 3]) })));
  const out: string[] = [];
  // стяжка с соседним корпусом (kitchen.outConf, k15 m12 «А 1» → «Пенал 1»): конфирмат по назначению сидит в доске соседа — как в Базисе
  // (у Базиса фурнитура в счёт не входит), это не пересечение (n4-antresol). Не allowedContact: доска соседа у k15 — «Фронтальная»
  // сырого «Пенал 1», помеченная фасадом (крепёж в фасаде allowedContact запрещает), а в Базисе конфирмат входит именно в неё.
  // Только конфирмат стяжки (fast:out — только из kitchen.outConf) и только в ЛДСП/ХДФ.
  const tie = (x: Part, y: Part) => x.id.startsWith("fast:out:") && (y.material === "board" || y.material === "hdf");
  // опора и клипса нижнего модуля у цоколя «Ряда» (k23 m12: опоры и клипсы как в Базисе, цоколь ряда — на 2 мм в габарите круглой
  // пяты опоры; клипса по назначению на цоколе) — тот же реестр разрешённых контактов, что внутри модуля (collisions.ts allowedContact:
  // опора в доске до 3 мм, клипса на цоколе модуля и на сыром цоколе Базиса до 3 мм — n4-kitchens3), но у соседнего модуля — только
  // у цоколя (по имени «Цоколь …»), другие доски — нет (n4-antresol)
  const atPlinth = (x: Part, y: Part, d: number) => /^(leg|kitchen-clip):/.test(x.id) && /цокол/i.test(y.name) && allowedContact(x, y, d);
  const ok = (x: Part, y: Part, d: number) => tie(x, y) || tie(y, x) || atPlinth(x, y, d) || atPlinth(y, x, d);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const A = all[i], B = all[j]; if (A.i === B.i) continue; const d = pen(A.b, B.b); if (d > 0.5 && !ok(A.q, B.q, d)) out.push(`${A.n} / ${A.q.name} × ${B.n} / ${B.q.name}: ${r1(d)} мм`); }
  return out;
}
