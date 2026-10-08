// Кухонная палитра слева (вкладка «Кухня», трек И, 09.10.2026): модули кухни по Базису цеха — ширина в одно касание,
// модуль встаёт в свой ряд (нижние на пол, навесные на высоту ряда, антресоль над навесными), прямая кухня по длине стены,
// «Кухни из базы» (локальный индекс, на Pages его нет) и общая палитра шкафов — свёрнутой.
import { useEffect, useState, type ReactNode } from "react";
import { PanelBottom, Archive, Droplets, Flame, Wine, PanelTopOpen, Rows3, ArrowUpToLine, RectangleVertical, RectangleHorizontal, CookingPot, Library, ArrowLeft, Sofa } from "lucide-react";
import type { Module } from "./model";
import type { Project } from "./project";
import { KITCHEN } from "./kitchen";
import { KITCHEN_ITEMS, KITCHEN_WALL_OFFSET, kitchenTemplate, placeKitchenModule, placeKitchenRow, placeWorktop, type KitchenItem } from "./kitchenProject";
import "./kitchen.css";

const ICONS: Record<KitchenItem, typeof PanelBottom> = { "base-doors": PanelBottom, "base-drawers": Archive, sink: Droplets, oven: Flame, bottle: Wine, wall: PanelTopOpen, "wall-open": Rows3, antresol: ArrowUpToLine, tall: RectangleVertical };
const GROUPS: { id: "base" | "wall" | "tall"; title: string; note: string }[] = [
  { id: "base", title: "Нижние", note: `на опорах ${KITCHEN.legs}, корпус ${KITCHEN.baseBody}, глубина ${KITCHEN.baseDepth}` },
  { id: "wall", title: "Верхние", note: `${KITCHEN.wallHeight} × ${KITCHEN.wallDepth}, на навесах, ${KITCHEN.wallGap} над столешницей` },
  { id: "tall", title: "Пеналы и столешница", note: "пенал — вровень с навесными" },
];
type BaseEntry = { id: string; title: string };

/** Индекс импортированных кухонь (public/local-projects/kitchens.json — только локально): id и название, без данных клиента. */
function useKitchenIndex() {
  const [list, setList] = useState<BaseEntry[] | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("./local-projects/kitchens.json", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((x: unknown) => {
        if (!Array.isArray(x)) return;
        setList(x.filter((e): e is BaseEntry => !!e && typeof e.id === "string" && /^[a-z0-9-]{1,40}$/.test(e.id) && typeof e.title === "string")
          .map((e) => ({ id: e.id, title: e.title.slice(0, 80) })));
      })
      .catch(() => { /* нет индекса (Pages) или нет сети — блок не показываем */ });
    return () => ctrl.abort();
  }, []);
  return list;
}

/** onError — общее сообщение студии «Изменение не применено» (видно при любой прокрутке палитры); commit — commitProject App. */
export function KitchenPalette({ project, source, commit, onAdded, onError, children }: { project: Project; source: Module; commit: (p: Project) => boolean; onAdded: (ids: string[], fit: boolean) => void; onError: (message: string) => void; children?: ReactNode }) {
  const wall = Math.max(600, Math.min(6000, project.room.width - 2 * KITCHEN_WALL_OFFSET));
  const [length, setLength] = useState(wall);
  const bases = useKitchenIndex();
  const opened = new URLSearchParams(location.search).get("project");
  const run = (f: () => { project: Project; ids: string[] }, fit = false) => {
    try { const r = f(); if (commit(r.project)) onAdded(r.ids, fit); } catch (e) { onError((e as Error).message); }
  };
  const add = (kind: KitchenItem, width: number) => run(() => { const r = placeKitchenModule(project, kitchenTemplate(kind, width, source)); return { project: r.project, ids: [r.id] }; });
  return <details className="module-palette kitchen-palette" open>
    <summary>Кухонные модули</summary>
    {GROUPS.map((g) => <div key={g.id} className="kp-group">
      <h3>{g.title}<small>{g.note}</small></h3>
      {(Object.keys(KITCHEN_ITEMS) as KitchenItem[]).filter((k) => KITCHEN_ITEMS[k].group === g.id).map((k) => { const Icon = ICONS[k]; return <div key={k} className="kp-item">
        <span className="kp-label"><Icon size={18} />{KITCHEN_ITEMS[k].label}</span>
        <span className="kp-widths">{KITCHEN_ITEMS[k].widths.map((w) => <button key={w} type="button" title={`Добавить: ${KITCHEN_ITEMS[k].label.toLowerCase()} ${w} мм`} aria-label={`${KITCHEN_ITEMS[k].label} ${w}`} onClick={() => add(k, w)}>{w}</button>)}</span>
      </div>; })}
      {g.id === "tall" && <div className="kp-item">
        <span className="kp-label"><RectangleHorizontal size={18} />Столешница</span>
        <span className="kp-widths"><button type="button" className="kp-wide" title="Столешница над нижними, которые ещё без неё" aria-label="Столешница над нижними" onClick={() => run(() => placeWorktop(project, source))}>над нижними</button></span>
      </div>}
    </div>)}
    <div className="kp-group kp-row">
      <h3><span className="kp-title"><CookingPot size={16} />Прямая кухня по длине стены</span><small>ящики, мойка, распашные, навесные, столешница</small></h3>
      <label className="number-field"><span>Длина стены</span><div><input aria-label="Длина стены кухни" type="number" min={600} max={6000} value={length} onChange={(e) => setLength(Number(e.target.value))} /><small>мм</small></div></label>
      <div className="kp-actions">
        <button type="button" className="primary" onClick={() => run(() => placeKitchenRow(project, length, source, true), true)}>Заменить кухню</button>
        <button type="button" className="outline" onClick={() => run(() => placeKitchenRow(project, length, source), true)}>Добавить ряд</button>
      </div>
      <small>«Заменить» убирает кухонные модули и ставит ряд от левой стены (место под фальш 16 + 5). Шкафы остаются. Ctrl+Z — вернуть.</small>
    </div>
    {children && <details className="kp-more"><summary><Sofa size={15} />Шкафы и другая мебель</summary>{children}</details>}
    {bases && bases.length > 0 && <details className="kp-more kp-base"><summary><Library size={15} />Кухни из базы · {bases.length}</summary>
      <p className="field-note">Проекты Базиса цеха, перенесённые в студию. Открываются здесь же, исходный файл не меняется.</p>
      <ul>{bases.map((b) => <li key={b.id}><a href={`?project=kitchen-${b.id}&fresh=1`}>{b.title}</a></li>)}</ul>
    </details>}
    {opened && <a className="text-action kp-back" href="?order=kitchen"><ArrowLeft size={14} />К своей кухне</a>}
  </details>;
}
