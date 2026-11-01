// Микро-обучение (Макс 31.10.2026): затемнение с «окном» на цели и короткая подсказка; Далее / Назад / Пропустить, Esc — закрыть.
// Не перехватывает мышь (окно и затемнение pointer-events: none) — сценарии мышью работают и при открытом туре.
// Предлагается один раз новому пользователю (флаг в localStorage), повторно — из «Как пользоваться» и поиска («обучение»).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { TOUR_STEPS, markTourSeen, tourAllowed, tourSeen } from "./tourSteps";
import { waitTarget, type StudioNav } from "./searchNav";
import { normalizeStage, type Stage } from "./stages";
import { editsText } from "./historyShortcuts";
import "./search-tour.css";

type Box = { left: number; top: number; width: number; height: number };
const PAD = 6, GAP = 14, CARD_W = 340;

export function StudioTour({ nav }: { nav: StudioNav }) {
  const [step, setStep] = useState<number | null>(null), [offer, setOffer] = useState(false);
  const [box, setBox] = useState<Box | null>(null), [cardH, setCardH] = useState(180);
  const navRef = useRef(nav); navRef.current = nav;
  const dir = useRef(1), startStage = useRef<Stage>("room"), tourStage = useRef<Stage | null>(null), before = useRef<HTMLElement | null>(null), target = useRef<HTMLElement | null>(null), card = useRef<HTMLDivElement>(null), next = useRef<HTMLButtonElement>(null);
  const start = () => { setOffer(false); markTourSeen(); before.current = document.activeElement as HTMLElement | null; startStage.current = normalizeStage(navRef.current.stage); tourStage.current = null; dir.current = 1; setStep(0); };
  const close = () => {
    setStep(null); setBox(null); target.current = null; markTourSeen();
    // вернуть этап, с которого начали (тур переключает на «Мебель» для палитры и меню) — только если этап сменил сам тур,
    // а пользователь его не трогал (критик 31.10); фокус — туда, где был до тура
    const n = navRef.current, cur = normalizeStage(n.stage);
    if (tourStage.current && cur === tourStage.current && cur !== startStage.current) n.goStage(startStage.current);
    const b = before.current; if (b && b.isConnected) requestAnimationFrame(() => b.focus({ preventScroll: true }));
  };
  // один раз новому пользователю, через пару секунд после открытия; не в сценариях Playwright и не с ?fresh=1
  useEffect(() => {
    if (!tourAllowed({ search: location.search, webdriver: !!navigator.webdriver, seen: tourSeen() })) return;
    // предложение — ровно один раз: флаг ставится при показе (пустая комната и редактор не предлагают дважды)
    const forced = new URLSearchParams(location.search).get("tour") === "1";
    const t = setTimeout(() => { if (!forced && tourSeen()) return; markTourSeen(); setOffer(true); }, 1800); return () => clearTimeout(t);
  }, []);
  useEffect(() => { const on = () => start(); window.addEventListener("studio-tour", on); return () => window.removeEventListener("studio-tour", on); }); // eslint-disable-line react-hooks/exhaustive-deps
  // шаг: нужный этап → ждём цель; нет цели — пропускаем в сторону движения
  useEffect(() => {
    if (step === null) return;
    let live = true;
    const s = TOUR_STEPS[step], n = navRef.current;
    if (s.stage && normalizeStage(n.stage) !== s.stage) { n.goStage(s.stage); tourStage.current = s.stage; }
    setBox(null);
    void waitTarget(s.target, 900, false).then((el) => {
      if (!live) return;
      if (!el) { const k = step + dir.current; if (k < 0 || k >= TOUR_STEPS.length) close(); else setStep(k); return; }
      target.current = el; el.scrollIntoView({ block: "nearest", inline: "nearest" });
      requestAnimationFrame(() => next.current?.focus({ preventScroll: true }));
    });
    return () => { live = false; };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  // окно следует за целью (прокрутка, смена размеров панелей)
  useEffect(() => {
    if (step === null) return;
    let raf = 0;
    const track = () => { const el = target.current; if (el && el.isConnected) { const r = el.getBoundingClientRect(); setBox((b) => (b && Math.abs(b.left - r.left) < 0.5 && Math.abs(b.top - r.top) < 0.5 && Math.abs(b.width - r.width) < 0.5 && Math.abs(b.height - r.height) < 0.5 ? b : { left: r.left, top: r.top, width: r.width, height: r.height })); } raf = requestAnimationFrame(track); };
    raf = requestAnimationFrame(track); return () => cancelAnimationFrame(raf);
  }, [step]);
  useLayoutEffect(() => { if (card.current) setCardH(card.current.offsetHeight); }, [step, box]);
  // Esc закрывает тур раньше, чем редактор снимет выделение
  useEffect(() => {
    if (step === null) return;
    const key = (e: KeyboardEvent) => {
      // Esc в палитре поиска или в поле ввода — им, а не туру (критик 31.10)
      if (e.key !== "Escape" || document.querySelector("[data-testid=param-search]") || editsText(e.target)) return;
      e.preventDefault(); e.stopImmediatePropagation(); close();
    };
    window.addEventListener("keydown", key, true); return () => window.removeEventListener("keydown", key, true);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (d: number) => { if (step === null) return; const k = step + d; dir.current = d; if (k >= TOUR_STEPS.length) close(); else if (k >= 0) setStep(k); };
  if (step === null) return offer ? createPortal(<div className="tour-offer" role="dialog" aria-label="Обучение" data-testid="tour-offer">
    <b>Короткое обучение</b><p>9 шагов, меньше минуты: этапы, шкафы, виды, меню, линии Q, цена и поиск.</p>
    <div><button className="primary" onClick={start}>Показать</button><button className="outline" onClick={() => { setOffer(false); markTourSeen(); }}>Не сейчас</button></div>
  </div>, document.body) : null;
  const s = TOUR_STEPS[step], vw = window.innerWidth, vh = window.innerHeight, w = Math.min(CARD_W, vw - 32);
  // карточка под целью, если есть место, иначе над ней, иначе сбоку; всегда в пределах окна
  let left = vw / 2 - w / 2, top = vh / 2 - cardH / 2;
  if (box) {
    left = Math.min(Math.max(16, box.left + box.width / 2 - w / 2), vw - w - 16);
    if (box.top + box.height + PAD + GAP + cardH < vh - 8) top = box.top + box.height + PAD + GAP;
    else if (box.top - PAD - GAP - cardH > 8) top = box.top - PAD - GAP - cardH;
    else { top = Math.min(Math.max(8, box.top), vh - cardH - 8); left = box.left + box.width + PAD + GAP + w < vw - 8 ? box.left + box.width + PAD + GAP : Math.max(16, box.left - PAD - GAP - w); }
  }
  return createPortal(<div className="studio-tour" data-testid="studio-tour" data-step={s.id}>
    {box ? <div className="tour-spot" aria-hidden="true" style={{ left: box.left - PAD, top: box.top - PAD, width: box.width + 2 * PAD, height: box.height + 2 * PAD }} /> : <div className="tour-dim" aria-hidden="true" />}
    <div ref={card} className="tour-card" role="dialog" aria-labelledby="tour-title" aria-describedby="tour-text" style={{ left, top, width: w }}>
      <div className="tour-head"><span className="tour-count">{step + 1} / {TOUR_STEPS.length}</span><button className="tour-x" aria-label="Закрыть обучение" onClick={close}><X size={16} /></button></div>
      <h3 id="tour-title">{s.title}</h3>
      <p id="tour-text">{s.text}</p>
      <div className="tour-actions">
        <button className="text-action" onClick={close}>Пропустить</button>
        <button className="outline" disabled={step === 0} onClick={() => go(-1)}>Назад</button>
        <button ref={next} className="primary" onClick={() => go(1)}>{step === TOUR_STEPS.length - 1 ? "Готово" : "Далее"}</button>
      </div>
    </div>
  </div>, document.body);
}
