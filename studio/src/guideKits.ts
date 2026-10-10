// Направляющие ящиков — комплектами (правило Макса 10.10.2026: «Направляющие должны идти комплектами по 2 шт. Левая и правая»).
// В смете — одна строка на систему и длину: «Направляющие … — комплект (по 2 шт.: левая + правая)», N компл., где N — число ящиков.
// Одно правило для всех систем и для сырых модулей Базиса: ящики считаются по коробам (дно, задняя стенка, боковины ящика; нет
// коробов — по фасадам ящиков), а не по записям фурнитуры Базиса (у Firmax на ящик бывает 4 одинаковые записи, 1 или ни одной).
// Система ящика — по направляющим, которые Базис перечисляет в модуле: нет направляющих в Базисе — нет строки (студия не добавляет).
// Металлические ящики (Axis PRO, Indigo, СТАРТ) параметрики студии — комплект ящика на ящик (в нём пара направляющих), см. pricing.ts.

/** Подпись комплекта направляющих в смете. */
export const GUIDE_KIT = "комплект (по 2 шт.: левая + правая)";
/** Строки сметы, которые считают комплекты направляющих (по ящику): Firmax, Versalite, MODERN SLIDE, прочие из Базиса (guides:),
 *  ящики Axis PRO (без строки внутреннего ящика — она направляющих не добавляет), Indigo, СТАРТ (без доп. рейлинга). */
export const GUIDE_KIT_LINE = /^(firmax:|firmax-ldsp:|versalite-h45:|modern-slide:|guides:|axis-pro:(?!inner:)|indigo:|start-sc:(?!rail:))/;
/** Металлический короб: боковины ящика — фурнитура (царги), из плиты только дно и задняя стенка. Остальные системы — короб ЛДСП. */
const METAL = /axis\s*pro|старт|start|indigo|quadro|innotech|actro|avantech|tandem|legrabox|metabox/i;
export const isAxisGuide = (name: string) => /axis\s*pro/i.test(name);

/** Название направляющей без стороны («…, левая», «… Направляющая правая»), во множественном числе («Направляющие Indigo, L=500»). */
export function guideCore(name: string): string {
  const s = (name ?? "").trim().replace(/\s+/g, " ").replace(/[\s,]*(направляющая\s+)?(левая|правая)\.?$/i, "").replace(/[\s,]+$/, "");
  return s.replace(/^направляющая\s/i, "Направляющие ");
}
/** Строка сметы комплекта: одна на систему и длину. Firmax — по артикулу Базиса («L - 500»: длина направляющей), Versalite Light H45
 *  и MODERN SLIDE — общие строки с параметрикой студии (versalite-h45:<длина>, modern-slide:<длина>), прочие — по названию Базиса. */
export function guideKitId(name: string): string {
  const c = guideCore(name);
  if (/firmax/i.test(c)) return "firmax:" + c;
  const v = /versalite\s+light\s+h45\s*,?\s*(\d{3})/i.exec(c);
  if (v) return "versalite-h45:" + v[1];
  const ms = /modern\s*slide/i.test(c) ? /-(\d{3})-/.exec(c) : null;
  if (ms) return "modern-slide:" + ms[1];
  return "guides:" + c;
}
/** Строка комплекта по названию направляющей Базиса: id и подпись (у общих с параметрикой строк — одна подпись, чей бы модуль ни был первым). */
export function guideKitLine(name: string): { id: string; label: string } {
  const id = guideKitId(name);
  if (id.startsWith("versalite-h45:")) return versaliteKit(Number(id.slice(14)));
  if (id.startsWith("modern-slide:")) return modernKit(Number(id.slice(13)));
  return { id, label: `${guideCore(name)} — ${GUIDE_KIT}` };
}
/** Шариковые Versalite Light H45 (параметрика студии и Базис «Направ. шарик. Versalite Light H45, 500»). */
export const versaliteKit = (len: number) => ({ id: "versalite-h45:" + len, label: `Направляющие шариковые Versalite Light H45, ${len} мм — ${GUIDE_KIT}` });
/** MODERN SLIDE с доводчиком (параметрика студии и Базис «… PB-3D0SHX18-500-H»). */
export const modernKit = (len: number) => ({ id: "modern-slide:" + len, label: `Направляющие MODERN SLIDE ${len} мм с доводчиком — ${GUIDE_KIT}` });
/** Firmax ящика студии без артикула Базиса — по длине короба, как раньше. */
export const firmaxKit = (len: number) => ({ id: "firmax-ldsp:" + len, label: `Направляющие скрытого монтажа Firmax ${len} мм — ${GUIDE_KIT}` });
/** Доли комплектов по весам (записи Базиса разных длин одной системы): сумма = total, остаток — по наибольшей дробной части. */
export function shareKits(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, v) => s + v, 0);
  if (!total || !sum) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum), n = raw.map(Math.floor);
  let left = total - n.reduce((s, v) => s + v, 0);
  for (const i of raw.map((_, i) => i).sort((a, c) => raw[c] - n[c] - (raw[a] - n[a]) || a - c)) { if (left <= 0) break; n[i]++; left--; }
  return n;
}

