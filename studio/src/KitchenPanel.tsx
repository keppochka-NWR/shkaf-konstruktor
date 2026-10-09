// Панель кухонного модуля справа (вкладка «Кухня», трек И, 09.10.2026): корпус, опоры и цоколь, фасады, петли, полки, навесы,
// столешница; для сырого модуля из Базиса — только сведения. Каждое изменение идёт через modify/commit студии (validate + projectErrors),
// поэтому ошибки, пересчёт сметы и 3D — как у остальных корпусов.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Footprints, Layers, Link2, Rows3, Anchor, RectangleHorizontal, Box, Move, Wrench, Info, TriangleAlert, CircleCheck } from "lucide-react";
import { scaleHingeY, parts, distribute, maxHeightOf, RULES, RAIL_PLACES, type Module, type Part } from "./model";
import { KITCHEN, APPLIANCES, kitchenLegs, worktopLabel, hardwareRows, type WorktopSpec } from "./kitchen";
import { HINGE_BRANDS, hingePositions, type HingeBrand } from "./hardware";
import { handleById } from "./handles";
import { partCollisions, rawCheck, bazisAirHardware, BAZIS_AIR, RAW_JOINT, RAW_SEAT_GAP, RAW_FAR } from "./collisions";
import { rawHangerSeats, RAW_HANGER_DROP } from "./rawModule";
import { type KDrawerSystem, refitKDrawers, relayoutKDrawers, relayoutProblem, withAxisH, axisMaxLen, kdrawerFacadeMax, setKDrawerFacade, axisLabel, axisFits, axisAvailable, AXIS_HEIGHTS, firmaxSetScrews } from "./kitchenDrawers";
import { catalog } from "./catalog";
import type { PlacedModule, Project, Room } from "./project";
import { DEFAULT_VERNISSAGE } from "./facadesVernissage";
import { VernissagePicker } from "./VernissagePicker";
import { KITCHEN_ITEMS, kitchenItemOf, rebuildKitchen, setLegHeight, legModules, addHinge, removeHinge, type KitchenItem } from "./kitchenProject";
import "./kitchen.css";

type Rail = NonNullable<Module["rails"]>[number];
const fmt = (v: number) => String(Math.round(v * 10) / 10);
const ROLE: Record<string, string> = { base: "Нижний модуль", wall: "Навесной модуль", tall: "Пенал", antresol: "Антресоль" };

/** Числовое поле как в студии (номер, единица, подсказка диапазона, ошибка); принимает дробные (зазоры 1,5). */
function Num({ label, value, min, max, step = 1, unit = "мм", change, note }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; change: (v: number) => boolean | void; note?: string }) {
  const [draft, setDraft] = useState(fmt(value)), [error, setError] = useState("");
  useEffect(() => { setDraft(fmt(value)); setError(""); }, [value]);
  const apply = () => {
    const n = Number(draft.replace(",", "."));
    if (!draft.trim() || !Number.isFinite(n) || n < min || n > max) { setError(`Введите число от ${fmt(min)} до ${fmt(max)} ${unit}. Изменение не применено.`); setDraft(fmt(value)); return; }
    setError("");
    if (Math.abs(n - value) > 1e-9 && change(n) === false) setDraft(fmt(value));
  };
  return <label className={"number-field" + (error ? " has-error" : "")}>
    <span>{label}</span>
    <div><input aria-label={label} type="number" inputMode="decimal" min={min} max={max} step={step} value={draft} onChange={(e) => { setDraft(e.target.value); setError(""); }} onBlur={apply}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(fmt(value)); setError(""); } }} /><small>{unit}</small></div>
    <span className={error ? "number-feedback" : "number-range"} role={error ? "alert" : undefined}>{error || note || `От ${fmt(min)} до ${fmt(max)} ${unit} · Enter — применить`}</span>
  </label>;
}
const Check = ({ label, checked, change }: { label: string; checked: boolean; change: (v: boolean) => void }) =>
  <label className="hardware-field"><span><input type="checkbox" aria-label={label} checked={checked} onChange={(e) => change(e.target.checked)} /> {label}</span></label>;
function Group({ icon, title, open, children, note }: { icon: ReactNode; title: string; open?: boolean; children: ReactNode; note?: string }) {
  return <details className="property-section kitchen-group" open={open}><summary>{icon}<span>{title}</span>{note && <small>{note}</small>}</summary>{children}</details>;
}

/** Цвета модуля образцами (как выбор материала в общей панели): корпус, фасады, фасады ящиков — открывают каталог декоров. */
function Colors({ m, material }: { m: Module; material: KitchenPanelProps["material"] }) {
  const tex = (n: string) => catalog.find((c) => c.n === n)?.tex;
  const fill = (n: string) => n === "Белый" ? "#efeeeb" : n === "Графит" ? "#565956" : "#c4ad85";
  const rows: ["decor" | "facadeDecor" | "drawerFacadeDecor", string, string][] = [["decor", m.worktop ? "Декор столешницы" : "Корпус", m.decor]];
  if (m.doors) rows.push(["facadeDecor", "Фасады", m.facadeDecor]);
  if (m.sections.some((s) => s.drawers > 0)) rows.push(["drawerFacadeDecor", "Фасады ящиков", m.drawerFacadeDecor ?? m.facadeDecor]);
  return <div className="kitchen-colors">{rows.map(([target, label, name]) => <button key={target} type="button" aria-label={`${label}: ${name} — выбрать декор`} onClick={() => material(target)}>
    <span className="swatch" style={tex(name) ? { backgroundImage: `url("${tex(name)}")` } : { backgroundColor: fill(name) }} /><span><small>{label}</small>{name}</span></button>)}</div>;
}

export type KitchenPanelProps = {
  m: Module; placed: PlacedModule; project: Project; stage: string;
  modify: (update: (draft: Module) => void) => boolean;
  commit: (p: Project) => boolean;
  move: (axis: "x" | "y" | "z", v: number) => void;
  position: { x: number; y: number; z: number; w: number; d: number; h: number }; room: Room;
  rotate: (r: 0 | 90 | 180 | 270) => boolean;
  material: (target: "decor" | "facadeDecor" | "drawerFacadeDecor") => void;
  handles: () => void;
  showInside: () => void;
};

export function KitchenPanel(props: KitchenPanelProps) {
  const { m } = props;
  if (m.raw) return <RawInfo {...props} />;
  if (m.worktop) return <WorktopPanel {...props} />;
  return <CabinetPanel {...props} />;
}

/** Положение модуля в комнате — как в общей панели (отступы по монтажному габариту, поворот, удаление). */
function Position({ placed, project, position, room, move, rotate, commit, open }: KitchenPanelProps & { open?: boolean }) {
  return <Group icon={<Move size={15} />} title="Положение" open={open}>
    {(["y", "x", "z"] as const).map((axis) => <Num key={axis} label={{ x: "От левой стены", z: "От задней стены", y: "От пола" }[axis]} value={position[axis]} min={0}
      max={Math.max(0, { x: room.width - position.w, z: room.depth - position.d, y: room.height - position.h }[axis])} change={(v) => { move(axis, v); }} />)}
    <label className="hardware-field">Поворот<select aria-label="Поворот кухонного модуля" value={placed.rotation ?? 0} onChange={(e) => rotate(Number(e.target.value) as 0 | 90 | 180 | 270)}>{[0, 90, 180, 270].map((r) => <option key={r} value={r}>{r}°</option>)}</select></label>
    <p className="field-note">Отступы — по монтажному габариту с фальшами и выступом ХДФ. Тяните модуль в сцене — края притягиваются к соседям.</p>
    <button className="text-action danger" disabled={project.modules.length === 1} onClick={() => commit({ ...project, modules: project.modules.filter((a) => a.id !== placed.id) })}>Удалить модуль · Ctrl+Z вернёт</button>
  </Group>;
}

