// Кухонная палитра слева (вкладка «Кухня», трек И, 09.10.2026): модули кухни по Базису цеха — ширина в одно касание,
// модуль встаёт в свой ряд (нижние на пол, навесные на высоту ряда, антресоль над навесными), прямая кухня по длине стены,
// «Кухни из базы» (локальный индекс, на Pages его нет) и общая палитра шкафов — свёрнутой.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { paletteIssues } from "./paletteCheck";
import { PanelBottom, Archive, Droplets, Flame, Wine, PanelTopOpen, Rows3, ArrowUpToLine, RectangleVertical, RectangleHorizontal, CookingPot, Library, ArrowLeft, Sofa, Columns2, Microwave, Refrigerator } from "lucide-react";
import type { CornerSide } from "./kitchenCorner";
import type { Module } from "./model";
import type { Project } from "./project";
import { KITCHEN, wallFloorY } from "./kitchen";
import { KITCHEN_ITEMS, KITCHEN_WALL_OFFSET, kitchenTemplate, placeKitchenModule, placeKitchenRow, placeWorktop, defaultWallY, type KitchenItem } from "./kitchenProject";
import { WardrobeBase } from "./WardrobeBase";
import { PUBLIC_BUILD } from "./buildMode";
import { offWallNote } from "./freeSpot";
import "./kitchen.css";

const ICONS: Record<KitchenItem, typeof PanelBottom> = { "base-doors": PanelBottom, "base-drawers": Archive, "base-corner": Columns2, sink: Droplets, oven: Flame, bottle: Wine, wall: PanelTopOpen, "wall-open": Rows3, antresol: ArrowUpToLine, tall: RectangleVertical, "tall-oven": Microwave, "tall-fridge": Refrigerator };
const GROUPS: { id: "base" | "wall" | "tall"; title: string; note: string }[] = [
  { id: "base", title: "Нижние", note: `на опорах ${KITCHEN.legs}, корпус ${KITCHEN.baseBody}, глубина ${KITCHEN.baseDepth}` },
  { id: "wall", title: "Верхние", note: `${KITCHEN.wallHeight} × ${KITCHEN.wallDepth}, на навесах, низ ${wallFloorY()} от пола (${KITCHEN.wallGap} над столешницей)` },
  { id: "tall", title: "Пеналы и столешница", note: "пенал — вровень с навесными" },
];
type BaseEntry = { id: string; title: string };

/** Индекс импортированных кухонь (public/local-projects/kitchens.json — только локально): id и название, без данных клиента.
 *  Публичная сборка индекс не запрашивает (релиз 22.10, m9: на сайте папки нет — был 404 в консоли при открытии кухонь). */
