// Плашка выбранной детали (Макс 01.11; критик: на 1024 — три строки и 24 % сцены). Главное всегда на виду, остальное по ширине сцены уходит в «Ещё ▾»:
// tier «wide» — в меню на сцене до 1040 px, «mid» — до 740 px (пороги — ui-layout.css). Подписи текстом, значков нет.
import { useEffect, useMemo, useRef, useState } from "react";
import { heightVarRef } from "./sceneBars";

export type BarItem = { id: string; label: string; aria?: string; tier: "mid" | "wide"; danger?: boolean; disabled?: boolean; title?: string; run: () => void };
const cls = (i: BarItem) => `outline sb-${i.tier}${i.danger ? " danger" : ""}`;

export function SelectionBar({ title, subtitle, onParams, items, onClose }: { title: string; subtitle: string; onParams: () => void; items: BarItem[]; onClose: () => void }) {
  const [open, setOpen] = useState(false), more = useRef<HTMLSpanElement>(null);
  const barRef = useMemo(() => heightVarRef("--selbar-h"), []);
  useEffect(() => { if (!open) return; const out = (e: PointerEvent) => { if (!more.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("pointerdown", out); return () => document.removeEventListener("pointerdown", out); }, [open]);
  const inline = (i: BarItem) => <button key={i.id} className={cls(i)} aria-label={i.aria} disabled={i.disabled} title={i.title} onClick={i.run}>{i.label}</button>;
  return <div ref={barRef} className="selection-action-bar" role="group" aria-label="Действия с выбранной деталью">
    <div className="selection-context" title={subtitle}><strong>{title}</strong><span>{subtitle}</span></div>
    <button className="primary" data-testid="selection-params" onClick={onParams}>Параметры</button>
    {items.map(inline)}
    {/* без пунктов «wide» меню нужно только на узкой сцене */}
    <span ref={more} className={"sb-more" + (items.some((i) => i.tier === "wide") ? "" : " sb-more-narrow")} onKeyDown={(e) => { if (open && e.key === "Escape") { e.stopPropagation(); setOpen(false); } }}>
      <button className="outline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>Ещё ▾</button>
      {open && <div className="sb-menu" role="group" aria-label="Ещё действия с деталью">{items.map((i) => <button key={i.id} className={cls(i)} aria-label={i.aria} disabled={i.disabled} title={i.title} onClick={() => { setOpen(false); i.run(); }}>{i.label}</button>)}</div>}
    </span>
    <button className="text-action" aria-label="Снять выделение детали" onClick={onClose}>Закрыть</button>
  </div>;
}