/** Фурнитура модуля списком (то, что видно в 3D моделями Базиса) и проверка пересечений деталей. */
function Hardware({ list, m, showInside }: { list: Part[]; m: Module; showInside: () => void }) {
  const rows = useMemo(() => hardwareRows(list), [list]);
  const collisions = useMemo(() => partCollisions(list, m), [list, m]);
  // фурнитура в воздухе, как в проекте Базиса (навесы над корпусом: k26–k28, k31) — студия положение не меняет, но говорит о нём
  const air = useMemo(() => bazisAirHardware(list, m), [list, m]);
  return <Group icon={<Wrench size={15} />} title="Фурнитура модуля" note={rows.reduce((s, r) => s + r[1], 0) + " шт."}>
    <ul className="kitchen-hardware">{rows.map(([name, n]) => <li key={name}><span>{name}</span><b>{n}</b></li>)}</ul>
    <button className="outline full" onClick={showInside}>Открыть фасады — увидеть петли, опоры, навесы</button>
    {collisions.length
      ? <p role="alert" className="kitchen-warn"><TriangleAlert size={14} /> Пересекаются детали: {collisions.slice(0, 3).map((c) => `${c.names[0]} × ${c.names[1]} (${c.depth} мм${c.bazis ? ", как в проекте Базиса" : ""})`).join("; ")}{collisions.length > 3 ? ` и ещё ${collisions.length - 3}` : ""}.{collisions.every((c) => c.bazis) ? " Так в самом проекте Базиса: отверстие крепежа вскрывает паз — исправляется в Базисе." : ""}</p>
      : <p className="kitchen-ok"><CircleCheck size={14} /> Детали и фурнитура не пересекаются.</p>}
    {/* «в воздухе» — не пересечение: сведения «как в проекте Базиса», как у сырого модуля (RawInfo; слияние n4-wardrobes и n4-antresol) */}
    {air.length > 0 && <p className="field-note"><Info size={12} /> Висит в воздухе (дальше {BAZIS_AIR} мм от деталей) — {air.length} шт.: {air.slice(0, 3).map((x) => `${x.name} (${x.gap} мм)`).join("; ")}{air.length > 3 ? " …" : ""}. Стоит по координатам проекта Базиса — детали, на которой она крепится, в модели нет: проверьте в Базисе или после смены размера модуля.</p>}
  </Group>;
}

