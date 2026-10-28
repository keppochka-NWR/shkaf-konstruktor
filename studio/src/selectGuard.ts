// Стрелки в закрытом выпадающем списке (интеграция 29.10.2026, сбой из сборок dp-2810 мышью): Chrome в закрытом <select> на каждую
// стрелку сразу шлёт change — студия применяла КАЖДЫЙ промежуточный пункт (лишние правки в истории, пересчёт), а пункт, который проверка
// отклоняет (рамка у дверей выше 2000), откатывал выбор — дальше стрелками было не пройти. Общее правило для всех списков студии:
// стрелки/Home/End только листают пункты (недоступные пропускаются), применяется выбранный — по Enter, Tab или уходу фокуса;
// Esc возвращает прежний. Открытый список (мышь, Alt+↓) и набор букв — поведение браузера без изменений.
const NAV = new Set(["ArrowUp", "ArrowDown", "Home", "End"]);

/** Индекс следующего доступного пункта при листании клавишей key от индекса from (−1, если некуда). */
export function nextOption(options: { disabled: boolean }[], from: number, key: string): number {
  const ok = (i: number) => i >= 0 && i < options.length && !options[i].disabled;
  if (key === "Home") { for (let i = 0; i < options.length; i++) if (ok(i)) return i; return -1; }
  if (key === "End") { for (let i = options.length - 1; i >= 0; i--) if (ok(i)) return i; return -1; }
  const step = key === "ArrowUp" ? -1 : 1;
  for (let i = from + step; i >= 0 && i < options.length; i += step) if (ok(i)) return i;
  return -1;
}

export function installSelectGuard(root: Document = document): () => void {
  const pending = new WeakMap<HTMLSelectElement, number>();
  const isClosedSelect = (t: EventTarget | null): t is HTMLSelectElement => t instanceof HTMLSelectElement && !t.multiple && t.size <= 1;
  const commit = (s: HTMLSelectElement) => {
    if (!pending.has(s)) return;
    const from = pending.get(s)!;
    pending.delete(s);
    if (s.selectedIndex !== from) s.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const keydown = (e: KeyboardEvent) => {
    const s = e.target;
    if (!isClosedSelect(s) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Enter") { commit(s); return; }
    if (e.key === "Escape") { if (pending.has(s)) { s.selectedIndex = pending.get(s)!; pending.delete(s); e.preventDefault(); e.stopPropagation(); } return; }
    if (!NAV.has(e.key)) return;
    e.preventDefault();
    const i = nextOption([...s.options], s.selectedIndex, e.key);
    if (i < 0 || i === s.selectedIndex) return;
    if (!pending.has(s)) pending.set(s, s.selectedIndex);
    s.selectedIndex = i;
  };
  const focusout = (e: FocusEvent) => { if (isClosedSelect(e.target)) commit(e.target); };
  root.addEventListener("keydown", keydown, true);
  root.addEventListener("focusout", focusout, true);
  return () => { root.removeEventListener("keydown", keydown, true); root.removeEventListener("focusout", focusout, true); };
}
