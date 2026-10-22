// Редактор подсветки (задача 14, менеджеры 22.10.2026): полоса режима «Подсветка» с переключателем «ставить: вертикаль / горизонталь / обе»
// и тоном, окно «Подсветка» (ПКМ «Подсветка › Настроить…», панель модуля): список подсвеченных деталей с ориентацией и длиной, тон и тип
// на модуль и на деталь, «убрать». Правки — только функциями src/lights.ts через onModify (как круговое меню). Цена — по ориентации
// (решение 20.10: вертикаль 3000, горизонталь 4000 ₽/пог. м), тип и тон на неё не влияют.
import { X } from "lucide-react";
import type { Module } from "./model";
import { LIGHT_TONES, LIGHT_TYPES, type LightTone, type LightType } from "./model";
import { applyToAll, clearLights, lightList, lightSummary, pricePerM, setDetailSpec, setLight, TONE_INFO, TYPE_INFO, type LightOrient } from "./lights";
import "./light-panel.css";

const rub = (v: number) => Math.round(v).toLocaleString("ru-RU") + " ₽";
const m2 = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const ORIENTS: { id: LightOrient; label: string; hint: string }[] = [
  { id: "vertical", label: "Вертикаль", hint: "Клик ставит/снимает LED в стойке: боковина, перегородка (обе грани)" },
  { id: "horizontal", label: "Горизонталь", hint: "Клик ставит/снимает LED в полке или под крышей" },
  { id: "both", label: "Обе", hint: "По детали: стойка — вертикаль, полка и крыша — горизонталь" },
];
const toneDot = (t: LightTone) => <i className="tone-dot" style={{ background: "#" + TONE_INFO[t].glow.toString(16).padStart(6, "0") }} aria-hidden="true" />;

/** Полоса режима «Подсветка» над 3D. */
export function LightModeBar(p: { module: Module; orient: LightOrient; note: string; onOrient: (o: LightOrient) => void; onTone: (t: LightTone) => void; onPanel: () => void; onDone: () => void }) {
  const s = lightSummary(p.module), tone = p.module.lightTone;
  return <div className="light-mode-bar light-mode-bar2" role="status" aria-label="Режим подсветки">
    <div className="lmb-row">
      <span><b>Подсветка</b>: кликайте детали, чтобы добавить/убрать подсветку, Esc — выйти
        <small>Стойки: {s.vertical.count} шт., {m2(s.vertical.meters)} пог. м · Полки и крыша: {s.horizontal.count} шт., {m2(s.horizontal.meters)} пог. м</small>
        {p.note && <small className="warn">{p.note}</small>}</span>
      <button onClick={p.onDone}>Готово</button>
    </div>
    <div className="lmb-row lmb-tools">
      <span className="lmb-group" role="group" aria-label="Ставить подсветку">Ставить:
        {ORIENTS.map((o) => <button key={o.id} type="button" className="lmb-chip" aria-pressed={p.orient === o.id} title={o.hint} onClick={() => p.onOrient(o.id)}>{o.label}</button>)}</span>
      <span className="lmb-group" role="group" aria-label="Тон подсветки модуля">Тон:
        {LIGHT_TONES.map((t) => <button key={t} type="button" className="lmb-chip" aria-pressed={tone === t} title={TONE_INFO[t].label + " — на все детали модуля"} onClick={() => p.onTone(t)}>{toneDot(t)}{TONE_INFO[t].label.split(" ")[0]}</button>)}</span>
      <button type="button" className="lmb-chip lmb-list" onClick={p.onPanel}>Список…</button>
    </div>
  </div>;
}

