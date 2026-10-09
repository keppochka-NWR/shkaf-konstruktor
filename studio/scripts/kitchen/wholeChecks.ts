// Независимые проверки целой кухни (whole.ts) — по признакам эталона Базиса, не по правилам сметы студии (n4-kitchens3).
// Вынесены из whole.ts, чтобы их видели тесты (whole.ts запускается сразу по аргументам и не импортируется).

/** Элемент списка фурнитуры эталона (модуль или «прочее»/профили ряда без габарита). */
export type EtHw = { name?: string; pos?: unknown; mesh?: string | null; service?: boolean; box?: unknown };
type Etalon = { modules: { hardware: EtHw[] }[]; row?: Record<string, EtHw[] | undefined> | null };

/** Отверстия-крепёж Базиса — НЕ по правилу имени bazisHoles (rawModule) и не по категории: элемент FurnList с позицией и без модели
 *  (mesh), который Базис пометил служебным (service), — любое имя («3x3», «Отверстие 3х2», «Отверстие глухое_d10x12 мм.»). У «прочего»
 *  ряда флага service нет — там безымянный размер («8x30» k19). Так пропуск именованного отверстия в смете виден. */
export function etalonHoleItems(e: Etalon): EtHw[] {
  const hw = [...e.modules.flatMap((m) => m.hardware ?? []), ...(["profiles", "other"] as const).flatMap((g) => (e.row?.[g] ?? []).filter((x) => !Array.isArray(x.box)))];
  return hw.filter((h) => Array.isArray(h.pos) && !h.mesh && (h.service === true || /^\s*\d[\d\s.,xх×*]*$/i.test(h.name ?? "")));
}

/** Размер отверстия по цифрам имени («3х2», «Отверстие 3x2» → «3x2»; «Отверстие глухое_d2x10 мм.» → «2x10») — сверка по размерам. */
export const holeSig = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).join("x");

/** Деталь Базиса, кромку которой смета не считает погонажем кромки, потому что это изделие поставщика (м²/пог. м): стекло, зеркало,
 *  столешница, стеновая панель; в параметрическом модуле — плита МДФ (фасад «external»). Иначе "" — её кромка должна быть в смете. */
export function supplierEdgeKind(x: { name?: string; kind?: string; mat?: string | null }, parametric: boolean): string {
  const nm = `${x.name ?? ""} ${x.mat ?? ""}`;
  return x.kind === "glass" ? "стекло" : x.kind === "mirror" ? "зеркало" : /столешниц/i.test(nm) ? "столешница" : /стенов\S* панел/i.test(nm) ? "стеновая панель" : parametric && x.kind === "mdf" ? "МДФ-фасад параметрики" : "";
}
