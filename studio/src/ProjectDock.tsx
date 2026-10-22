// Нижняя навигация по проекту (решение Макса 06.10.2026, по мотивам Самопила): вкладки внизу экрана,
// панель выезжает над ними и не закрывает 3D. Цена — материалы и фурнитура отдельно; смена фурнитуры сразу меняет итог.
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Calculator, FileText, Layers, Wrench } from "lucide-react";
import type { Project } from "./project";
import {estimate} from "./pricing";
import { missingPriceLabel } from "./clientLabels";
import { handleById } from "./handles";
import { HINGE_BRANDS, SLIDE_SYSTEMS } from "./hardware";
import { hardwareChoice } from "./hardwareSwap";
import { HardwareWindow } from "./HardwareWindow";
import { createPortal } from "react-dom";

/** Ориентир цены системы направляющих на 450 мм, чтобы клиент видел разницу прямо в списке. */

import { details, nest, quoteBreakdown, splitRows, unplacedDetails } from "./exports";
import { pendingTotalLabel } from "./pendingPrices";
import { fillerCount, sameDesign, sheetChangeNote } from "./sheetNote";
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
// m10 (критик релиза 22.10): открытая нижняя панель не восстанавливается после F5 — она закрывала кнопки «Добавить…» кухонной
// палитры. При загрузке всегда «Проект» (панель закрыта); выбор вкладки живёт до перезагрузки.
function loadTab(): DockTab { try { localStorage.removeItem("studio-dock"); } catch { /* браузер без хранилища */ } return "project"; }