function CabinetPanel(props: KitchenPanelProps) {
  const { m, placed, project, modify, commit, material, handles, stage } = props;
  const k = m.kitchen!, role = k.role, legged = (role === "base" || role === "tall") && !!m.feet, hanging = role === "wall" || role === "antresol";
  const list = useMemo(() => parts(m), [m]);
  const [si, setSi] = useState(0), sIdx = Math.min(si, m.sections.length - 1), s = m.sections[sIdx];
  const [onlyThis, setOnlyThis] = useState(false);
  const item = kitchenItemOf(m), group = item ? KITCHEN_ITEMS[item].group : "base";
  const kinds = (Object.keys(KITCHEN_ITEMS) as KitchenItem[]).filter((x) => KITCHEN_ITEMS[x].group === group);
  const setK = (patch: Partial<NonNullable<Module["kitchen"]>>) => modify((n) => { n.kitchen = { ...n.kitchen!, ...patch }; });
  const legs = k.legs ?? { back: KITCHEN.legInset, front: KITCHEN.legInset }, plinth = k.plinth ?? { height: KITCHEN.plinthHeight };
  const setLegs = (patch: Partial<NonNullable<typeof k.legs>>) => setK({ legs: { ...legs, ...patch } });
  const setPlinth = (patch: Partial<NonNullable<typeof k.plinth>>) => { const next = { ...plinth, ...patch }; if (next.off !== true) delete next.off; if (next.clips !== false) delete next.clips; setK({ plinth: next }); };
  const rail = (place: Rail["place"]) => m.rails?.find((r) => r.place === place);
  const setRail = (place: Rail["place"], patch: Partial<Rail> | null) => modify((n) => {
    const rest = (n.rails ?? []).filter((r) => r.place !== place), cur = n.rails?.find((r) => r.place === place);
    n.rails = patch === null ? rest : [...rest, { place, height: KITCHEN.railWidth, lay: "flat", ...cur, ...patch }];
    if (!n.rails.length) delete n.rails;
    if (n.kdrawers) n.kdrawers = refitKDrawers(n); // нижняя царга поднимает пол под ящиками
  });
  const doors = list.filter((p) => p.role === "door" && p.sectionId === s.id), door = doors[0];
  const hingeCount = list.filter((p) => p.id.includes(":hingecup:")).length;
  const auto = door ? hingePositions(door.size[1], door.size[0], true) : [];
  const legCount = list.filter((p) => p.id.startsWith("leg:")).length, clipCount = list.filter((p) => p.id.startsWith("kitchen-clip:")).length, plinthPart = list.find((p) => p.id === "kitchen-plinth");
  const hasFronts = m.doors || m.sections.some((x) => x.drawers > 0) || !!m.kdrawers?.length;
  const legsAll = (v: number) => commit(setLegHeight(project, onlyThis ? [placed.id] : legModules(project), v));
  const legsToAll = () => commit({ ...project, modules: project.modules.map((a) => {
    const ak = a.module.kitchen;
    if (a.id === placed.id || !ak || (ak.role !== "base" && ak.role !== "tall") || !a.module.feet) return a;
    const ph = Math.min(plinth.height, a.module.feet.height);
    return { ...a, module: { ...a.module, kitchen: { ...ak, legs: { back: legs.back, front: legs.front, ...(legs.side === undefined ? {} : { side: legs.side }) }, plinth: { ...plinth, height: ph } } } };
  }) });
  const appliance = k.appliance ? APPLIANCES[k.appliance] : undefined;

  // Петли: текущая высота фасада и фактические ручные высоты (scaleHingeY), чтобы панель показывала и сохраняла то, что стоит в 3D
  const dhNow = door ? Math.round(door.size[1] * 10) / 10 : 0;
  const shownY = s.hingeY?.length ? scaleHingeY(s.hingeY, s.hingeYFor ?? dhNow, dhNow).map((y) => Math.round(y * 10) / 10) : [];
  return <div className="kitchen-panel">
    <div className="property-section kitchen-head">
      <span className="eyebrow">{ROLE[role] ?? "Кухонный модуль"}{appliance ? " · " + appliance.label.toLowerCase() : ""}</span>
      <h2>{m.name}</h2>
      <p>{m.width} × {m.height} × {m.depth} мм{legged ? ` · корпус ${m.height - m.feet!.height} + опоры ${m.feet!.height}` : ""}</p>
      <Colors m={m} material={material} />
    </div>

    <Group icon={<Box size={15} />} title="Корпус" open={stage === "bodies"}>
      {item && kinds.length > 1 && <label className="hardware-field">Назначение<select aria-label="Назначение кухонного модуля" value={item} onChange={(e) => modify((n) => { const r = rebuildKitchen(n, e.target.value as KitchenItem); for (const key of Object.keys(n)) delete (n as Record<string, unknown>)[key]; Object.assign(n, r); })}>
        {kinds.map((x) => <option key={x} value={x}>{KITCHEN_ITEMS[x].label}</option>)}</select></label>}
      {item && kinds.length > 1 && <p className="field-note">Смена назначения пересобирает модуль по регламенту Базиса (ширина, цвета, петли и ручки сохраняются).</p>}
      <label className="hardware-field">Название<input aria-label="Название кухонного модуля" key={m.name} defaultValue={m.name} maxLength={80} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== m.name) modify((n) => { n.name = v; }); }} /></label>
      {/* предел — как в проверке кухни (KITCHEN.maxModuleWidth 1650: мойка 1480 k28 m17), не 1200 нарезки ряда */}
      <Num label="Ширина" value={m.width} min={KITCHEN.minWidth} max={KITCHEN.maxModuleWidth} change={(v) => modify((n) => { n.width = v; })} />
      <Num label={legged ? "Высота с опорами" : "Высота"} value={m.height} min={RULES.minH} max={maxHeightOf(m)} change={(v) => modify((n) => { n.height = v; if (n.kdrawers) n.kdrawers = refitKDrawers(n, "height"); })} note={legged ? `Нижний по регламенту — ${KITCHEN.baseHeight}: корпус ${KITCHEN.baseBody} + опоры ${KITCHEN.legs}` : undefined} />
      <Num label="Глубина" value={m.depth} min={RULES.minD} max={RULES.maxD} change={(v) => modify((n) => { n.depth = v; if (n.kdrawers) n.kdrawers = refitKDrawers(n, "depth"); })} note={m.backType === "nailed" ? "Боковина; накладной ХДФ добавляет 3 мм" : undefined} />
      <Check label="Дно под боковинами (боковины стоят на дне)" checked={!!m.bottomUnder} change={(v) => modify((n) => { if (v) n.bottomUnder = true; else delete n.bottomUnder; })} />
      <Check label={role === "base" ? "Крыша (у нижних обычно нет — царги под столешницу)" : "Крыша"} checked={m.topType !== "none"} change={(v) => modify((n) => { if (v) delete n.topType; else n.topType = "none"; })} />
      <div className="kitchen-field"><span>Кромка открытых торцов</span>
        <div className="kitchen-chips" role="group" aria-label="Кромка открытых торцов">{([1, 0.5, undefined] as const).map((t) => <button key={String(t)} type="button" title={t ? "Как в Базисе цеха: открытые торцы — кромка, скрытые — без кромки" : "Как у шкафов студии: кромка 2 мм на видимых торцах"} aria-pressed={m.edgeScheme?.t === t} onClick={() => modify((n) => { if (t) n.edgeScheme = { t }; else delete n.edgeScheme; })}>{t ? String(t).replace(".", ",") + " мм" : "как у шкафов"}</button>)}</div></div>
      <details className="kitchen-rails">
        <summary className="rails-title">Царги и стяжки · {m.rails?.length ? m.rails.map((r) => `${RAIL_PLACES[r.place]} ${r.height}${r.lay === "flat" ? " лёжа" : ""}`).join(", ") : "нет"}</summary>
        {(Object.keys(RAIL_PLACES) as Rail["place"][]).map((place) => { const r = rail(place); return <div key={place} className="kitchen-rail">
          <Check label={"Царга " + RAIL_PLACES[place]} checked={!!r} change={(v) => setRail(place, v ? {} : null)} />
          {r && <>
            <div className="kitchen-chips" role="group" aria-label={"Укладка царги " + RAIL_PLACES[place]}>
              {(["flat", "edge"] as const).map((lay) => <button key={lay} type="button" aria-pressed={(r.lay ?? "edge") === lay} onClick={() => setRail(place, { lay })}>{lay === "flat" ? "Лёжа" : "На ребре"}</button>)}
            </div>
            <Num label={r.lay === "flat" ? "Ширина царги" : "Высота царги"} value={r.height} min={RULES.railMin} max={RULES.railMax} change={(v) => setRail(place, { height: v })} />
            {place.startsWith("front") && <Num label="Утопание от лица корпуса" value={r.setback ?? 0} min={0} max={80} change={(v) => setRail(place, { setback: v || undefined })} note="Под профиль Gola — 20–30 мм" />}
          </>}
        </div>; })}
      </details>
      <label className="hardware-field">Задняя стенка<select aria-label="Задняя стенка кухонного модуля" value={m.backType ?? "nailed"} onChange={(e) => modify((n) => {
        const v = e.target.value as "nailed" | "groove" | "none"; n.backType = v;
        if (v === "groove") { const g = KITCHEN.groove; n.grooveInset ??= g.inset; n.grooveWidth ??= g.width; n.grooveDepth ??= g.depth; n.grooveClear ??= g.clear; }
        if (v === "nailed") n.backGap ??= KITCHEN.backGap;
      })}><option value="nailed">ХДФ 3 мм накладной</option><option value="groove">ХДФ 3 мм в паз</option><option value="none">Без задней стенки</option></select></label>
      {(m.backType ?? "nailed") === "nailed" && <Num label="Отступ ХДФ от кромок" value={m.backGap ?? 2} min={0} max={10} step={0.5} change={(v) => modify((n) => { n.backGap = v; })} note={`Базис: ${KITCHEN.backGap} → ХДФ (W−3)×(H−3)`} />}
      {m.backType === "groove" && <>
        <Num label="Паз от задней кромки" value={m.grooveInset ?? 16} min={8} max={30} change={(v) => modify((n) => { n.grooveInset = v; })} />
        <Num label="Ширина паза" value={m.grooveWidth ?? 4} min={3} max={10} step={0.5} change={(v) => modify((n) => { n.grooveWidth = v; })} />
        <Num label="Глубина паза" value={m.grooveDepth ?? 8} min={4} max={10} change={(v) => modify((n) => { n.grooveDepth = v; })} />
        <Num label="Недоход ХДФ до дна паза" value={m.grooveClear ?? 0.5} min={0} max={3} step={0.5} change={(v) => modify((n) => { n.grooveClear = v; })} note="Базис П16-4×8: ХДФ (W−18)×(H−18)" />
      </>}
      {m.backType === "none" && <p className="field-note">Без задника — как под мойку и духовку в Базисе: доступ к коммуникациям и вентиляция.</p>}
      {/* флаг модуля из Базиса: действует и на полки, добавленные потом в студии, — поэтому виден и снимается здесь */}
      {k.fasteners === false && <p className="field-note">Как в проекте Базиса: крепежа нет — ни конфирматов, ни эксцентриков, ни полкодержателей в 3D, присадке и смете. Добавили полку или стык — <button className="text-action" onClick={() => modify((n) => { delete n.kitchen!.fasteners; })}>Поставить крепёж</button></p>}
    </Group>

    {legged && <Group icon={<Footprints size={15} />} title="Опоры и цоколь" open={stage === "bodies"} note={`${legCount} оп. · ${clipCount} клипс`}>
      <Num label="Высота опор" value={m.feet!.height} min={55} max={RULES.feetMax} change={(v) => legsAll(v)} note="Опора H100-120: корпус не меняется, модуль и столешница поднимаются" />
      <Check label="Только у этого модуля" checked={onlyThis} change={setOnlyThis} />
      <Num label="Опоры от зада" value={legs.back} min={20} max={Math.floor(m.depth / 2) - 20} change={(v) => setLegs({ back: v })} note="Задний ряд — от задней кромки дна; Базис — 70" />
      <Num label="Опоры от переда" value={legs.front} min={20} max={Math.floor(m.depth / 2) - 20} change={(v) => setLegs({ front: v })} note="Передний ряд (с клипсами) — от передней кромки дна; Базис — 70" />
      {m.width >= 250 && !legs.xs && <Num label="Опоры от торцов" value={legs.side ?? KITCHEN.legInset} min={20} max={Math.floor(m.width / 2) - 20} change={(v) => setLegs({ side: v })} note={m.width > 1300 ? (legs.rows2 ? "Два ряда без среднего — как в проекте Базиса" : "Шире 1300 — третий ряд посередине") : "По Базису — 70 от краёв дна"} />}
      {m.width < 250 && <p className="field-note">Узкий модуль: одна пара опор по центру ширины.</p>}
      {legs.xs && <p className="field-note">Раскладка опор из проекта Базиса: {legs.xs.map((x) => Math.round(x)).join(", ")} мм от левого края. <button className="text-action" onClick={() => { const { xs: _xs, ...rest } = legs; void _xs; setK({ legs: rest }); }}>Вернуть по правилу</button></p>}
      <Check label="Цоколь у этого модуля" checked={!plinth.off} change={(v) => setPlinth({ off: v ? undefined : true })} />
      {!plinth.off && <Num label="Высота цоколя" value={plinth.height} min={50} max={m.feet!.height} change={(v) => setPlinth({ height: v })} note={`Регламент: ${KITCHEN.plinthHeight} — на 5 мм ниже дна`} />}
      <Check label="Клипсы цоколя на передних опорах" checked={plinth.clips !== false} change={(v) => setPlinth({ clips: v ? undefined : false })} />
      <p className="field-note">{plinthPart ? `Цоколь ${Math.round(plinthPart.size[0])}×${Math.round(plinthPart.size[1])} ЛДСП 16 — на клипсах, за фасадом на ${Math.round(m.depth + (m.facadeT ?? 16) + (m.faceAir ?? 0) - (plinthPart.position[2] + plinthPart.size[2] / 2))} мм.` : "Цоколь ряда — у соседнего модуля (сплошной цоколь обычно ставят у крайнего)."} Опор: {legCount}, клипс: {clipCount} — так же в смете.</p>
      <button className="outline full" onClick={legsToAll}>Эти отступы опор и цоколь — всем нижним</button>
    </Group>}

    {hasFronts && <Group icon={<Layers size={15} />} title="Фасады" open={stage === "facades"}>
      <Check label="Распашные фасады" checked={m.doors} change={(v) => modify((n) => { n.doors = v; })} />
      {m.doors && <div className="kitchen-field"><span>Створки{m.sections.length > 1 ? ` · секция ${sIdx + 1}` : ""}</span>
        <div className="kitchen-chips" role="group" aria-label="Число створок">{([undefined, 1, 2] as const).map((v) => <button key={String(v)} type="button" aria-pressed={s.doorLeaves === v} onClick={() => modify((n) => { if (v) n.sections[sIdx].doorLeaves = v; else delete n.sections[sIdx].doorLeaves; })}>{v ?? "Авто"}</button>)}</div></div>}
      <label className="hardware-field">Материал фасадов<select aria-label="Материал кухонных фасадов" value={m.vernissage ? "vernissage" : m.facadeMaterial ?? "ldsp"} onChange={(e) => modify((n) => { const v = e.target.value; if (v === "vernissage") { delete n.facadeMaterial; n.vernissage = { ...DEFAULT_VERNISSAGE }; n.facadeT = DEFAULT_VERNISSAGE.thickness; return; } delete n.vernissage; if (v === "external") n.facadeMaterial = "external"; else delete n.facadeMaterial; })}>
        <option value="ldsp">ЛДСП — в раскрое цеха</option><option value="external">Фасадный материал (МДФ, эмаль, плёнка) — сторонний участок</option><option value="vernissage">МДФ «Вернисаж» — фрезеровка, плёнка, эмаль (прайс)</option></select></label>
      {m.vernissage && <VernissagePicker value={m.vernissage} sample={door ? [Math.round(door.size[0]), Math.round(door.size[1])] : undefined} onChange={(v) => modify((n) => { n.vernissage = v; n.facadeT = v.thickness; })} />}
      <Num label="Толщина фасада" value={m.facadeT ?? RULES.panel} min={3} max={40} change={(v) => modify((n) => { if (v === RULES.panel) delete n.facadeT; else n.facadeT = v; })} note="ЛДСП 16, МДФ 18–19, рамка со стеклом — по профилю" />
      <Num label="Отступ от кромок корпуса" value={m.faceGap ?? RULES.faceGap} min={0} max={5} step={0.5} change={(v) => modify((n) => { n.faceGap = v; if (n.kdrawers) n.kdrawers = refitKDrawers(n); })} note={`Базис цеха: ${KITCHEN.faceGap} → фасад W−3 × H−3`} />
      <Num label="Зазор между фасадами" value={m.faceGapBetween ?? KITCHEN.faceGapBetween} min={0} max={10} step={0.5} change={(v) => modify((n) => { n.faceGapBetween = v; if (n.kdrawers) n.kdrawers = refitKDrawers(n); })} />
      <Num label="Воздух до корпуса" value={m.faceAir ?? 2} min={0} max={10} step={0.5} change={(v) => modify((n) => { n.faceAir = v; })} note="Кухни Базиса — 0 (фасад вплотную)" />
      <Check label="Ручки на фасадах" checked={!m.noHandles} change={(v) => modify((n) => { if (v) delete n.noHandles; else n.noHandles = true; })} />
      {!m.noHandles ? <button className="text-action" onClick={handles}>Ручка: {handleById(m.handleId).label}</button> : <p className="field-note">Без ручек: Gola, ручки заказчика или push — в смете ручек нет.</p>}
    </Group>}

    {m.doors && <Group icon={<Link2 size={15} />} title="Петли" open={stage === "facades"} note={k.hinges === false ? "нет, как в Базисе" : hingeCount + " шт."}>
      {/* флаг модуля из Базиса: действует и на двери, добавленные потом в студии, — поэтому виден и снимается здесь */}
      {k.hinges === false && <p className="field-note">Как в проекте Базиса: фасады без петель — петель нет ни в 3D, ни в присадке, ни в смете. Добавили или заменили дверь — <button className="text-action" onClick={() => modify((n) => { delete n.kitchen!.hinges; })}>Поставить петли</button></p>}
      <label className="hardware-field">Бренд петель<select aria-label="Бренд петель кухонного модуля" value={m.hingeBrand ?? "gtv"} onChange={(e) => modify((n) => { const v = e.target.value as HingeBrand; if (v === "gtv") delete n.hingeBrand; else n.hingeBrand = v; })}>
        {(Object.keys(HINGE_BRANDS) as HingeBrand[]).map((b) => <option key={b} value={b}>{HINGE_BRANDS[b].label} · {HINGE_BRANDS[b].note} · {HINGE_BRANDS[b].soft.price} ₽/шт</option>)}</select></label>
      {door && doors.filter((d) => Math.abs(d.position[1] - door.position[1]) < 1).length === 1 && <label className="hardware-field">Петли одиночной створки<select aria-label="Сторона петель кухонного модуля" value={s.hingeSide ?? m.hingeSide ?? "left"} onChange={(e) => modify((n) => { n.sections[sIdx].hingeSide = e.target.value as "left" | "right"; })}><option value="left">Слева</option><option value="right">Справа</option></select></label>}
      {/* фактические высоты (ручные пересчитаны под текущую высоту фасада) — их показываем и от них считаем правки */}
      <div className="kitchen-chips" role="group" aria-label="Высоты петель">
        <button type="button" aria-pressed={!s.hingeY?.length} onClick={() => modify((n) => { delete n.sections[sIdx].hingeY; delete n.sections[sIdx].hingeYFor; })}>Авто</button>
        <button type="button" aria-pressed={!!s.hingeY?.length} disabled={!door || !!s.hingeY?.length} title={s.hingeY?.length ? "Уже вручную: правьте высоты ниже; «Авто» — вернуть правило" : undefined} onClick={() => modify((n) => { n.sections[sIdx].hingeY = auto.map((y) => Math.round(y)); n.sections[sIdx].hingeYFor = dhNow; })}>Вручную</button>
      </div>
      {!s.hingeY?.length && door && <p className="field-note">По правилу: {auto.length} шт. на {Math.round(door.size[1])} мм — {auto.map((y) => Math.round(y)).join(" и ")} мм от низа фасада; если там полка, царга или конфирмат — петля сдвигается до свободного места.</p>}
      {!!s.hingeY?.length && door && <>
        {shownY.map((y, j) => <Num key={j} label={`Петля ${j + 1} от низа фасада`} value={y} min={40} max={Math.floor(door.size[1] - 40)} change={(v) => modify((n) => { const h = [...shownY]; h[j] = v; n.sections[sIdx].hingeY = h.sort((a, b) => a - b); n.sections[sIdx].hingeYFor = dhNow; })} />)}
        <div className="kitchen-chips">
          <button type="button" disabled={s.hingeY.length >= 5} onClick={() => modify((n) => { n.sections[sIdx].hingeY = addHinge(shownY); n.sections[sIdx].hingeYFor = dhNow; })}>+ петля</button>
          <button type="button" disabled={s.hingeY.length <= 2} onClick={() => modify((n) => { n.sections[sIdx].hingeY = removeHinge(shownY, door.size[1]); n.sections[sIdx].hingeYFor = dhNow; })}>− петля</button>
        </div>
        <p className="field-note">Высоты одинаковы для всех фасадов секции, как в проекте Базиса.{doors.length > 1 && doors.some((d) => Math.abs(d.size[1] - door.size[1]) > 1) ? " У фасадов разной высоты проверьте верхний ряд." : ""}</p>
      </>}
    </Group>}

    {!!m.kdrawers?.length && <Group icon={<Rows3 size={15} />} title={m.kdrawers[0].system === "firmax-ldsp" ? "Ящики Firmax ЛДСП" : m.kdrawers[0].system === "versalite-h45" ? "Ящики Versalite H45" : m.kdrawers[0].system === "start-sc" ? "Ящики Boyard СТАРТ" : m.kdrawers[0].system === "indigo" ? "Ящики Indigo" : m.kdrawers[0].system === "modern-slide" ? "Ящики MODERN SLIDE" : "Ящики Axis PRO"} open={stage === "filling"} note={m.kdrawers.length + " шт."}>
      <div className="kitchen-field"><span>Количество ящиков</span>
        <div className="kitchen-chips" role="group" aria-label="Количество ящиков">{[1, 2, 3, 4].map((c) => { const same = m.kdrawers!.length === c, why = relayoutProblem(m, c); /* текущее число — пересобрать с теми же долями фасадов (царги и длины заново) */
          return <button key={c} type="button" aria-pressed={same} disabled={!same && !!why} title={why ?? (same ? "Пересобрать ящики: царги и длины заново под корпус, доли фасадов те же" : undefined)} onClick={() => modify((n) => { n.kdrawers = same ? relayoutKDrawers(n, c, n.kdrawers!.map((k) => k.y1 - k.y0)) : relayoutKDrawers(n, c); })}>{c}</button>; })}</div></div>
      {[...m.kdrawers].map((d, i) => ({ d, i })).reverse().map(({ d, i }) => <div key={i} className="kitchen-rail">
        <p className="field-note"><b>Ящик {i + 1}{i === 0 ? " (нижний)" : ""}</b>: фасад {Math.round((d.y1 - d.y0) * 10) / 10} мм · {axisLabel(d)} · направляющая на {d.runnerY} от пола модуля</p>
        {i < m.kdrawers!.length - 1 && <Num label={`Фасад ящика ${i + 1}`} value={Math.round((d.y1 - d.y0) * 10) / 10} min={100} max={kdrawerFacadeMax(m, i)} step={0.5} change={(v) => modify((n) => { n.kdrawers = setKDrawerFacade(n, i, v); })} note={i === 0 ? "Верхний ящик забирает остаток высоты" : undefined} />}
        {d.system === "axis-pro" && <div className="kitchen-chips" role="group" aria-label={`Царга ящика ${i + 1}`}>{AXIS_HEIGHTS.map((h) => { const k2 = withAxisH(m, d, h), fit = axisFits(m, k2), ok = fit && axisAvailable(k2) && k2.len <= axisMaxLen(m); /* длина подбирается под глубину и царгу */
          return <button key={h} type="button" aria-pressed={d.h === h} disabled={d.h !== h && !ok} title={!fit ? "Не входит: короб ближе 21,5 мм к верху фасада или 5 мм к царгам корпуса" : !ok ? `Нет модели Axis PRO H-${h} под глубину корпуса ${m.depth}` : undefined} onClick={() => modify((n) => { const o = n.kdrawers![i]; if (o.system !== "axis-pro") return; n.kdrawers![i] = withAxisH(n, o, h); })}>H-{h}</button>; })}</div>}
        {d.system === "firmax-ldsp" && <p className="field-note">Короб ЛДСП 16: боковины {d.box.h} × {d.box.len} мм с {d.box.y} от пола модуля, дно на {d.box.bottomUp ?? 10} выше низа боковин</p>}
        {d.system === "versalite-h45" && <p className="field-note">Короб ЛДСП 16: боковины {d.box.h} × {d.box.len} мм с {d.box.y} от пола модуля, дно у низа боковин; направляющая H45 {d.len} мм</p>}
        {d.system === "modern-slide" && <p className="field-note">Короб ЛДСП 16: боковины {d.box.h} × {d.box.len} мм с {d.box.y} от пола модуля, дно на {d.box.bottomUp ?? 13} выше низа боковин</p>}
        {d.system === "start-sc" && <p className="field-note">Боковины СТАРТ {d.sb}{d.rail ? " с рейлингом" : ""}{d.inner ? " · внутренний ящик за фасадом" : ""}</p>}
      </div>)}
      <label className="hardware-field">Система ящиков<select aria-label="Система ящиков" value={m.kdrawers[0].system} onChange={(e) => modify((n) => { n.kdrawers = relayoutKDrawers(n, n.kdrawers!.length, n.kdrawers!.map((k) => k.y1 - k.y0), e.target.value as KDrawerSystem); })}><option value="axis-pro">Axis PRO (металлические царги)</option><option value="firmax-ldsp">Firmax ЛДСП (короб ЛДСП, скрытый монтаж)</option><option value="versalite-h45">Versalite Light H45 (короб ЛДСП, шариковые направляющие)</option><option value="start-sc">Boyard СТАРТ Soft-Closing (металлические боковины SB08/SB19/SB20)</option><option value="indigo">Indigo (металлические царги H=90 / H=175, 500 мм)</option><option value="modern-slide">MODERN SLIDE (короб ЛДСП, направляющая без модели Базиса)</option></select></label>
      {m.kdrawers[0].system === "firmax-ldsp" && <>
        <Check label="Саморезы направляющих 3×3 в боковинах корпуса" checked={m.kdrawers.every((k) => k.system !== "firmax-ldsp" || !!k.box.screws)} change={(v) => modify((n) => { n.kdrawers = firmaxSetScrews(n.kdrawers!, "screws", v); })} />
        <Check label="Шурупы фальшпанели в фасад 3,5×30" checked={m.kdrawers.every((k) => k.system !== "firmax-ldsp" || !!k.box.faceScrews)} change={(v) => modify((n) => { n.kdrawers = firmaxSetScrews(n.kdrawers!, "faceScrews", v); })} />
      </>}
      {m.kdrawers[0].system === "axis-pro" && <label className="hardware-field">Цвет Axis PRO<select aria-label="Цвет Axis PRO" value={m.kdrawers[0].color ?? "white"} onChange={(e) => modify((n) => { n.kdrawers = n.kdrawers!.map((k) => { if (k.system !== "axis-pro") return k; const c = { ...k }; if (e.target.value === "anthracite") c.color = "anthracite"; else delete c.color; return c; }); })}><option value="white">Белый</option><option value="anthracite" disabled={!m.kdrawers.every((k) => axisAvailable({ ...k, color: "anthracite" }))}>Антрацит{m.kdrawers.every((k) => axisAvailable({ ...k, color: "anthracite" })) ? "" : " — нет моделей на эти размеры"}</option></select></label>}
      <p className="field-note">{m.kdrawers[0].system === "modern-slide" ? "Как в проектах Базиса цеха: короб ЛДСП 16 на конфирматах (боковины в 8,5 мм от корпуса, дно на 13 выше их низа), саморезы 3,5×16 в корпус. Направляющая MODERN SLIDE в Базисе без 3D-модели — в студии условный профиль под дном." : m.kdrawers[0].system === "indigo" ? "Как в проектах Базиса цеха: дно и задняя стенка ЛДСП 16, царги Indigo H=175 (или H=90, если не входит), направляющие Indigo 500, саморезы 3×3." : m.kdrawers[0].system === "start-sc" ? "Как в проектах Базиса цеха: дно и задняя стенка ЛДСП 16, металлические боковины СТАРТ (SB20 — с рейлингом), направляющие Soft-Closing на шурупах 3,5×16, держатели задней стенки и крепления фасада на саморезах 3×3." : m.kdrawers[0].system === "versalite-h45" ? "Как в проектах Базиса цеха: короб ЛДСП 16 на конфирматах (боковины в 13 мм от корпуса, дно у их низа, задняя стенка и фальшпанель на дне), шариковые направляющие Versalite Light H45 на шурупах 3,5×16; посадка короба в Базисе ручная — по умолчанию медианы базы." : m.kdrawers[0].system === "firmax-ldsp" ? "Как в проектах Базиса цеха: короб ЛДСП 16 на конфирматах (боковины в 5 мм от корпуса, задняя стенка и фальшпанель на дне), направляющие Firmax скрытого монтажа под дном." : "Как в проектах Базиса цеха: дно и задняя стенка ЛДСП 16, царги металлические, направляющие на боковинах (саморезы 3×3, фиксаторы D5), держатели фасада AB/CD."} Высота корпуса или глубина меняются — ящики пересчитываются.</p>
    </Group>}

    {!m.kdrawers?.length && !m.sections.every((x) => x.drawers > 0) && <Group icon={<Rows3 size={15} />} title="Полки" open={stage === "filling"} note={m.sections.reduce((n, x) => n + x.shelves.length, 0) + " шт."}>
      {m.sections.length > 1 && <div className="kitchen-chips" role="group" aria-label="Секция модуля">{m.sections.map((x, i) => <button key={x.id} type="button" aria-pressed={i === sIdx} onClick={() => setSi(i)}>Секция {i + 1}</button>)}</div>}
      {s.drawers > 0 ? <p className="field-note">В секции ящики — полки настраиваются на вкладке «Секция».</p> : <>
        <label className="hardware-field">Количество полок<select aria-label="Количество полок кухонного модуля" value={s.shelves.length} onChange={(e) => modify((n) => { const sec = n.sections[sIdx], c = Number(e.target.value); sec.shelves = distribute(n, sec, c); if (sec.glassShelves) sec.glassShelves = sec.glassShelves.length ? sec.shelves.map((_, i) => i) : undefined; if (!sec.glassShelves?.length) delete sec.glassShelves; if (sec.fixed) sec.fixed = sec.fixed.filter((j) => j < c); })}>
          {Array.from({ length: 7 }, (_, n) => <option key={n} value={n}>{n}</option>)}</select></label>
        {s.shelves.length > 0 && <Check label="Полки из стекла (закалённое, полкодержатели MV05)" checked={!!s.glassShelves?.length} change={(v) => modify((n) => { const sec = n.sections[sIdx]; if (v) sec.glassShelves = sec.shelves.map((_, i) => i); else delete sec.glassShelves; })} />}
        {!!s.glassShelves?.length && <div className="kitchen-field"><span>Толщина стекла</span><div className="kitchen-chips" role="group" aria-label="Толщина стекла полок">{[4, 6].map((t) => <button key={t} type="button" aria-pressed={(m.glassT ?? 6) === t} onClick={() => modify((n) => { if (t === 6) delete n.glassT; else n.glassT = t; })}>{t} мм</button>)}</div></div>}
        <p className="field-note">Полки расставляются равномерно; точная высота — перетаскиванием в 3D или на вкладке «Секция». В 1 мм от задника, полкодержатели в 60 мм от кромок — как в Базисе.</p>
      </>}
    </Group>}

    {hanging && <Group icon={<Anchor size={15} />} title="Навесы" open={stage === "bodies"} note={k.hangers === false ? "нет" : "2 шт."}>
      <Check label="Навесы ABS регулируемые, левый и правый" checked={k.hangers !== false} change={(v) => setK({ hangers: v ? undefined : false })} />
      {k.hangers !== false ? <>
        <ul className="kitchen-hardware">
          <li><span>Навес мебельный регулируемый ABS · левый и правый</span><b>2</b></li>
          <li><span>Заглушка навеса ABS · левая и правая</span><b>2</b></li>
        </ul>
        <p className="field-note">Навесы — на внутренних гранях боковин: {KITCHEN.hangerDown} мм ниже верха и {KITCHEN.hangerBack} мм от задней кромки; крюк заподлицо с задней кромкой, к шине или планке на стене. Модели и сетки — из проектов Базиса цеха. Задник навесных — ХДФ в паз П16-4×8.</p>
      </> : <p className="field-note">Без навесов: модуль вешают иначе (планка, шина, крепёж по месту) — в смете навесов нет.</p>}
      <p className="field-note">Низ модуля от пола: {Math.round(props.placed.y ?? 0)} мм{(() => { const under = project.modules.find((a) => a.module.worktop && a.x < placed.x + m.width && a.x + a.module.width > placed.x); return under ? ` · от столешницы ${Math.round((placed.y ?? 0) - (under.y ?? 0) - under.module.height)} мм (регламент ${KITCHEN.wallGap}, минимум ${KITCHEN.wallGapMin}, над вытяжкой ${KITCHEN.hoodGapMin})` : ""; })()}.</p>
    </Group>}

    {appliance && <div className="property-section kitchen-note"><Info size={14} /><p>{appliance.label}{appliance.niche[0] ? `: ниша ${appliance.niche.join(" × ")} мм по паспорту типовой модели.` : "."} {k.appliance === "sink" ? "Задника нет, передняя царга на ребре — под сифон и трубы." : k.appliance === "oven" ? "Без задника и царг — под вентиляцию и розетку." : ""}</p></div>}

    <Hardware list={list} m={m} showInside={props.showInside} />
    <Position {...props} />
  </div>;
}

