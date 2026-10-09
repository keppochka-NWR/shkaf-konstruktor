// Распознавание модулей Базиса: «как в Базисе, ничего сверх» — флаги кухни по составу проекта. Отдельный файл, чтобы не конфликтовать
// с соседями по fromEtalon.ts. Каждое правило читает сам проект Базиса: флаг ставится, только если так в этом проекте. Срабатывание —
// прогон по всем 422 модулям 34 кухонь (09.10.2026), «модулей / кухонь»:
//  - фасад без петель — 15 / 12: фасад есть, петель и направляющих нет, и студия строит ровно те же фасады (иначе фасадов не ставим);
//  - без опор — 33 / 13: дно на полу или на своём цоколе;
//  - без крепежа — 22 / 1 (только k32): нет ни конфирматов, ни эксцентриков, ни шкантов, ни полкодержателей;
//  - без наколок под планку 26 / 11; зазоры ХДФ 24 / 13; опоры не сеткой 17 / 10; эксцентрик дна снизу 12 / 10;
//    передние полкодержатели 12 / 8; полки кромятся не по кругу 14 / 6; опущенная боковина 8 / 5; зазор фасадов сверху/снизу 3 / 3;
//  - одна-две кухни (статистической опоры нет — это чтение конкретного проекта, не обобщение): кромка по кругу 33 / 2 (k11, k32),
//    без кромки 15 / 1 (k23), верх боковин без кромки 9 / 2 (k03, k20), толстый передний торец 8 / 2 (k27, k29).
import { parts, type Module } from "../../src/model";
import type { RefModule } from "./compare";

const FASTENERS = ["конфирмат", "эксцентрик", "шкант", "полкодержатель"];

