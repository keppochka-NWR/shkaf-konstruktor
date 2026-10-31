// Поиск по параметрам — палитра команд (Макс 31.10.2026): Ctrl+K или «/», кнопка «Поиск» в шапке.
// Результаты — пункты редактирования из реестра (searchRegistry.ts); выбор ведёт к полю и подсвечивает его (searchNav.ts).
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { searchItems } from "./searchMatch";
import { SEARCH_ITEMS, SUGGESTED, type SearchItem } from "./searchRegistry";
import { goToItem, itemState, type StudioNav } from "./searchNav";
import { editsText } from "./historyShortcuts";
import "./search-tour.css";

const suggested = SUGGESTED.map((id) => SEARCH_ITEMS.find((i) => i.id === id)!).filter(Boolean);

export function ParamSearch({ nav }: { nav: StudioNav }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [cursor, setCursor] = useState(0);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const navRef = useRef(nav); navRef.current = nav;
  const input = useRef<HTMLInputElement>(null), before = useRef<HTMLElement | null>(null), listId = useId();
  const results: SearchItem[] = useMemo(() => (query.trim() ? searchItems(SEARCH_ITEMS, query, 12).map((h) => h.item) : suggested), [query]);
  const show = () => { before.current = document.activeElement as HTMLElement | null; setQuery(""); setCursor(0); setOpen(true); };
  const close = (restore = true) => { setOpen(false); if (restore) before.current?.focus?.(); };
  // Ctrl+K — везде (в том числе в поле); «/» — не в полях ввода (Макс 31.10). Физическая клавиша: работает и в русской раскладке.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const ctrlK = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === "KeyK";
      const slash = !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "/" || (e.code === "Slash" && !e.shiftKey)) && !editsText(e.target) && !(e.target instanceof Element && e.target.closest("select"));
      if (!ctrlK && !slash) return;
      if (slash && document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      if (open) input.current?.select(); else show();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useEffect(() => { if (open) requestAnimationFrame(() => input.current?.focus()); }, [open]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), toast.bad ? 4000 : 3200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { document.getElementById(`${listId}-${cursor}`)?.scrollIntoView({ block: "nearest" }); }, [cursor, listId]);
  async function choose(item: SearchItem | undefined) {
    if (!item) return;
    const st = itemState(item, navRef.current);
    if (st.reason) { setToast({ text: st.reason, bad: true }); return; }
    close(false);
    const error = await goToItem(item, navRef.current);
    // пункт кругового меню — учим, где он живёт (ревизия структуры 31.10: функции только на правой кнопке)
    const tip = item.radial ? `В следующий раз: правая кнопка по модулю → «${item.radial}»${item.note ? ". " + item.note : ""}` : item.note;
    if (error) setToast({ text: error, bad: true }); else if (tip) setToast({ text: tip });
  }
  return <>
    <button type="button" className="param-search-trigger" data-tour="search" aria-label="Поиск по параметрам" title="Поиск по параметрам · Ctrl+K или /" onClick={show}>
      <Search size={16} /><span>Поиск</span><kbd>Ctrl K</kbd>
    </button>
    {open && createPortal(<div className="param-search-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="param-search" role="dialog" aria-modal="true" aria-label="Поиск по параметрам" data-testid="param-search">
        <label className="param-search-field"><Search size={18} />
          <input ref={input} autoFocus /* сразу при открытии: быстрый набор после Ctrl+K не теряет первые буквы */ role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={results.length ? `${listId}-${cursor}` : undefined} aria-label="Что настроить" placeholder="Петли, полка, цоколь, форма комнаты, КП…" value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
              if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const n = results.length; if (n) setCursor((c) => (c + (e.key === "ArrowDown" ? 1 : n - 1)) % n); return; }
              if (e.key === "Enter") { e.preventDefault(); void choose(results[cursor]); }
              if (e.key === "Tab") e.preventDefault(); // фокус остаётся в поиске
            }} />
          <kbd>Esc</kbd>
        </label>
        {!query.trim() && <p className="param-search-head">Частые пункты</p>}
        <ul className="param-search-list" id={listId} role="listbox" aria-label="Результаты поиска">
          {results.map((item, i) => { const st = itemState(item, nav); return <li key={item.id} id={`${listId}-${i}`} role="option" aria-selected={i === cursor} aria-disabled={!!st.reason || undefined} data-item={item.id}
            className={"param-search-item" + (i === cursor ? " current" : "") + (st.reason ? " off" : "")} onMouseMove={() => setCursor(i)} onClick={() => void choose(item)}>
            <span className="param-search-kind">{item.kind}</span>
            <span className="param-search-text"><b>{item.title}</b><small>{st.reason ?? st.hint ?? item.where}</small></span>
            {i === cursor && !st.reason && <CornerDownLeft size={15} className="param-search-enter" aria-hidden="true" />}
          </li>; })}
          {!results.length && <li className="param-search-empty" role="option" aria-selected="false" aria-disabled="true">Ничего не нашлось. Попробуйте другое слово: «ручки», «фасад», «размер».</li>}
        </ul>
        <p className="param-search-foot">↑↓ — выбрать · Enter — перейти · «обучение» — короткий тур по студии</p>
      </div>
    </div>, document.body)}
    {toast && createPortal(<div className={"search-toast" + (toast.bad ? " bad" : "")} role="status" data-testid="search-toast">{toast.text}</div>, document.body)}
  </>;
}