function WorktopPanel(props: KitchenPanelProps) {
  const { m, modify, stage, material } = props, w = m.worktop!;
  const setW = (patch: Partial<WorktopSpec>) => modify((n) => { n.worktop = { ...n.worktop!, ...patch }; });
  const setCut = (i: number, patch: Partial<WorktopSpec["cutouts"][number]>) => modify((n) => { const c = [...n.worktop!.cutouts]; c[i] = { ...c[i], ...patch }; n.worktop = { ...n.worktop!, cutouts: c }; });
  // вырез — над модулем под мойку (варочная — над духовкой), если он под этой столешницей; иначе по центру
  const over = (kind: "sink" | "hob") => props.project.modules.find((a) => a.module.kitchen?.appliance === (kind === "sink" ? "sink" : "oven") && (a.rotation ?? 0) === (props.placed.rotation ?? 0) && a.x >= props.placed.x - 1 && a.x + a.module.width <= props.placed.x + m.width + 1);
  const addCut = (kind: "sink" | "hob") => modify((n) => {
    const [cw, cd] = kind === "sink" ? [500, 450] : [560, 490], below = over(kind);
    const x = below ? below.x - props.placed.x + (below.module.width - cw) / 2 : (n.width - cw) / 2;
    n.worktop = { ...n.worktop!, cutouts: [...n.worktop!.cutouts, { kind, x: Math.max(50, Math.min(n.width - 50 - cw, Math.round(x))), width: cw, depth: cd }] };
  });
  return <div className="kitchen-panel">
    <div className="property-section kitchen-head"><span className="eyebrow">Столешница</span><h2>{m.name}</h2><p>{m.width} × {m.depth} мм · {worktopLabel(w)} {w.thickness} мм</p></div>
    <Group icon={<RectangleHorizontal size={15} />} title="Столешница" open={stage !== "filling"}>
      <label className="hardware-field">Материал<select aria-label="Материал столешницы" value={w.material} onChange={(e) => setW({ material: e.target.value as WorktopSpec["material"] })}>
        <option value="postforming">Постформинг (СКИФ)</option><option value="ldsp">ЛДСП 16+16 — в раскрое цеха</option><option value="stone">Искусственный камень</option></select></label>
      <Num label="Длина" value={m.width} min={200} max={4100} change={(v) => modify((n) => { n.width = v; })} note="Длиннее 4100 — двумя частями со стыком" />
      <Num label="Глубина от стены" value={m.depth} min={400} max={1200} change={(v) => modify((n) => { n.depth = v; })} note={`Регламент ${KITCHEN.worktopDepth}`} />
      <Num label="Толщина" value={w.thickness} min={12} max={60} change={(v) => modify((n) => { n.worktop = { ...n.worktop!, thickness: v }; n.height = v; })} note="СКИФ 26, 28, 38, 40" />
      <Num label="Свес над фасадом" value={w.overhang} min={0} max={60} change={(v) => setW({ overhang: v })} note={`Базис: 21–${KITCHEN.worktopOverhang}`} />
      <Colors m={m} material={material} />
      <div className="kitchen-cuts">
        <span className="rails-title">Вырезы</span>
        {w.cutouts.map((c, i) => <div key={i} className="kitchen-cut">
          <div className="kitchen-chips" role="group" aria-label={"Вырез " + (i + 1)}>{(["sink", "hob"] as const).map((kind) => <button key={kind} type="button" aria-pressed={c.kind === kind} onClick={() => setCut(i, { kind })}>{kind === "sink" ? "Мойка" : "Варочная"}</button>)}
            <button type="button" className="danger" onClick={() => modify((n) => { n.worktop = { ...n.worktop!, cutouts: n.worktop!.cutouts.filter((_, j) => j !== i) }; })}>Убрать</button></div>
          <Num label="От левого торца" value={c.x} min={50} max={Math.max(50, m.width - 50 - c.width)} change={(v) => setCut(i, { x: v })} />
          <Num label="Ширина выреза" value={c.width} min={200} max={Math.max(200, m.width - 100)} change={(v) => setCut(i, { width: v })} />
          <Num label="Глубина выреза" value={c.depth} min={200} max={Math.max(200, m.depth - 80)} change={(v) => setCut(i, { depth: v })} />
        </div>)}
        <div className="kitchen-chips"><button type="button" onClick={() => addCut("sink")}>+ под мойку</button><button type="button" onClick={() => addCut("hob")}>+ под варочную</button></div>
      </div>
      <p className="field-note">Столешница — отдельное изделие: в раскрой ЛДСП не идёт (кроме ЛДСП 16+16), в смете — за погонный метр, вырезы — отдельными работами.</p>
    </Group>
    <Position {...props} open={stage === "bodies"} />
  </div>;
}