/** Ящики модуля по деталям Базиса: короба (дно, задняя стенка, боковины ящика — по наибольшему), из них с боковинами из плиты (ldsp),
 *  и фасады ящиков (если коробов нет). Детали «Ряда» и корпуса сюда не попадают: в названии нет «ящ». */
export function drawerBoxes(panels: { name: string }[]): { boxes: number; ldsp: number; facades: number } {
  let bottoms = 0, backs = 0, left = 0, right = 0, facades = 0;
  for (const p of panels) {
    const n = (p.name ?? "").trim();
    if (!/ящ/i.test(n)) continue;
    if (/фасад/i.test(n)) facades++;
    else if (/^дно[\s.]/i.test(n)) bottoms++;
    else if (/задн|зад\./i.test(n)) backs++;
    else if (/^(боковина|ст\.)/i.test(n) && /лев/i.test(n)) left++;
    else if (/^(боковина|ст\.)/i.test(n) && /прав/i.test(n)) right++;
  }
  const boxes = Math.max(bottoms, backs, left, right);
  return { boxes, ldsp: Math.min(boxes, Math.max(left, right)), facades };
}

/** Комплекты одной системы и длины. axis — ящик Axis PRO (строка сметы — комплект ящика axis-pro:raw, label не нужен). */
export type GuideKit = { id: string; label: string; n: number; axis?: boolean;
  /** коробов (и фасадов) ящиков этого типа в модели Базиса нет — комплектов по записям (пара на комплект), проверить */
  noBox?: boolean };
type Rec = { name: string; category: string };
/** Комплекты направляющих сырого модуля Базиса (и модуля эталона — для сверки): по системам (название без стороны), N — ящики.
 *  Ящики делятся между системами по типу короба (ЛДСП / металлический); несколько систем одного типа — пропорционально записям.
 *  axisDrawers — счётчик ящиков Axis PRO по держателям фасада (raw.counts.drawers), если записей его направляющих нет.
 *  items — направляющие из списка изделий (файлы без записей направляющих в hardware). */
export function guideKits(panels: { name: string }[], hardware: Rec[], opts: { axisDrawers?: number; items?: (Rec & { n: number })[] } = {}): GuideKit[] {
  const groups = new Map<string, { label: string; rec: number; metal: boolean; axis: boolean }>();
  const add = (name: string, k: number) => {
    const axis = isAxisGuide(name), line = axis ? { id: "axis-pro:raw", label: "Axis PRO" } : guideKitLine(name);
    const g = groups.get(line.id) ?? { label: line.label, rec: 0, metal: axis || METAL.test(name), axis };
    g.rec += k; groups.set(line.id, g);
  };
  for (const h of hardware) if (h.category === "направляющая" && (h.name ?? "").trim()) add(h.name, 1);
  for (const it of opts.items ?? []) if (it.category === "направляющая" && it.name.trim() && !groups.has(isAxisGuide(it.name) ? "axis-pro:raw" : guideKitId(it.name))) add(it.name, it.n);
  if (opts.axisDrawers && !groups.has("axis-pro:raw")) groups.set("axis-pro:raw", { label: "Axis PRO", rec: 2 * opts.axisDrawers, metal: true, axis: true });
  if (!groups.size) return [];
  const b = drawerBoxes(panels), total = b.boxes || b.facades, ldsp = b.boxes ? b.ldsp : 0, metal = total - ldsp;
  const all = [...groups.entries()], out: GuideKit[] = [];
  for (const isMetal of [false, true]) {
    const mine = all.filter(([, g]) => g.metal === isMetal);
    if (!mine.length) continue;
    const other = all.some(([, g]) => g.metal !== isMetal);
    // ящики своего типа короба; если систем другого типа в модуле нет — все ящики модуля (боковины могли назвать иначе)
    let pool = isMetal ? metal : ldsp;
    if (!pool && !other) pool = total;
    if (!pool) { for (const [id, g] of mine) out.push({ id, label: g.label, n: g.axis && opts.axisDrawers ? opts.axisDrawers : Math.ceil(g.rec / 2), ...(g.axis ? { axis: true } : {}), noBox: true }); continue; }
    // по записям — только доли (несколько длин одной системы), число комплектов — ящики
    const n = shareKits(pool, mine.map(([, g]) => g.rec));
    mine.forEach(([id, g], i) => { if (n[i]) out.push({ id, label: g.label, n: n[i], ...(g.axis ? { axis: true } : {}) }); });
  }
  return out;
}