/** Ставит kitchen.hinges / noLegs / fasteners по фурнитуре эталона. fronts — число фасадов перед корпусом (распознаны в fromEtalon). */
export function recognizeBaseExtras(ref: RefModule, m: Module, fronts: number): string[] {
  const notes: string[] = [], k = m.kitchen;
  if (!k) return notes;
  const has = (c: string) => ref.hardware.some((h) => h.category === c);
  // фасады есть, петель и ящиков нет — фасады без петель (не подъёмный: у него петли тоже есть)
  // ящик без направляющих (k20 m11: царги TANDEMBOX в «ящик-система») и подъёмный на газлифте (k11 m09–m11) — не распашной фасад;
  // ручка-рейлинг в «ящик-система» (k09 m04) — не ящик
  const drawerKit = ref.hardware.some((h) => h.category === "ящик-система" && !/ручк/i.test(h.name));
  // фасады перед корпусом не из стекла/зеркала («Наполнение» рамочного фасада) и не ЛДСП корпуса (фальшпанель «ФП», «Фронтальная»)
  const noHinges = fronts > 0 && !has("петля") && !has("направляющая") && !has("газлифт") && !drawerKit && !m.kdrawers?.length && plainFronts(ref);
  if (noHinges) { m.doors = true; k.hinges = false; }
  if ((k.role === "base" || k.role === "tall") && !has("опора")) { k.noLegs = true; notes.push("без опор — как в Базисе"); }
  // крепёж и под другим разделом: «Евровинт 6х50» Базис кладёт в «прочее» (k33, k34) — это тоже конфирмат, крепёж есть
  if (!FASTENERS.some(has) && !ref.hardware.some((h) => /евровинт|конфирмат|эксцентрик|шкант|полкодерж/i.test(h.name))) { k.fasteners = false; notes.push("без крепежа — как в Базисе"); }
  const all = edgesAllAround(ref);
  if (all) { m.edgeScheme = { ...(m.edgeScheme ?? { t: all }), all: true }; notes.push("кромка по кругу у всех деталей корпуса — как в Базисе"); }
  else if (!m.edgeScheme && edgesNone(ref)) { m.edgeScheme = { t: 0 }; notes.push("без кромки — как в Базисе"); }
  else if (k.role === "base" && m.edgeScheme?.t && sideTopBare(ref)) { m.edgeScheme = { ...m.edgeScheme, sideTop: false }; notes.push("верх боковин без кромки — как в Базисе"); }
  const sd = sideDown(ref);
  if (sd && (k.role === "base" || k.role === "tall") && m.bottomType !== "none") { m.bottomUnder = true; k.sideDown = sd; notes.push(`${sd.side === "left" ? "левая" : "правая"} боковина опущена до ${sd.y0}, дно под другой — как в Базисе`); }
  if (hingePlateHoles(ref) === false) { k.plateHoles = false; notes.push("у петель нет наколок под планку — как в Базисе"); }
  const pts = irregularLegs(ref);
  if (pts && k.legs) { k.legs = { ...k.legs, pts }; delete k.legs.xs; delete k.legs.side; notes.push(`опоры не сеткой — ${pts.length} точек как в Базисе`); }
  const fg = faceGapsTB(ref, m.faceGap ?? 0);
  if (fg && k.role === "base" && m.feet && m.doors && !m.kdrawers?.length && !m.gola && !m.sections[0].doorSplit) {
    if (fg.top !== undefined) k.faceTop = fg.top;
    if (fg.bottom !== undefined) k.faceBottom = fg.bottom;
    notes.push(`зазор фасадов сверху/снизу ${fg.top ?? m.faceGap}/${fg.bottom ?? m.faceGap} (сбоку ${m.faceGap}) — как в Базисе`);
  }
  const bgs = m.backType === "nailed" ? backGapsTB(ref, m.backGap ?? 0) : undefined;
  if (bgs) { k.backGaps = bgs; notes.push(`ХДФ: зазор снизу ${bgs.bottom}, сверху ${bgs.top} (сбоку ${m.backGap}) — как в Базисе`); }
  const eb = eccFromBelow(ref);
  if (eb === true) { k.eccBelow = true; notes.push("эксцентрики дна сверлятся снизу — как в Базисе"); }
  else if (eb === "legs") notes.push("эксцентрик дна снизу у Базиса попадает под площадку опоры — не повторяем (пересечение), сверлим сверху");
  const se = shelfEdges(ref);
  if (se && m.edgeScheme?.t && !m.edgeScheme.all) { m.edgeScheme = { ...m.edgeScheme, shelf: se }; notes.push(`съёмные полки кромятся: ${se.join(", ")} — как в Базисе`); }
  const fe = frontEdge(ref);
  if (fe && m.edgeScheme?.t) { m.edgeScheme = { ...m.edgeScheme, t: fe.other, front: fe.front }; notes.push(`передние торцы корпуса — кромка ${fe.front}, остальные ${fe.other} — как в Базисе`); }
  const pf = pinInsetFront(ref, m.shelfPinInset);
  if (pf !== undefined) { m.shelfPinInsetFront = pf; notes.push(`передние полкодержатели в ${pf} от переднего торца полки (задние в ${m.shelfPinInset}) — как в Базисе`); }
  // фасады без петель — только если студия строит ровно фасады Базиса (число и габариты, после зазоров faceTop/faceBottom выше).
  // Несколько рядов, ниша под технику, фасады ящиков разной ширины — студия поставила бы распашные, которых в Базисе нет
  // (k20 m09: два фасада по 2398 вместо двери 597×330 и стёкол) → фасадов не ставим: лучше «нет», чем лишнее (правило Макса)
  if (noHinges) {
    if (sameFronts(ref, m)) notes.push("фасады без петель — как в Базисе");
    else {
      m.doors = false; delete k.hinges; delete k.faceTop; delete k.faceBottom;
      const i = notes.findIndex((n) => n.startsWith("зазор фасадов сверху/снизу")); if (i >= 0) notes.splice(i, 1);
      notes.push("фасады без петель не повторяются студией один в один (ряды, ниша, ширины) — не ставим, чтобы не добавить лишнего");
    }
  }
  return notes;
}

/** Две крайние боковины (высотой больше 200) и фасады перед ними — как в fromEtalon. */
function frontPanels(ref: RefModule) {
  const sides = ref.panels.filter((p) => (p.kind === "ldsp" || p.kind === "mdf") && p.axis === "x" && p.box[4] - p.box[1] > 200).sort((a, b) => a.box[0] - b.box[0]);
  if (sides.length < 2) return { sides, fronts: [] as RefModule["panels"] };
  const z1 = Math.max(sides[0].box[5], sides[sides.length - 1].box[5]);
  return { sides, fronts: ref.panels.filter((p) => p.axis === "z" && p.kind !== "hdf" && p.box[2] >= z1 - 1) };
}

