// Окно «Фурнитура» для клиента (менеджеры 22.10.2026, п. 15): вместо выпадающих списков нижней панели — группы (петли, открывание,
// направляющие, ручки, кромка, крепёж — то, что меняет hardwareSwap), у варианта — схема-иконка, понятное название, ключевые свойства
// и розничная разница «+N ₽ к заказу» (итог сметы после замены минус текущий; закупки здесь нет), текущий выбор отмечен.
// Применить — ко всему проекту или к одному модулю (scopedSwap). Образец — окно ручек App.tsx (поиск, цены).
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Check, Search, X } from "lucide-react";
import type { Project } from "./project";
import { estimate } from "./pricing";
import { HANDLES, HANDLE_FINISHES, handleById, handleFinish } from "./handles";
import { HINGE_BRANDS, SLIDE_MOTIONS, SLIDE_SYSTEMS, type HingeBrand } from "./hardware";
import { EDGE_CHOICES, type EdgeThickness } from "./model";
import { hardwareChoice, scopeProject, scopedSwap, setAllEdges, setAllFastening, setAllHandles, setAllHinges, setAllOpening, setAllSlides } from "./hardwareSwap";
import "./hardware-window.css";

type GroupId = "hinges" | "opening" | "slides" | "handles" | "edgeBody" | "edgeFacade" | "fastening";
type Option = { id: string; title: string; props: string[]; icon: ReactElement; current: boolean; make: (p: Project) => Project; what: string; search?: string };
const rub = (n: number) => Math.abs(n).toLocaleString("ru-RU") + " ₽";
const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");

/* Схемы-иконки вариантов (картинок фурнитуры в каталоге нет): петля с чашкой, направляющая, ручка в цвете покрытия, кромка, крепёж. */
const HingeIcon = ({ soft }: { soft: boolean }) => <svg viewBox="0 0 64 40" aria-hidden="true"><rect x="2" y="6" width="14" height="28" rx="2" fill="#e6e2d9" stroke="#7d8b92"/><circle cx="9" cy="20" r="5.5" fill="#c9d1d5" stroke="#55626a"/><path d="M14 20 H44" stroke="#55626a" strokeWidth="5" strokeLinecap="round"/><rect x="42" y="12" width="18" height="16" rx="2" fill="#c9d1d5" stroke="#55626a"/>{soft && <circle cx="30" cy="20" r="3.2" fill="#2449d6"/>}</svg>;
const PushIcon = () => <svg viewBox="0 0 64 40" aria-hidden="true"><rect x="6" y="5" width="34" height="30" rx="2" fill="#e6e2d9" stroke="#7d8b92"/><rect x="42" y="16" width="16" height="8" rx="2" fill="#c9d1d5" stroke="#55626a"/><path d="M30 20 h8 m-4 -4 l4 4 -4 4" stroke="#2449d6" strokeWidth="2.4" fill="none" strokeLinecap="round"/></svg>;
const HandleIcon = ({ color, len }: { color: string; len: number }) => { const w = Math.max(14, Math.min(54, len / 6)); return <svg viewBox="0 0 64 40" aria-hidden="true"><rect x="2" y="6" width="60" height="28" rx="2" fill="#f1eee7" stroke="#b9c1c5"/><rect x={32 - w / 2} y="16" width={w} height="7" rx="3.5" fill={color} stroke="#3b4044" strokeWidth=".8"/></svg>; };
const SlideIcon = ({ hidden, motion }: { hidden: boolean; motion: string }) => <svg viewBox="0 0 64 40" aria-hidden="true"><rect x="6" y="6" width="52" height="20" rx="2" fill="#e6e2d9" stroke="#7d8b92"/>{hidden ? <rect x="10" y="27" width="44" height="5" rx="1" fill="#9aa4a8" stroke="#55626a"/> : <><rect x="4" y="12" width="56" height="5" rx="1" fill="#9aa4a8" stroke="#55626a"/><circle cx="18" cy="14.5" r="1.4" fill="#55626a"/><circle cx="32" cy="14.5" r="1.4" fill="#55626a"/><circle cx="46" cy="14.5" r="1.4" fill="#55626a"/></>}{motion === "soft-close" && <circle cx="54" cy="35" r="3" fill="#2449d6"/>}{motion === "push" && <path d="M22 36 h12 m-4 -3 l4 3 -4 3" stroke="#2449d6" strokeWidth="2" fill="none"/>}</svg>;
const EdgeIcon = ({ t }: { t: number }) => <svg viewBox="0 0 64 40" aria-hidden="true"><rect x="6" y="10" width="48" height="20" fill="#e6e2d9" stroke="#7d8b92"/><rect x="54" y="10" width={Math.max(1.5, t * 2.2)} height="20" fill="#55626a"/></svg>;
const FastIcon = ({ hidden }: { hidden: boolean }) => <svg viewBox="0 0 64 40" aria-hidden="true"><rect x="4" y="6" width="14" height="28" fill="#e6e2d9" stroke="#7d8b92"/><rect x="18" y="26" width="42" height="8" fill="#e6e2d9" stroke="#7d8b92"/>{hidden ? <><circle cx="40" cy="30" r="3.4" fill="#c9d1d5" stroke="#55626a"/><path d="M18 30 H37" stroke="#55626a" strokeWidth="1.6"/></> : <><path d="M4 30 H34" stroke="#55626a" strokeWidth="2.4"/><circle cx="4" cy="30" r="2.6" fill="#55626a"/></>}</svg>;

