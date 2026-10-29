// Панель модуля «Фигурные детали» (задача Макса 29.10.2026, shapes.ts): мансарда (скос назад), радиусные полки, список вырезов.
// Всё — функциями калькулятора: переключатель/поля меняют модуль через modify (проверка validate, Ctrl+Z).
import { parts, type Module } from "./model";
import { MANSARD, RADIUS, mansardAngleDeg, mansardRearByAngle, mansardWarnings, radiusMax, cutText, faceAxes } from "./shapes";
import { withMansard, fitUnderMansard } from "./paletteBuild";
import { Num, cutHosts } from "./CutoutEditor";
import { cutHost } from "./partIds";

/** Мансарда ставится у прямого шкафа/стеллажа студии с крышей ЛДСП. */
export function mansardApplies(m: Module) {
  return !m.kitchen && !m.raw && !m.corner && !m.desk && !m.casework && !m.kupe && !m.kupeZone && !m.kupeBody && !m.worktop && !m.radius && !m.slope && !m.skew && m.topType !== "none" && !m.topGlass && !m.seatTop && !m.seatPanel && !m.sectionLayout && !m.hanging;
}
export function ShapePanel({ m, modify, openCuts }: { m: Module; modify: (u: (n: Module) => void) => boolean; openCuts: (pid: string) => void }) {
  const warn = m.mansard ? (() => { try { return mansardWarnings(m, parts(m)); } catch { return []; } })() : [];
  let hosts: ReturnType<typeof cutHosts> = [];
  try { hosts = cutHosts(m); } catch { hosts = []; }
  const name = (pid: string) => hosts.find((p) => p.id === pid)?.name.replace(/ · фигурная \(вырез\)$/, "") ?? pid;
  return <div className="shape-panel" data-testid="shape-panel">
    {m.radius && <>
      <label className="hardware-field">Скругление полок<select aria-label="Сторона скругления полок" value={m.radius.side} onChange={(e) => modify((n) => { n.radius = { ...n.radius!, side: e.target.value === "left" ? "left" : "right" }; })}><option value="right">Справа спереди (боковина слева)</option><option value="left">Слева спереди (боковина справа)</option></select></label>
      <Num label={`Радиус скругления, мм (${RADIUS.min}–${radiusMax(m)})`} value={m.radius.r} min={RADIUS.min} onChange={(r) => modify((n) => { n.radius = { ...n.radius!, r }; })} />
      <button type="button" className="text-action" onClick={() => modify((n) => { n.radius = { ...n.radius!, r: radiusMax(n) }; })}>Четверть круга (R {radiusMax(m)})</button>
      <label className="hardware-field"><span><input type="checkbox" aria-label="Крыша радиусная" checked={m.radius.top !== false} onChange={(e) => modify((n) => { const r = { ...n.radius! }; if (e.target.checked) delete r.top; else r.top = false; n.radius = r; })} /> Крыша радиусная</span></label>
      <label className="hardware-field"><span><input type="checkbox" aria-label="Дно радиусное" checked={m.radius.bottom !== false} onChange={(e) => modify((n) => { const r = { ...n.radius! }; if (e.target.checked) delete r.bottom; else r.bottom = false; n.radius = r; })} /> Дно радиусное</span></label>
      <p className="field-note">Открытый торцевой стеллаж: боковина у соседнего шкафа, задник ЛДСП, полки жёсткие на конфирматах со скруглением переднего угла. В раскрое полки — по габариту с пометкой «фигурная (радиус)», кромка по дуге — криволинейная, в смете — работа «сложный выпил» и «кромка по кривой». Цоколь — две прямые планки с отступом {RADIUS.plinthRecess} мм от дуги.</p>
    </>}
    {(mansardApplies(m) || m.mansard) && <>
      <label className="hardware-field"><span><input type="checkbox" aria-label="Мансарда (скос назад)" checked={!!m.mansard} onChange={(e) => modify((n) => {
        if (!e.target.checked) { delete n.mansard; return; }
        const rear = Math.max(MANSARD.minRear, Math.min(n.height - MANSARD.minDrop, Math.round((n.height * 0.75) / 10) * 10));
        Object.assign(n, withMansard(n, rear));
      })} /> Мансарда (скос назад)</span></label>
      {m.mansard && <>
        <Num label={`Высота сзади, мм (${MANSARD.minRear}–${m.height - MANSARD.minDrop})`} value={m.mansard.rear} min={1} onChange={(rear) => modify((n) => { n.mansard = { rear }; })} />
        <Num label={`Угол скоса, ° (до ${MANSARD.maxAngle})`} value={mansardAngleDeg(m)} min={1} onChange={(deg) => modify((n) => { n.mansard = { rear: mansardRearByAngle(n.height, n.depth, deg) }; })} />
        <p className="field-note">Высота корпуса выше — спереди ({m.height} мм), сзади — {m.mansard.rear} мм, скос {String(mansardAngleDeg(m)).replace(".", ",")}°. Крыша наклонная, боковины и перегородки — трапеции, задняя стенка — по задней высоте, фасады — по передней. Антресоль над мансардой не ставится.</p>
        {warn.length > 0 && <div className="cut-warnings" role="status" aria-label="Выше скоса">{warn.map((w, i) => <p key={i}>{w}</p>)}
          <button type="button" className="outline" onClick={() => modify((n) => { Object.assign(n, fitUnderMansard(n)); })}>Опустить полки под скос</button></div>}
      </>}
    </>}
    {hosts.length > 0 && <div className="shape-cuts">
      <p className="shape-cut-head"><b>Вырезы в деталях{m.cutouts?.length ? `: ${m.cutouts.length}` : ""}</b> — под плинтус, трубу, подоконник, розетку, кабель.</p>
      {(m.cutouts ?? []).map((c, i) => { const pid = cutHost(m, c) ?? c.host, h = hosts.find((p) => p.id === pid); return <p key={c.id} className="shape-cut-item">{i + 1}. {name(pid)}: {h ? cutText(c, faceAxes(h)) : "деталь не найдена"} <button type="button" className="text-action" aria-label={`Изменить вырез ${i + 1}`} onClick={() => openCuts(pid)}>Изменить</button></p>; })}
      {(() => { const first = m.cutouts?.[0] && cutHost(m, m.cutouts[0]); return <button type="button" className="outline" onClick={() => openCuts(first && hosts.some((p) => p.id === first) ? first : hosts.find((p) => p.id === "left")?.id ?? hosts[0].id)}>Вырезы деталей…</button>; })()}
    </div>}
  </div>;
}
