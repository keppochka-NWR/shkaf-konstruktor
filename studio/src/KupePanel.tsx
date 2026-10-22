import {SettingsSection} from './SettingsSection';
// Панель «Двери купе»: всё на одном экране, сверху вниз как в калькуляторе купе — проём, двери, профиль, наполнение, секции, опции.
import React, { useContext, useEffect, useMemo, useState } from "react";
import { ManagerMode, decorLabel, decorTitle, kupeProfileCaption } from "./clientLabels";
import type { Module } from "./model";
import { KUPE_SYSTEMS, KUPE_FILLS, KUPE_SECTIONS, KUPE_SOFT_CLOSE } from "./kupeData";
import { kupeErrors, kupeLines, kupeTotal, kupeSystem, kupeColor, kupeDoorFill, kupeProfileStyle, kupeProfileExact, kupeLeaf, kupeSections, kupeSectionCount, kupeSectionFill, kupeFillLook, isLdspFill, withSectionFill, kupeGrad, KUPE_DEPTH, KUPE_PROFILE_PREVIEW, KUPE_PROFILE_WIDTH, type KupeSpec } from "./kupe";
import { kupeLdspPerM2, MARKUP_DEFAULT } from "./pricing";
import "./kupe-panel.css";

const groups = [...new Set(KUPE_FILLS.map((f) => f.g))];
const rub = (n: number) => Math.round(n).toLocaleString("ru-RU") + " ₽";

/** Цвет секции в схеме двери — как в 3D (kupeFillLook), ЛДСП — бежевый. */
const swatch = (n: string) => { const f = KUPE_FILLS.find((x) => x.n === n) ?? KUPE_FILLS[0]; return isLdspFill(f) ? "#d9cbb2" : "#" + kupeFillLook(f).color.toString(16).padStart(6, "0"); };

