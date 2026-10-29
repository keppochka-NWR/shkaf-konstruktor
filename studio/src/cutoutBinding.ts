// Устойчивая привязка вырезов (критик 29.10, блокер 2). Вырез (Module.cutouts) указывает на деталь по id, а у полок, ящиков,
// дверей секции id порядковый (`<секция>:shelf:2`, `<секция>:drawer:1:facade`, `<секция>:door:0`): вставили полку ниже — номер
// «верхней» полки сменился, и вырез молча переезжал на другую полку. Привязка держится при каждом изменении проекта: вырез идёт за
// своей деталью по месту (та же семья деталей — то же положение и размер), а не за номером. Удалили носитель — вырез снимается с
// сообщением. Формат файла и id деталей прежние, поэтому старые проекты (привязка по номеру на момент сохранения) читаются без миграции:
// номер в файле верен для того состояния, от которого начинается правка.
import { shapeBaseParts, type Module, type Part } from "./model";
import type { Cutout } from "./shapes";

/** Семья детали: id с порядковыми номерами, заменёнными на «#» (`s1:shelf:#`, `s1:drawer:#:facade`). Без номеров — id не порядковый. */
export const cutFamily = (id: string) => id.replace(/:(\d+)(?=:|$)/g, ":#");
const near = (a: Part, b: Part) => [0, 1, 2].every((i) => Math.abs(a.position[i] - b.position[i]) < 0.6 && Math.abs(a.size[i] - b.size[i]) < 0.6);
const safeParts = (m: Module): Part[] | null => { try { return shapeBaseParts(m); } catch { return null; } };

/** Перепривязать вырезы модуля после правки prev → next. Возвращает модуль (тот же объект, если ничего не менялось) и сообщения
 *  менеджеру: вырез снят (деталь удалена) или оставлен на детали с тем же номером после перестановки всех деталей семьи. */
export function rebindCutouts(prev: Module, next: Module): { module: Module; notes: string[] } {
  const cuts = next.cutouts;
  if (!cuts?.length || !prev.cutouts?.length) return { module: next, notes: [] };
  const before = safeParts(prev), after = safeParts(next);
  if (!before || !after) return { module: next, notes: [] };
  const notes: string[] = [], out: Cutout[] = [];
  let changed = false;
  for (const c of cuts) {
    const old = before.find((p) => p.id === c.host), fam = cutFamily(c.host);
    // новый вырез (в prev его нет) или деталь не порядковая (боковина, крыша, перегородка секции) — привязка не меняется
    if (!old || fam === c.host || !prev.cutouts.some((x) => x.id === c.id && x.host === c.host)) { out.push(c); continue; }
    const same = after.find((p) => p.id === c.host);
    if (same && near(same, old)) { out.push(c); continue; }
    const match = after.find((p) => cutFamily(p.id) === fam && near(p, old));
    if (match) { out.push({ ...c, host: match.id }); changed = true; continue; }
    const famBefore = before.filter((p) => cutFamily(p.id) === fam), famAfter = after.filter((p) => cutFamily(p.id) === fam);
    // остальные детали семьи остались на местах, а носителя нет — его удалили: вырез снимается (а не переезжает на соседнюю)
    const othersKept = famBefore.some((p) => p.id !== old.id && famAfter.some((q) => near(p, q)));
    const what = c.label ? `«${c.label}»` : c.shape === "round" ? `Ø${c.w}` : `${c.w}×${c.h}`;
    const name = `«${old.name.replace(/ · .*$/, "")}»`;
    if (same && (famBefore.length === famAfter.length || !othersKept)) {
      // деталь сдвинули/изменили (число деталей то же) — вырез идёт с ней; переставили все детали семьи — остаётся на том же номере
      out.push(c);
      if (famBefore.length !== famAfter.length) notes.push(`Вырез ${what}: детали переставлены заново — вырез остался на ${name} (была на ${Math.round(old.position[1])} мм, теперь ${Math.round(same.position[1])} мм от низа корпуса); проверьте его место.`);
      continue;
    }
    changed = true;
    notes.push(`Вырез ${what} снят: деталь ${name} (${Math.round(old.position[1])} мм от низа корпуса) удалена. Задайте вырез заново в окне «Вырезы».`);
  }
  if (!changed) return { module: next, notes };
  const module: Module = { ...next, cutouts: out };
  if (!out.length) delete module.cutouts;
  return { module, notes };
}
