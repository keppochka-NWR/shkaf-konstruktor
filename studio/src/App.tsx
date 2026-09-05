import { useState, useEffect, useRef } from "react";
import {
  Box,
  Undo2,
  Redo2,
  Download,
  Upload,
  Plus,
  Minus,
  Columns2,
  Rows3,
  Shirt,
  Archive,
  DoorOpen,
  RotateCcw,
  Maximize,
  Move3D,
  Ruler,
  Check,
  ChevronDown,
  X,
  Info,
  Layers,
  Trash2,
  Search,
  HelpCircle,
  PanelTop,
  Copy,
  CheckCircle2,
} from "lucide-react";
import {
  initialModule,
  boxes,
  parts,
  validate,
  parseModule,
  splitSection,
  distribute,
  section,
  RULES,
  type Module,
  type Section,
} from "./model";
import { Scene, type View } from "./Scene";
import { catalog } from "./catalog";
const KEY = "module-studio-v1";
function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const apply = () => {
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n) || n === value) {
      setDraft(String(value));
      return;
    }
    onChange(n);
    setDraft(String(value));
  };
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          type="number"
          min={min}
          max={max}
          step="1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(String(value));
              e.currentTarget.blur();
            }
          }}
        />
        <small>мм</small>
      </div>
    </label>
  );
}
function Counter({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="counter">
      <span>{label}</span>
      <div>
        <button
          aria-label={`Уменьшить: ${label}`}
          disabled={!value}
          onClick={() => onChange(value - 1)}
        >
          <Minus size={14} />
        </button>
        <b>{value}</b>
        <button
          aria-label={`Добавить: ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
export default function App() {
  const [startup] = useState(() => {
    try {
      const s = localStorage.getItem(KEY);
      return {
        model: s ? parseModule(JSON.parse(s)) : initialModule(),
        error: "",
      };
    } catch {
      return {
        model: initialModule(),
        error:
          "Сохранённый модуль не удалось прочитать. Открыт пример; исходная запись сохранится до первого изменения.",
      };
    }
  });
  const [history, setHistory] = useState<Module[]>([startup.model]),
    [cursor, setCursor] = useState(0);
  const m = history[cursor];
  const [selected, setSelected] = useState(m.sections[0].id),
    [view, setView] = useState<View>("iso"),
    [fit, setFit] = useState(0),
    [openDoors, setOpenDoors] = useState(true),
    [exploded, setExploded] = useState(false),
    [dimensions, setDimensions] = useState(true),
    [tab, setTab] = useState<"module" | "section">("module");
  const [error, setError] = useState(startup.error),
    [saved, setSaved] = useState("На этом компьютере"),
    [modal, setModal] = useState<"materials" | "parts" | "help" | null>(null),
    [materialTarget, setMaterialTarget] = useState<"decor" | "facadeDecor">(
      "decor",
    ),
    [search, setSearch] = useState("");
  const upload = useRef<HTMLInputElement>(null),
    touched = useRef(false);
  const selectedId = m.sections.some((s) => s.id === selected)
    ? selected
    : m.sections[0].id;
  const idx = m.sections.findIndex((s) => s.id === selectedId),
    s = m.sections[idx],
    b = boxes(m)[idx],
    allParts = parts(m);
  const undo = () => {
    setCursor((c) => Math.max(0, c - 1));
    setError("");
    touched.current = true;
  };
  const redo = () => {
    setCursor((c) => Math.min(history.length - 1, c + 1));
    setError("");
    touched.current = true;
  };
  function commit(next: Module) {
    const e = validate(next);
    if (e.length) {
      setError(e[0]);
      return false;
    }
    if (JSON.stringify(next) === JSON.stringify(m)) {
      setError("");
      return true;
    }
    touched.current = true;
    setHistory((h) => [...h.slice(0, cursor + 1), next].slice(-61));
    setCursor(Math.min(cursor + 1, 60));
    setError("");
    return true;
  }
  function modify(update: (draft: Module) => void) {
    const next = structuredClone(m);
    update(next);
    return commit(next);
  }
  function modifySection(update: (draft: Section, next: Module) => void) {
    modify((next) => update(next.sections[idx], next));
  }
  function chooseSection(id: string) {
    setSelected(id);
    setTab("section");
  }
  useEffect(() => {
    if (!touched.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(m));
      setSaved("Изменения сохранены");
    } catch {
      setSaved("Не сохранено");
      setError(
        "Хранилище браузера недоступно. Сохраните модуль кнопкой «Скачать».",
      );
    }
  }, [m]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const input =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if (input) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  useEffect(() => {
    if (!modal) return;
    const before = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setModal(null);
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,a[href],[tabindex="0"]',
        ),
      ).filter((el) => el.offsetParent !== null);
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      before?.focus();
    };
  }, [modal]);
  function preset(type: "shelves" | "wardrobe" | "drawers" | "empty") {
    const n = {
      ...initialModule(),
      name: m.name,
      width: m.width,
      height: m.height,
      depth: m.depth,
      decor: m.decor,
      facadeDecor: m.facadeDecor,
      doors: false,
      sections: [section()],
    };
    const a = n.sections[0];
    if (type === "shelves") a.shelves = distribute(n, a, 4);
    if (type === "wardrobe") {
      a.rod = true;
      a.shelves = distribute(n, a, 1);
    }
    if (type === "drawers") {
      a.drawers = 3;
      a.shelves = distribute(n, a, 2);
    }
    if (commit(n)) {
      setSelected(a.id);
      setTab("section");
    }
  }
  function resizeSection(width: number) {
    if (m.sections.length === 1) {
      setError("Ширину единственной секции меняйте через габарит модуля.");
      return;
    }
    modify((next) => {
      const avail = next.width - RULES.panel * (next.sections.length + 1);
      if (width <= 0 || width >= avail) {
        next.sections[idx].weight = -1;
        return;
      }
      const remaining = m.sections.reduce(
        (sum, s, i) => sum + (i === idx ? 0 : s.weight),
        0,
      );
      next.sections.forEach(
        (ss, i) =>
          (ss.weight =
            i === idx ? width : ((avail - width) * ss.weight) / remaining),
      );
    });
  }
  function download() {
    const blob = new Blob([JSON.stringify(m, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download =
      (m.name.replace(/[<>:"/\\|?*]/g, "_") || "Модуль") + ".module.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const texture = (name: string) =>
    catalog.find((c) => c.n === name)?.tex || undefined;
  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="./" aria-label="Модуль — главная">
          <span className="brand-mark">
            <Box size={23} />
          </span>
          <strong>
            модуль<span>студия мебели</span>
          </strong>
        </a>
        <div className="document-name">
          <input
            aria-label="Название модуля"
            maxLength={80}
            value={m.name}
            onChange={(e) => modify((n) => (n.name = e.target.value))}
          />
          <span>
            <i className={saved === "Не сохранено" ? "bad" : ""} />
            {saved}
          </span>
        </div>
        <div className="header-actions">
          <div className="history">
            <button
              title="Отменить · Ctrl+Z"
              aria-label="Отменить"
              disabled={cursor === 0}
              onClick={undo}
            >
              <Undo2 size={18} />
            </button>
            <button
              title="Повторить · Ctrl+Shift+Z"
              aria-label="Повторить"
              disabled={cursor === history.length - 1}
              onClick={redo}
            >
              <Redo2 size={18} />
            </button>
          </div>
          <button
            className="quiet"
            aria-label="Открыть"
            onClick={() => upload.current?.click()}
          >
            <Upload size={16} />
            <span>Открыть</span>
          </button>
          <button className="primary" aria-label="Скачать" onClick={download}>
            <Download size={16} />
            <span>Скачать</span>
          </button>
        </div>
      </header>
      <input
        ref={upload}
        hidden
        type="file"
        accept=".json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 100000) {
            setError(
              "Файл слишком большой. Откройте файл одного модуля до 100 КБ.",
            );
            return;
          }
          try {
            const next = parseModule(JSON.parse(await file.text()));
            if (
              !catalog.some((c) => c.n === next.decor) ||
              !catalog.some((c) => c.n === next.facadeDecor)
            )
              throw new Error(
                "Материал из файла не найден в каталоге Lamarty.",
              );
            if (commit(next)) {
              setSelected(next.sections[0].id);
              setFit((f) => f + 1);
            }
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Не удалось открыть файл.",
            );
          }
        }}
      />
      <main className="workspace">
        <aside className="library">
          <div className="panel-heading">
            <span className="eyebrow">КОНСТРУКЦИЯ</span>
            <h1>Ваш модуль</h1>
            <p>
              Начните с формы.
              <br />
              Остальное подстроится.
            </p>
          </div>
          <div className="library-label">Быстрый старт</div>
          <div className="presets">
            {(
              [
                { type: "empty", title: "Пустой корпус", icon: Box },
                { type: "shelves", title: "Полочный", icon: Rows3 },
                { type: "wardrobe", title: "Платяной", icon: Shirt },
                { type: "drawers", title: "С ящиками", icon: Archive },
              ] as const
            ).map((p) => (
              <button key={p.type} onClick={() => preset(p.type)}>
                <p.icon size={30} strokeWidth={1.3} />
                <span>{p.title}</span>
              </button>
            ))}
          </div>
          <p className="small-note">
            Шаблон заменит наполнение.
            <br />
            Изменение можно отменить.
          </p>
          <div className="library-label section-title">
            Наполнение <span>в секцию {idx + 1}</span>
          </div>
          <div className="fill-buttons">
            <button
              onClick={() => {
                setTab("section");
                modifySection(
                  (a, n) =>
                    (a.shelves = distribute(n, a, a.shelves.length + 1)),
                );
              }}
            >
              <Rows3 size={19} />
              <span>Добавить полку</span>
              <Plus size={15} />
            </button>
            <button
              onClick={() => {
                setTab("section");
                modifySection((a) => a.drawers++);
              }}
            >
              <Archive size={19} />
              <span>Добавить ящик</span>
              <Plus size={15} />
            </button>
            <button
              onClick={() => {
                setTab("section");
                modifySection((a) => (a.rod = !a.rod));
              }}
            >
              <Shirt size={19} />
              <span>{s.rod ? "Убрать штангу" : "Добавить штангу"}</span>
              {s.rod ? <Minus size={15} /> : <Plus size={15} />}
            </button>
            <button
              disabled={m.sections.length >= RULES.maxSections}
              onClick={() => {
                const next = splitSection(m, selectedId);
                if (commit(next)) setTab("section");
              }}
            >
              <Columns2 size={19} />
              <span>Разделить секцию</span>
              <Plus size={15} />
            </button>
          </div>
          <div className="library-bottom">
            <div className="tip-mark">
              <Info size={17} />
            </div>
            <p>Нажмите на секцию в модели, чтобы изменить её наполнение.</p>
            <button onClick={() => setModal("help")}>
              <HelpCircle size={16} /> Как пользоваться
            </button>
          </div>
        </aside>
        <section className="viewport" aria-label="Рабочая область">
          <div className="view-header">
            <div className="view-tabs">
              {(
                [
                  { id: "iso", label: "3D" },
                  { id: "front", label: "Спереди" },
                  { id: "side", label: "Сбоку" },
                  { id: "top", label: "Сверху" },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  aria-pressed={view === v.id}
                  onClick={() => {
                    setView(v.id);
                    setFit((f) => f + 1);
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <span className="scale-label">РАЗМЕРЫ В ММ</span>
          </div>
          <Scene
            module={m}
            selected={selectedId}
            onSelect={chooseSection}
            texture={texture(m.decor)}
            facadeTexture={texture(m.facadeDecor)}
            view={view}
            fit={fit}
            openDoors={openDoors}
            exploded={exploded}
            dimensions={dimensions}
          />
          <div className="scene-caption">
            <span>КОРПУС / ЛДСП 16</span>
            <b>
              {m.width} <small>×</small> {m.height} <small>×</small> {m.depth}
            </b>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <Info size={20} />
              <div>
                <strong>Изменение не применено</strong>
                <p>{error}</p>
              </div>
              <button
                aria-label="Закрыть сообщение"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          <div className="scene-tools">
            <button
              aria-label="Вписать модель"
              title="Вписать модель"
              onClick={() => setFit((f) => f + 1)}
            >
              <Maximize size={19} />
            </button>
            <button
              aria-label="Показать размеры"
              title="Размеры"
              aria-pressed={dimensions}
              onClick={() => setDimensions((v) => !v)}
            >
              <Ruler size={19} />
            </button>
            <button
              aria-label="Разнести детали"
              title="Разнести детали"
              aria-pressed={exploded}
              onClick={() => setExploded((v) => !v)}
            >
              <Move3D size={19} />
            </button>
            {m.doors && (
              <button
                aria-label="Открыть фасады"
                title="Открыть фасады"
                aria-pressed={openDoors}
                onClick={() => setOpenDoors((v) => !v)}
              >
                <DoorOpen size={19} />
              </button>
            )}
          </div>
          <div className="section-picker">
            {boxes(m).map((box, i) => (
              <button
                key={box.id}
                aria-pressed={selectedId === box.id}
                onClick={() => chooseSection(box.id)}
              >
                <span>Секция {i + 1}</span>
                <b>
                  {Math.round(box.width * 10) / 10}
                  <small> мм</small>
                </b>
              </button>
            ))}
          </div>
          <div className="orbit-help">
            <RotateCcw size={13} /> Перетащите, чтобы повернуть <span>·</span>{" "}
            Колесо — масштаб
          </div>
        </section>
        <aside className="properties">
          <div className="property-tabs">
            <button
              aria-selected={tab === "module"}
              onClick={() => setTab("module")}
            >
              Модуль
            </button>
            <button
              aria-selected={tab === "section"}
              onClick={() => setTab("section")}
            >
              Секция {idx + 1}
            </button>
          </div>
          {tab === "module" ? (
            <>
              <div className="property-section">
                <div className="section-heading">
                  <h2>Габариты корпуса</h2>
                  <Ruler size={17} />
                </div>
                <NumberField
                  label="Ширина"
                  value={m.width}
                  min={RULES.minW}
                  max={RULES.maxW}
                  onChange={(v) => modify((n) => (n.width = v))}
                />
                <NumberField
                  label="Высота"
                  value={m.height}
                  min={RULES.minH}
                  max={RULES.maxH}
                  onChange={(v) => modify((n) => (n.height = v))}
                />
                <NumberField
                  label="Глубина"
                  value={m.depth}
                  min={RULES.minD}
                  max={RULES.maxD}
                  onChange={(v) => modify((n) => (n.depth = v))}
                />
                <p className="field-note">
                  Размеры включают боковины и цоколь.
                </p>
              </div>
              <div className="property-section">
                <h2>Материал корпуса</h2>
                <button
                  className="material-choice"
                  onClick={() => {
                    setMaterialTarget("decor");
                    setModal("materials");
                  }}
                >
                  <span
                    className="material-preview"
                    style={{ backgroundImage: `url("${texture(m.decor)}")` }}
                  />
                  <span>
                    <b>{m.decor}</b>
                    <small>Lamarty · 16 мм</small>
                  </span>
                  <ChevronDown size={16} />
                </button>
                {!texture(m.decor) && (
                  <p className="field-note">
                    В каталоге нет текстуры этого декора. Цвет в 3D условный.
                  </p>
                )}
                <div className="material-chips">
                  {["Дуб Вотан", "Белый", "Графит", "Дуб Солсбери"]
                    .filter((n) => catalog.some((c) => c.n === n))
                    .map((n) => (
                      <button
                        key={n}
                        aria-label={`Материал ${n}`}
                        title={n}
                        aria-pressed={m.decor === n}
                        style={{
                          backgroundImage: `url("${texture(n)}")`,
                          backgroundColor:
                            n === "Графит"
                              ? "#565956"
                              : n === "Белый"
                                ? "#efeeeb"
                                : "#c4ad85",
                        }}
                        onClick={() => modify((m) => (m.decor = n))}
                      >
                        {m.decor === n && <Check size={16} />}
                      </button>
                    ))}
                  <button
                    className="more-materials"
                    onClick={() => {
                      setMaterialTarget("decor");
                      setModal("materials");
                    }}
                  >
                    Все
                  </button>
                </div>
              </div>
              <div className="property-section">
                <div className="toggle-row">
                  <span>
                    <b>Распашные фасады</b>
                    <small>По одной двери на секцию</small>
                  </span>
                  <button
                    role="switch"
                    aria-label="Распашные фасады"
                    aria-checked={m.doors}
                    className="switch"
                    onClick={() => modify((n) => (n.doors = !n.doors))}
                  >
                    <span />
                  </button>
                </div>
                {m.doors && (
                  <button
                    className="text-action"
                    onClick={() => {
                      setMaterialTarget("facadeDecor");
                      setModal("materials");
                    }}
                  >
                    Материал фасадов: {m.facadeDecor} <ChevronDown size={13} />
                  </button>
                )}
              </div>
              <div className="property-section specs">
                <h2>Основа модуля</h2>
                <dl>
                  <div>
                    <dt>Плита</dt>
                    <dd>16 мм</dd>
                  </div>
                  <div>
                    <dt>Цоколь</dt>
                    <dd>80 мм</dd>
                  </div>
                  <div>
                    <dt>Задняя стенка</dt>
                    <dd>ЛХДФ 3 мм</dd>
                  </div>
                  <div>
                    <dt>Секций</dt>
                    <dd>{m.sections.length}</dd>
                  </div>
                </dl>
              </div>
            </>
          ) : (
            <>
              <div className="property-section">
                <div className="section-heading">
                  <h2>Секция {idx + 1}</h2>
                  <Columns2 size={17} />
                </div>
                <NumberField
                  label="Внутренняя ширина"
                  value={Math.round(b.width * 10) / 10}
                  min={RULES.minSection}
                  max={m.width - 32}
                  onChange={resizeSection}
                />
                <p className="field-note">
                  Соседние секции займут оставшееся место.
                </p>
                <button
                  className="outline full"
                  disabled={m.sections.length >= RULES.maxSections}
                  onClick={() => commit(splitSection(m, selectedId))}
                >
                  <Columns2 size={16} /> Разделить пополам
                </button>
              </div>
              <div className="property-section">
                <h2>Наполнение</h2>
                <Counter
                  label="Полки"
                  value={s.shelves.length}
                  max={RULES.maxShelves}
                  onChange={(c) =>
                    modifySection((a, n) => (a.shelves = distribute(n, a, c)))
                  }
                />
                <Counter
                  label="Ящики"
                  value={s.drawers}
                  max={RULES.maxDrawers}
                  onChange={(c) => modifySection((a) => (a.drawers = c))}
                />
                <div className="toggle-row">
                  <span>Штанга</span>
                  <button
                    className="switch"
                    role="switch"
                    aria-label="Штанга"
                    aria-checked={s.rod}
                    onClick={() => modifySection((a) => (a.rod = !a.rod))}
                  >
                    <span />
                  </button>
                </div>
                {s.shelves.length > 0 && (
                  <>
                    <button
                      className="text-action"
                      onClick={() =>
                        modifySection(
                          (a, n) =>
                            (a.shelves = distribute(n, a, a.shelves.length)),
                        )
                      }
                    >
                      <Rows3 size={15} /> Распределить полки
                    </button>
                    <p className="field-note">
                      Высота полок — от дна внутреннего проёма.
                    </p>
                    {s.shelves.map((f, j) => (
                      <NumberField
                        key={j}
                        label={`Полка ${j + 1}`}
                        value={Math.round(f * (b.top - b.bottom))}
                        min={80}
                        max={b.top - b.bottom - 80}
                        onChange={(v) =>
                          modifySection(
                            (a) => (a.shelves[j] = v / (b.top - b.bottom)),
                          )
                        }
                      />
                    ))}
                  </>
                )}
              </div>
              <div className="property-section">
                <button
                  className="text-action danger"
                  onClick={() =>
                    modifySection((a) => {
                      a.shelves = [];
                      a.drawers = 0;
                      a.rod = false;
                    })
                  }
                >
                  <Trash2 size={15} /> Очистить наполнение
                </button>
                {m.sections.length > 1 && (
                  <button
                    className="text-action danger"
                    onClick={() => {
                      const n = structuredClone(m);
                      const removed = n.sections.splice(idx, 1)[0];
                      n.sections[Math.max(0, idx - 1)].weight += removed.weight;
                      commit(n);
                    }}
                  >
                    <Minus size={15} /> Удалить секцию
                  </button>
                )}
                <p className="field-note">
                  Удаление секции уберёт её наполнение. Соседняя секция станет
                  шире.
                </p>
              </div>
            </>
          )}
          <div className="property-footer">
            <CheckCircle2 size={18} />
            <div>
              <strong>Габариты проверены</strong>
              <span>Детали помещаются в лист</span>
            </div>
          </div>
        </aside>
      </main>
      <footer className="statusbar">
        <span>
          <span className="status-dot" />
          3D-редактор модулей <b>01</b>
        </span>
        <button onClick={() => setModal("parts")}>
          <Layers size={14} />
          {allParts.filter((p) => p.material !== "metal").length} деталей{" "}
          <span>Посмотреть</span>
        </button>
        <span className="stage-note">Конструкция · без раскроя и УП</span>
      </footer>
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className={`modal ${modal === "parts" ? "wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">МОДУЛЬ</span>
                <h2 id="modal-title">
                  {modal === "materials"
                    ? "Материалы Lamarty"
                    : modal === "parts"
                      ? "Детали модуля"
                      : "Несколько простых действий"}
                </h2>
              </div>
              <button
                autoFocus
                aria-label="Закрыть окно"
                onClick={() => setModal(null)}
              >
                <X />
              </button>
            </div>
            {modal === "materials" ? (
              <>
                <label className="search">
                  <Search size={18} />
                  <input
                    autoFocus
                    placeholder="Найти декор…"
                    aria-label="Найти декор"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <div className="decor-grid">
                  {catalog
                    .filter((c) =>
                      c.n.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((c) => (
                      <button
                        key={c.n}
                        aria-pressed={m[materialTarget] === c.n}
                        onClick={() => {
                          modify((n) => (n[materialTarget] = c.n));
                          setModal(null);
                          setSearch("");
                        }}
                      >
                        <span
                          style={{
                            backgroundImage: c.tex
                              ? `url("${c.tex}")`
                              : undefined,
                            backgroundColor:
                              c.n === "Графит" ? "#565956" : "#e6e2d9",
                          }}
                        />
                        {c.n}
                        {m[materialTarget] === c.n && <Check size={15} />}
                      </button>
                    ))}
                </div>
              </>
            ) : modal === "parts" ? (
              <>
                <p className="modal-note">
                  Предварительная геометрия модели. Размеры готовых деталей; это
                  не производственный комплект.
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Деталь</th>
                        <th>Секция</th>
                        <th>Размер, мм</th>
                        <th>Материал</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allParts.map((p, i) => (
                        <tr key={p.id}>
                          <td>{i + 1}</td>
                          <td>{p.name}</td>
                          <td>
                            {p.sectionId
                              ? m.sections.findIndex(
                                  (s) => s.id === p.sectionId,
                                ) + 1
                              : "—"}
                          </td>
                          <td>
                            {Math.round(p.length * 10) / 10} ×{" "}
                            {Math.round(p.width * 10) / 10} × {p.thickness}
                          </td>
                          <td>
                            {p.material === "metal"
                              ? "Металл"
                              : p.material === "hdf"
                                ? "ЛХДФ"
                                : p.decor}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="help-content">
                <p>
                  <strong>Повернуть модель</strong> — перетащите мышью.
                  Приблизить — колесо. Сдвинуть — правая кнопка мыши.
                </p>
                <p>
                  <strong>Изменить размеры</strong> — введите число справа и
                  нажмите Enter. Программа объяснит, если размер не подходит.
                </p>
                <p>
                  <strong>Выбрать секцию</strong> — нажмите на её полку/ящик в
                  3D или на кнопку под моделью.
                </p>
                <p>
                  <strong>Добавить наполнение</strong> — кнопками слева.
                  Количество и высоты меняются во вкладке секции.
                </p>
                <p>
                  <strong>Вернуться назад</strong> — Ctrl+Z. Все изменения
                  сохраняются в этом браузере. Для переноса на другой компьютер
                  используйте «Скачать» и «Открыть».
                </p>
                <div className="help-note">
                  Первая версия работает с одним прямым корпусом. Раскрой,
                  производственные чертежи и УП — следующие этапы.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
