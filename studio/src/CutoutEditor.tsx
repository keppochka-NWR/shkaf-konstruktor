// Окно «Вырезы детали» (задача Макса 29.10.2026, shapes.ts): выбрать деталь/фасад → «Вырез» → тип, размеры, привязка от края;
// несколько вырезов на деталь. Черновик проверяется сразу (как validate: вырез не разрезает деталь, не выходит за край, мост 10 мм),
// предупреждения — петля/полкодержатель/крепёж в зоне выреза. «Сохранить» — одним изменением проекта (Ctrl+Z отменяет).
import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { shapeBaseParts, validate, type Module, type Part } from "./model";
import { basePolygon, buildCutShape, cutText, cutoutWarnings, faceAxes, EDGE_WORDS, type Cutout } from "./shapes";
import type { Project } from "./project";
import { bindCutouts, cutHost } from "./partIds";
import "./shapes.css";

const PRESETS: { id: string; label: string; make: (p: Part, ax: ReturnType<typeof faceAxes>) => Omit<Cutout, "id" | "host"> }[] = [
  { id: "plinth", label: "Под плинтус", make: (_p, ax) => ({ shape: "rect", w: ax.u === 2 ? 20 : 60, h: 80, u: 0, v: 0, fromU: "min", fromV: "min", label: "под плинтус" }) },
  { id: "pipe", label: "Под трубу Ø50", make: (p, ax) => ({ shape: "round", w: 50, h: 50, u: Math.round(Math.min(150, p.size[ax.u] / 2)), v: Math.round(p.size[ax.v] / 2), fromU: "min", fromV: "min", label: "под трубу" }) },
  { id: "socket", label: "Под розетку 80×80", make: (p, ax) => ({ shape: "rect", w: 80, h: 80, u: Math.round(Math.max(20, p.size[ax.u] / 2 - 40)), v: Math.round(Math.min(300, p.size[ax.v] / 2)), fromU: "min", fromV: "min", label: "под розетку" }) },
  { id: "sill", label: "Под подоконник", make: (p, ax) => ({ shape: "rect", w: Math.round(Math.min(100, p.size[ax.u] / 3)), h: 40, u: 0, v: 0, fromU: "max", fromV: "max", label: "под подоконник" }) },
  { id: "rect", label: "Прямоугольный", make: (p, ax) => ({ shape: "rect", w: 100, h: 100, u: Math.round(Math.max(20, p.size[ax.u] / 2 - 50)), v: Math.round(Math.max(20, p.size[ax.v] / 2 - 50)), fromU: "min", fromV: "min" }) },
  { id: "round", label: "Круглый", make: (p, ax) => ({ shape: "round", w: 60, h: 60, u: Math.round(p.size[ax.u] / 2), v: Math.round(p.size[ax.v] / 2), fromU: "min", fromV: "min" }) },
];
/** Детали, в которых можно сделать вырез: доски корпуса, ЛХДФ, фасады ЛДСП (не фурнитура, не сторонний участок). */
export function cutHosts(m: Module): Part[] {
  if (m.raw || m.kupe || m.worktop || m.corner || m.casework) return [];
  return shapeBaseParts(m).filter((p) => (p.material === "board" || p.material === "hdf") && !p.external && basePolygon(p) !== null);
}
/** Можно ли делать вырез в детали pid модуля (пункт меню «Вырез…»). */
export function cutAllowed(m: Module, pid: string): boolean { try { return cutHosts(m).some((p) => p.id === pid); } catch { return false; } }

