// Подсветка по деталям (запрос Макса 20.10.2026): «надо выбор левой, правой или обеих стоек, по полкам тоже выбор; режим —
// выбираешь „Подсветка“ через правое меню и кликаешь детали, в которых заложить подсветку».
// Хранение — в секции (model.ts Section): standLights (стойки секции слева/справа), shelfLights (номера полок, как fixed),
// topLight (под крышей). Ключи деталей устойчивы к перестановке: id секции + сторона / номер полки; удаление полки
// уносит её подсветку (operations.removePart сдвигает номера, как у жёстких и стеклянных полок).
// Цена — как раньше по LED-профилям parts(): вертикали RULES.lightRetailPerM (3000), горизонтали RULES.shelfLightRetailPerM (4000).
// Задача 14 (менеджеры 22.10.2026): ориентация видна и выбирается в режиме («ставить: вертикаль / горизонталь / обе»), тон (3000/4000/6000 К)
// и тип (врезной / накладной профиль / лента без профиля) — на модуль и на отдельную деталь (Section.lightSpec). Цена не меняется:
// по-прежнему по ориентации (решение 20.10); тип и тон — описанием строки сметы и КП, только когда выбраны (старые проекты считаются как раньше).
import { boxes, lightSpecAt, migrateLights, parts, RULES, type LightSpec, type LightTone, type LightType, type Module, type Part, type Section } from "./model";

export { migrateLights, lightSpecAt };
export type { LightTone, LightType };
export type StandSide = "left" | "right";
/** Ключ подсвеченного места: `${sid}:stand:left|right`, `${sid}:shelf:${j}`, `${sid}:top`. */
export type LightKey = string;
/** Что ставит клик в режиме «Подсветка»: только вертикали (стойки, перегородки), только горизонтали (полки, крыша) или по детали. */
export type LightOrient = "vertical" | "horizontal" | "both";

export const TONE_INFO: Record<LightTone, { label: string; short: string; led: number; emissive: number; glow: number }> = {
  3000: { label: "Тёплый 3000K", short: "тёплый 3000K", led: 0xffe2b0, emissive: 0xffa94d, glow: 0xffa040 },
  4000: { label: "Нейтральный 4000K", short: "нейтральный 4000K", led: 0xfff6e6, emissive: 0xffe7c2, glow: 0xffe6b8 },
  6000: { label: "Холодный 6000K", short: "холодный 6000K", led: 0xf0f6ff, emissive: 0xc4dcff, glow: 0x8fc0ff },
};
export const TYPE_INFO: Record<LightType, { label: string; short: string; hint: string }> = {
  inset: { label: "Врезной профиль", short: "врезной профиль", hint: "Профиль в пазу детали, заподлицо" },
  surface: { label: "Накладной профиль", short: "накладной профиль", hint: "Профиль на поверхности детали" },
  tape: { label: "Лента без профиля", short: "лента без профиля", hint: "Светодиодная лента на детали, без алюминиевого профиля" },
};