export function KupePanel({ m, modify, openDoors, setOpenDoors, selectedPid }: { m: Module; modify: (update: (draft: Module) => void) => boolean; openDoors: boolean; setOpenDoors: (v: boolean) => void; selectedPid?: string }) {
  const k = m.kupe!, sys = kupeSystem(k), col = kupeColor(k);
  const manager = useContext(ManagerMode);
  const set = (patch: Partial<KupeSpec>) => modify((n) => { n.kupe = { ...n.kupe!, ...patch }; });
  const setK = (next: KupeSpec) => modify((n) => { n.kupe = next; });
  // Выбранная секция полотна (задание 23, как редактор секции калькулятора купе): клик по схеме двери или по вставке в 3D.
  const sec = kupeSections(k), nSec = kupeSectionCount(k), cols = sec.colRatios.length;
  const [pick, setPick] = useState<{ door: number; sect: number } | null>(null);
  useEffect(() => { const mt = /^kupe:(\d+):fill:(\d+):(\d+)$/.exec(selectedPid ?? ""); if (mt) setPick({ door: Number(mt[1]), sect: Number(mt[2]) * cols + Number(mt[3]) }); }, [selectedPid, cols]);
  const active = pick && pick.door < k.doors && pick.sect < nSec ? pick : null;
  const leaf = kupeLeaf(m);
  // ЛДСП Lamarty — по прайсу листа × коэффициент сметы по умолчанию (в смете проекта — коэффициент проекта)
  const lines = useMemo(() => kupeLines(m, (n) => kupeLdspPerM2(n, MARKUP_DEFAULT)), [m]);
  const total = kupeTotal(lines); // K5: то же округление, что у графы «Двери купе» сметы
  const errors = useMemo(() => kupeErrors(m), [m]);
  const dw = Math.round(leaf.width), allSame = k.fills.length <= 1 || k.fills.every((f) => f === k.fills[0]);
  // смена полотна у всех дверей сбрасывает полотна секций; раскладка секций — тоже (номера секций другие)
  const { sectionFills: _sf, ...noSect } = k;
  const fillSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {groups.map((g) => <optgroup key={g} label={g}>{KUPE_FILLS.filter((f) => f.g === g).map((f) => <option key={f.n} value={f.n} title={decorTitle(f.n)}>{decorLabel(f.n)}</option>)}</optgroup>)}
    </select>
  );
  return (
    <div className="property-section kupe-panel">
      <h2>Двери купе</h2>
      <p className="kupe-total"><span>Двери купе под ключ</span><b>{rub(total)}</b></p>
      {errors.length > 0 && <p role="alert" className="cloud-error">{errors[0]}</p>}
      <SettingsSection title="Габариты и количество дверей"><div className="kupe-row">
        <label>Ширина проёма<input type="number" aria-label="Ширина проёма купе" key={"w" + m.width} defaultValue={m.width} onBlur={(e) => { const v = Number(e.target.value); if (v !== m.width && !modify((n) => { n.width = v; })) e.target.value = String(m.width); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>
        <label>Высота проёма<input type="number" aria-label="Высота проёма купе" key={"h" + m.height} defaultValue={m.height} onBlur={(e) => { const v = Number(e.target.value); if (v !== m.height && !modify((n) => { n.height = v; })) e.target.value = String(m.height); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>
      </div>
      <p className="field-note kupe-mount">Установка дверей: <b>{k.mount === "inside" ? "внутри шкафа" : "отдельно (ниша или перед корпусами)"}</b>{k.mount === "inside" ? " — между боковинами, под крышей; нижняя направляющая на полу" : ""}</p>
      <div className="kupe-field"><span>Количество дверей · <b data-kupe-leaf>полотно {dw} мм</b>{k.doors > 1 ? ` (нахлёст ${Math.round(leaf.overlap)} мм)` : ""}</span>
        <div className="kupe-chips" role="group" aria-label="Количество дверей купе">{[1, 2, 3, 4, 5, 6, 7].map((n) => <button key={n} type="button" aria-pressed={k.doors === n} onClick={() => set({ doors: n, fills: k.fills.slice(0, n), ...(k.sectionFills ? { sectionFills: k.sectionFills.slice(0, n) } : {}) })}>{n}</button>)}</div>
      </div>
</SettingsSection><SettingsSection title="Профиль и цвет">
      <label className="hardware-field">Система профиля<select aria-label="Система профиля купе" value={k.system} onChange={(e) => { const s = KUPE_SYSTEMS.find((x) => x.system === e.target.value)!; set({ system: s.system, color: s.colors.some((c) => c.name === k.color) ? k.color : s.colors[0].name }); }}>
        {[...new Set(KUPE_SYSTEMS.map((s) => s.family))].map((f) => <optgroup key={f} label={f}>{KUPE_SYSTEMS.filter((s) => s.family === f).map((s) => <option key={s.system} value={s.system}>{s.system} · {s.limits.Hmin}–{s.limits.Hmax} мм{s.kind === "hang" ? " · подвесная" : ""}</option>)}</optgroup>)}
      </select></label>
      <figure className="kupe-profile-preview">
        <img src={import.meta.env.BASE_URL + KUPE_PROFILE_PREVIEW[kupeProfileStyle(sys)]} alt={"Профиль-ручка " + sys.profile} loading="lazy" />
        <figcaption>{kupeProfileCaption(sys.profile, KUPE_PROFILE_WIDTH[kupeProfileStyle(sys)] || sys.dims.frameSide, manager)}{manager && <small>{kupeProfileExact(sys) ? "Сечение по заводскому чертежу Aristo" : "Показан профилем SLIM LINE: в каталоге Aristo 2026 этого профиля нет"}</small>}</figcaption>
      </figure>
      <div className="kupe-field"><span>Цвет профиля · {col.name}</span>
        <div className="kupe-swatches" role="group" aria-label="Цвет профиля купе">{sys.colors.map((c) => <button key={c.name} type="button" title={c.name} aria-label={c.name} aria-pressed={c.name === k.color} style={{ background: `linear-gradient(135deg, ${kupeGrad(c)})` }} onClick={() => set({ color: c.name })} />)}</div>
      </div>
</SettingsSection><SettingsSection title="Наполнение дверей">
      <label className="hardware-field">Наполнение {allSame ? "всех дверей" : "двери 1"}{fillSelect(k.fills[0], (v) => setK({ ...noSect, fills: allSame ? [v] : [v, ...k.fills.slice(1)] }), "Наполнение дверей купе")}</label>
      {k.doors > 1 && <details className="kupe-doors" open={!allSame}><summary>Разное наполнение по дверям</summary>
        {Array.from({ length: k.doors }, (_, i) => <label key={i} className="hardware-field">Дверь {i + 1}{fillSelect(kupeDoorFill(k, i).n, (v) => { const fills = Array.from({ length: k.doors }, (_, j) => kupeDoorFill(k, j).n); fills[i] = v; set({ fills }); }, "Наполнение двери " + (i + 1))}</label>)}
      </details>}
      <div className="kupe-field"><span>Полотно по секциям — нажмите секцию двери (или вставку в 3D)</span>
        <div className="kupe-leaves" role="group" aria-label="Секции дверей купе">{Array.from({ length: k.doors }, (_, d) => {
          const sumR = sec.rowRatios.reduce((a, b) => a + b, 0), sumC = sec.colRatios.reduce((a, b) => a + b, 0), W = 30, H = 58;
          let y = 2;
          return <svg key={d} viewBox={`0 0 ${W + 4} ${H + 9}`} className="kupe-leaf" aria-label={"Дверь " + (d + 1)}><rect x="1" y="1" width={W + 2} height={H + 2} rx="1.5" className="kupe-leaf-frame" style={{ fill: col.grad.split(",")[0] }} />
            {sec.rowRatios.map((r, ri) => { const h = r / sumR * H, y0 = y; y += h; let x = 2; return sec.colRatios.map((c, ci) => { const w = c / sumC * W, x0 = x, si = ri * cols + ci, f = kupeSectionFill(k, d, si); x += w;
              const on = active?.door === d && active.sect === si;
              return <rect key={ri + "-" + ci} x={x0 + 0.6} y={y0 + 0.6} width={w - 1.2} height={h - 1.2} rx="0.6" role="button" tabIndex={0} aria-pressed={on} aria-label={`Дверь ${d + 1}, секция ${si + 1}: ${f.n}`} className={"kupe-sect" + (on ? " on" : "")} style={{ fill: swatch(f.n) }}
                onClick={() => setPick({ door: d, sect: si })} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPick({ door: d, sect: si }); } }}><title>{`Дверь ${d + 1} · секция ${si + 1} · ${f.n}`}</title></rect>; }); })}
            <text x={(W + 4) / 2} y={H + 8} textAnchor="middle" className="kupe-leaf-n">{d + 1}</text></svg>;
        })}</div>
        {active ? <div className="kupe-sect-editor">
          <label className="hardware-field">Дверь {active.door + 1} · секция {active.sect + 1}{fillSelect(kupeSectionFill(k, active.door, active.sect).n, (v) => setK(withSectionFill(k, active.door, active.sect, v)), "Полотно секции")}</label>
          <div className="kupe-sect-actions">
            <button type="button" className="outline" onClick={() => { const f = kupeSectionFill(k, active.door, active.sect).n, fills = Array.from({ length: k.doors }, (_, j) => kupeDoorFill(k, j).n); fills[active.door] = f; const rows = Array.from({ length: k.doors }, (_, j) => j === active.door ? [] : k.sectionFills?.[j] ?? []); setK({ ...noSect, fills, ...(rows.some((r) => r.length) ? { sectionFills: rows } : {}) }); }}>Ко всем секциям двери</button>
            <button type="button" className="outline" onClick={() => { const base = kupeDoorFill(k, active.door).n, row = k.sectionFills?.[active.door] ?? []; setK({ ...noSect, fills: [base], ...(row.some(Boolean) ? { sectionFills: Array.from({ length: k.doors }, () => row.slice()) } : {}) }); }}>Все двери — как эта</button>
          </div>
        </div> : <p className="field-note">Секция не выбрана: полотно меняется для всей двери выше.</p>}
      </div>
      <div className="kupe-field"><span>Раскладка секций</span>
        <div className="kupe-sections" role="group" aria-label="Раскладка секций купе">{KUPE_SECTIONS.map((s, i) => <button key={s.label} type="button" aria-pressed={(k.sections ?? 0) === i} title={s.label} onClick={() => { const { sections: _s, ...rest } = noSect; setK(i ? { ...rest, sections: i } : rest); }}>
          <svg viewBox="0 0 20 34" aria-hidden="true"><rect x="1" y="1" width="18" height="32" rx="1.5" />{(() => { const out: React.ReactElement[] = []; let y = 1; const sum = s.rowRatios.reduce((a, b) => a + b, 0); s.rowRatios.slice(0, -1).forEach((r, j) => { y += (r / sum) * 32; out.push(<line key={"h" + j} x1="1" x2="19" y1={y} y2={y} />); }); if (s.colRatios.length > 1) out.push(<line key="v" x1="10" x2="10" y1="1" y2="33" />); return out; })()}</svg>
          <span>{s.label}</span></button>)}</div>
      </div>
</SettingsSection><SettingsSection title="Комплектация и открывание">
      <label className="hardware-field kupe-check"><span><input type="checkbox" aria-label="Доводчики купе" checked={!!k.softClose} onChange={(e) => set({ softClose: e.target.checked || undefined })} /> Доводчики <small className="field-note" data-testid="kupe-soft-price">+{KUPE_SOFT_CLOSE.toLocaleString("ru-RU")} ₽ за дверь</small></span></label>
      <label className="hardware-field kupe-check"><span><input type="checkbox" aria-label="Плёнка купе" checked={!!k.film} onChange={(e) => set({ film: e.target.checked || undefined })} /> Плёнка на наполнение (армирующая / противоосколочная)</span></label>
      <button type="button" className="outline" onClick={() => setOpenDoors(!openDoors)}>{openDoors ? "Закрыть двери" : "Сдвинуть двери — посмотреть внутрь"}</button>

    </SettingsSection></div>
  );
}