/** Окно «Подсветка» модуля. */
export function LightPanel(p: { module: Module; onModify: (u: (n: Module) => void) => void; onClose: () => void; onMode?: () => void }) {
  const m = p.module, rows = lightList(m), s = lightSummary(m);
  const vert = rows.filter((r) => r.orient === "vertical"), hor = rows.filter((r) => r.orient === "horizontal");
  const total = (list: typeof rows) => list.reduce((a, r) => a + r.length, 0) / 1000;
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) p.onClose(); }}>
    <div className="modal wide light-panel" role="dialog" aria-modal="true" aria-labelledby="light-panel-title">
      <div className="modal-head">
        <div><span className="eyebrow">МОДУЛЬ · {m.name}</span><h2 id="light-panel-title">Подсветка</h2></div>
        <button autoFocus aria-label="Закрыть окно" onClick={p.onClose}><X /></button>
      </div>
      <div className="lp-module">
        <div className="lp-field"><span>Тон света — на весь модуль</span>
          <div className="lp-chips" role="group" aria-label="Тон подсветки модуля">{LIGHT_TONES.map((t) => <button key={t} type="button" aria-pressed={m.lightTone === t} onClick={() => p.onModify((n) => applyToAll(n, { tone: t }))}>{toneDot(t)}{TONE_INFO[t].label}</button>)}</div>
          {m.lightTone === undefined && <small>Не выбран: в 3D — нейтральный, в смете и КП без описания</small>}</div>
        <div className="lp-field"><span>Тип — на весь модуль</span>
          <div className="lp-chips" role="group" aria-label="Тип подсветки модуля">{LIGHT_TYPES.map((t) => <button key={t} type="button" aria-pressed={m.lightType === t} title={TYPE_INFO[t].hint} onClick={() => p.onModify((n) => applyToAll(n, { type: t }))}>{TYPE_INFO[t].label}</button>)}</div>
          {m.lightType === undefined && <small>Не выбран: врезной профиль, в смете без описания</small>}</div>
        <p className="field-note">Цена не зависит от типа и тона: вертикали {rub(pricePerM("vertical"))} за пог. м, горизонтали {rub(pricePerM("horizontal"))} за пог. м (решение 20.10). Выбранные тип и тон идут в смету и КП описанием строки. У отдельной детали — свой выбор в списке.</p>
      </div>
      {rows.length ? <table className="lp-table" aria-label="Подсвеченные детали">
        <thead><tr><th>Секция</th><th>Деталь</th><th>Ориентация</th><th>Длина, мм</th><th>Тон</th><th>Тип</th><th /></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.key} data-key={r.key}>
          <td>{r.section}</td><td>{r.label}</td>
          <td><span className={"lp-orient " + r.orient}>{r.orient === "vertical" ? "вертикаль" : "горизонталь"}</span></td>
          <td className="num">{r.length}</td>
          <td><select aria-label={`Тон: секция ${r.section}, ${r.label}`} value={r.ownTone ? String(r.tone) : ""} onChange={(e) => p.onModify((n) => setDetailSpec(n, r.key, { tone: e.target.value ? (Number(e.target.value) as LightTone) : null }))}>
            <option value="">как у модуля ({TONE_INFO[m.lightTone ?? 4000].short})</option>
            {LIGHT_TONES.map((t) => <option key={t} value={t}>{TONE_INFO[t].label}</option>)}</select></td>
          <td><select aria-label={`Тип: секция ${r.section}, ${r.label}`} value={r.ownType ? r.type : ""} onChange={(e) => p.onModify((n) => setDetailSpec(n, r.key, { type: e.target.value ? (e.target.value as LightType) : null }))}>
            <option value="">как у модуля ({TYPE_INFO[m.lightType ?? "inset"].short})</option>
            {LIGHT_TYPES.map((t) => <option key={t} value={t}>{TYPE_INFO[t].label}</option>)}</select></td>
          <td><button type="button" className="lp-remove" aria-label={`Убрать: секция ${r.section}, ${r.label}`} onClick={() => p.onModify((n) => setLight(n, r.key, false))}>Убрать</button></td>
        </tr>)}</tbody>
      </table> : <p className="lp-empty">Подсветки нет. Нажмите «Режим выбора деталей» и кликните стойки, полки или крышу.</p>}
      <div className="lp-foot">
        <span>Вертикали: {vert.length} шт., {m2(total(vert))} пог. м · {rub(total(vert) * pricePerM("vertical"))}<br />
          Горизонтали: {hor.length} шт., {m2(total(hor))} пог. м · {rub(total(hor) * pricePerM("horizontal"))}{s.horizontal.count ? ` (${s.horizontal.where})` : ""}</span>
        <span className="lp-actions">
          {p.onMode && <button type="button" onClick={p.onMode}>Режим выбора деталей</button>}
          <button type="button" className="danger" disabled={!rows.length} onClick={() => p.onModify((n) => clearLights(n))}>Убрать всю подсветку</button>
        </span>
      </div>
    </div>
  </div>;
}
