// Подсветка по деталям (запрос Макса 20.10.2026): «надо выбор левой, правой или обеих стоек, по полкам тоже выбор; режим —
// выбираешь „Подсветка“ через правое меню и кликаешь детали, в которых заложить подсветку».
// Хранение — в секции (model.ts Section): standLights (стойки секции слева/справа), shelfLights (номера полок, как fixed),
// topLight (под крышей). Ключи деталей устойчивы к перестановке: id секции + сторона / номер полки; удаление полки
// уносит её подсветку (operations.removePart сдвигает номера, как у жёстких и стеклянных полок).
// Цена — как раньше по LED-профилям parts(): вертикали RULES.lightRetailPerM (3000), горизонтали RULES.shelfLightRetailPerM (4000).
import { boxes, migrateLights, parts, type Module, type Part, type Section } from "./model";

export { migrateLights };
export type StandSide = "left" | "right";
/** Ключ подсвеченного места: `${sid}:stand:left|right`, `${sid}:shelf:${j}`, `${sid}:top`. */
export type LightKey = string;

const sec = (m: Module, sid: string): Section => {
  const s = m.sections.find((x) => x.id === sid);
  if (!s) throw Error("Секция не найдена.");
  return s;
};
const tidy = (s: Section) => {
  if (s.standLights) s.standLights = (["left", "right"] as const).filter((x) => s.standLights!.includes(x));
  if (s.shelfLights) s.shelfLights = [...new Set(s.shelfLights)].filter((j) => j < s.shelves.length).sort((a, z) => a - z);
  if (!s.standLights?.length) delete s.standLights;
  if (!s.shelfLights?.length) delete s.shelfLights;
  if (!s.topLight) delete s.topLight;
};

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
/** Какие места подсветки относятся к детали под кликом (id детали из parts()). Пусто — в эту деталь подсветка не ставится. */
export function lightTargets(m: Module, pid: string): LightKey[] {
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
  for (const s of m.sections) { delete s.standLights; delete s.shelfLights; delete s.topLight; }
}

/** Подсветка модуля для КП: вертикали и горизонтали — штуки и длина LED-профиля, пог. м (как в смете). */
export function lightSummary(m: Module): { vertical: { count: number; meters: number }; horizontal: { count: number; meters: number; where: string } } {
  const leds = parts(m).filter((p) => p.role === "light" && !p.id.startsWith("groove:"));
  const sum = (list: Part[]) => ({ count: list.length, meters: Math.round(list.reduce((a, p) => a + p.length, 0)) / 1000 });
  const horizontal = leds.filter((p) => p.id.includes(":shelf-light:") || p.id.endsWith(":light:roof"));
  const shelf = horizontal.some((p) => p.id.includes(":shelf-light:")), roof = horizontal.some((p) => p.id.endsWith(":light:roof"));
  return { vertical: sum(leds.filter((p) => !horizontal.includes(p))), horizontal: { ...sum(horizontal), where: shelf && roof ? "в полках и под крышей" : roof ? "под крышей" : "в полках" } };
}
