// Круговое меню на правую кнопку мыши (решение Макса 06.10.2026): крупные кнопки по кругу вокруг курсора,
// в центре — что выбрано и подсказка наведённого пункта. Пункт со стрелкой открывает следующее кольцо; центр = «Назад» или «Закрыть».
// Клавиатура: Esc — назад/закрыть, стрелки — по кругу, Enter — выбрать.
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { X, ChevronLeft } from "lucide-react";
import "./radial-menu.css";
import { labelSide, placeMenu, type MenuArea } from "./contextMenu";

export type RadialItem = {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  /** Короткое пояснение в центре при наведении. */
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Отмечен (текущий вариант в подменю). */
  active?: boolean;
  children?: RadialItem[];
  run?: () => void;
};

// Компактное кольцо (просьба Макса 16.10: меню закрывало весь шкаф): меньше радиус и кнопки, полупрозрачная подложка,
// и меню открывается со сдвигом вбок от точки клика — выбранная деталь остаётся видна, точка клика отмечена.
const RADIUS = 76, SIZE = 48;

export function RadialMenu({ x, y, title, subtitle, items, onClose, area }: { x: number; y: number; title: string; subtitle?: string; items: RadialItem[]; onClose: () => void; area?: MenuArea }) {
  const [path, setPath] = useState<RadialItem[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  // «Опасный» пункт (удалить) всегда строго внизу кольца, в одном и том же месте — подальше от частых действий сверху.
  const raw = path.length ? path[path.length - 1].children ?? [] : items;
  const ring = (() => { const danger = raw.filter((i) => i.danger), rest = raw.filter((i) => !i.danger); if (!danger.length || raw.length < 3) return raw; const out = [...rest]; out.splice(Math.floor(raw.length / 2), 0, ...danger); return out; })();
  // Радиус растёт с числом пунктов, чтобы кнопки не налезали (10 пунктов меню модуля).
  const R = Math.max(RADIUS, Math.ceil((ring.length * (SIZE + 8)) / (2 * Math.PI)));
  const ref = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // Меню целиком в области: центр не ближе радиуса + подпись к краю; по горизонтали — ещё место под боковые подписи (до ~110 px).
  // Сдвиг вправо от клика, у правого края — влево; area — сцена без правой панели инструментов (placeMenu, находка 6).
  const { cx, cy } = placeMenu(x, y, R, SIZE, area ?? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight });
  const back = () => { setHover(null); if (path.length) setPath(path.slice(0, -1)); else onClose(); };
  // Фокус на само меню, а не на первый пункт: в центре остаётся название выбранного, стрелки начинают обход с первого пункта.
  useLayoutEffect(() => { ref.current?.focus(); }, [path]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); back(); }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const i = buttons.current.findIndex((b) => b === document.activeElement), step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
        const n = ring.length; let k = i < 0 ? (step > 0 ? n - 1 : 0) : i;
        for (let t = 0; t < n; t++) { k = (k + step + n) % n; if (!ring[k].disabled) break; }
        buttons.current[k]?.focus(); setHover(k);
      }
    };
    const outside = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.addEventListener("keydown", key); window.addEventListener("pointerdown", outside, true);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("pointerdown", outside, true); };
  });
  const choose = (item: RadialItem) => {
    if (item.disabled) return;
    if (item.children?.length) { setHover(null); setPath([...path, item]); return; }
    item.run?.(); onClose();
  };
  const shown = hover !== null ? ring[hover] : null;
  return (
    <div className="radial-menu" ref={ref} role="menu" tabIndex={-1} aria-label={"Действия: " + title} style={{ left: cx, top: cy }} onContextMenu={(e) => { e.preventDefault(); back(); }}>
      <span className="radial-anchor" aria-hidden="true" style={{ left: x - cx, top: y - cy }} />
      <svg className="radial-ring" style={{ left: -(R + SIZE / 2), top: -(R + SIZE / 2) }} width={2 * R + SIZE} height={2 * R + SIZE} aria-hidden="true"><circle cx={R + SIZE / 2} cy={R + SIZE / 2} r={R} /></svg>
      {ring.map((item, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / ring.length, px = Math.cos(a) * R, py = Math.sin(a) * R;
        const Icon = item.icon;
        return (
          <button key={item.id} ref={(b) => { buttons.current[i] = b; }} type="button" role="menuitem" className={"radial-item" + (item.danger ? " danger" : "") + (item.active ? " active" : "")}
            style={{ transform: `translate(${px}px, ${py}px)`, animationDelay: i * 18 + "ms" }} disabled={item.disabled} aria-haspopup={item.children ? "menu" : undefined}
            aria-label={item.label + (item.hint ? ". " + item.hint : "")} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => choose(item)}>
            <Icon size={18} />
            <span className={"radial-label" + labelSide(px, py, R)}>{item.label}{item.children ? " ›" : ""}</span>
          </button>
        );
      })}
      <button type="button" className="radial-center" onClick={back} aria-label={path.length ? "Назад" : "Закрыть меню"}>
        {shown ? <><b>{shown.label}</b>{shown.hint && <small>{shown.hint}</small>}</> : <><b>{path.length ? path[path.length - 1].label : title}</b>{!path.length && subtitle && <small>{subtitle}</small>}<i>{path.length ? <><ChevronLeft size={13} /> назад</> : <><X size={13} /> закрыть</>}</i></>}
      </button>
    </div>
  );
}