function useKitchenIndex() {
  const [list, setList] = useState<BaseEntry[] | null>(null);
  useEffect(() => {
    if (PUBLIC_BUILD) return;
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
export function KitchenPalette({ project, source, commit, onAdded, onError, onNote, children }: { project: Project; source: Module; commit: (p: Project) => boolean; onAdded: (ids: string[], fit: boolean) => void; onError: (message: string) => void;
  /** K2 (критик 22.10): модуль встал не у стены (ряд занят) — предупреждение «Нет места у стены…» (freeSpot.ts) */
  onNote?: (note: string | null) => void; children?: ReactNode }) {
  const wall = Math.max(600, Math.min(6000, project.room.width - 2 * KITCHEN_WALL_OFFSET));
  const [length, setLength] = useState(wall);
  const bases = useKitchenIndex();
  const opened = new URLSearchParams(location.search).get("project");
  const run = (f: () => { project: Project; ids: string[] }, fit = false) => {
    try { const r = f(); if (commit(r.project)) { onAdded(r.ids, fit); onNote?.(offWallNote(r.project, r.ids)); } } catch (e) { onError((e as Error).message); }
  };
  const [cornerSide, setCornerSide] = useState<CornerSide>("right");
  // низ навесных от пола (п. 6, 22.10): по умолчанию — ряд навесных или регламент от верха нижних (1458); заданное число — для новых навесных
  const [wallFloor, setWallFloor] = useState<number | undefined>(undefined), wallShown = wallFloor ?? Math.round(defaultWallY(project));
  // w-formerrors (23.10): ошибки полей палитры — после выхода из поля (или по кнопке), все сразу, у поля, с «Что сделать» и исправлением
  const [lenSeen, setLenSeen] = useState(false), [floorSeen, setFloorSeen] = useState(false);
  const rowIssues = useMemo(() => lenSeen ? paletteIssues({ kind: "kitchen-row", width: length, height: KITCHEN.baseHeight, depth: KITCHEN.baseDepth }, source) : [], [lenSeen, length, source]);
  const floorMax = Math.max(0, project.room.height - KITCHEN.wallHeight);
  const floorIssue = floorSeen && wallFloor !== undefined && (wallFloor < 0 || wallFloor > floorMax)
    ? { problem: wallFloor < 0 ? `Низ навесных ${wallFloor} < 0 мм` : `Низ навесных ${wallFloor} > ${floorMax} мм`, action: wallFloor < 0 ? "Минимум 0 — от пола." : `Навесной ${KITCHEN.wallHeight} мм при потолке ${project.room.height} встаёт не выше ${floorMax}.`, fix: wallFloor < 0 ? 0 : floorMax } : null;
  const addRow = (replace: boolean) => { const now = paletteIssues({ kind: "kitchen-row", width: length, height: KITCHEN.baseHeight, depth: KITCHEN.baseDepth }, source); if (now.length) { setLenSeen(true); return; } run(() => placeKitchenRow(project, length, source, replace), true); };
  const add = (kind: KitchenItem, width: number) => run(() => { const r = placeKitchenModule(project, kitchenTemplate(kind, width, source, kind === "base-corner" ? { side: cornerSide } : undefined), KITCHEN_ITEMS[kind].group === "wall" && kind !== "antresol" ? { wallY: wallFloor } : {}); return { project: r.project, ids: [r.id] }; });
  return <details className="module-palette kitchen-palette" open>
    <summary>Кухонные модули</summary>
    {GROUPS.map((g) => <div key={g.id} className="kp-group">
      <h3>{g.title}<small>{g.note}</small></h3>
      {g.id === "wall" && <label className={"number-field kp-floor" + (floorIssue ? " has-error" : "")}><span>Низ навесных от пола</span><div><input aria-label="Низ навесных от пола" aria-invalid={!!floorIssue || undefined} type="number" min={0} max={project.room.height} value={wallShown} onChange={(e) => { const v = Number(e.target.value); setWallFloor(Number.isFinite(v) && e.target.value !== "" ? v : undefined); }} onBlur={() => setFloorSeen(true)} /><small>мм</small></div></label>}
      {g.id === "wall" && floorIssue && <div className="palette-issues" role="alert" aria-label="Ошибка поля «Низ навесных от пола»"><ol><li><b>{floorIssue.problem}</b><span className="pi-action">Что сделать: {floorIssue.action}</span><span className="pi-fixes"><button type="button" className="outline" onClick={() => setWallFloor(floorIssue.fix)}>Низ {floorIssue.fix}</button></span></li></ol></div>}
      {(Object.keys(KITCHEN_ITEMS) as KitchenItem[]).filter((k) => KITCHEN_ITEMS[k].group === g.id).map((k) => { const Icon = ICONS[k]; return <div key={k} className="kp-item">
        <span className="kp-label"><Icon size={18} />{KITCHEN_ITEMS[k].label}</span>
        {k === "base-corner" && <span className="kp-corner">
          <select aria-label="Вариант углового" value="straight" onChange={() => undefined} title="Вариант нижнего углового">
            <option value="straight">прямой, с фальшпанелью</option>
            <option value="l90" disabled>Г-образный 90° — в работе</option>
          </select>
          <select aria-label="Глухая часть углового" value={cornerSide} onChange={(e) => setCornerSide(e.target.value as CornerSide)} title="С какой стороны глухая часть (фальш); дверь — с другой">
            <option value="right">глухая часть справа</option>
            <option value="left">глухая часть слева</option>
          </select>
        </span>}
        <span className="kp-widths">{KITCHEN_ITEMS[k].widths.map((w) => <button key={w} type="button" title={`Добавить: ${KITCHEN_ITEMS[k].label.toLowerCase()} ${w} мм`} aria-label={`${KITCHEN_ITEMS[k].label} ${w}`} onClick={() => add(k, w)}>{w}</button>)}</span>
      </div>; })}
      {g.id === "tall" && <div className="kp-item">
        <span className="kp-label"><RectangleHorizontal size={18} />Столешница</span>
        <span className="kp-widths"><button type="button" className="kp-wide" title="Столешница над нижними, которые ещё без неё" aria-label="Столешница над нижними" onClick={() => run(() => placeWorktop(project, source))}>над нижними</button></span>
      </div>}
    </div>)}
    <div className="kp-group kp-row">
      <h3><span className="kp-title"><CookingPot size={16} />Прямая кухня по длине стены</span><small>ящики, мойка, распашные, навесные, столешница</small></h3>
      <label className={"number-field" + (rowIssues.some((x) => x.field === "width") ? " has-error" : "")}><span>Длина стены</span><div><input aria-label="Длина стены кухни" aria-invalid={rowIssues.some((x) => x.field === "width") || undefined} type="number" min={600} max={6000} value={length} onChange={(e) => setLength(Number(e.target.value))} onBlur={() => setLenSeen(true)} onKeyDown={(e) => { if (e.key === "Enter") setLenSeen(true); }} /><small>мм</small></div></label>
      {rowIssues.length > 0 && <div className="palette-issues" role="alert" aria-label="Ошибки прямой кухни">
        <p className="pi-title">Не добавится: {rowIssues.length} {rowIssues.length === 1 ? "ошибка" : rowIssues.length < 5 ? "ошибки" : "ошибок"}</p>
        <ol>{rowIssues.map((x, i) => <li key={i}><b>{x.problem.replace(/^Ширина/, "Длина")}</b><span className="pi-action">Что сделать: {x.action}</span>
          {x.fixes.length > 0 && <span className="pi-fixes">{x.fixes.map((f) => <button key={f.label} type="button" className="outline" onClick={() => { if (f.patch.width !== undefined) setLength(f.patch.width); }}>{f.label.replace(/^Ширина/, "Длина")}</button>)}</span>}</li>)}</ol>
      </div>}
      <div className="kp-actions">
        <button type="button" className="primary" onClick={() => addRow(true)}>Заменить кухню</button>
        <button type="button" className="outline" onClick={() => addRow(false)}>Добавить ряд</button>
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