const sec = (m: Module, sid: string): Section => {
  const s = m.sections.find((x) => x.id === sid);
  if (!s) throw Error("Секция не найдена.");
  return s;
};
/** Место секции по ключу: 'left' | 'right' | 'top' | 'shelf:N'. */
export function slotOf(key: LightKey): { sid: string; slot: string } {
  const [sid, kind, arg] = key.split(":");
  return { sid, slot: kind === "stand" ? arg : kind === "top" ? "top" : "shelf:" + arg };
}
export const orientOf = (key: LightKey): "vertical" | "horizontal" => (key.split(":")[1] === "stand" ? "vertical" : "horizontal");
const slotLit = (s: Section, slot: string) => {
  const sh = /^shelf:(\d+)$/.exec(slot);
  return slot === "left" || slot === "right" ? !!s.standLights?.includes(slot) : slot === "top" ? !!s.topLight : !!sh && !!s.shelfLights?.includes(Number(sh[1]));
};
const tidy = (s: Section) => {
  if (s.standLights) s.standLights = (["left", "right"] as const).filter((x) => s.standLights!.includes(x));
  if (s.shelfLights) s.shelfLights = [...new Set(s.shelfLights)].filter((j) => j < s.shelves.length).sort((a, z) => a - z);
  if (!s.standLights?.length) delete s.standLights;
  if (!s.shelfLights?.length) delete s.shelfLights;
  if (!s.topLight) delete s.topLight;
  // тон/тип детали живёт, пока место подсвечено
  if (s.lightSpec) {
    for (const k of Object.keys(s.lightSpec)) if (!slotLit(s, k) || (s.lightSpec[k].tone === undefined && s.lightSpec[k].type === undefined)) delete s.lightSpec[k];
    if (!Object.keys(s.lightSpec).length) delete s.lightSpec;
  }
};
/** Номера полок сдвинулись (удаление, вставка, сортировка): тон/тип полки идут за своей полкой; undefined — полки больше нет. */
export function remapShelfSpec(s: Section, map: (j: number) => number | undefined) {
  if (!s.lightSpec) return;
  const next: Record<string, LightSpec> = {};
  for (const [k, v] of Object.entries(s.lightSpec)) {
    const sh = /^shelf:(\d+)$/.exec(k);
    if (!sh) { next[k] = v; continue; }
    const j = map(Number(sh[1]));
    if (j !== undefined) next["shelf:" + j] = v;
  }
  if (Object.keys(next).length) s.lightSpec = next; else delete s.lightSpec;
}

export function hasStand(m: Module, sid: string, side: StandSide) { const s = m.sections.find((x) => x.id === sid); return !!s && (!!m.standLight || !!s.standLights?.includes(side)); }
export function hasShelf(m: Module, sid: string, j: number) { const s = m.sections.find((x) => x.id === sid); return !!s && j >= 0 && j < s.shelves.length && (!!s.shelfLight || !!s.shelfLights?.includes(j)); }
export function hasTop(m: Module, sid: string) { return !!m.sections.find((x) => x.id === sid)?.topLight; }

/** Все подсвеченные места модуля ключами (для тестов, подсказок и описания). */
export function lightKeys(m: Module): LightKey[] {
  return m.sections.flatMap((s) => [
    ...(["left", "right"] as const).filter((x) => hasStand(m, s.id, x)).map((x) => `${s.id}:stand:${x}`),
    ...s.shelves.flatMap((_, j) => (hasShelf(m, s.id, j) ? [`${s.id}:shelf:${j}`] : [])),
    ...(s.topLight ? [`${s.id}:top`] : []),
  ]);
}
export function anyLight(m: Module) { return lightKeys(m).length > 0; }

/** Включить/снять подсветку по ключу. Сначала переводит старые флаги в поштучный набор. */
export function setLight(m: Module, key: LightKey, on: boolean) {
  migrateLights(m);
  const [sid, kind, arg] = key.split(":"), s = sec(m, sid);
  // вновь поставленная подсветка — с тоном и типом модуля (старый выбор детали, оставшийся от снятой подсветки, не оживает)
  const slot = slotOf(key).slot;
  if (on && !slotLit(s, slot) && s.lightSpec) delete s.lightSpec[slot];
  if (kind === "stand") { const side = arg as StandSide; const set = new Set(s.standLights ?? []); if (on) set.add(side); else set.delete(side); s.standLights = [...set]; }
  else if (kind === "shelf") { const j = Number(arg); if (!Number.isInteger(j) || j < 0 || j >= s.shelves.length) throw Error("Полка не найдена."); const set = new Set(s.shelfLights ?? []); if (on) set.add(j); else set.delete(j); s.shelfLights = [...set]; }
  else if (kind === "top") { if (on) s.topLight = true; else delete s.topLight; }
  else throw Error("Неизвестная деталь подсветки.");
  tidy(s);
}
const isOn = (m: Module, key: LightKey) => lightKeys(m).includes(key);

