// «Столешница на этот модуль» (правка Макса 29.10.2026, РЕШЕНИЯ.md: «Полка тоже может быть опорой столешницы, делаем так, что
// столешница выставляется на модуль через правое меню»). Опору не угадываем: столешница ложится на верх модуля, который выбрал
// менеджер правой кнопкой, — любого (комод на полу, поднятая полка, подвесная тумба, кухонный нижний), той же ширины и поворота.
//  • кухонный модуль — кухонная столешница как «над нижними» (placeWorktop): постформинг 38, от задней кромки до фасада + свес 24,
//    не мельче 600;
//  • шкаф/комод/полка — шкафная ЛДСП 32 (две плиты 16), как палитра без кухонных низов: от задней кромки до лица фасадов.
// Дальше менеджер правит её как обычно (панель столешницы, «Материал столешницы ›»). Палитра «Столешница» — как была.
import { id, initialModule, section, validate, type Module } from "./model";
import { applyAutoFillers, localToRoom, projectErrors, type PlacedModule, type Project } from "./project";
import { KITCHEN, kitchenWorktop, setWorktopMaterial } from "./kitchen";
import { kitchenFaceOffset, kitchenRearClearance } from "./kitchenAlignment";
import { transform } from "./roomGeometry";

/** Можно ли положить столешницу на модуль (и почему нет). */
export function worktopHostProblem(m: Module): string | undefined {
  if (m.worktop) return "Это уже столешница.";
  if (m.kupe) return "На двери купе столешница не ставится.";
  if (m.raw) return "Модуль из Базиса: столешница ставится так, как в проекте Базиса.";
  if (m.desk) return "У стола своя столешница.";
  if (m.corner) return "На угловой шкаф столешница из меню не ставится — только прямоугольные модули.";
  return undefined;
}

/** Фасады выступают вперёд (как в bounds): накладные двери или накладные фасады ящиков. */
const faces = (m: Module) => (m.doors && m.doorMount !== "inset") || m.sections.some((s) => s.drawers > 0 && s.drawerMount !== "inset" && !(m.doors && !s.externalDrawers));

/** Столешница для модуля host: модель и её место в локальных координатах модуля (от задней кромки). */
export function worktopFor(host: Module): { module: Module; back: number } {
  if (host.kitchen) {
    const rear = kitchenRearClearance(host), depth = Math.max(KITCHEN.worktopDepth, Math.round(rear + kitchenFaceOffset(host) + KITCHEN.worktopOverhang));
    const m: Module = { ...kitchenWorktop(initialModule(), host.width), depth, decor: host.decor, name: `Столешница ${host.width}`, sections: [{ ...section(), shelves: [], drawers: 0, rod: false }] };
    return { module: m, back: rear };
  }
  const rear = host.kupe || !host.backType || host.backType === "nailed" ? 3 : 0, depth = Math.round(rear + host.depth + (faces(host) ? 18 : 0));
  const m: Module = { ...kitchenWorktop(initialModule(), host.width), depth, decor: host.decor, name: `Столешница ${host.width}`, sections: [{ ...section(), shelves: [], drawers: 0, rod: false }] };
  setWorktopMaterial(m, "ldsp", 32);
  return { module: m, back: rear };
}

/** Положить столешницу на модуль mid. Возвращает проект с новой столешницей и её id; не встаёт — понятная ошибка. */
export function worktopOnModule(p: Project, mid: string): { project: Project; id: string } {
  const a = p.modules.find((x) => x.id === mid);
  if (!a) throw Error("Модуль не найден.");
  const why = worktopHostProblem(a.module);
  if (why) throw Error(why);
  const { module, back } = worktopFor(a.module), e0 = validate(module)[0];
  if (e0) throw Error(`Столешница на «${a.module.name}»: ${e0}`);
  const rot = a.rotation ?? 0, y = (a.y ?? 0) + a.module.height;
  // уже лежит столешница на верху модуля — правим её, вторую не кладём
  const on = p.modules.find((w) => w.module.worktop && Math.abs((w.y ?? 0) - y) < 1 && overlapsTop(a, w));
  if (on) throw Error(`На «${a.module.name}» уже лежит «${on.module.name}» — правьте её (выберите столешницу), вторую не кладём.`);
  // начало столешницы — точка (0, −задний зазор) модуля; столешница с тем же поворотом
  const target = localToRoom(a, 0, -back), origin = transform(0, 0, module.width, module.depth, rot, 0, 0);
  const w: PlacedModule = { id: id(), x: Math.round((target.x - origin.x) * 10) / 10, y, z: Math.round((target.z - origin.z) * 10) / 10, rotation: rot, module };
  const project = { ...p, modules: [...p.modules, w] };
  const e = projectErrors(applyAutoFillers(project))[0];
  if (e) throw Error(`Столешница на «${a.module.name}» не встаёт: ${e}`);
  if (y + module.height > p.room.height + 0.1) throw Error(`Столешница на «${a.module.name}» упрётся в потолок.`);
  return { project, id: w.id };
}

/** Столешница w перекрывает верх модуля a (в плане). */
function overlapsTop(a: PlacedModule, w: PlacedModule) {
  const pts = (x: PlacedModule) => [[0, 0], [x.module.width, 0], [x.module.width, x.module.depth], [0, x.module.depth]].map(([u, v]) => localToRoom(x, u, v));
  const box = (q: { x: number; z: number }[]) => ({ x0: Math.min(...q.map((c) => c.x)), x1: Math.max(...q.map((c) => c.x)), z0: Math.min(...q.map((c) => c.z)), z1: Math.max(...q.map((c) => c.z)) });
  const A = box(pts(a)), B = box(pts(w));
  return Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) > 1 && Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0) > 1;
}