export function ProjectDock({ project, commit, openOutput, openParts, warnings, onWarnings, onLayout, inspect }: {
  project: Project;
  /** «Показать» у детали, которая не помещается в лист: выбрать корпус и деталь в 3D. */
  inspect?: (moduleId: string, partId: string) => void;
  /** Панель открылась или закрылась: сцене нужно заново вписать мебель в уменьшенный вид. */
  onLayout?: () => void;
  commit: (p: Project) => boolean;
  openOutput: (tab: OutputTab) => void;
  openParts: () => void;
  warnings: number;
  onWarnings: () => void;
}) {
  const [tab, setTabState] = useState<DockTab>(loadTab);
  const setTab = (t: DockTab) => { const next = t === tab ? "project" : t; setTabState(next); };
  const open = tab !== "project";
  const mounted = useRef(false);
  // Вписать мебель после того, как холст сцены успел поменять размер (ResizeObserver срабатывает кадром позже).
  useEffect(() => { if (!mounted.current) { mounted.current = true; return; } const t = setTimeout(() => onLayout?.(), 120); return () => clearTimeout(t); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // Смета считает раскрой: откладываем на 300 мс после правки, чтобы перетаскивание не тормозило.
  // note — почему итог прыгнул целым листом (m3 критика 22.10, sheetNote.ts); держится, пока число листов то же
  const [calc, setCalc] = useState<{ project: Project; e: ReturnType<typeof estimate>; parts: number; ldsp: number; hdf: number; fillers: number; note: string | null; unplaced: ReturnType<typeof unplacedDetails> } | null>(null);
  // БЛОКЕР 1 критика релиза 22.10: ошибка раскроя/сметы — сообщение в панели, а не необработанное исключение таймера
  const [calcError, setCalcError] = useState<{ project: Project; message: string } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      let sheets: ReturnType<typeof nest>, e: ReturnType<typeof estimate>, unplaced: ReturnType<typeof unplacedDetails>;
      try { sheets = nest(project); e = estimate(project, sheets); unplaced = unplacedDetails(project); setCalcError(null); }
      catch (err) { setCalcError({ project, message: err instanceof Error ? err.message : String(err) }); return; }
      const ldsp = sheets.filter((s) => s.material !== "hdf").length, fillers = fillerCount(project);
      setCalc((c) => {
        const same = !!c && sameDesign(c.project, project), note = same ? sheetChangeNote({ ldsp: c!.ldsp, total: c!.e.retail, fillers: c!.fillers }, { ldsp, total: e.retail, fillers }) : null;
        return { project, e, parts: details(project).length, ldsp, hdf: sheets.filter((s) => s.material === "hdf").length, fillers, note: note ?? (same && c!.ldsp === ldsp ? c!.note : null), unplaced };
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [project]);
  const fresh = calc?.project === project ? calc : null, e = fresh?.e;

  // Окно «Фурнитура» (менеджеры 22.10.2026, п. 15) вместо выпадающих списков: группы, схемы, разница в цене, весь проект или модуль
  const [hwOpen, setHwOpen] = useState(false);

  const total = e?.retail ?? null;
  // Материалы и фурнитура отдельно (решение 06.10): та же разбивка, что печатается в КП при цене по смете.
  const split = e && total !== null ? quoteBreakdown(String(total), e) : null;
  const choice = useMemo(() => hardwareChoice(project), [project]);
  const hwSummary = useMemo(() => {
    const many = (n: number, word: string) => n > 1 ? word : "";
    const out: string[] = [];
    if (choice.hasDoors) out.push("Петли: " + (many(choice.hinges.length, "разные") || choice.hinges.map((k) => HINGE_BRANDS[k].label).join("")), choice.opening.length === 1 ? (choice.opening[0] === "push" ? "Без ручек, push-to-open" : "С ручками") : "Открывание разное");
    if (choice.hasDrawers) out.push("Направляющие: " + (many(choice.slides.length, "разные") || (SLIDE_SYSTEMS.find((s) => s.id === choice.slides[0])?.label ?? "")));
    if (choice.handles.length) out.push("Ручки: " + (many(choice.handles.length, "разные") || handleById(choice.handles[0]).label));
    out.push("Кромка корпуса: " + (many(choice.edgeBody.length, "разная") || String(choice.edgeBody[0]).replace(".", ",") + " мм"));
    out.push(choice.fastening.length === 1 ? (choice.fastening[0] === "eccentric" ? "Скрытый крепёж" : "Конфирматы") : "Крепёж разный");
    return out;
  }, [choice]);

  const panel = tab === "project" ? null : tab === "estimate" ? (
    <div className="dock-body dock-estimate">
      {calcError?.project === project && <div className="dock-unplaced" role="alert"><b>Смета не посчитана: {calcError.message}</b></div>}
      {fresh && fresh.unplaced.length > 0 && <div className="dock-unplaced" role="alert" aria-label="Не помещаются в лист"><b>Смета не завершена — не помещаются в лист ({fresh.unplaced.length}):</b><ul>{fresh.unplaced.slice(0, 6).map((u) => <li key={u.detail.code}>Деталь {u.detail.code} · {u.detail.moduleName} / {u.detail.name} {u.detail.length} × {u.detail.width} — сращивать или заказать отдельно{inspect && <button type="button" className="text-action" aria-label={"Показать деталь " + u.detail.code} onClick={() => inspect(u.detail.moduleId, u.detail.id)}>Показать</button>}</li>)}{fresh.unplaced.length > 6 && <li>…и ещё {fresh.unplaced.length - 6}</li>}</ul></div>}
      <div className="dock-sum total"><span>Итоговая стоимость</span><b>{calcError?.project === project ? 'Ошибка расчёта' : !e?'Считаем…':total===null?'Требует уточнения':rub(total)}</b><small>{e?.missing.length?'Не все позиции оценены':e?.pending.length?pendingTotalLabel(e.pending.length):'Предварительно, без доставки и монтажа'}</small></div>
      {split && <div className={"dock-cost-split" + (split.kupe ? " has-kupe" : "")} aria-label="Разбивка стоимости">{splitRows(split).map(([k, v], i) => <div key={k} className={"dock-sum " + ["material", "hardware", "kupe"][i]}><span>{k}</span><b>{rub(v)}</b></div>)}</div>}
      {fresh && <p className="dock-sheets" aria-label="Листы раскроя">Листов ЛДСП в раскрое: <b>{fresh.ldsp}</b>{fresh.hdf ? <> · ЛХДФ: <b>{fresh.hdf}</b></> : null}{fresh.note && <small role="status">{fresh.note}</small>}</p>}
      <div className="dock-actions"><button className="outline" onClick={()=>openOutput('estimate')}>Стоимость проекта</button><button className="outline" onClick={()=>openOutput('quote')}>КП</button><button className="text-action" onClick={()=>setHwOpen(true)}>Поменять фурнитуру</button></div>
    </div>
  ) : tab === "hardware" ? (
    <div className="dock-body dock-hardware">
      <div className="dock-hw-summary" aria-label="Фурнитура сейчас">{hwSummary.map((x) => <span key={x}>{x}</span>)}</div>
      <div className="dock-actions"><button className="primary" onClick={() => setHwOpen(true)}>Выбрать фурнитуру…</button></div>
      <p className="dock-hint">В окне — варианты петель, направляющих, ручек, кромки и крепежа с разницей в цене; применить можно ко всему проекту или к одному модулю. Ручку отдельного фасада можно сменить в свойствах фасада справа.</p>
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
      {hwOpen && createPortal(<HardwareWindow project={project} commit={commit} onClose={() => setHwOpen(false)}/>, document.body)}
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