/** Группа ключей переключается вместе: если все горят — снять все, иначе включить все (перегородка — обе грани, крыша — все секции под ней). */
export function toggleGroup(m: Module, keys: LightKey[]) {
  if (!keys.length) return false;
  const on = !keys.every((k) => isOn(m, k));
  for (const k of keys) setLight(m, k, on);
  return true;
}

const NEAR = 1.5;
/** Какие места подсветки относятся к детали под кликом (id детали из parts()). Пусто — в эту деталь подсветка не ставится.
 *  orient — переключатель режима (задача 14): «вертикаль» берёт только стойки, «горизонталь» — только полки и крышу. */
export function lightTargets(m: Module, pid: string, orient: LightOrient = "both"): LightKey[] {
  const keys = detailTargets(m, pid);
  return orient === "both" ? keys : keys.filter((k) => orientOf(k) === orient);
}
/** Первая деталь под курсором (по лучу, ближняя первой), принимающая подсветку выбранной ориентации: в режиме «вертикаль» клик
 *  по кромке полки у стойки ставит подсветку в стойку за ней. */
export function pickTargets(m: Module, pids: string[], orient: LightOrient = "both"): { pid: string; keys: LightKey[] } | null {
  for (const pid of pids) { const keys = lightTargets(m, pid, orient); if (keys.length) return { pid, keys }; }
  return null;
}
function detailTargets(m: Module, pid: string): LightKey[] {
  const ids = new Set(m.sections.map((s) => s.id));
  // сами LED-профили: клик по светящейся полосе снимает именно её
  let r = /^(.+):light:(left|right)$/.exec(pid);
  if (r && ids.has(r[1])) return [`${r[1]}:stand:${r[2]}`];
  r = /^(.+):shelf-light:(\d+)$/.exec(pid);
  if (r && ids.has(r[1])) return [`${r[1]}:shelf:${r[2]}`];
  r = /^(.+):light:roof$/.exec(pid);
  if (r && ids.has(r[1])) return [`${r[1]}:top`];
  r = /^(.+):shelf:(\d+)$/.exec(pid);
  if (r && ids.has(r[1])) { const s = sec(m, r[1]), j = Number(r[2]); return j < s.shelves.length ? [pid] : []; }
  const part = parts(m).find((p) => p.id === pid);
  if (!part || part.role !== "body") return [];
  return standOrTopKeys(m, part);
}
function standOrTopKeys(m: Module, p: Part): LightKey[] {
  const [sx, sy, sz] = p.size, [px, py] = p.position;
  const x0 = px - sx / 2, x1 = px + sx / 2, y0 = py - sy / 2, y1 = py + sy / 2;
  const bs = boxes(m);
  if (sx < sy && sx < sz && sx <= 40) {
    // вертикаль толщиной в плиту (боковина, перегородка, перегородка ограниченной высоты): грань, смотрящая в секцию
    const overlapY = (b: (typeof bs)[number]) => Math.min(b.top, y1) - Math.max(b.bottom, y0) > 10;
    return [
      ...bs.filter((b) => Math.abs(b.x + b.width - x0) < NEAR && overlapY(b)).map((b) => `${b.id}:stand:right`),
      ...bs.filter((b) => Math.abs(b.x - x1) < NEAR && overlapY(b)).map((b) => `${b.id}:stand:left`),
    ];
  }
  if (sy < sx && sy < sz && sy <= 40) {
    // горизонталь над секцией (крыша, общая разделительная полка): подсветка снизу у переда
    const overlapX = (b: (typeof bs)[number]) => Math.min(b.x + b.width, x1) - Math.max(b.x, x0) > 10;
    return bs.filter((b) => Math.abs(b.top - y0) < NEAR && overlapX(b)).map((b) => `${b.id}:top`);
  }
  return [];
}

