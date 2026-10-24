// Панель «Наполнение › Перегородки секции» (решение Макса 23.10.2026): у перегородки слева/справа от выбранной секции —
// «Во всю высоту» или «Частичная: от … до …» (мм от пола) либо «от полки … до полки …». Команды — src/partialDivider.ts.
import { useEffect, useState } from "react";
import type { Module } from "./model";
import { announceDividerNotes, dividerBounds, dividerInfo, setDividerByShelves, setPartialDivider } from "./partialDivider";

function Mm({ label, value, change }: { label: string; value: number; change: (v: number) => boolean }) {
  const [text, setText] = useState(String(Math.round(value)));
  useEffect(() => setText(String(Math.round(value))), [value]);
  return <label className="hardware-field">{label}<input aria-label={label} type="number" value={text} onChange={(e) => setText(e.target.value)}
    onBlur={() => { if (text === "" || (Number(text) !== Math.round(value) && !change(Number(text)))) setText(String(Math.round(value))); }}
    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>;
}

/** Одна перегородка — слева от секции i (i ≥ 1). */
function DividerRow({ module: m, i, edit }: { module: Module; i: number; edit: (f: (draft: Module) => void) => boolean }) {
  const info = dividerInfo(m, i);
  if (!info) return null;
  const sid = m.sections[i].id, label = `Перегородка между секциями ${i} и ${i + 1}`;
  const bounds = dividerBounds(m, i), near = (y: number) => bounds.find((b) => Math.abs(b.y - y) < 9)?.key ?? "";
  const lowKey = info.partial ? near(info.from === info.bottom ? info.from : info.from - 8) : "floor", highKey = info.partial ? near(info.to === info.top ? info.to : info.to + 8) : "roof";
  /** Применить и, если студия сама сменила створки у перегородки (две → одна), — сообщить. */
  const apply = (f: (draft: Module) => string[]) => { let notes: string[] = []; const ok = edit((n) => { notes = f(n); }); if (ok) announceDividerNotes(notes); return ok; };
  const byShelves = (lo: string, hi: string) => apply((n) => { const bs = dividerBounds(n, i), a = bs.find((b) => b.key === lo), z = bs.find((b) => b.key === hi); return a && z ? setDividerByShelves(n, sid, a.bound, z.bound) : []; });
  return <div className="property-section" data-testid={`divider-${i}`} data-stages="filling bodies">
    <h3>{label}</h3>
    <div className="quick-actions" role="group" aria-label={label + ": высота"}>
      <button type="button" className={info.partial ? "outline" : "primary"} aria-pressed={!info.partial} onClick={() => edit((n) => { setPartialDivider(n, sid, null); })}>Во всю высоту</button>
      <button type="button" className={info.partial ? "primary" : "outline"} aria-pressed={info.partial} onClick={() => { if (!info.partial) apply((n) => setPartialDivider(n, sid, { from: info.bottom + Math.round((info.top - info.bottom) * 0.3), to: info.bottom + Math.round((info.top - info.bottom) * 0.75) })); }}>Частичная</button>
    </div>
    {info.partial && <>
      <div className="partial-divider-range">
        <Mm label="От, мм от пола" value={info.from} change={(v) => apply((n) => setPartialDivider(n, sid, { from: v, to: info.to }))} />
        <Mm label="До, мм от пола" value={info.to} change={(v) => apply((n) => setPartialDivider(n, sid, { from: info.from, to: v }))} />
      </div>
      <label className="hardware-field">От полки<select aria-label="Перегородка от полки" value={lowKey} onChange={(e) => byShelves(e.target.value, highKey || "roof")}>
        {!lowKey && <option value="">по размеру · {Math.round(info.from)} мм</option>}
        {bounds.filter((b) => b.key !== "roof").map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
      </select></label>
      <label className="hardware-field">До полки<select aria-label="Перегородка до полки" value={highKey} onChange={(e) => byShelves(lowKey || "floor", e.target.value)}>
        {!highKey && <option value="">по размеру · {Math.round(info.to)} мм</option>}
        {bounds.filter((b) => b.key !== "floor").map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
      </select></label>
      <p className="field-note">Перегородка стоит между горизонталями: ниже и выше неё — сквозная полка во всю ширину двух секций (или дно / крыша). Полки над и под перегородкой — тоже во всю ширину.</p>
    </>}
  </div>;
}

export default function PartialDividerPanel({ module: m, sectionIndex: i, edit }: { module: Module; sectionIndex: number; edit: (f: (draft: Module) => void) => boolean }) {
  const rows = [i, i + 1].filter((k) => k >= 1 && k < m.sections.length);
  if (!rows.length) return <p className="field-note">В корпусе одна секция: перегородки нет. Разделите секцию, чтобы поставить перегородку.</p>;
  return <>{rows.map((k) => <DividerRow key={m.sections[k].id} module={m} i={k} edit={edit} />)}</>;
}
