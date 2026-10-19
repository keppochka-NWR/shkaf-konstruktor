// Нижняя навигация по проекту (решение Макса 06.10.2026, по мотивам Самопила): вкладки внизу экрана,
// панель выезжает над ними и не закрывает 3D. Цена — материалы и фурнитура отдельно; смена фурнитуры сразу меняет итог.
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Calculator, FileText, Layers, Wrench } from "lucide-react";
import type { Project } from "./project";
import {estimate} from "./pricing";
import { missingPriceLabel } from "./clientLabels";
import { HANDLES, handleById } from "./handles";
import { HINGE_BRANDS, SLIDE_SYSTEMS, type HingeBrand } from "./hardware";
import { EDGE_CHOICES, type EdgeThickness } from "./model";
import { hardwareChoice, setAllEdges, setAllFastening, setAllHandles, setAllHinges, setAllOpening, setAllSlides } from "./hardwareSwap";

/** Ориентир цены системы направляющих на 450 мм, чтобы клиент видел разницу прямо в списке. */

import { details, nest, quoteBreakdown, splitRows } from "./exports";
import { pendingTotalLabel } from "./pendingPrices";
import { count, DETAILS, SHEETS } from "./ru";
import "./project-dock.css";

export type DockTab = "project" | "estimate" | "hardware" | "details" | "docs";
export type OutputTab = "sheets" | "quote" | "estimate" | "labels" | "drawings" | "specification" | "placement" | "client-spec";
const rub = (n: number) => n.toLocaleString("ru-RU") + " ₽";
const TABS: { id: DockTab; label: string; icon: typeof Box }[] = [
  { id: "project", label: "Проект", icon: Box },
  { id: "estimate", label: "Стоимость", icon: Calculator },
  { id: "hardware", label: "Фурнитура", icon: Wrench },
  { id: "details", label: "Детали", icon: Layers },
  { id: "docs", label: "Документы", icon: FileText },
];
function loadTab(): DockTab { try { const t = localStorage.getItem("studio-dock"); return TABS.some((x) => x.id === t) ? (t as DockTab) : "project"; } catch { return "project"; } }