/** Клик по детали в режиме «Подсветка»: переключить её подсветку. false — деталь не принимает подсветку. */
export function toggleDetailLight(m: Module, pid: string) {
  return toggleGroup(m, lightTargets(m, pid));
}

/** Быстрые пункты: левая/правая/обе стойки секции. */
export function setStands(m: Module, sid: string, which: StandSide | "both", on: boolean) {
  for (const side of which === "both" ? (["left", "right"] as const) : [which]) setLight(m, `${sid}:stand:${side}`, on);
}
/** Все полки секции: включить или снять. */
export function setSectionShelves(m: Module, sid: string, on: boolean) {
  migrateLights(m);
  const s = sec(m, sid);
  s.shelfLights = on ? s.shelves.map((_, j) => j) : [];
  tidy(s);
}
/** «Подсветка в стойках» панели и меню «Улучшения»: все стойки всех секций. */
export function setAllStands(m: Module, on: boolean) {
  migrateLights(m);
  for (const s of m.sections) { s.standLights = on ? ["left", "right"] : []; tidy(s); }
}
export function allStandsLit(m: Module) { return m.sections.length > 0 && m.sections.every((s) => hasStand(m, s.id, "left") && hasStand(m, s.id, "right")); }
/** «Убрать всю подсветку». */
export function clearLights(m: Module) {
  migrateLights(m);
  for (const s of m.sections) { delete s.standLights; delete s.shelfLights; delete s.topLight; delete s.lightSpec; }
}

/** Место подсветки по id LED-детали из parts() (`…:light:left`, `…:shelf-light:2`, `…:light:roof`); иначе null. */
export function keyOfLed(m: Module, pid: string): LightKey | null {
  const ids = new Set(m.sections.map((s) => s.id));
  let r = /^(.+):light:(left|right)$/.exec(pid);
  if (r && ids.has(r[1])) return `${r[1]}:stand:${r[2]}`;
  r = /^(.+):shelf-light:(\d+)$/.exec(pid);
  if (r && ids.has(r[1])) return `${r[1]}:shelf:${r[2]}`;
  r = /^(.+):light:roof$/.exec(pid);
  if (r && ids.has(r[1])) return `${r[1]}:top`;
  return null;
}
/** Тон и тип LED-детали (сцена, смета). Деталь без места (Вотан, кухня) — тон и тип модуля. */
export function ledLook(m: Module, pid: string): { tone: LightTone; type: LightType; explicit: boolean } {
  const key = keyOfLed(m, pid);
  if (!key) return { tone: m.lightTone ?? 4000, type: m.lightType ?? "inset", explicit: m.lightTone !== undefined || m.lightType !== undefined };
  const { sid, slot } = slotOf(key);
  return lightSpecAt(m, sec(m, sid), slot);
}
/** Описание тона и типа строкой: «накладной профиль, тёплый 3000K». */
export const specText = (s: { tone: LightTone; type: LightType }) => `${TYPE_INFO[s.type].short}, ${TONE_INFO[s.tone].short}`;

/** Тон/тип модуля (null — снять выбор). Свой выбор деталей остаётся (он явный). */
export function setModuleLight(m: Module, patch: { tone?: LightTone | null; type?: LightType | null }) {
  if (patch.tone === null) delete m.lightTone; else if (patch.tone !== undefined) m.lightTone = patch.tone;
  if (patch.type === null) delete m.lightType; else if (patch.type !== undefined) m.lightType = patch.type;
}
/** Тон/тип одной подсвеченной детали (null — как у модуля). */
export function setDetailSpec(m: Module, key: LightKey, patch: { tone?: LightTone | null; type?: LightType | null }) {
  migrateLights(m);
  const { sid, slot } = slotOf(key), s = sec(m, sid);
  if (!slotLit(s, slot)) throw Error("Деталь не подсвечена.");
  const cur: LightSpec = { ...(s.lightSpec?.[slot] ?? {}) };
  if (patch.tone === null) delete cur.tone; else if (patch.tone !== undefined) cur.tone = patch.tone;
  if (patch.type === null) delete cur.type; else if (patch.type !== undefined) cur.type = patch.type;
  s.lightSpec = { ...(s.lightSpec ?? {}), [slot]: cur };
  tidy(s);
}
/** Применить тон/тип ко всем деталям модуля: выбор модуля, свой выбор деталей снимается. */
export function applyToAll(m: Module, patch: { tone?: LightTone; type?: LightType }) {
  setModuleLight(m, patch);
  for (const s of m.sections) if (s.lightSpec) {
    for (const v of Object.values(s.lightSpec)) { if (patch.tone !== undefined) delete v.tone; if (patch.type !== undefined) delete v.type; }
    tidy(s);
  }
}

