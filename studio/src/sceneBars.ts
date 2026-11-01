// Плашки над сценой (Макс 01.11, критик): реальные размеры вместо запасов в px — их не угадать, текст и перенос строк меняются.
/** Callback-ref: высота элемента — в переменную CSS на родителе. Элемент появился или снят — переменная следует за ним. */
export function heightVarRef(name: string) {
  let observer: ResizeObserver | undefined, host: HTMLElement | null = null;
  return (el: HTMLElement | null) => {
    observer?.disconnect(); observer = undefined;
    if (!el) { host?.style.removeProperty(name); host = null; return; }
    host = el.parentElement;
    const sync = () => host?.style.setProperty(name, el.offsetHeight + "px");
    sync();
    if (typeof ResizeObserver !== "undefined") { observer = new ResizeObserver(sync); observer.observe(el, { box: "border-box" }); }
  };
}
/** Что скрыто прокруткой: "above", "below", оба или пусто. */
export function moreState(scrollTop: number, clientHeight: number, scrollHeight: number): string {
  const above = scrollTop > 1, below = scrollTop + clientHeight < scrollHeight - 1;
  return [above && "above", below && "below"].filter(Boolean).join(" ");
}
/** Callback-ref колонки с прокруткой: data-more для стрелок (критик: на низком окне кнопки уходили вниз без всякого знака); щелчок по стрелке листает. */
export function scrollCueRef() {
  let stop: (() => void) | undefined;
  return (el: HTMLElement | null) => {
    stop?.(); stop = undefined;
    if (!el) return;
    const sync = () => { el.dataset.more = moreState(el.scrollTop, el.clientHeight, el.scrollHeight); };
    // стрелка — псевдоэлемент: щелчок приходит в саму колонку, по кнопкам — нет
    const page = (e: MouseEvent) => { if (e.target !== el) return; const r = el.getBoundingClientRect(); el.scrollBy({ top: (e.clientY > r.top + r.height / 2 ? 1 : -1) * 120, behavior: "smooth" }); };
    el.addEventListener("scroll", sync, { passive: true }); el.addEventListener("click", page);
    const size = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : undefined; size?.observe(el);
    const list = typeof MutationObserver !== "undefined" ? new MutationObserver(sync) : undefined; list?.observe(el, { childList: true }); // кнопка «Стены» появляется и пропадает
    sync();
    stop = () => { el.removeEventListener("scroll", sync); el.removeEventListener("click", page); size?.disconnect(); list?.disconnect(); };
  };
}
