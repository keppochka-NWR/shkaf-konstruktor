import { cutHost } from './partIds';
import { useEffect, useState } from 'react';
import { id, parts, type Module } from './model';
import { axisLabel, faceLabel, lightHosts, newSurfaceLight, offsetLabel, panelAxes, surfaceLightParts, type SurfaceLight } from './surfaceLights';

export function LightDistance({ label, value, max, change }: { label: string; value: number; max: number; change: (v: number) => void }) {
  const [text, setText] = useState(String(value)), [error, setError] = useState('');
  useEffect(() => { setText(String(value)); }, [value]);
  const apply = () => {
    const v = Number(text.replace(',', '.'));
    if (!text.trim() || !Number.isFinite(v) || v < 0 || v > max) { setError(`Введите от 0 до ${max} мм`); return; }
    setError(''); if (v !== value) change(v);
  };
  return <label className="lp-distance">{label}, мм<input type="number" aria-label={label} min={0} max={max} value={text} onChange={e => setText(e.target.value)} onBlur={apply} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setText(String(value)); setError(''); } }} />{error && <small role="alert">{error}</small>}</label>;
}
export function SurfaceLightEditor({ module: m, onModify }: { module: Module; onModify: (f: (m: Module) => void) => void }) {
  const ps = parts(m), hosts = lightHosts(ps), result = surfaceLightParts(m, ps);
  const update = (line: SurfaceLight, patch: Partial<SurfaceLight>) => onModify(n => { n.surfaceLights = n.surfaceLights?.map(l => l.id === line.id ? { ...l, ...patch } : l); });
  return <section className="surface-lights" aria-label="Подсветка на поверхностях">
    <h3>Подсветка с любой стороны детали</h3>
    <p>Выберите дно, крышу, полку или стенку, затем сторону установки. Отступ измеряется до ближайшего края профиля. Можно добавить несколько линий.</p>
    {(m.surfaceLights ?? []).map((line, i) => {
      const host = hosts.find(p => p.id === cutHost(m, line)), axes = host ? panelAxes(host) : null;
      const across = axes?.axes.find(a => a !== line.along) ?? 2;
      const light = result.parts.find(p => p.id === 'surface-led:' + line.id);
      return <fieldset key={line.id}><legend>Линия {i + 1}{light ? ` · ${Math.round(light.length)} мм` : ' · проверьте размещение'}</legend>
        <div className="surface-light-fields">
          <label>Деталь<select aria-label={`Деталь линии ${i + 1}`} value={host?.id ?? line.host} onChange={e => { const p = hosts.find(p => p.id === e.target.value); if (p) onModify(n => { n.surfaceLights = n.surfaceLights?.map(l => l.id === line.id ? newSurfaceLight(p, line.id, n) : l); }); }}>{!host && <option value={line.host}>Деталь недоступна</option>}{hosts.map(p => <option key={p.id} value={p.id}>{p.name} · {p.size.join(' × ')} мм</option>)}</select></label>
          {axes && <><label>Сторона установки<select aria-label={`Сторона линии ${i + 1}`} value={line.face} onChange={e => update(line, { face: Number(e.target.value) as -1 | 1 })}>{([-1, 1] as const).map(sign => <option key={sign} value={sign}>{faceLabel(axes.normal, sign)}</option>)}</select></label>
          <label>Направление<select aria-label={`Направление линии ${i + 1}`} value={line.along} onChange={e => update(line, { along: Number(e.target.value) as 0 | 1 | 2, start: 20, end: 20, offset: 20 })}>{axes.axes.map(a => <option key={a} value={a}>{axisLabel(a)}</option>)}</select></label>
          <LightDistance label={offsetLabel(across)} value={line.offset} max={Math.max(0, host!.size[across] - 20)} change={offset => update(line, { offset })} />
          <LightDistance label={line.along === 0 ? 'Отступ слева' : line.along === 1 ? 'Отступ снизу' : 'Отступ спереди'} value={line.start} max={Math.max(0, host!.size[line.along] - line.end - 1)} change={start => update(line, { start })} />
          <LightDistance label={line.along === 0 ? 'Отступ справа' : line.along === 1 ? 'Отступ сверху' : 'Отступ сзади'} value={line.end} max={Math.max(0, host!.size[line.along] - line.start - 1)} change={end => update(line, { end })} /></>}
        </div><button type="button" onClick={() => onModify(n => { n.surfaceLights = n.surfaceLights?.filter(l => l.id !== line.id); })}>Убрать линию {i + 1}</button>
      </fieldset>;
    })}
    {result.warnings.map((w, i) => <p role="alert" key={i}>{w}</p>)}
    <button type="button" disabled={!hosts.length} onClick={() => { const p = hosts.find(p => p.id === 'bottom') ?? hosts[0]; onModify(n => { n.surfaceLights = [...(n.surfaceLights ?? []), newSurfaceLight(p, id(), n)]; }); }}>Добавить линию подсветки</button>
    <small>Тон и тип — из настроек модуля. Нестандартные контуры и повёрнутые детали пока не поддерживаются.</small>
  </section>;
}