export type LightRow = { key: LightKey; pid: string; section: number; label: string; orient: "vertical" | "horizontal"; length: number; tone: LightTone; type: LightType; ownTone: boolean; ownType: boolean };
/** Список подсвеченных деталей для окна «Подсветка»: секция, деталь, ориентация, длина LED по смете, тон и тип (свой или модуля). */
export function lightList(m: Module): LightRow[] {
  const leds = new Map(parts(m).filter((p) => p.role === "light" && !p.id.startsWith("groove:")).map((p) => [keyOfLed(m, p.id), p]));
  return lightKeys(m).flatMap((key) => {
    const p = leds.get(key);
    if (!p) return [];
    const { sid, slot } = slotOf(key), si = m.sections.findIndex((s) => s.id === sid), s = m.sections[si], own = s.lightSpec?.[slot], spec = lightSpecAt(m, s, slot);
    const sh = /^shelf:(\d+)$/.exec(slot);
    const label = slot === "left" ? "Левая стойка" : slot === "right" ? "Правая стойка" : slot === "top" ? "Под крышей" : `Полка ${Number(sh![1]) + 1}`;
    return [{ key, pid: p.id, section: si + 1, label, orient: orientOf(key), length: Math.round(p.length), tone: spec.tone, type: spec.type, ownTone: own?.tone !== undefined, ownType: own?.type !== undefined }];
  });
}
/** Цена за пог. м по ориентации (решение 20.10): вертикаль 3000, горизонталь 4000. */
export const pricePerM = (orient: "vertical" | "horizontal") => (orient === "vertical" ? RULES.lightRetailPerM : RULES.shelfLightRetailPerM);

/** Описание выбранных тонов/типов группы LED-деталей (только явный выбор, как в смете): «врезной профиль, тёплый 3000K». */
function groupSpec(m: Module, list: Part[]): string {
  const specs = list.map((p) => ledLook(m, p.id)).filter((s) => s.explicit);
  return [...new Set(specs.map(specText))].join("; ");
}
/** Подсветка модуля для КП: вертикали и горизонтали — штуки и длина LED-профиля, пог. м (как в смете); spec — тип и тон, если выбраны. */
export function lightSummary(m: Module): { vertical: { count: number; meters: number; spec: string }; horizontal: { count: number; meters: number; where: string; spec: string } } {
  const leds = parts(m).filter((p) => p.role === "light" && !p.id.startsWith("groove:"));
  const sum = (list: Part[]) => ({ count: list.length, meters: Math.round(list.reduce((a, p) => a + p.length, 0)) / 1000, spec: groupSpec(m, list) });
  const horizontal = leds.filter((p) => p.id.includes(":shelf-light:") || p.id.endsWith(":light:roof"));
  const shelf = horizontal.some((p) => p.id.includes(":shelf-light:")), roof = horizontal.some((p) => p.id.endsWith(":light:roof"));
  return { vertical: sum(leds.filter((p) => !horizontal.includes(p))), horizontal: { ...sum(horizontal), where: shelf && roof ? "в полках и под крышей" : roof ? "под крышей" : "в полках" } };
}