export function ProjectDock({ project, commit, openOutput, openParts, warnings, onWarnings, onLayout }: {
  project: Project;
  /** Панель открылась или закрылась: сцене нужно заново вписать мебель в уменьшенный вид. */
  onLayout?: () => void;
  commit: (p: Project) => boolean;
  openOutput: (tab: OutputTab) => void;
  openParts: () => void;
  warnings: number;
  onWarnings: () => void;
}) {
  const [tab, setTabState] = useState<DockTab>(loadTab);
  const setTab = (t: DockTab) => { const next = t === tab ? "project" : t; setTabState(next); try { localStorage.setItem("studio-dock", next); } catch { /* браузер без хранилища */ } };
  const open = tab !== "project";
  const mounted = useRef(false);
  // Вписать мебель после того, как холст сцены успел поменять размер (ResizeObserver срабатывает кадром позже).
  useEffect(() => { if (!mounted.current) { mounted.current = true; return; } const t = setTimeout(() => onLayout?.(), 120); return () => clearTimeout(t); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // Смета считает раскрой: откладываем на 300 мс после правки, чтобы перетаскивание не тормозило.
  const [calc, setCalc] = useState<{ project: Project; e: ReturnType<typeof estimate>; parts: number; ldsp: number; hdf: number } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      const sheets = nest(project);
      setCalc({ project, e: estimate(project, sheets), parts: details(project).length, ldsp: sheets.filter((s) => s.material !== "hdf").length, hdf: sheets.filter((s) => s.material === "hdf").length });
    }, 300);
    return () => clearTimeout(timer);
  }, [project]);
  const fresh = calc?.project === project ? calc : null, e = fresh?.e;
  const [note, setNote] = useState("");
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 6000); return () => clearTimeout(t); }, [note]);

  function swap(make: () => Project, what: string) {
    let next: Project;
    try { next = make(); } catch (err) { setNote(err instanceof Error ? err.message : "Не удалось заменить фурнитуру."); return; }
    const before = estimate(project).retail, after = estimate(next).retail;
    if (!commit(next)) { setNote("Замена не прошла проверку проекта. Подробности в сообщении сверху."); return; }
    if (before === null || after === null) { setNote(what + ": заменено."); return; }
    const d = after - before;
    setNote(what + (d === 0 ? ": цена не изменилась." : `: цена ${d > 0 ? "выросла на " + rub(d) : "снизилась на " + rub(-d)}.`));
  }

  const total = e?.retail ?? null;
  // Материалы и фурнитура отдельно (решение 06.10): та же разбивка, что печатается в КП при цене по смете.
  const split = e && total !== null ? quoteBreakdown(String(total), e) : null;
  const choice = useMemo(() => hardwareChoice(project), [project]);

  const panel = tab === "project" ? null : tab === "estimate" ? (
    <div className="dock-body dock-estimate">
      <div className="dock-sum total"><span>Итоговая стоимость</span><b>{!e?'Считаем…':total===null?'Требует уточнения':rub(total)}</b><small>{e?.missing.length?'Не все позиции оценены':e?.pending.length?pendingTotalLabel(e.pending.length):'Предварительно, без доставки и монтажа'}</small></div>
      {split && <div className={"dock-cost-split" + (split.kupe ? " has-kupe" : "")} aria-label="Разбивка стоимости">{splitRows(split).map(([k, v], i) => <div key={k} className={"dock-sum " + ["material", "hardware", "kupe"][i]}><span>{k}</span><b>{rub(v)}</b></div>)}</div>}
      <div className="dock-actions"><button className="outline" onClick={()=>openOutput('estimate')}>Стоимость проекта</button><button className="outline" onClick={()=>openOutput('quote')}>КП</button><button className="text-action" onClick={()=>setTab('hardware')}>Поменять фурнитуру</button></div>
    </div>
  ) : tab === "hardware" ? (
    <div className="dock-body dock-hardware">
      <div className="dock-swaps">
        {choice.handles.length > 0 && <label>Ручки<select aria-label="Ручки во всём проекте" value={choice.handles.length === 1 ? choice.handles[0] : ""} onChange={(ev) => ev.target.value && swap(() => setAllHandles(project, ev.target.value), "Ручки " + handleById(ev.target.value).label)}>
          {choice.handles.length > 1 && <option value="">Разные ({choice.handles.length})</option>}
          <optgroup label="Склад цеха">{HANDLES.filter((h) => h.vendor === "workshop").map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}</optgroup>
          <optgroup label="Лемана Про">{HANDLES.filter((h) => h.vendor === "lemana").map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}</optgroup>
        </select></label>}
        {choice.hasDoors && <label>Открывание дверей<select aria-label="Открывание дверей во всём проекте" value={choice.opening.length === 1 ? choice.opening[0] : ""} onChange={(ev) => ev.target.value && swap(() => setAllOpening(project, ev.target.value as "handle" | "push"), "Открывание")}>
          {choice.opening.length > 1 && <option value="">Разное</option>}
          <option value="handle">С ручками, петли с доводчиком</option><option value="push">Без ручек, push-to-open</option>
        </select></label>}
        {choice.hasDoors && <label>Петли<select aria-label="Петли во всём проекте" value={choice.hinges.length === 1 ? choice.hinges[0] : ""} onChange={(ev) => ev.target.value && swap(() => setAllHinges(project, ev.target.value as HingeBrand), "Петли " + HINGE_BRANDS[ev.target.value as HingeBrand].label)}>
          {choice.hinges.length > 1 && <option value="">Разные</option>}
          {(Object.keys(HINGE_BRANDS) as HingeBrand[]).map((k) => <option key={k} value={k}>{HINGE_BRANDS[k].label} · {HINGE_BRANDS[k].note}</option>)}
        </select></label>}
        {choice.hasDrawers && <label>Направляющие ящиков<select aria-label="Направляющие во всём проекте" value={choice.slides.length === 1 ? choice.slides[0] : ""} onChange={(ev) => ev.target.value && swap(() => setAllSlides(project, ev.target.value), "Направляющие")}>
          {choice.slides.length > 1 && <option value="">Разные</option>}
          <optgroup label="Шариковые">{SLIDE_SYSTEMS.filter((s) => s.slide === "ball").map((s) => <option key={s.id} value={s.id}>{s.label.replace("Шариковые ", "")}</option>)}</optgroup>
          <optgroup label="Скрытого монтажа">{SLIDE_SYSTEMS.filter((s) => s.slide === "gtv0fpo").map((s) => <option key={s.id} value={s.id}>{s.label.replace("Скрытые ", "")}</option>)}</optgroup>
        </select></label>}
        <label>Кромка корпуса<select aria-label="Кромка корпуса во всём проекте" value={choice.edgeBody.length === 1 ? String(choice.edgeBody[0]) : ""} onChange={(ev) => ev.target.value && swap(() => setAllEdges(project, "body", Number(ev.target.value) as EdgeThickness), "Кромка корпуса")}>
          {choice.edgeBody.length > 1 && <option value="">Разная</option>}
          {EDGE_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select></label>
        {choice.hasDoors && <label>Кромка фасадов<select aria-label="Кромка фасадов во всём проекте" value={choice.edgeFacade.length === 1 ? String(choice.edgeFacade[0]) : ""} onChange={(ev) => ev.target.value && swap(() => setAllEdges(project, "facade", Number(ev.target.value) as EdgeThickness), "Кромка фасадов")}>
          {choice.edgeFacade.length > 1 && <option value="">Разная</option>}
          {EDGE_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select></label>}
        <label>Крепёж корпусов<select aria-label="Крепёж корпусов во всём проекте" value={choice.fastening.length === 1 ? choice.fastening[0] : ""} onChange={(ev) => ev.target.value && swap(() => setAllFastening(project, ev.target.value as "confirmat" | "eccentric"), "Крепёж")}>
          {choice.fastening.length > 1 && <option value="">Разный</option>}
          <option value="confirmat">Конфирматы с заглушками</option><option value="eccentric">Эксцентрики, скрытый</option>
        </select></label>
      </div>
      {note && <p className="dock-note" role="status">{note}</p>}
      <p className="dock-hint">Замена здесь действует на весь проект. Ручку отдельного фасада можно сменить в свойствах фасада справа.</p>
    </div>
  ) : tab === "details" ? (
    <div className="dock-body dock-details">
      <p>{fresh ? <>{count(fresh.parts, DETAILS)} · {count(fresh.ldsp, SHEETS)} ЛДСП{fresh.hdf ? <> · {count(fresh.hdf, SHEETS)} ЛХДФ</> : null}</> : "Считаем…"}</p>
      <div className="dock-actions"><button className="outline" onClick={openParts}>Список деталей</button><button className="outline" onClick={() => openOutput("sheets")}>Карты листов</button></div>
    </div>
  ) : (
    <div className="dock-body dock-docs">
      <div className="dock-actions">
        <span className="dock-group">Клиенту</span>
        <button className="outline" onClick={() => openOutput("quote")}>Коммерческое предложение</button>
        <button className="outline" onClick={() => openOutput("client-spec")}>Спецификация</button>
        <button className="outline" onClick={() => openOutput("placement")}>Расстановка</button>
        <span className="dock-group">Производству</span>
        <button className="outline" onClick={() => openOutput("specification")}>Ведомость</button>
        <button className="outline" onClick={() => openOutput("drawings")}>Чертежи</button>
        <button className="outline" onClick={() => openOutput("labels")}>Бирки</button>
      </div>
    </div>
  );

  return (
    <div className="project-dock">
      {panel && <section className="dock-panel" aria-label={TABS.find((t) => t.id === tab)!.label}>{panel}</section>}
      <nav className="dock-bar" aria-label="Навигация по проекту">
        <div className="dock-tabs">{TABS.map((t) => <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}><t.icon size={15} />{t.label}</button>)}</div>
        <button className="room-warning-link" hidden={!warnings} onClick={onWarnings} title="Проверить расстановку"><span className="dock-warn-long">Проверить расстановку</span><span className="dock-warn-short">Расстановка</span> · {warnings}</button>
        <button className="dock-price" onClick={() => setTab("estimate")} aria-label="Открыть стоимость">
          {!e ? "Считаем…" : <><b>{total === null ? missingPriceLabel(e.missing.length) : rub(total)}</b>{total !== null && e.pending.length > 0 && <small className="dock-pending" title={pendingTotalLabel(e.pending.length)}><span className="dock-warn-long">{pendingTotalLabel(e.pending.length)}</span><span className="dock-warn-short">+{e.pending.length} после расчёта</span></small>}</>}
        </button>
      </nav>
    </div>
  );
}
