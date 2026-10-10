// Нижняя навигация по проекту (решение Макса 06.10.2026, по мотивам Самопила): вкладки внизу экрана,
// панель выезжает над ними и не закрывает 3D. Цена — материалы и фурнитура отдельно; смена фурнитуры сразу меняет итог.
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Calculator, FileText, Layers, Wrench } from "lucide-react";
import type { Project } from "./project";
import { estimate, hardwareKind, HARDWARE_KINDS, isVernissageLine, lineGroup, slidePrice, type HardwareKind } from "./pricing";
import { HANDLES, handleById } from "./handles";
import { HINGE_BRANDS, SLIDE_SYSTEMS, type HingeBrand } from "./hardware";
import { EDGE_CHOICES, type EdgeThickness } from "./model";
import { hardwareChoice, setAllEdges, setAllFastening, setAllHandles, setAllHinges, setAllOpening, setAllSlides } from "./hardwareSwap";

/** Ориентир цены системы направляющих на 450 мм, чтобы клиент видел разницу прямо в списке. */
function slideHint(id: string) { const s = SLIDE_SYSTEMS.find((x) => x.id === id)!; const q = slidePrice({ slide: s.slide, operation: s.motion, brand: s.brand, length: 450 }); return q.price === null ? "цена по запросу" : "≈ " + q.price.toLocaleString("ru-RU") + " ₽ за 450 мм"; }
import { details, nest } from "./exports";
import "./project-dock.css";

