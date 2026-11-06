import { useEffect, useState } from 'react';
import type { Module } from './model';
import {METAL_PROFILES} from './metalProfiles';
import { changeFrameKind, FRAME_COLORS, FRAME_LABEL, metalFrameLength, type MetalFrameKind } from './metalFrame';

function Field({ label, value, apply }: { label: string; value: number; apply: (v: number) => unknown }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const save = () => { if (text.trim() && Number(text) !== value) apply(Number(text)); setText(String(value)); };
  return <label className="hardware-field">{label}<input aria-label={label} type="number" value={text} onChange={e => setText(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>;
}
export function MetalFramePanel({ m, modify, position, move, rotation, rotate }: {
  m: Module; modify: (update: (n: Module) => void) => unknown; position: { x: number; y: number; z: number };
  move: (axis: 'x' | 'y' | 'z', v: number) => unknown; rotation: number; rotate: (v: number) => unknown;
}) {
  const f = m.metalFrame!;
  const stock=METAL_PROFILES.find(p=>p.width===f.tubeWidth&&p.depth===f.tubeDepth&&p.wall===f.tubeWall);
  return <section className="property-section" data-testid="metal-frame-panel">
    <h2>Металлокаркас</h2>
    <label className="hardware-field">Вариант каркаса<select aria-label="Вариант каркаса" value={f.kind} onChange={e => modify(n => changeFrameKind(n, e.target.value as MetalFrameKind))}>{Object.entries(FRAME_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></label>
    <p className="essential-note">Размеры по наружным граням. Столешница добавляется отдельно, её низ ставится на высоту каркаса.</p>
    <Field label="Ширина каркаса, мм" value={m.width} apply={v => modify(n => { n.width = v; })} />
    <Field label="Высота каркаса, мм" value={m.height} apply={v => modify(n => { n.height = v; })} />
    {f.kind === 'table' && <Field label="Глубина каркаса, мм" value={m.depth} apply={v => modify(n => { n.depth = v; })} />}
    <label className="hardware-field">Профиль из наличия<select aria-label="Профиль из наличия" value={stock?.id??''} onChange={e=>{const p=METAL_PROFILES.find(p=>p.id===e.target.value);if(p)modify(n=>{Object.assign(n.metalFrame!,{tubeWidth:p.width,tubeDepth:p.depth,tubeWall:p.wall});if(n.metalFrame!.kind!=='table')n.depth=p.depth;});}}><option value="" disabled>{f.tubeWall===undefined?'Выберите профиль и толщину стенки':'Индивидуальное сечение'}</option>{METAL_PROFILES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
    <Field label="Сечение трубы - сторона А, мм" value={f.tubeWidth} apply={v => modify(n => { n.metalFrame!.tubeWidth = v; })} />
    <Field label="Сечение трубы - сторона Б, мм" value={f.tubeDepth} apply={v => modify(n => { n.metalFrame!.tubeDepth = v; if (n.metalFrame!.kind !== 'table') n.depth = v; })} />
    {f.tubeWall!==undefined&&<p className="essential-note">Стенка трубы: {String(f.tubeWall).replace('.',',')} мм.</p>}
    {f.kind === 'table' && <Field label="Верхние поперечины, шт" value={f.crossbars} apply={v => modify(n => { n.metalFrame!.crossbars = v; })} />}
    <label className="hardware-field">Цвет каркаса<select aria-label="Цвет каркаса" value={f.color} onChange={e => modify(n => { n.metalFrame!.color = e.target.value; })}>{FRAME_COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}{!FRAME_COLORS.some(c => c.value === f.color) && <option value={f.color}>{f.color}</option>}</select></label>
    <p>Длина профиля по модели: {metalFrameLength(m).toFixed(2).replace('.', ',')} м.</p>
    <details><summary>Положение</summary>
      {(['x', 'z', 'y'] as const).map(axis => <Field key={axis} label={{ x: 'От левой стены, мм', z: 'От задней стены, мм', y: 'От пола, мм' }[axis]} value={position[axis]} apply={v => move(axis, v)} />)}
      <label className="hardware-field">Поворот<select aria-label="Поворот каркаса" value={rotation} onChange={e => rotate(Number(e.target.value))}>{[0, 90, 180, 270].map(v => <option key={v} value={v}>{v}°</option>)}</select></label>
    </details>
    <p className="field-note">{f.tubeWall===undefined?'Выберите толщину стенки через список профилей. ':''}Крепление столешницы и допустимую нагрузку согласовать с изготовителем. Цена каркаса указывается отдельно в смете.</p>
  </section>;
}
