// Переход к найденному пункту (Макс 31.10.2026): этап → вкладка/окно → раскрыть <details> → прокрутить → фокус → подсветка ~1,5 с.
// App отдаёт мост StudioNav (только действия и снимок состояния) — компоненты поиска и обучения не знают внутренностей App.
import { revealSettings } from "./SettingsTree";
import { normalizeStage, type Stage } from "./stages";
import type { Module } from "./model";
import type { OutputTab } from "./ProjectDock";
import type { SearchItem } from "./searchRegistry";

export type StudioNav = {
  stage: Stage; advanced: boolean; compactTop: boolean; hasModules: boolean; deselected: boolean; module?: Module; moduleName: string; activeId?: string;
  goStage(s: Stage): void; selectModule(id: string): void; setTab(t: "module" | "section" | "room"): void; setPlan(on: boolean): void;
  openOutput(t: OutputTab): void; openModal(name: "help" | "cloud"): void; closeModal(): void; expandTop(): void; openRadial(): void;
  /** Закрыть круговое меню (палитра поверх него перехватывала стрелки и Enter — критик 31.10). */
  closeMenu(): void;
  /** Пустая комната (EmptyRoomView): работают пункты помещения, остальные — серым с причиной. */
  empty?: boolean;
  /** Открыт заказ с комнатами (папка клиента): есть «Варианты комнаты». */
  folder?: boolean;
  /** Открыт вопрос «Удалить?» или окно вырезов — поиск не открывается поверх. */
  blocked?: boolean;
};
/** Пункты, которые работают в пустой комнате помимо пунктов помещения. */
const EMPTY_OK = new Set(["stages", "views", "advanced", "tour"]);
const EMPTY_REASON = "В комнате пока нет мебели — добавьте первый шкаф (палитра слева)";

/** «селектор::текст» — элементы по селектору, в тексте которых есть «текст». */
export function queryTargets(sel: string): HTMLElement[] {
  const [css, text] = sel.split("::");
  let list: HTMLElement[] = [];
  try { list = Array.from(document.querySelectorAll<HTMLElement>(css)); } catch { return []; }
  return text ? list.filter((el) => (el.textContent ?? "").includes(text)) : list;
}
export const visible = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
/** Раскрыть все <details> над элементом (и сам, если это <details>) — категории свойств, «Конструкция и фурнитура». */
export function reveal(el: HTMLElement) { revealSettings(el); if (el instanceof HTMLDetailsElement) el.open = true; }

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Ждём, пока цель появится после смены этапа/вкладки (React рисует за кадр-два); первая видимая по порядку селекторов. */
export async function waitTarget(selectors: string[], ms = 2500, open = true): Promise<HTMLElement | null> {
  const end = performance.now() + ms;
  for (;;) {
    for (const sel of selectors) for (const el of queryTargets(sel)) { if (open) reveal(el); if (visible(el)) return el; }
    // проверка и после долгого кадра (тяжёлая смета считается синхронно) — выход только после последней попытки
    if (performance.now() >= end) return null;
    await Promise.race([frame(), sleep(50)]);
  }
}

const NO_FOCUS = '[data-testid="scene"],[data-tour="guides"],[data-tour="views"],[data-tour="modes"],[data-tour="palette"],[data-tour="modules"]';
const FOCUSABLE = "input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea,button:not(:disabled),summary,[tabindex]:not([tabindex='-1'])";
/** Фокус на самом поле, а у раздела — на первом поле внутри. */
export function focusIn(el: HTMLElement) {
  const f = el.matches(FOCUSABLE) ? el : el instanceof HTMLDetailsElement ? el.querySelector<HTMLElement>("summary") : Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).find(visible) ?? null;
  f?.focus({ preventScroll: true });
}

let pulseStop: (() => void) | null = null;
/** Мягкая подсветка цели ~1,5 с: рамка поверх страницы (следует за целью при прокрутке), у цели — data-search-hit на время подсветки. */
export function pulse(el: HTMLElement, ms = 1600) {
  pulseStop?.();
  const ring = document.createElement("div");
  ring.className = "search-pulse"; ring.setAttribute("aria-hidden", "true");
  document.body.appendChild(ring); el.setAttribute("data-search-hit", "");
  let raf = 0; const t0 = performance.now();
  const place = () => { const r = el.getBoundingClientRect(); Object.assign(ring.style, { left: r.left - 4 + "px", top: r.top - 4 + "px", width: r.width + 8 + "px", height: r.height + 8 + "px" }); if (performance.now() - t0 < ms) raf = requestAnimationFrame(place); else stop(); };
  const stop = () => { cancelAnimationFrame(raf); ring.remove(); el.removeAttribute("data-search-hit"); if (pulseStop === stop) pulseStop = null; };
  pulseStop = stop; place();
}

/** Причина, почему пункт сейчас недоступен (серым), и подсказка, если нужен выбор шкафа. */
export function itemState(item: SearchItem, nav: Pick<StudioNav, "hasModules" | "deselected" | "module" | "moduleName" | "empty" | "folder">): { reason?: string; hint?: string } {
  if (nav.empty && !((item.stage === "room" && !item.full) || item.empty || EMPTY_OK.has(item.id))) return { reason: EMPTY_REASON };
  if (item.folder && !nav.folder) return { reason: "Есть только в папке клиента (заказ с комнатами)" };
  if (!item.module && item.radial === undefined) return {};
  if (!nav.hasModules || !nav.module) return { reason: "Выберите шкаф: в проекте пока нет мебели" };
  const reason = item.applies?.(nav.module);
  if (reason) return { reason };
  return nav.deselected ? { hint: `Выберите шкаф — откроется «${nav.moduleName}»` } : {};
}

/** Переход к пункту. Возвращает текст ошибки, если цель не нашлась. */
export async function goToItem(item: SearchItem, nav: StudioNav): Promise<string | undefined> {
  if (item.action === "tour") { window.dispatchEvent(new CustomEvent("studio-tour")); return; }
  nav.closeModal(); nav.closeMenu();
  if (item.action === "help" || item.action === "cloud") { nav.openModal(item.action); await frame(); return; }
  if (item.top && nav.compactTop) nav.expandTop();
  if (item.stage && normalizeStage(nav.stage) !== item.stage) nav.goStage(item.stage);
  if (item.module || item.radial !== undefined) { if (nav.deselected && nav.activeId) nav.selectModule(nav.activeId); nav.setTab("module"); }
  if (item.plan !== undefined) nav.setPlan(item.plan);
  if (item.output) nav.openOutput(item.output);
  await frame(); await frame();
  if (item.radial !== undefined) { nav.openRadial(); await frame(); }
  if (item.click) { const c = await waitTarget([item.click], 1200, false); c?.click(); await frame(); }
  const el = await waitTarget(item.target);
  // пункт кругового меню есть не всегда (за угол — у крайнего в ряду, «Выровнять» — при отмеченных): объясняем, где он живёт
  if (!el && item.radial) return `Правая кнопка по модулю → «${item.radial}»: у «${nav.moduleName}» сейчас нет.${item.note ? " " + item.note + "." : ""}`;
  if (!el) return `«${item.title}» сейчас не на экране${item.module ? " для этого шкафа" : ""}.${item.note ? " " + item.note + "." : ""}`;
  el.scrollIntoView({ block: "center", inline: "nearest" });
  // в круговом меню фокус держит само меню (стрелки по кругу) — пункт только подсвечиваем
  // сцену и подсказки клавиш не фокусируем: случайный Enter открыл бы правку размера (критик 31.10)
  if (item.radial === undefined && !el.matches(NO_FOCUS)) focusIn(el);
  pulse(el);
}