export type DockTab = "project" | "estimate" | "hardware" | "details" | "docs";
export type OutputTab = "sheets" | "quote" | "estimate" | "labels" | "drawings" | "specification" | "placement";
const rub = (n: number) => n.toLocaleString("ru-RU") + " ₽";
const TABS: { id: DockTab; label: string; icon: typeof Box }[] = [
  { id: "project", label: "Проект", icon: Box },
  { id: "estimate", label: "Смета", icon: Calculator },
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
  const fresh = calc?.project === project ? calc : null, e = calc?.e;
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

  const totals = !e ? null : e.model === "sheet" ? null : e.split;
  const total = e?.retail ?? null;
  const markup = e?.markup ?? 1;
  const kinds = useMemo(() => {
    if (!e) return [];
    const map = new Map<HardwareKind, { sum: number; items: { label: string; qty: string }[] }>();
    for (const l of e.lines) {
      if (lineGroup(l.id) !== "hardware") continue;
      const k = hardwareKind(l.id), row = map.get(k) ?? { sum: 0, items: [] };
      row.sum += l.retail ? l.quantity * (l.unitPrice ?? 0) : l.quantity * (l.unitPrice ?? 0) * markup;
      row.items.push({ label: l.label, qty: `${l.quantity} ${l.unit}` });
      map.set(k, row);
    }
    return (Object.keys(HARDWARE_KINDS) as HardwareKind[]).filter((k) => map.has(k)).map((k) => ({ k, ...map.get(k)! }));
  }, [e, markup]);
  const materialRows = useMemo(() => {
    if (!e) return [];
    const rows: [string, RegExp][] = [["Плита ЛДСП и задники", /^sheet:/], ["Кромка", /^edge/], ["Работа цеха", /^(work|small)$/], ["Рамочные фасады и стекло", /^(alu-|glass-)/], ["Фасады Вернисаж", /^vernissage/]];
    // фасады Вернисаж — свой коэффициент (закупка × 1,6), остальные материалы — общий
    return rows.map(([label, re]) => ({ label, sum: e.lines.filter((l) => re.test(l.id)).reduce((s, l) => s + l.quantity * (l.unitPrice ?? 0) * (isVernissageLine(l.id) ? e.vernissageMarkup : markup), 0) })).filter((r) => r.sum > 0);
  }, [e, markup]);
  const choice = useMemo(() => hardwareChoice(project), [project]);

  const panel = tab === "project" ? null : tab === "estimate" ? (
    <div className="dock-body dock-estimate">
      {!e ? <p>Считаем…</p> : <>
        <div className="dock-sums">
          <div className="dock-sum material"><span>Материалы</span><b>{totals ? rub(totals.material) : "—"}</b><small>{fresh ? `ЛДСП ${fresh.ldsp} л.` : ""}{fresh?.hdf ? ` · ЛХДФ ${fresh.hdf} л.` : ""} · кромка · работа цеха</small></div>
          <div className="dock-sum hardware"><span>Фурнитура</span><b>{totals ? rub(totals.hardware) : "—"}</b><small>петли · направляющие · ручки · крепёж</small><button className="text-action" onClick={() => setTab("hardware")}>Поменять фурнитуру</button></div>
          <div className="dock-sum total"><span>Итого</span><b>{total === null ? "—" : rub(total)}</b><small>{e.missing.length ? `Нет цены: ${e.missing.length} поз.` : "Предварительно, без доставки и монтажа"}</small></div>
          <div className="dock-breakdown">
            {totals && <table className="dock-table"><tbody>{materialRows.map((r) => <tr key={r.label}><td>{r.label}</td><td>{rub(Math.round(r.sum / 10) * 10)}</td></tr>)}</tbody></table>}
            <div className="dock-actions"><button className="outline" onClick={() => openOutput("estimate")}>Подробная смета</button><button className="outline" onClick={() => openOutput("quote")}>КП</button></div>
          </div>
        </div>
        {e.model === "sheet" && <p className="dock-note">Выбрана модель «цена за лист»: фурнитура входит в цену листа и отдельно не показывается{e.vernissageOnTop ? `; фасады Вернисаж — сверху листов, закупка × ${String(e.vernissageMarkup).replace(".", ",")}: ${rub(e.vernissageOnTop)}` : ""}. Чтобы видеть её отдельно, в подробной смете выберите «Себестоимость × коэффициент».</p>}
      </>}
    </div>
  ) : tab === "hardware" ? (
    <div className="dock-body dock-hardware">
      <div className="dock-swaps">
        {choice.handles.length > 0 && <label>Ручки<select aria-label="Ручки во всём проекте" value={choice.handles.length === 1 ? choice.handles[0] : ""} onChange={(ev) => ev.target.value && swap(() => setAllHandles(project, ev.target.value), "Ручки " + handleById(ev.target.value).label)}>
          {choice.handles.length > 1 && <option value="">Разные ({choice.handles.length})</option>}
          <optgroup label="Склад цеха">{HANDLES.filter((h) => h.vendor === "workshop").map((h) => <option key={h.id} value={h.id}>{h.label} · {rub(h.price)}</option>)}</optgroup>
          <optgroup label="Лемана Про">{HANDLES.filter((h) => h.vendor === "lemana").map((h) => <option key={h.id} value={h.id}>{h.label} · {rub(h.price)}</option>)}</optgroup>
        </select></label>}
        {choice.hasDoors && <label>Открывание дверей<select aria-label="Открывание дверей во всём проекте" value={choice.opening.length === 1 ? choice.opening[0] : ""} onChange={(ev) => ev.target.value && swap(() => setAllOpening(project, ev.target.value as "handle" | "push"), "Открывание")}>
          {choice.opening.length > 1 && <option value="">Разное</option>}
          <option value="handle">С ручками, петли с доводчиком</option><option value="push">Без ручек, push-to-open</option>
        </select></label>}
        {choice.hasDoors && <label>Петли<select aria-label="Петли во всём проекте" value={choice.hinges.length === 1 ? choice.hinges[0] : ""} onChange={(ev) => ev.target.value && swap(() => setAllHinges(project, ev.target.value as HingeBrand), "Петли " + HINGE_BRANDS[ev.target.value as HingeBrand].label)}>
          {choice.hinges.length > 1 && <option value="">Разные</option>}
          {(Object.keys(HINGE_BRANDS) as HingeBrand[]).map((k) => <option key={k} value={k}>{HINGE_BRANDS[k].label} · {HINGE_BRANDS[k].note} · {rub(HINGE_BRANDS[k].soft.price)}/шт</option>)}
        </select></label>}
        {choice.hasDrawers && <label>Направляющие ящиков<select aria-label="Направляющие во всём проекте" value={choice.slides.length === 1 ? choice.slides[0] : ""} onChange={(ev) => ev.target.value && swap(() => setAllSlides(project, ev.target.value), "Направляющие")}>
          {choice.slides.length > 1 && <option value="">Разные</option>}
          <optgroup label="Шариковые">{SLIDE_SYSTEMS.filter((s) => s.slide === "ball").map((s) => <option key={s.id} value={s.id}>{s.label.replace("Шариковые ", "")} · {slideHint(s.id)}</option>)}</optgroup>
          <optgroup label="Скрытого монтажа">{SLIDE_SYSTEMS.filter((s) => s.slide === "gtv0fpo").map((s) => <option key={s.id} value={s.id}>{s.label.replace("Скрытые ", "")} · {slideHint(s.id)}</option>)}</optgroup>
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
      <table className="dock-table"><tbody>{kinds.map((r) => <tr key={r.k}><td><b>{HARDWARE_KINDS[r.k]}</b><small>{r.items.map((i) => `${i.label} — ${i.qty}`).join("; ")}</small></td><td>{rub(Math.round(r.sum / 10) * 10)}</td></tr>)}</tbody></table>
      <p className="dock-hint">Замена здесь действует на весь проект. Ручку отдельного фасада можно сменить в свойствах фасада справа.</p>
    </div>
  ) : tab === "details" ? (
    <div className="dock-body dock-details">
      <p>{fresh ? <><b>{fresh.parts}</b> деталей · <b>{fresh.ldsp}</b> листов ЛДСП{fresh.hdf ? <> · <b>{fresh.hdf}</b> ЛХДФ</> : null}</> : "Считаем…"}</p>
      <div className="dock-actions"><button className="outline" onClick={openParts}>Список деталей</button><button className="outline" onClick={() => openOutput("sheets")}>Карты листов</button></div>
    </div>
  ) : (
    <div className="dock-body dock-docs">
      <div className="dock-actions">
        <button className="outline" onClick={() => openOutput("quote")}>Коммерческое предложение</button>
        <button className="outline" onClick={() => openOutput("placement")}>Расстановка</button>
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
        <button className="dock-price" onClick={() => setTab("estimate")} aria-label="Открыть смету">
          {!e ? "Считаем…" : <>{totals && <span className="dock-split">Материалы {rub(totals.material)} · Фурнитура {rub(totals.hardware)} · Итого</span>}<b>{total === null ? `Нет цены: ${e.missing.length}` : rub(total)}</b></>}
        </button>
      </nav>
    </div>
  );
}