/** Фасады — не стекло/зеркало («Наполнение» рамочного фасада: k08 m01, k20 m02–m04, k21 m05) и не ЛДСП корпуса (фальшпанель:
 *  k32 m04 «4-ФП», угловые «Фронтальная» k02 m06, k03 m04). Такие студия не превращает в распашной фасад. */
export function plainFronts(ref: RefModule): boolean {
  const { sides, fronts } = frontPanels(ref);
  const bodyMat = new Set(sides.map((p) => p.mat));
  return fronts.length > 0 && fronts.every((p) => p.kind !== "glass" && p.kind !== "mirror" && !(p.kind === "ldsp" && bodyMat.has(p.mat)));
}

/** Студия строит те же фасады, что в Базисе: столько же, и каждый лежит внутри своего фасада Базиса (допуск tol мм — меньше зазора
 *  между фасадами 3), занимая не меньше половины его площади. */
export function sameFronts(ref: RefModule, m: Module, tol = 1.5): boolean {
  const { fronts } = frontPanels(ref);
  const box = (p: { position: number[]; size: number[] }) => [0, 1, 2].map((i) => p.position[i] - p.size[i] / 2).concat([0, 1, 2].map((i) => p.position[i] + p.size[i] / 2));
  let ps: ReturnType<typeof parts>;
  try { ps = parts(m); } catch { return false; }
  // общая точка отсчёта — минимальный угол панелей, как в compare.ts (у Базиса ХДФ на z 0..3 и боковины с 3, у студии боковины с 0)
  const sp = ps.filter((p) => (p.material === "board" || p.material === "hdf" || p.material === "glass") && (!p.external || p.role === "door" || p.id.endsWith(":facade"))).map(box);
  const rp = ref.panels.filter((p) => ["ldsp", "hdf", "mdf", "glass", "other"].includes(p.kind)).map((p) => p.box);
  if (!sp.length || !rp.length) return false;
  const oS = [0, 1, 2].map((i) => Math.min(...sp.map((b) => b[i]))), oR = [0, 1, 2].map((i) => Math.min(...rp.map((b) => b[i])));
  const st = ps.filter((p) => p.role === "door" || p.id.endsWith(":facade")).map(box);
  if (!fronts.length || st.length !== fronts.length) return false;
  const used = new Set<number>();
  return fronts.every((f) => {
    const fb = f.box.map((v, q) => v - oR[q % 3]), area = (b: number[]) => (b[3] - b[0]) * (b[4] - b[1]);
    // фасад студии не выходит за фасад Базиса (лишней площади нет) и занимает хотя бы половину его — тот же фасад, пусть и с Δ
    // (k27 m17: дверь Базиса до пола, у студии от 30 — Δ видна в сверке); вышел за него — другая деталь (k03 m01: 717 вместо 117)
    const j = st.findIndex((s0, i) => { if (used.has(i)) return false; const s = s0.map((v, q) => v - oS[q % 3]);
      return s.every((v, q) => (q < 3 ? v >= fb[q] - tol : v <= fb[q] + tol)) && area(s) >= area(fb) / 2; });
    if (j >= 0) used.add(j);
    return j >= 0;
  });
}

/** Одна боковина опущена ниже другой (срабатывает на 8 модулях 5 кухонь): до низа дна (k22 m01) или до пола (k06 m01, k15 m06),
 *  а дно — под второй боковиной (от опущенной до наружной грани второй). */
export function sideDown(ref: RefModule): { side: "left" | "right"; y0: number } | undefined {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const sides = ref.panels.filter((p) => (p.kind === "ldsp" || p.kind === "mdf") && p.axis === "x" && p.box[4] - p.box[1] > 200).sort((a, b) => a.box[0] - b.box[0]);
  if (sides.length < 2) return undefined;
  const L = sides[0], R = sides[sides.length - 1];
  const bot = ref.panels.filter((p) => p.axis === "y" && (p.kind === "ldsp" || p.kind === "mdf") && p.box[3] - p.box[0] > (R.box[0] - L.box[3]) * 0.9).sort((a, b) => a.box[1] - b.box[1])[0];
  if (!bot || Math.abs(L.box[1] - R.box[1]) < 0.5) return undefined;
  const low = L.box[1] < R.box[1] ? L : R, high = low === L ? R : L, side = low === L ? "left" : "right";
  // дно между опущенной боковиной и наружной гранью второй, вторая стоит на дне, опущенная — не выше низа дна
  const underHigh = side === "left" ? bot.box[3] >= R.box[3] - 0.5 && Math.abs(bot.box[0] - L.box[3]) < 0.6 : bot.box[0] <= L.box[0] + 0.5 && Math.abs(bot.box[3] - R.box[0]) < 0.6;
  if (!underHigh || Math.abs(high.box[1] - bot.box[4]) > 0.6 || low.box[1] > bot.box[1] + 0.5) return undefined;
  // конфирмат снизу в торец второй боковины (50 мм) упрётся в горизонталь над дном ближе 50 мм (k26 m05: дно ящика в 7 мм) — не повторяем
  if (ref.panels.some((p) => p !== bot && p.axis === "y" && p.box[1] > bot.box[4] - 0.5 && p.box[1] < bot.box[4] + 50)) return undefined;
  return { side, y0: r1(low.box[1]) };
}