const RAW_COUNT_LABEL = { legs: "опоры", clips: "клипсы цоколя", hangers: "навесы", confirmats: "конфирматы", eccentrics: "эксцентрики", shelfHolders: "полкодержатели", dowels: "шканты", hinges: "петли", lifts: "подъёмники (компл.)", drawers: "ящики Axis PRO (компл.)" } as const;
/** Сырой модуль из Базиса: детали как в проекте, правится в Базисе — здесь сведения, положение и удаление. */
function RawInfo(props: KitchenPanelProps) {
  const { m } = props, r = m.raw!;
  const panels = r.panels.length, fronts = r.panels.filter((p) => p.facade).length;
  // вся фурнитура Базиса, что идёт в смету (счётчики, петли по типам, позиции по названию), а не только показанная в 3D (n3-kitchens2)
  const rows = useMemo(() => {
    const out: [string, string][] = [], c = r.counts ?? {}, names = r.names ?? {};
    for (const [k, label] of Object.entries(RAW_COUNT_LABEL) as [keyof typeof RAW_COUNT_LABEL, string][]) {
      if (k === "hinges" && names.hinges) { for (const [n, v] of Object.entries(names.hinges)) out.push([n, String(v)]); continue; }
      if (k === "shelfHolders" && names.shelfHolders) { for (const [n, v] of Object.entries(names.shelfHolders)) out.push([n, String(v)]); continue; }
      if (c[k]) out.push([label, String(c[k])]);
    }
    for (const i of r.items ?? []) out.push([i.name, i.len ? `${Math.round(i.len) / 1000} м` : String(i.n)]);
    // сырой шкаф Базиса (без счётчиков) — фурнитура модели по категориям
    if (!out.length) { const map = new Map<string, number>(); for (const h of r.hardware) map.set(h.category || "прочее", (map.get(h.category || "прочее") ?? 0) + 1); for (const [cat, n] of [...map].sort((a, b) => b[1] - a[1])) out.push([cat, String(n)]); }
    return out;
  }, [r]);
  const total = r.counts || r.items ? Object.values(r.counts ?? {}).reduce((s, v) => s + (v ?? 0), 0) + (r.items ?? []).reduce((s, i) => s + i.n, 0) : r.hardware.length;
  // проверка по политике сырого модуля (collisions.ts rawCheck): посадка фурнитуры и перекрытия панелей «как в Базисе» (n3-wardrobes2)
  const check = useMemo(() => rawCheck(parts(m), m), [m]);
  // навесы кухни, висевшие в файле Базиса над своей боковиной (комплект со старыми координатами) — поставлены на боковину (n4-wardrobes)
  const seated = useMemo(() => [...rawHangerSeats(r)].filter(([i]) => r.hardware[i].category === "навес").length, [r]);
  // figure + contour — внешний контур нарисован, внутренние вырезы нет; figure без контура или skew — габаритом
  const figures = r.panels.filter((p) => p.contour).length, boxes = r.panels.filter((p) => (p.figure && !p.contour) || p.skew).length, holes = r.panels.filter((p) => p.figure && p.contour).length, turned = r.panels.filter((p) => p.obb).length, rods = r.profiles?.length ?? 0;
  return <div className="kitchen-panel">
    <div className="property-section kitchen-head"><span className="eyebrow">Импорт из Базиса</span><h2>{m.name}</h2><p>{Math.round(m.width)} × {Math.round(m.height)} × {Math.round(m.depth)} мм</p></div>
    <div className="property-section kitchen-note raw"><Info size={14} /><p>Модуль перенесён из проекта Базиса как есть: {panels} деталей (фасадов {fronts}), фурнитура по Базису — {total} шт. (в 3D показано {r.hardware.length}).{figures ? ` Фигурных по контуру Базиса — ${figures}.` : ""}{turned ? ` Повёрнутых не на 90° — ${turned}.` : ""}{rods ? ` Штанг Ø25 — ${rods}.` : ""}{boxes ? ` Нарисованы габаритом (контур или поворот не перенесён) — ${boxes}.` : ""}{holes ? ` Внутренние вырезы не нарисованы (контур — внешний) — ${holes}.` : ""} Размеры, наполнение и фурнитура правятся в Базисе; здесь — положение в комнате, смета и раскрой.</p></div>
    {rows.length > 0 && <Group icon={<Wrench size={15} />} title="Фурнитура из Базиса" open note={total + " шт."}>
      <ul className="kitchen-hardware">{rows.map(([c, n], i) => <li key={c + i}><span>{c}</span><b>{n}</b></li>)}</ul>
      {check.deep.length > 0 && <p role="alert" className="kitchen-warn"><TriangleAlert size={14} /> Пересечение: тело фурнитуры в материале панели — {check.deep.slice(0, 3).map((x) => `${x.name} (${-x.gap} мм)`).join("; ")}{check.deep.length > 3 ? ` и ещё ${check.deep.length - 3}` : ""}. Так стоит в проекте Базиса — исправить в Базисе.</p>}
      {check.deep.length === 0 && check.checked > 0 && <p className="kitchen-ok"><CircleCheck size={14} /> Пересечений фурнитуры с деталями нет; стоит на деталях {check.checked - check.outside.length - check.far.length} из {check.checked} по точкам крепления Базиса.</p>}
      {/* «в воздухе» — не пересечение: детали-хозяина нет в самой модели Базиса (модель неполная, деталь удалена, высота модуля
          изменена без навесов, а навеса над боковиной нет). Сведения, не тревога (n4-wardrobes). */}
      {check.far.length > 0 && <p className="field-note"><Info size={12} /> Без детали в модели Базиса (дальше {RAW_FAR} мм от деталей) — {check.far.length} шт.: {check.far.slice(0, 3).map((x) => `${x.name} (${x.gap} мм)`).join("; ")}{check.far.length > 3 ? " …" : ""}. Это не пересечение: в проекте Базиса нет детали, на которой она крепится (модель неполная или деталь удалена) — так в самом проекте.</p>}
      {seated > 0 && <p className="field-note"><Info size={12} /> Навесы ({seated}) в файле Базиса висели над своей боковиной (комплект навесов со старыми координатами) — поставлены на боковину, {RAW_HANGER_DROP} мм ниже её верха, как остальные навесы кухонь.</p>}
      {check.outside.length > 0 && <p className="field-note">Рядом с деталями, но не на них ({RAW_SEAT_GAP}–{RAW_FAR} мм) — {check.outside.length} шт.: {check.outside.slice(0, 2).map((x) => x.name).join("; ")}{check.outside.length > 2 ? " …" : ""}. Так бывает, когда крепление — на профиле без сечения или детали соседнего модуля; сверьте с Базисом.</p>}
    </Group>}
    {check.overlaps.length > 0 && <div className="property-section kitchen-note raw"><Info size={14} /><p>Перекрытия деталей глубже {RAW_JOINT} мм — как в проекте Базиса ({check.overlaps.length}): {check.overlaps.slice(0, 2).map((c) => `${c.names[0]} × ${c.names[1]} (${c.depth} мм)`).join("; ")}{check.overlaps.length > 2 ? " …" : ""}. Студия геометрию сырого модуля не меняет — правится в Базисе.</p></div>}
    <Position {...props} open />
  </div>;
}