export function Num({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const apply = () => { const n = Number(draft.replace(",", ".")); if (draft.trim() !== "" && Number.isFinite(n) && n >= min) onChange(Math.round(n * 10) / 10); else setDraft(String(value)); };
  return <label className="cut-num"><span>{label}</span><input type="number" aria-label={label} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={apply} onKeyDown={(e) => { if (e.key === "Enter") apply(); }} /></label>;
}

export function CutoutEditor({ project, mid, pid, commit, close }: { project: Project; mid: string; pid: string; commit: (p: Project) => boolean; close: () => void }) {
  const placed = project.modules.find((a) => a.id === mid);
  const m = placed?.module;
  const hosts = useMemo(() => (m ? cutHosts(m) : []), [m]);
  const [host, setHost] = useState(pid);
  // деталь выреза — по постоянной ссылке (partIds.ts): host в черновике — id детали сейчас
  const [draft, setDraft] = useState<Cutout[]>(() => (m?.cutouts ?? []).map((c) => ({ ...structuredClone(c), host: cutHost(m!, c) ?? c.host })));
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [close]);
  if (!m || !placed) return null;
  const part = hosts.find((p) => p.id === host);
  const mine = draft.filter((c) => c.host === host);
  const ax = part ? faceAxes(part) : { u: 0 as const, v: 1 as const, w: 2 as const };
  const next: Module = { ...m, cutouts: draft.length ? draft : undefined };
  const built = part ? buildCutShape(part, mine) : null;
  let errors: string[] = [], warnings: string[] = [];
  try { errors = validate(next); } catch (e) { errors = [(e as Error).message]; }
  try { warnings = errors.length ? [] : cutoutWarnings(next, shapeBaseParts(next)).filter((w) => !part || w.startsWith(`«${part.name}`)); } catch { warnings = []; }
  const set = (c: Cutout, patch: Partial<Cutout>) => setDraft((d) => d.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
  const add = (preset: (typeof PRESETS)[number]) => { if (!part) return; setDraft((d) => [...d, { id: crypto.randomUUID(), host, ...preset.make(part, ax) }]); };
  // новый вырез / смена детали — постоянная ссылка на полку/ящик (id заводятся у секции), остальные детали — по роли
  const save = () => { const n = structuredClone(project), t = n.modules.find((a) => a.id === mid)!.module; if (draft.length) { t.cutouts = draft.map(({ ref, ...c }) => { const h = ref ? cutHost(t, { host: c.host, ref }) : undefined; return ref && (h === c.host || (!h && m.cutouts?.find((x) => x.id === c.id)?.host === c.host)) ? { ...c, ref } : c; }); bindCutouts(t); } else delete t.cutouts; if (commit(n)) close(); };
  // вид детали (контур с вырезами) в масштабе окна
  const U = part ? part.size[ax.u] : 1, V = part ? part.size[ax.v] : 1, k = Math.min(240 / U, 240 / V), pad = 24;
  const path = (pl: [number, number][]) => pl.map(([u, v], i) => `${i ? "L" : "M"}${(pad + u * k).toFixed(1)},${(pad + (V - v) * k).toFixed(1)}`).join("") + "Z";
  const outline = built && !built.errors.length ? built.outline : part ? basePolygon(part)?.poly ?? [] : [];
  const holes = built && !built.errors.length ? built.holes : [];
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
    <div className="modal cut-editor" role="dialog" aria-modal="true" aria-labelledby="cut-title">
      <div className="modal-head"><div><span className="eyebrow">{m.name}</span><h2 id="cut-title">Вырезы детали</h2></div><button aria-label="Закрыть окно вырезов" onClick={close}><X /></button></div>
      <label className="hardware-field">Деталь<select aria-label="Деталь для выреза" value={host} onChange={(e) => setHost(e.target.value)}>
        {hosts.map((p) => <option key={p.id} value={p.id}>{p.name.replace(/ · фигурная \(вырез\)$/, "")} · {Math.round(p.length)}×{Math.round(p.width)}{draft.some((c) => c.host === p.id) ? " · есть вырезы" : ""}</option>)}
      </select></label>
      {!part ? <p className="field-note">В этой детали вырез не делается — выберите другую.</p> : <div className="cut-body">
        <figure className="cut-view" aria-label="Вид детали с вырезами">
          <svg width={U * k + 2 * pad} height={V * k + 2 * pad} role="img" aria-label={`Деталь ${Math.round(U)}×${Math.round(V)}`}>
            <path d={path(outline) + holes.map(path).join("")} fillRule="evenodd" className="cut-shape" />
            <text x={pad + (U * k) / 2} y={pad + V * k + 16} textAnchor="middle">{EDGE_WORDS[ax.v].lo} · {Math.round(U)} мм</text>
            <text x={pad + (U * k) / 2} y={14} textAnchor="middle">{EDGE_WORDS[ax.v].hi}</text>
            <text x={4} y={pad + (V * k) / 2} className="cut-side">{EDGE_WORDS[ax.u].lo}</text>
            <text x={pad + U * k + 4} y={pad + (V * k) / 2} className="cut-side">{EDGE_WORDS[ax.u].hi}</text>
          </svg>
          <figcaption>Вид {ax.w === 0 ? "сбоку" : ax.w === 1 ? "сверху" : "спереди"} · {Math.round(U)} × {Math.round(V)} мм</figcaption>
        </figure>
        <div className="cut-list">
          {mine.length === 0 && <p className="field-note">Вырезов нет. Выберите вид выреза ниже.</p>}
          {mine.map((c, i) => <fieldset key={c.id} className="cut-row" aria-label={`Вырез ${i + 1}`}>
            <legend>Вырез {i + 1}{c.label ? ` · ${c.label}` : ""}</legend>
            <label className="cut-num"><span>Тип</span><select aria-label={`Тип выреза ${i + 1}`} value={c.shape} onChange={(e) => set(c, { shape: e.target.value === "round" ? "round" : "rect" })}><option value="rect">Прямоугольный</option><option value="round">Круглый</option></select></label>
            <label className="cut-num"><span>Кромка по вырезу</span><select aria-label={`Кромка по вырезу ${i + 1}`} value={c.edge === undefined ? "auto" : c.edge ? "yes" : "no"} onChange={(e) => set(c, { edge: e.target.value === "auto" ? undefined : e.target.value === "yes" })}><option value="auto">По правилу (где видно)</option><option value="yes">Да</option><option value="no">Нет</option></select></label>
            {c.shape === "round" ? <><Num label={`Диаметр выреза ${i + 1}`} value={c.w} onChange={(w) => set(c, { w, h: w })} min={1} /><span /></> : <>
              <Num label={`Ширина выреза ${i + 1} (${EDGE_WORDS[ax.u].along})`} value={c.w} onChange={(w) => set(c, { w })} min={1} />
              <Num label={`Высота выреза ${i + 1} (${EDGE_WORDS[ax.v].along})`} value={c.h} onChange={(h) => set(c, { h })} min={1} /></>}
            <label className="cut-num"><span>{c.shape === "round" ? "Центр от" : "Отступ от"}</span><select aria-label={`Привязка выреза ${i + 1} по ширине`} value={c.fromU} onChange={(e) => set(c, { fromU: e.target.value === "max" ? "max" : "min" })}><option value="min">{EDGE_WORDS[ax.u].min}</option><option value="max">{EDGE_WORDS[ax.u].max}</option></select></label>
            <Num label={`Отступ выреза ${i + 1} по ширине`} value={c.u} onChange={(u) => set(c, { u })} />
            <label className="cut-num"><span>{c.shape === "round" ? "Центр от" : "Отступ от"}</span><select aria-label={`Привязка выреза ${i + 1} по высоте`} value={c.fromV} onChange={(e) => set(c, { fromV: e.target.value === "max" ? "max" : "min" })}><option value="min">{EDGE_WORDS[ax.v].min}</option><option value="max">{EDGE_WORDS[ax.v].max}</option></select></label>
            <Num label={`Отступ выреза ${i + 1} по высоте`} value={c.v} onChange={(v) => set(c, { v })} />
            <p className="field-note cut-text">{cutText(c, ax)}</p>
            <button type="button" className="text-action danger" aria-label={`Удалить вырез ${i + 1}`} onClick={() => setDraft((d) => d.filter((x) => x.id !== c.id))}><Trash2 size={14} /> Удалить</button>
          </fieldset>)}
          <div className="cut-presets" role="group" aria-label="Добавить вырез">{PRESETS.map((p) => <button key={p.id} type="button" className="outline" onClick={() => add(p)}><Plus size={14} /> {p.label}</button>)}</div>
          <p className="field-note">Прямоугольный с отступом 0 — выборка по кромке или в углу (плинтус, подоконник, труба у стены); внутри детали — отверстие (розетка). Круглый — под трубу или кабель, отступы — до центра. В раскрое деталь по габариту с пометкой «фигурная», в смете — работа «вырез / сложный выпил».</p>
        </div>
      </div>}
      {errors.length > 0 && <div className="palette-issues" role="alert" aria-label="Ошибки вырезов"><ol>{errors.map((e, i) => <li key={i}><b>{e}</b></li>)}</ol></div>}
      {warnings.length > 0 && <div className="cut-warnings" role="status" aria-label="Предупреждения вырезов">{warnings.map((w, i) => <p key={i}>{w}</p>)}</div>}
      <div className="cut-actions"><button className="primary" disabled={errors.length > 0} onClick={save}>Сохранить вырезы</button><button className="outline" onClick={close}>Отмена</button></div>
    </div>
  </div>;
}
