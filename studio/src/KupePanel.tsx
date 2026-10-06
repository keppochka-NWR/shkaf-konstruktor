// Панель «Двери купе»: всё на одном экране, сверху вниз как в калькуляторе купе — проём, двери, профиль, наполнение, секции, опции.
import React, { useMemo } from "react";
import type { Module } from "./model";
import { KUPE_SYSTEMS, KUPE_FILLS, KUPE_SECTIONS, KUPE_SOFT_CLOSE } from "./kupeData";
import { kupeErrors, kupeLines, kupeSystem, kupeColor, kupeDoorFill, KUPE_DEPTH, type KupeSpec } from "./kupe";
import "./kupe-panel.css";

const groups = [...new Set(KUPE_FILLS.map((f) => f.g))];
const rub = (n: number) => Math.round(n).toLocaleString("ru-RU") + " ₽";

export function KupePanel({ m, modify, openDoors, setOpenDoors }: { m: Module; modify: (update: (draft: Module) => void) => boolean; openDoors: boolean; setOpenDoors: (v: boolean) => void }) {
  const k = m.kupe!, sys = kupeSystem(k), col = kupeColor(k);
  const set = (patch: Partial<KupeSpec>) => modify((n) => { n.kupe = { ...n.kupe!, ...patch }; });
  const lines = useMemo(() => kupeLines(m), [m]);
  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const errors = useMemo(() => kupeErrors(m), [m]);
  const dw = Math.round(m.width / k.doors), allSame = k.fills.length <= 1 || k.fills.every((f) => f === k.fills[0]);
  const fillSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {groups.map((g) => <optgroup key={g} label={g}>{KUPE_FILLS.filter((f) => f.g === g).map((f) => <option key={f.n} value={f.n}>{f.n} · {f.p.toLocaleString("ru-RU")} ₽/м²</option>)}</optgroup>)}
    </select>
  );
  return (
    <div className="property-section kupe-panel">
      <h2>Двери купе</h2>
      <p className="kupe-total"><span>Двери купе под ключ</span><b>{rub(total)}</b></p>
      {errors.length > 0 && <p role="alert" className="cloud-error">{errors[0]}</p>}
      <div className="kupe-row">
        <label>Ширина проёма<input type="number" aria-label="Ширина проёма купе" key={"w" + m.width} defaultValue={m.width} onBlur={(e) => { const v = Number(e.target.value); if (v !== m.width && !modify((n) => { n.width = v; })) e.target.value = String(m.width); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>
        <label>Высота проёма<input type="number" aria-label="Высота проёма купе" key={"h" + m.height} defaultValue={m.height} onBlur={(e) => { const v = Number(e.target.value); if (v !== m.height && !modify((n) => { n.height = v; })) e.target.value = String(m.height); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>
      </div>
      <div className="kupe-field"><span>Количество дверей · полотно {dw} мм</span>
        <div className="kupe-chips" role="group" aria-label="Количество дверей купе">{[1, 2, 3, 4, 5, 6, 7].map((n) => <button key={n} type="button" aria-pressed={k.doors === n} onClick={() => set({ doors: n, fills: k.fills.slice(0, n) })}>{n}</button>)}</div>
      </div>
      <label className="hardware-field">Система профиля<select aria-label="Система профиля купе" value={k.system} onChange={(e) => { const s = KUPE_SYSTEMS.find((x) => x.system === e.target.value)!; set({ system: s.system, color: s.colors.some((c) => c.name === k.color) ? k.color : s.colors[0].name }); }}>
        {[...new Set(KUPE_SYSTEMS.map((s) => s.family))].map((f) => <optgroup key={f} label={f}>{KUPE_SYSTEMS.filter((s) => s.family === f).map((s) => <option key={s.system} value={s.system}>{s.system} · {s.limits.Hmin}–{s.limits.Hmax} мм{s.kind === "hang" ? " · подвесная" : ""}</option>)}</optgroup>)}
      </select></label>
      <div className="kupe-field"><span>Цвет профиля · {col.name}</span>
        <div className="kupe-swatches" role="group" aria-label="Цвет профиля купе">{sys.colors.map((c) => <button key={c.name} type="button" title={c.name} aria-label={c.name} aria-pressed={c.name === k.color} style={{ background: `linear-gradient(135deg, ${c.grad})` }} onClick={() => set({ color: c.name })} />)}</div>
      </div>
      <label className="hardware-field">Наполнение {allSame ? "всех дверей" : "двери 1"}{fillSelect(k.fills[0], (v) => set({ fills: allSame ? [v] : [v, ...k.fills.slice(1)] }), "Наполнение дверей купе")}</label>
      {k.doors > 1 && <details className="kupe-doors" open={!allSame}><summary>Разное наполнение по дверям</summary>
        {Array.from({ length: k.doors }, (_, i) => <label key={i} className="hardware-field">Дверь {i + 1}{fillSelect(kupeDoorFill(k, i).n, (v) => { const fills = Array.from({ length: k.doors }, (_, j) => kupeDoorFill(k, j).n); fills[i] = v; set({ fills }); }, "Наполнение двери " + (i + 1))}</label>)}
      </details>}
      <div className="kupe-field"><span>Раскладка секций</span>
        <div className="kupe-sections" role="group" aria-label="Раскладка секций купе">{KUPE_SECTIONS.map((s, i) => <button key={s.label} type="button" aria-pressed={(k.sections ?? 0) === i} title={s.label} onClick={() => set({ sections: i || undefined })}>
          <svg viewBox="0 0 20 34" aria-hidden="true"><rect x="1" y="1" width="18" height="32" rx="1.5" />{(() => { const out: React.ReactElement[] = []; let y = 1; const sum = s.rowRatios.reduce((a, b) => a + b, 0); s.rowRatios.slice(0, -1).forEach((r, j) => { y += (r / sum) * 32; out.push(<line key={"h" + j} x1="1" x2="19" y1={y} y2={y} />); }); if (s.colRatios.length > 1) out.push(<line key="v" x1="10" x2="10" y1="1" y2="33" />); return out; })()}</svg>
          <span>{s.label}</span></button>)}</div>
      </div>
      <label className="hardware-field kupe-check"><span><input type="checkbox" aria-label="Доводчики купе" checked={!!k.softClose} onChange={(e) => set({ softClose: e.target.checked || undefined })} /> Доводчики · {rub(KUPE_SOFT_CLOSE)} за дверь</span></label>
      <label className="hardware-field kupe-check"><span><input type="checkbox" aria-label="Плёнка купе" checked={!!k.film} onChange={(e) => set({ film: e.target.checked || undefined })} /> Плёнка на наполнение (армирующая / противоосколочная)</span></label>
      <button type="button" className="outline" onClick={() => setOpenDoors(!openDoors)}>{openDoors ? "Закрыть двери" : "Сдвинуть двери — посмотреть внутрь"}</button>
      <details className="kupe-lines"><summary>Из чего складывается цена</summary>
        <table><tbody>{lines.map((l) => <tr key={l.id}><td>{l.label.replace("Купе · ", "")}<small>{Math.round(l.quantity * 100) / 100} {l.unit} × {l.unitPrice.toLocaleString("ru-RU")} ₽</small></td><td>{rub(l.quantity * l.unitPrice)}</td></tr>)}</tbody></table>
        <p className="field-note">Цены и формула — как в калькуляторе дверей-купе. Глубина зоны направляющих {KUPE_DEPTH} мм.</p>
      </details>
    </div>
  );
}
