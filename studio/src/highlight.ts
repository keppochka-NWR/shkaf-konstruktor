// Подсветка параметров, куда привело действие (Макс 31.10.2026: «при нажатии в колесе на параметры, параметры должны немного
// подсвечиваться, показывая, что они там»). Общий помощник: круговое меню, плашка выбранной детали; потом — и поиск по студии
// (ветка claude/search-tour), поэтому отдельным файлом без зависимостей от App. Элемент раскрывается (родительские <details>),
// прокручивается в видимую область и мягко светится брендовым синим ~1,3 с; prefers-reduced-motion — рамка без анимации и плавной прокрутки.
import "./highlight.css";

export type HighlightTarget = string | Element | null | undefined | readonly (Element | null | undefined)[];
export type HighlightOptions = {
  /** где искать селектор (по умолчанию document) */
  root?: ParentNode | null;
  /** прокрутить первый элемент в видимую область (по умолчанию да) */
  scroll?: boolean;
  /** раскрыть родительские <details> (по умолчанию да) */
  open?: boolean;
  /** фокус в первое поле ввода (по умолчанию нет — фокус не уводим из сцены) */
  focus?: boolean;
  /** длительность, мс (по умолчанию 1300) */
  duration?: number;
  /** сколько кадров ждать появления элемента после setState (по умолчанию 30 ≈ 0,5 с) */
  frames?: number;
};
export const HIGHLIGHT_CLASS = "ui-highlight";
const timers = new WeakMap<Element, number>();

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
function resolve(t: HighlightTarget, root: ParentNode | null | undefined): HTMLElement[] {
  if (!t) return [];
  if (typeof t === "string") return Array.from((root ?? document).querySelectorAll<HTMLElement>(t));
  const list = (Array.isArray(t) ? t : [t]) as (Element | null | undefined)[];
  return list.filter((e): e is HTMLElement => !!e && e instanceof HTMLElement && e.isConnected);
}
/** Раскрыть свёрнутые <details> вокруг элемента (как revealSettings панели). */
export function revealAncestors(el: Element) { for (let c = el.parentElement; c; c = c.parentElement) if (c instanceof HTMLDetailsElement && !c.open) c.open = true; if (el instanceof HTMLDetailsElement && !el.open) el.open = true; }
/** Подсветить уже найденные элементы: перезапуск анимации, снятие класса по таймеру. */
export function pulse(els: readonly HTMLElement[], duration = 1300) {
  for (const el of els) {
    const old = timers.get(el); if (old) clearTimeout(old);
    el.classList.remove(HIGHLIGHT_CLASS); void el.offsetWidth; // перезапуск анимации при повторном нажатии
    el.style.setProperty("--ui-highlight-ms", duration + "ms");
    el.classList.add(HIGHLIGHT_CLASS);
    timers.set(el, window.setTimeout(() => { el.classList.remove(HIGHLIGHT_CLASS); el.style.removeProperty("--ui-highlight-ms"); timers.delete(el); }, duration));
  }
}
/** Найти (дождаться после перерисовки), раскрыть, прокрутить и подсветить. Возвращает подсвеченные элементы ([] — не нашлись). */
export function highlightControls(target: HighlightTarget, opts: HighlightOptions = {}): Promise<HTMLElement[]> {
  const { root, scroll = true, open = true, focus = false, duration = 1300, frames = 30 } = opts;
  return new Promise((done) => {
    let left = frames;
    const tick = () => {
      const els = resolve(target, root);
      if (!els.length && left-- > 0 && typeof requestAnimationFrame === "function") { requestAnimationFrame(tick); return; }
      if (!els.length) { done([]); return; }
      if (open) els.forEach(revealAncestors);
      if (scroll) els[0].scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
      if (focus) els[0].querySelector<HTMLElement>("input,select,textarea")?.focus({ preventScroll: true });
      pulse(els, duration);
      done(els);
    };
    // первый поиск — после кадра: действие меню только что поменяло вкладку/выбор, React дорисовывает панель
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(tick); else tick();
  });
}