/** Наколки D3×3 под планку петли (±16 от оси петли, 37 вглубь от тыльной плоскости фасада): у всех петель — true, ни у одной — false
 *  (false срабатывает на 26 модулях 11 кухонь), часть — undefined (не повторяем, студия ставит как обычно). */
export function hingePlateHoles(ref: RefModule): boolean | undefined {
  const hs = ref.hardware.filter((h) => h.category === "петля");
  if (!hs.length || !ref.holes?.length) return undefined;
  const n = hs.filter((h) => {
    const [x, y, z] = h.pos;
    return ref.holes!.filter((o) => o.d === 3 && Math.abs(o.at[0] - x) < 1 && Math.abs(Math.abs(o.at[1] - y) - 16) < 1.5 && Math.abs(o.at[2] - (z - 37)) < 1.5).length >= 2
      || ref.holes!.filter((o) => o.d === 3 && Math.abs(o.at[1] - y) < 1 && Math.abs(Math.abs(o.at[0] - x) - 16) < 1.5 && Math.abs(o.at[2] - (z - 37)) < 1.5).length >= 2;
  }).length;
  return n === hs.length ? true : n === 0 ? false : undefined;
}

/** Один ряд фасадов: зазор верха от верха боковин и низа от низа дна, если отличается от бокового (side). */
export function faceGapsTB(ref: RefModule, side: number): { top?: number; bottom?: number } | undefined {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const sides = ref.panels.filter((p) => (p.kind === "ldsp" || p.kind === "mdf") && p.axis === "x" && p.box[4] - p.box[1] > 200);
  if (sides.length < 2) return undefined;
  const top = Math.max(...sides.map((p) => p.box[4])), z1 = Math.max(...sides.map((p) => p.box[5]));
  const fr = ref.panels.filter((p) => p.axis === "z" && p.kind !== "hdf" && p.box[2] >= z1 - 1);
  const bot = ref.panels.filter((p) => p.axis === "y" && (p.kind === "ldsp" || p.kind === "mdf")).sort((a, b) => a.box[1] - b.box[1])[0];
  if (!fr.length || !bot || new Set(fr.map((p) => r1(p.box[1]))).size > 1 || new Set(fr.map((p) => r1(p.box[4]))).size > 1) return undefined;
  const t = r1(top - fr[0].box[4]), b = r1(fr[0].box[1] - bot.box[1]);
  const out: { top?: number; bottom?: number } = {};
  // только зазор (до 10 мм); фасад ниже на сотни мм (k22 m06: 598 — ниша/второй ряд) — не зазор, не трогаем
  if (t > 10 || b > 10 || t < 0 || b < 0) return undefined;
  if (Math.abs(t - side) > 0.05) out.top = t;
  if (Math.abs(b - side) > 0.05) out.bottom = b;
  return out.top !== undefined || out.bottom !== undefined ? out : undefined;
}

/** Накладной ХДФ (за задней кромкой боковин): зазоры от низа корпуса и от верха боковин, если хоть один отличается от бокового. */
export function backGapsTB(ref: RefModule, side: number): { bottom: number; top: number } | undefined {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const sides = ref.panels.filter((p) => (p.kind === "ldsp" || p.kind === "mdf") && p.axis === "x" && p.box[4] - p.box[1] > 200);
  if (sides.length < 2) return undefined;
  const z0 = Math.min(...sides.map((p) => p.box[2])), top = Math.max(...sides.map((p) => p.box[4]));
  const hd = ref.panels.filter((p) => p.kind === "hdf").sort((a, b) => (b.box[3] - b.box[0]) * (b.box[4] - b.box[1]) - (a.box[3] - a.box[0]) * (a.box[4] - a.box[1]))[0];
  if (!hd || hd.box[5] > z0 + 0.5) return undefined;
  const ylo = Math.min(...ref.panels.filter((p) => (p.kind === "ldsp" || p.kind === "mdf") && (p.axis === "y" || sides.includes(p))).map((p) => p.box[1]));
  const bottom = r1(hd.box[1] - ylo), tp = r1(top - hd.box[4]);
  return Math.abs(bottom - side) > 0.05 || Math.abs(tp - side) > 0.05 ? { bottom, top: tp } : undefined;
}