export function HardwareWindow({ project, commit, onClose, initialModuleId = null }: { project: Project; commit: (p: Project) => boolean; onClose: () => void; initialModuleId?: string | null }) {
  const [scope, setScope] = useState<string | null>(initialModuleId && project.modules.some((a) => a.id === initialModuleId) ? initialModuleId : null);
  const part = useMemo(() => scopeProject(project, scope), [project, scope]);
  const choice = useMemo(() => hardwareChoice(part), [part]);
  const groups = useMemo(() => {
    const g: { id: GroupId; label: string; hint: string }[] = [];
    if (choice.hasDoors) g.push({ id: "hinges", label: "Петли", hint: "На каких петлях висят двери. С доводчиком дверь закрывается плавно и тихо." }, { id: "opening", label: "Открывание", hint: "С ручками или нажатием на фасад (push-to-open), без ручек." });
    if (choice.hasDrawers) g.push({ id: "slides", label: "Направляющие", hint: "На чём выдвигаются ящики: шариковые видны сбоку ящика, скрытые — под дном." });
    if (choice.handles.length) g.push({ id: "handles", label: "Ручки", hint: "Одна ручка на все фасады и ящики выбранной части проекта." });
    g.push({ id: "edgeBody", label: "Кромка корпуса", hint: "Пластиковая кромка на видимых торцах корпуса." });
    if (choice.hasDoors) g.push({ id: "edgeFacade", label: "Кромка фасадов", hint: "Кромка по торцам фасадов ЛДСП." });
    // кромку на клей PUR не делаем (решение Макса 26.10.2026) — группы «Клей кромки» нет
    g.push({ id: "fastening", label: "Крепёж", hint: "Как соединяются стенки корпуса." });
    return g;
  }, [choice]);
  const [group, setGroup] = useState<GroupId>("hinges");
  const active = groups.some((g) => g.id === group) ? group : groups[0].id;
  const [search, setSearch] = useState("");
  const one = <T,>(list: T[], v: T) => list.length === 1 && list[0] === v;
  const options = useMemo((): Option[] => {
    const push = one(choice.opening, "push");
    switch (active) {
      case "hinges": return (Object.keys(HINGE_BRANDS) as HingeBrand[]).map((k) => ({ id: k, title: "Петли " + HINGE_BRANDS[k].label, props: [HINGE_BRANDS[k].note, push ? "без пружины, с толкателем (push-to-open)" : "с доводчиком — плавное закрывание"], icon: <HingeIcon soft={!push}/>, current: one(choice.hinges, k), make: (p) => setAllHinges(p, k), what: "Петли " + HINGE_BRANDS[k].label }));
      case "opening": return [
        { id: "handle", title: "С ручками", props: ["петли с доводчиком", "ручка на каждом фасаде"], icon: <HingeIcon soft/>, current: one(choice.opening, "handle"), make: (p) => setAllOpening(p, "handle"), what: "Открывание с ручками" },
        { id: "push", title: "Без ручек, нажатием", props: ["push-to-open: нажали — фасад приоткрылся", "петли без пружины и толкатели"], icon: <PushIcon/>, current: one(choice.opening, "push"), make: (p) => setAllOpening(p, "push"), what: "Открывание нажатием" }];
      case "slides": return SLIDE_SYSTEMS.map((s) => ({ id: s.id, title: s.label, props: [SLIDE_MOTIONS[s.motion] === "push-to-open" ? "открывание нажатием (push-to-open)" : SLIDE_MOTIONS[s.motion], s.slide === "ball" ? "видны сбоку ящика" : "под дном ящика, снаружи не видны"], icon: <SlideIcon hidden={s.slide !== "ball"} motion={s.motion}/>, current: one(choice.slides, s.id), make: (p) => setAllSlides(p, s.id), what: s.label }));
      case "handles": return HANDLES.slice().sort((a, b) => Number(a.vendor !== "workshop") - Number(b.vendor !== "workshop") || a.len - b.len).map((h) => { const f = HANDLE_FINISHES[handleFinish(h)]; return { id: h.id, title: h.label, props: [h.len + " мм между отверстиями", f.label, h.vendor === "lemana" ? "Лемана Про" : "в наличии у цеха"], icon: <HandleIcon color={hex(f.color)} len={h.len}/>, current: one(choice.handles, h.id), make: (p) => setAllHandles(p, h.id), what: "Ручки " + h.label, search: (h.label + " " + h.len + " " + (h.art ?? "") + " " + f.label).toLowerCase() }; });
      case "edgeBody": case "edgeFacade": { const t = active === "edgeBody" ? "body" : "facade", cur = active === "edgeBody" ? choice.edgeBody : choice.edgeFacade; return EDGE_CHOICES.map((c) => ({ id: String(c.value), title: "Кромка " + c.label.split(" · ")[0], props: c.label.split(" · ").slice(1), icon: <EdgeIcon t={c.value}/>, current: one(cur, c.value), make: (p) => setAllEdges(p, t, c.value as EdgeThickness), what: (t === "body" ? "Кромка корпуса " : "Кромка фасадов ") + c.label.split(" · ")[0] })); }
      default: return [
        { id: "confirmat", title: "Конфирматы с заглушками", props: ["прочное соединение", "заглушки в цвет на видимых сторонах"], icon: <FastIcon hidden={false}/>, current: one(choice.fastening, "confirmat"), make: (p) => setAllFastening(p, "confirmat"), what: "Крепёж конфирматами" },
        { id: "eccentric", title: "Эксцентрики, скрытый крепёж", props: ["снаружи крепёж не виден"], icon: <FastIcon hidden/>, current: one(choice.fastening, "eccentric"), make: (p) => setAllFastening(p, "eccentric"), what: "Скрытый крепёж" }];
    }
  }, [active, choice]);
  const shown = active === "handles" && search.trim() ? options.filter((o) => o.search!.includes(search.trim().toLowerCase())) : options;
  // Разница в цене: итог сметы после замены минус текущий (розница; в публичной сборке estimate — клиентские цены). Считаем по одному
  // варианту за такт, чтобы окно не подвисало на списке ручек.
  const base = useMemo(() => { try { return estimate(project).retail; } catch { return null; } }, [project]);
  const [delta, setDelta] = useState<Record<string, number | null | "err">>({});
  useEffect(() => {
    let live = true, i = 0; const key = (o: Option) => (scope ?? "all") + "|" + active + "|" + o.id;
    setDelta({});
    const step = () => {
      if (!live || i >= options.length) return;
      const o = options[i++]; let v: number | null | "err";
      try { const r = estimate(scopedSwap(project, scope, o.make)).retail; v = r === null || base === null ? null : r - base; } catch { v = "err"; }
      setDelta((d) => ({ ...d, [key(o)]: v })); setTimeout(step, 0);
    };
    const t = setTimeout(step, 30);
    return () => { live = false; clearTimeout(t); };
  }, [project, scope, active, options, base]);
  const [note, setNote] = useState("");
  function apply(o: Option) {
    let next: Project;
    try { next = scopedSwap(project, scope, o.make); } catch (err) { setNote(err instanceof Error ? err.message : "Не удалось заменить фурнитуру."); return; }
    let after: number | null = null; try { after = estimate(next).retail; } catch { after = null; }
    if (!commit(next)) { setNote("Замена не прошла проверку проекта. Подробности в сообщении сверху."); return; }
    const d = after === null || base === null ? null : after - base;
    setNote(o.what + (d === null ? ": заменено." : d === 0 ? ": цена не изменилась." : `: цена ${d > 0 ? "выросла на " + rub(d) : "снизилась на " + rub(d)}.`));
  }
  // Esc закрывает окно (критик релиза 22.10). Было: слушатель с [onClose] — Esc сначала ловил App (снять выделение), React
  // перерисовывал док в микрозадаче между слушателями, эффект снимал наш слушатель и ставил новый, а новый на это нажатие уже
  // не срабатывал — окно оставалось. Теперь один слушатель на всё время окна, на погружении: закрывает окно раньше App
  // (preventDefault — App выделение не трогает).
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close.current(); } }; window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true); }, []);
  const g = groups.find((x) => x.id === active)!;
  const price = (o: Option) => {
    const d = delta[(scope ?? "all") + "|" + active + "|" + o.id];
    if (o.current) return <span className="hw-price current">Сейчас выбрано</span>;
    if (d === undefined) return <span className="hw-price wait">считаем…</span>;
    if (d === "err") return <span className="hw-price na">не подходит</span>;
    if (d === null) return <span className="hw-price na">цену уточнит менеджер</span>;
    return <span className={"hw-price " + (d > 0 ? "up" : d < 0 ? "down" : "same")}>{d === 0 ? "без изменения цены" : (d > 0 ? "+" : "−") + rub(d) + " к заказу"}</span>;
  };
  return <div className="hw-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="hw-window" role="dialog" aria-modal="true" aria-label="Фурнитура">
      <header className="hw-head"><div><h2>Фурнитура</h2><p>Выберите вариант — цена заказа пересчитается сразу. Цены розничные, разница к текущей стоимости.</p></div><button className="hw-close" aria-label="Закрыть окно фурнитуры" onClick={onClose}><X size={18}/></button></header>
      <div className="hw-scope"><label>Применить<select aria-label="Применить фурнитуру к" value={scope ?? ""} onChange={(e) => setScope(e.target.value || null)}><option value="">Ко всему проекту ({project.modules.length})</option>{project.modules.map((a, i) => <option key={a.id} value={a.id}>{i + 1}. {a.module.name} · {a.module.width} мм</option>)}</select></label>{base !== null && <span className="hw-total">Сейчас: <b>{base.toLocaleString("ru-RU")} ₽</b></span>}</div>
      <div className="hw-main">
        <nav className="hw-groups" aria-label="Группы фурнитуры">{groups.map((x) => <button key={x.id} aria-pressed={x.id === active} onClick={() => { setGroup(x.id); setSearch(""); }}>{x.label}</button>)}</nav>
        <div className="hw-list">
          <p className="hw-hint">{g.hint}</p>
          {active === "handles" && <label className="hw-search"><Search size={16}/><input placeholder="Найти ручку: 128, чёрный, золото…" aria-label="Найти ручку в окне фурнитуры" value={search} onChange={(e) => setSearch(e.target.value)}/></label>}
          {active === "handles" && choice.handles.length > 1 && <p className="hw-hint">Сейчас разные ручки: {choice.handles.map((h) => handleById(h).label).join(", ")}.</p>}
          <div className="hw-cards">{shown.map((o) => <button key={o.id} className="hw-card" aria-pressed={o.current} aria-label={o.title} onClick={() => { if (o.current) return; if (delta[(scope ?? "all") + "|" + active + "|" + o.id] === "err") { setNote(o.title + ": не подходит к выбранным изделиям (например, ручка длиннее фасада)."); return; } apply(o); }}>
            <span className="hw-icon">{o.icon}</span>
            <span className="hw-text"><b>{o.title}</b><span className="hw-props">{o.props.map((p) => <span key={p}>{p}</span>)}</span>{price(o)}</span>
            {o.current && <Check className="hw-check" size={18}/>}
          </button>)}{!shown.length && <p className="hw-hint">Ничего не найдено.</p>}</div>
        </div>
      </div>
      {note && <p className="hw-note" role="status">{note}</p>}
    </section>
  </div>;
}
