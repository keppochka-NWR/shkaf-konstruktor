// «Шкафы из базы» (09.10.2026): шкафы, тумбы, столы, прихожие из базы заказов цеха, перенесённые из Базиса «сырыми» модулями
// (scripts/wardrobe/import.ts). Индекс public/local-projects/wardrobes.json есть только локально — на Pages блок не показывается.
import { useEffect, useState } from "react";
import { Library } from "lucide-react";

type Entry = { id: string; title: string; modules: number; panels: number; error?: string };

export function WardrobeBase() {
  const [list, setList] = useState<Entry[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("./local-projects/wardrobes.json", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((x: unknown) => {
        if (!Array.isArray(x)) return;
        setList(x.filter((e): e is Entry => !!e && typeof e.id === "string" && /^[0-9]{1,6}$/.test(e.id) && typeof e.title === "string" && !e.error)
          .map((e) => ({ id: e.id, title: String(e.title).slice(0, 80), modules: Number(e.modules) || 0, panels: Number(e.panels) || 0 })));
      })
      .catch(() => { /* нет индекса (Pages) или нет сети — блок не показываем */ });
    return () => ctrl.abort();
  }, []);
  if (!list || !list.length) return null;
  const f = q.trim().toLowerCase();
  const shown = f ? list.filter((b) => b.title.toLowerCase().includes(f)) : list;
  return <details className="kp-more kp-base wardrobe-base"><summary><Library size={15} />Шкафы из базы · {list.length}</summary>
    <p className="field-note">Шкафы, тумбы, столы и прихожие из Базиса цеха — детали как в Базисе. Исходный файл не меняется.</p>
    <input type="search" aria-label="Поиск шкафа из базы" placeholder="Поиск по заказу или файлу" value={q} onChange={(e) => setQ(e.target.value)} />
    <ul style={{ maxHeight: 360, overflowY: "auto" }}>{shown.map((b) => <li key={b.id}><a href={`?project=wardrobe-${b.id}&fresh=1`} title={`${b.modules} мод. · ${b.panels} дет.`}>{b.title}</a></li>)}</ul>
  </details>;
}