/** Все эксцентрики дна — на нижней пласти (сверлятся снизу): 56 из 380 эксцентриков дна Базиса; флаг — на 12 модулях 10 кухонь.
 *  "legs" — бочонок (Ø15 в 34 от стойки) под площадкой опоры (±29): так у Базиса бывает (k22 m01), но это пересечение — не повторяем. */
export function eccFromBelow(ref: RefModule): boolean | "legs" {
  const bot = ref.panels.filter((p) => p.axis === "y" && (p.kind === "ldsp" || p.kind === "mdf")).sort((a, b) => a.box[1] - b.box[1])[0];
  if (!bot) return false;
  const e = ref.hardware.filter((h) => h.category === "эксцентрик" && h.pos[1] > bot.box[1] - 0.6 && h.pos[1] < bot.box[4] + 0.6);
  if (!e.length || !e.every((h) => Math.abs(h.pos[1] - bot.box[1]) < 0.6)) return false;
  const W = ref.size[0], legs = ref.hardware.filter((h) => h.category === "опора");
  const hit = e.some((h) => { const cx = h.pos[0] + (h.pos[0] < W / 2 ? 34 : -34); return legs.some((l) => Math.abs(l.pos[0] - cx) < 29 + 7.5 && Math.abs(l.pos[2] - h.pos[2]) < 29 + 7.5); });
  return hit ? "legs" : true;
}

/** Съёмные полки (на полкодержателях) кромлены не по кругу (18 из 219 полок Базиса — только перед; флаг — на 14 модулях 6 кухонь):
 *  торцы, одинаковые у всех полок модуля. */
export function shelfEdges(ref: RefModule): string[] | undefined {
  type P = RefModule["panels"][number] & { edges?: { side: string; thick: number }[] };
  const pins = ref.hardware.filter((h) => h.category === "полкодержатель");
  const sh = (ref.panels as P[]).filter((s) => s.axis === "y" && s.kind === "ldsp" && pins.some((h) => Math.abs(h.pos[1] - s.box[1]) < 2));
  const sets = sh.map((s) => [...new Set((s.edges ?? []).filter((e) => e.thick > 0).map((e) => e.side))].sort().join(","));
  if (!sets.length || new Set(sets).size !== 1 || !sets[0] || sets[0] === "+x,+z,-x,-z") return undefined;
  return sets[0].split(",");
}

/** Передний торец боковин кромлен толще остальных (8 модулей двух кухонь: k29 — 7, k27 — 1): { front, other } или undefined. */
export function frontEdge(ref: RefModule): { front: number; other: number } | undefined {
  type P = RefModule["panels"][number] & { edges?: { side: string; thick: number }[] };
  const L = (ref.panels as P[]).filter((p) => (p.kind === "ldsp" || p.kind === "mdf") && p.axis === "x" && p.box[4] - p.box[1] > 200).sort((a, b) => a.box[0] - b.box[0])[0];
  const ed = (L?.edges ?? []).filter((e) => e.thick > 0), f = ed.find((e) => e.side === "+z"), o = [...new Set(ed.filter((e) => e.side !== "+z").map((e) => e.thick))];
  return f && o.length === 1 && Math.abs(o[0] - f.thick) > 0.01 ? { front: f.thick, other: o[0] } : undefined;
}

/** Опоры не сеткой «ряды по ширине × перед/зад» (17 модулей 10 кухонь, k15 m02: правая задняя глубже левой на 23) —
 *  точки [x, z от задней кромки боковин]. Сетка или опоры внахлёст (ближе площадки 58 по обеим осям) — undefined. */
export function irregularLegs(ref: RefModule): [number, number][] | undefined {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const sides = ref.panels.filter((p) => (p.kind === "ldsp" || p.kind === "mdf") && p.axis === "x" && p.box[4] - p.box[1] > 200);
  if (sides.length < 2) return undefined;
  const z0 = Math.min(...sides.map((p) => p.box[2]));
  const L = ref.hardware.filter((h) => h.category === "опора").map((h) => [r1(h.pos[0]), r1(h.pos[2] - z0)] as [number, number]);
  if (L.length < 2) return undefined;
  const xs = [...new Set(L.map((p) => p[0]))], zs = [...new Set(L.map((p) => p[1]))];
  const key = (p: [number, number]) => p.join(","), have = new Set(L.map(key));
  const grid = zs.length <= 2 && have.size === xs.length * zs.length && xs.every((x) => zs.every((z) => have.has(key([x, z]))));
  if (grid) return undefined;
  if (L.some((p, i) => L.some((q, j) => j > i && Math.abs(p[0] - q[0]) < 58 && Math.abs(p[1] - q[1]) < 58))) return undefined;
  return L.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Полкодержатели не симметричны по глубине полки (61 из 244 полок Базиса; поле — на 12 модулях 8 кухонь): отступ передних от переднего торца нижней полки с держателями,
 *  если он не равен заднему (back — shelfPinInset, распознанный по той же полке). */
export function pinInsetFront(ref: RefModule, back: number | undefined): number | undefined {
  if (back === undefined) return undefined;
  const pins = ref.hardware.filter((h) => h.category === "полкодержатель");
  const r1 = (v: number) => Math.round(v * 10) / 10;
  for (const s of ref.panels.filter((p) => p.axis === "y").sort((a, b) => a.box[1] - b.box[1])) {
    const ps = pins.filter((h) => Math.abs(h.pos[1] - s.box[1]) < 2);
    if (ps.length < 2 || Math.abs(r1(Math.min(...ps.map((h) => h.pos[2] - s.box[2]))) - back) > 0.05) continue;
    const front = r1(s.box[5] - Math.max(...ps.map((h) => h.pos[2])));
    // держатель за передним торцом полки (k25 m08: −1,5) упрётся в фасад — не повторяем
    return Math.abs(front - back) > 0.5 && front >= 10 ? front : undefined;
  }
  return undefined;
}

/** Нижний: боковины кромлены, но верхний торец — нет (9 модулей двух кухонь: k03, k20). */
export function sideTopBare(ref: RefModule): boolean {
  type P = RefModule["panels"][number] & { edges?: { side: string; thick: number }[] };
  const sides = (ref.panels as P[]).filter((p) => (p.kind === "ldsp" || p.kind === "mdf") && p.axis === "x" && p.box[4] - p.box[1] > 200).sort((a, b) => a.box[0] - b.box[0]);
  if (sides.length < 2) return false;
  const ed = [sides[0], sides[sides.length - 1]].map((s) => new Set((s.edges ?? []).filter((e) => e.thick > 0).map((e) => e.side)));
  return ed.every((e) => e.size > 0 && !e.has("+y"));
}

/** Детали корпуса ЛДСП (без фасадов) с их кромкой. */
function bodyPanels(ref: RefModule) {
  const sides = ref.panels.filter((p) => p.kind === "ldsp" && p.axis === "x");
  const front = Math.max(0, ...sides.map((p) => p.box[5]));
  return ref.panels.filter((p) => p.kind === "ldsp" && !(p.axis === "z" && p.box[2] >= front - 1)) as (RefModule["panels"][number] & { edges?: { side: string; thick: number }[] })[];
}
/** Без кромки вовсе (k23 — 15 из 422 модулей): ни на одной детали корпуса нет кромки. */
export function edgesNone(ref: RefModule): boolean {
  const body = bodyPanels(ref);
  return body.length > 0 && body.every((p) => !(p.edges ?? []).some((e) => e.thick > 0));
}

/** Кромка по кругу (33 из 422 модулей, две кухни: k11, k32): у каждой детали корпуса ЛДСП кромлены все четыре торца. Возвращает толщину кромки или 0. */
export function edgesAllAround(ref: RefModule): number {
  const body = bodyPanels(ref);
  if (!body.length || !body.every((p) => new Set((p.edges ?? []).filter((e) => e.thick > 0).map((e) => e.side)).size >= 4)) return 0;
  return body[0].edges!.find((e) => e.thick > 0)!.thick;
}
