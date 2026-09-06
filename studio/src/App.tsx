import {RoomObstacles} from './RoomObstacles';
import {NewProjectPanel} from './NewProjectPanel';
import {MEASUREMENT_RULES,nicheSize} from './measurement';
import {ModuleLibrary} from './ModuleLibrary';
import { useState, useEffect, useRef, useMemo } from "react";
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
  shelfGaps,
  setShelfGap,
  drawerConfig, drawerOffsets, plinth, rearClear,
  type Module,
  type Section,
} from "./model";
import { Scene, type View } from "./Scene";
import { PriceStatus } from "./PriceStatus";
import { OutputPanel } from "./OutputPanel";
import {RoomWarnings} from './RoomWarningPanel';
import {roomWarnings} from './roomWarnings';
import { RoomEditor } from './RoomEditor';
import {RoomPlan} from './RoomPlan';
import {CloudPanel} from './CloudPanel';
import { catalog } from "./catalog";
import { compatibleSlideLength, SLIDES, GTV_SOURCE, type DrawerConfig } from "./hardware";
import {
  newProject,
  parseProject,
  projectErrors,
  appendModule, snapComposition, snapPlacement, bounds, compositionBounds, mountingCompositionBounds,
  type Project,
} from "./project";
import {moveComposition,compactDrawers,setCompositionDistance,applyDrawerSlide,clearSection,removeSection,addUpperModule,rotateModule,setWallDistance,mirrorModule,moveDivider,insertItem,moveModule,movePart,removePart,transferPart,type FillKind} from './operations';
const KEY = "module-studio-v3";
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
  const cancelled = useRef(false);
  useEffect(() => setDraft(String(value)), [value]);
  const apply = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(String(value));
      return;
    }
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
              cancelled.current = true;
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
      const s =
        localStorage.getItem(KEY) || localStorage.getItem("module-studio-v2") || localStorage.getItem("module-studio-v1");
      return {
        model: s ? parseProject(JSON.parse(s)) : newProject(),
        error: "",
      };
    } catch {
      return {
        model: newProject(),
        error:
          "Сохранённый модуль не удалось прочитать. Открыт пример; исходная запись сохранится до первого изменения.",
      };
    }
  });
  const [history, setHistory] = useState<Project[]>([startup.model]),
    [cursor, setCursor] = useState(0);
  const project = history[cursor];
  const [active, setActive] = useState(project.modules[0].id);
  const placed =
    project.modules.find((a) => a.id === active) || project.modules[0];
  const m = placed.module;
  const placedBounds=bounds(placed);
  const mountingComposition=useMemo(()=>mountingCompositionBounds(project),[project]);
  const composition=useMemo(()=>compositionBounds(project),[project]);
  const placementWarnings=useMemo(()=>roomWarnings(project),[project]);
  const [allMaterials,setAllMaterials]=useState(false);
  const [mode,setMode]=useState<"move"|"fill"|"orbit">("move");
  const [drawerPreview,setDrawerPreview]=useState(false);
  const [drawerIndex, setDrawerIndex] = useState<number | null>(null);
  const [selectedPart,setSelectedPart]=useState<{mid:string;sid:string;pid:string}|null>(null);
  const selectedDetail=selectedPart?.mid===placed.id?parts(m).find(p=>p.id===selectedPart.pid):undefined;
  const canRemove=selectedDetail&&(/:shelf:|:drawer:|:pantograph:|:flange:/.test(selectedDetail.id)||selectedDetail.id.endsWith(':rod'));
  const selectedFillingName=selectedDetail?.id.includes(':drawer:')?'Ящик '+(Number(selectedDetail.id.split(':drawer:')[1].split(':')[0])+1):selectedDetail?.id.includes(':pantograph:')?'Пантограф':selectedDetail?.id.includes(':flange:')||selectedDetail?.id.endsWith(':rod')?'Штанга':selectedDetail?.name;
  const removalLabel=selectedDetail?.id.includes(':drawer:')?'Удалить ящик целиком':selectedDetail?.id.includes(':pantograph:')?'Удалить пантограф':selectedDetail?.id.includes(':flange:')||selectedDetail?.id.endsWith(':rod')?'Удалить штангу':'Удалить полку';
  function removeSelected(){if(!selectedPart||!canRemove)return;try{if(commitProject(removePart(project,selectedPart.mid,selectedPart.sid,selectedPart.pid)))setSelectedPart(null);}catch(e){setError((e as Error).message);}}
  const [snapping,setSnapping]=useState(true);
  const [moveAll,setMoveAll]=useState(false);
  const [transparent, setTransparent] = useState(false);
  const [showRoom, setShowRoom] = useState(false);
  const [roomPlan,setRoomPlan]=useState(false);
  const [selectedOpening,setSelectedOpening]=useState<string>();
  const [selectedObstacle,setSelectedObstacle]=useState<string>();
  const [presentation,setPresentation]=useState(false);
  const [outputTab,setOutputTab] = useState<"sheets" | "estimate">("sheets");
  const [renderImage,setRenderImage]=useState("");
  const [direct, setDirect] = useState<{
    label: string;
    value: number;
    apply: (v: number) => boolean;
  } | null>(null);
  const [directValue, setDirectValue] = useState("");
  function editDimension(
    label: string,
    value: number,
    apply: (v: number) => boolean,
  ) {
    setError("");
    setDirect({ label, value, apply });
    setDirectValue(String(value));
  }
  function selectModule(mid: string) {
    setSelectedOpening(undefined);
    setSelectedObstacle(undefined);
    setDrawerPreview(false);
    setSelectedPart(null);
    setActive(mid);
    setTab("module");
    setFit((f) => f + 1);
  }
  function addUpper(){try{const n=addUpperModule(project,placed.id);if(commitProject(n))selectModule(n.modules[n.modules.length-1].id);}catch(e){setError((e as Error).message);}}
  function moveBody(mid:string,pos:{x:number;y:number;z:number}){return commitProject((moveAll?moveComposition:moveModule)(project,mid,pos));}
  function moveFilling(mid:string,sid:string,pid:string,delta:number){return commitProject(movePart(project,mid,sid,pid,delta));}
  function dropFilling(kind:string,mid:string,sid:string,y:number){if(!['shelf','drawer','rod','pantograph'].includes(kind))return false;try{const next=insertItem(project,kind as FillKind,mid,sid,y);if(commitProject(next)){setActive(mid);chooseSection(sid);setMode('fill');setOpenDoors(true);return true;}}catch(e){setError(e instanceof Error?e.message:'Не удалось добавить элемент.')}return false;}
  function startFill(e:React.DragEvent,kind:FillKind){setRoomPlan(false);e.dataTransfer.setData('application/x-furniture',kind);e.dataTransfer.effectAllowed='copy';setMode('fill');setOpenDoors(true);}
  function addModule(copy = false) {
    const source = copy
      ? m
      : { ...initialModule(), width: 600, sections: [section()] };
    const next = appendModule(project, source,copy?placed:undefined);
    if (commitProject(next)) {
      selectModule(next.modules.at(-1)!.id);
    }
  }
  const [selected, setSelected] = useState(m.sections[0].id),
    [view, setView] = useState<View>("iso"),
    [fit, setFit] = useState(0),
    [openDoors, setOpenDoors] = useState(true),
    [exploded, setExploded] = useState(false),
    [dimensions, setDimensions] = useState(true),
    [tab, setTab] = useState<"module" | "section" | "room">("module");
  const [error, setError] = useState(startup.error),
    [saved, setSaved] = useState("На этом компьютере"),
    [modal, setModal] = useState<
      "materials" | "parts" | "help" | "output" | "cloud" | "render" | "library" | "new" | null
    >(null),
    [materialTarget, setMaterialTarget] = useState<"decor" | "facadeDecor" | "drawerFacadeDecor">(
      "decor",
    ),
    [search, setSearch] = useState("");
  const capture = useRef<(() => string) | undefined>(undefined);
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
  function commitProject(next: Project) {
    const e = projectErrors(next);
    if (e.length) {
      setError(e[0]);
      return false;
    }
    if (JSON.stringify(next) === JSON.stringify(project)) {
      setError("");
      return true;
    }
    touched.current = true;
    setHistory((h) => [...h.slice(0, cursor + 1), next].slice(-61));
    setCursor(Math.min(cursor + 1, 60));
    setError("");
    return true;
  }
  function commit(next: Module) {
    return commitProject({
      ...project,
      modules: project.modules.map((a) =>
        a.id === placed.id ? { ...a, module: next } : a,
      ),
    });
  }
  useEffect(()=>{setAllMaterials(false);},[modal]);
  function movePlaced(key: "x" | "y" | "z", value: number) {
    try{commitProject(setWallDistance(project,placed.id,key,value,moveAll));}catch(e){setError((e as Error).message);}
  }
  function modify(update: (draft: Module) => void) {
    const next = structuredClone(m);
    update(next);
    return commit(next);
  }
  function modifySection(update: (draft: Section, next: Module) => void) {
    modify((next) => {
      update(next.sections[idx], next);
      const a = next.sections[idx];
      if (a.drawerConfigs)
        a.drawerConfigs = a.drawerConfigs.slice(0, Math.max(0, a.drawers));
    });
  }
  function chooseSection(id: string) {
    setDrawerPreview(false);
    setSelectedPart(null);
    setSelected(id);
    setDrawerIndex(null);
    setTab("section");
  }
  useEffect(() => {
    if (!touched.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(project));
      setSaved("Сохранено в браузере");
    } catch {
      setSaved("Не сохранено");
      setError(
        "Хранилище браузера недоступно. Сохраните модуль кнопкой «Скачать».",
      );
    }
  }, [project]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const input =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if (input || direct) return;
      if(e.key==='Delete'&&!modal&&canRemove){e.preventDefault();removeSelected();}
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
          'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
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
    const n = {...structuredClone(m),sections:[section()]};
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
    const right=idx<m.sections.length-1;
    try{commitProject(moveDivider(project,placed.id,m.sections[right?idx+1:idx].id,right?width-b.width:b.width-width));}catch(e){setError((e as Error).message);}
  }
  function download() {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download =
      (m.name.replace(/[<>:"/\\|?*]/g, "_") || "Модуль") + ".project.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const texture = (name: string) =>
    catalog.find((c) => c.n === name)?.tex || undefined;
  return (
    <div className={'app'+(presentation?' presentation':'')}>
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
            readOnly={presentation}
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
          <button className="outline presentation-trigger" onClick={()=>{setPresentation(!presentation);setRoomPlan(false);setView('iso');setOpenDoors(false);}}>{presentation?'Вернуться к редактору':'Показать клиенту'}</button>
          <button className="outline" onClick={()=>setModal("cloud")}>Кабинет</button>
          <button className="outline documents-action" aria-label="Выдать документы" title="Карты листов, деталировка и КП" onClick={() => {if(roomPlan){setRoomPlan(false);setView("iso");setShowRoom(true);}setOutputTab("sheets");setModal("output");}}>
            <Layers size={16} /> <span>Выдать документы</span>
          </button>
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
          if (file.size > 2000000) {
            setError("Файл слишком большой. Откройте файл проекта до 2 МБ.");
            return;
          }
          try {
            const imported = parseProject(JSON.parse(await file.text()));
            const next = imported.modules[0].module;
            if (
              imported.modules.some(
                ({ module: n }) =>
                  !catalog.some((c) => c.n === n.decor) ||
                  !catalog.some((c) => c.n === n.facadeDecor)||(n.drawerFacadeDecor!==undefined&&!catalog.some(c=>c.n===n.drawerFacadeDecor)),
              )
            )
              throw new Error(
                "Материал из файла не найден в каталоге Lamarty.",
              );
            if (commitProject(imported)) {
              setActive(imported.modules[0].id);
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
      {direct && (
        <div
          className="dimension-editor"
          role="dialog"
          aria-label="Изменить размер"
        >
          <form
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              const items = Array.from(
                e.currentTarget.querySelectorAll<HTMLElement>("input,button"),
              );
              const first = items[0],
                last = items.at(-1);
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            }}
            onSubmit={(e) => {
              e.preventDefault();
              const v = Number(directValue);
              if (!directValue.trim() || !Number.isFinite(v)) {
                setError("Введите размер числом.");
                return;
              }
              if (direct.apply(v)) setDirect(null);
            }}
          >
            <label>
              {direct.label}, мм
              <input
                autoFocus
                type="number"
                value={directValue}
                onChange={(e) => setDirectValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setDirect(null);
                }}
              />
            </label>
            {error && (
              <p role="alert" className="dimension-error">
                {error}
              </p>
            )}
            <button type="submit" className="primary">
              Применить
            </button>
            <button type="button" onClick={() => setDirect(null)}>
              Отмена
            </button>
          </form>
        </div>
      )}
      <main className="workspace">
        <aside className="library">
          <div className="panel-heading">
            <span className="eyebrow">КОНСТРУКЦИЯ</span>
            <h1>Соберите шкаф</h1>
            <p>
              <span title="Габарит закрытой мебели Ш × В × Г: включает промежутки, задники, фасады и ручки.">Вся композиция:<br/><span style={{whiteSpace:'nowrap'}}>{Math.round(composition.w)} × {Math.round(composition.h)} × {Math.round(composition.d)} мм</span></span>
            </p>
          </div>
          <button className="text-action upper-add" onClick={()=>setModal("new")}>Новый проект / восстановить</button>
          <div className="project-modules">
            <button className="primary full" onClick={() => addModule()}>
              <Plus size={17} /> Добавить модуль
            </button>
            {project.modules.map((a, i) => (
              <button
                key={a.id}
                className="module-item"
                title={a.module.name}
                aria-pressed={a.id === placed.id}
                onClick={() => selectModule(a.id)}
              >
                <Box size={18} />
                <span>
                  <b>{a.module.name}</b>
                  <small>
                    {a.module.width} × {a.module.height} × {a.module.depth}
                  </small>
                </span>
                <small>{i + 1}</small>
              </button>
            ))}
<label className="snap-control"><input type="checkbox" aria-label="Привязки корпусов" checked={snapping} onChange={e=>setSnapping(e.target.checked)}/> Привязки корпусов</label>
<label className="snap-control"><input type="checkbox" aria-label="Двигать всю композицию" checked={moveAll} onChange={e=>{setMoveAll(e.target.checked);setMode('move');}}/> Двигать всю композицию</label>
            <button className="text-action" onClick={() => addModule(true)}>
              <Copy size={14} /> Копировать выбранный
            </button>
            <button
              className="text-action"
              onClick={() => {
                setTab("room");
                setShowRoom(true);
                setRoomPlan(true);
                setFit((f) => f + 1);
              }}
            >
              <Ruler size={14} /> Замер помещения
            </button>
          </div>
          <button className="text-action upper-add" title={`Высота до 600 мм; под потолком остаётся ${MEASUREMENT_RULES.ceilingClearance} мм по СТП`} onClick={addUpper}><Plus size={16}/> Антресоль сверху</button>
          <div className="library-label">Готовое наполнение</div>
          <button className="text-action upper-add" onClick={()=>setModal("library")}>Моя библиотека модулей</button>
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
            <button draggable onDragStart={e=>startFill(e,'pantograph')} onClick={()=>dropFilling('pantograph',placed.id,selectedId,b.top-100)}><Shirt size={19}/><span>Пантограф</span><Plus size={15}/></button>
            <button draggable onDragStart={e=>startFill(e,'shelf')}
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
            <button draggable onDragStart={e=>startFill(e,'drawer')}
              onClick={() => {
                setTab("section");
                modifySection((a) => a.drawers++);
              }}
            >
              <Archive size={19} />
              <span>Добавить ящик</span>
              <Plus size={15} />
            </button>
            <button draggable onDragStart={e=>startFill(e,'rod')}
              onClick={() => {
                setTab("section");
                modifySection((a) => {a.rod=!a.rod;a.pantograph=false;});
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
            <p>Перетащите полку, ящик или штангу в корпус. Для перемещения корпуса выберите «Двигать корпуса».</p>
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
                  aria-pressed={!roomPlan&&view === v.id}
                  onClick={() => {
                    setView(v.id);
                    setRoomPlan(false);
                    setFit((f) => f + 1);
                  }}
                >
                  {v.label}
                </button>
              ))}
              <button hidden={presentation} aria-pressed={roomPlan} onClick={()=>{setRoomPlan(true);setTab('room');}}>План</button>
            </div>
            <span className="scale-label">РАЗМЕРЫ В ММ</span>
          </div>
          <div className="interaction-bar" style={{display:roomPlan?"none":undefined}}>{([{id:'move',label:'Двигать корпуса',icon:Move3D},{id:'fill',label:'Наполнение',icon:Rows3},{id:'orbit',label:'Повернуть вид',icon:RotateCcw}] as const).map(t=><button key={t.id} aria-pressed={mode===t.id} onClick={()=>{setMode(t.id);if(t.id==='fill')setOpenDoors(true)}}><t.icon size={16}/>{t.label}</button>)}</div>
          {roomPlan?<RoomPlan moveAll={moveAll} selectedObstacle={selectedObstacle} onObstacleSelect={id=>{setSelectedObstacle(id);setSelectedOpening(undefined);}} selectedOpening={selectedOpening} onOpeningSelect={id=>{setSelectedOpening(id);setSelectedObstacle(undefined);}} snapping={snapping} project={project} active={placed.id} onSelect={selectModule} onRoom={()=>setTab('room')} update={commitProject}/>:<Scene
            moveAll={moveAll}
            mode={presentation?'orbit':mode}
            presentation={presentation}
            drawerPreview={!presentation&&drawerPreview&&s.drawers>0?{sid:s.id,index:Math.min(drawerIndex??0,s.drawers-1)}:undefined}
            snap={(mid,p)=>snapping?(moveAll?snapComposition:snapPlacement)(project,mid,p):{x:Math.round(p.x),y:Math.round(p.y),z:Math.round(p.z)}}
            onMoveModule={moveBody}
            moveProblem={(mid,p)=>projectErrors((moveAll?moveComposition:moveModule)(project,mid,p))[0]}
            onMoveDivider={(mid,sid,delta)=>{try{return commitProject(moveDivider(project,mid,sid,delta));}catch(e){setError((e as Error).message);return false;}}}
            dividerProblem={(mid,sid,delta)=>{try{moveDivider(project,mid,sid,delta);return undefined;}catch(e){return (e as Error).message;}}}
            partProblem={(mid,sid,pid,delta,to)=>{try{const next=to&&(to.mid!==mid||to.sid!==sid)?transferPart(project,mid,sid,pid,to.mid,to.sid,to.y):movePart(project,mid,sid,pid,delta);return projectErrors(next)[0];}catch(e){return (e as Error).message;}}}
            onMovePart={moveFilling}
            onDropItem={dropFilling}
            onTransfer={(mid,sid,pid,toMid,toSid,y)=>{try{const next=transferPart(project,mid,sid,pid,toMid,toSid,y);if(commitProject(next)){setActive(toMid);chooseSection(toSid);setMode('fill');return true;}}catch(e){setError((e as Error).message);}return false;}}
            captureReady={(fn) => (capture.current = fn)}
            module={m}
            arrangement={project.modules}
            activeId={placed.id}
            room={showRoom ? project.room : undefined}
            selectedObstacle={selectedObstacle}
            onObstacleSelect={id=>{setSelectedObstacle(id);setSelectedOpening(undefined);setSelectedPart(null);setTab('room');}}
            onModuleSelect={selectModule}
            transparent={presentation?false:transparent}
            onDimension={(key) =>
              editDimension(
                key === "width"
                  ? "Ширина"
                  : key === "height"
                    ? "Высота"
                    : "Глубина",
                m[key],
                (v) => modify((n) => (n[key] = v)),
              )
            }
            onGap={(index) => {
              const g = shelfGaps(m, selectedId)[index];
              if (g)
                editDimension("Проём " + (index + 1), g.height, (v) =>
                  modify((n) => setShelfGap(n, selectedId, index, v)),
                );
            }}
            onPartSelect={(sid, pid) => {
              chooseSection(sid);
              setSelectedPart({mid:placed.id,sid,pid});
              if(pid.includes(":shelf:")||pid.includes(":drawer:"))setMode("fill");
              if (pid.includes(":drawer:")) {
                setDrawerIndex(Number(pid.split(":drawer:")[1].split(":")[0]));
              }
            }}
            selectedPart={!presentation&&selectedPart?.mid===placed.id?selectedPart.pid:undefined}
            selected={presentation?'':selectedId}
            onSelect={chooseSection}
            texture={texture(m.decor)}
            facadeTexture={texture(m.facadeDecor)}
            view={view}
            fit={fit}
            openDoors={openDoors}
            exploded={presentation?false:exploded}
            dimensions={presentation?false:dimensions}
          />}
          {presentation&&<div className="presentation-tools"><button aria-pressed={showRoom} onClick={()=>setShowRoom(!showRoom)}>Помещение</button><button aria-pressed={openDoors} onClick={()=>setOpenDoors(!openDoors)}>{openDoors?'Закрыть фасады':'Открыть фасады'}</button><button className="primary" onClick={()=>{try{const png=capture.current?.();if(!png){setError('Изображение ещё загружается. Повторите через несколько секунд.');return;}setRenderImage(png);setModal('render');}catch{setError('Не удалось сохранить изображение. Попробуйте ещё раз.');}}}>Сохранить изображение</button></div>}
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
          <div className="scene-tools" style={{display:roomPlan?"none":undefined}}>
            <button
              aria-label="Прозрачный корпус"
              title="Прозрачный корпус"
              aria-pressed={transparent}
              onClick={() => setTransparent((v) => !v)}
            >
              <Layers size={19} />
            </button>
            <button
              aria-label="Показать помещение"
              title="Помещение"
              aria-pressed={showRoom}
              onClick={() => {
                setShowRoom((v) => !v);
                setFit((f) => f + 1);
              }}
            >
              <Box size={19} />
            </button>
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
          <div className="section-picker" style={{display:roomPlan?"none":undefined}}>
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
          <div className="orbit-help" style={{display:roomPlan?"none":undefined}}>
            <RotateCcw size={13} /> {mode==='move'?(moveAll?'Тяните любой корпус — движется вся композиция':snapping?'Тяните корпус · Alt — без привязки':'Тяните корпус · привязки отключены'):mode==='fill'?'Полки и ящики — по высоте, перегородки — по ширине':'Перетащите, чтобы повернуть'} <span>·</span>{" "}
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
          {tab === "room" ? (
            <div className="property-section">
              <h2>Замер помещения</h2>
              <p className="field-note">
                Прямоугольное помещение. Модули не должны пересекаться или
                выходить за стены.
              </p>
              {(["width", "height", "depth"] as const).map((k, i) => (
                <NumberField
                  key={k}
                  label={
                    ["Ширина комнаты", "Высота потолка", "Глубина комнаты"][i]
                  }
                  value={project.room[k]}
                  min={500}
                  max={20000}
                  onChange={(v) =>
                    commitProject({
                      ...project,
                      room: { ...project.room, [k]: v },
                    })
                  }
                />
              ))}
              <details className="measurement-fields"><summary>Карточка замера</summary><p className="field-note">Номер и дата из задания на корпус. Примечания сохранятся в ведомости проекта.</p>{(['number','date','notes'] as const).map(k=>{const measure=project.measurement||{number:'',date:'',notes:''};const change=(value:string)=>commitProject({...project,measurement:{...measure,[k]:value}});const label={number:'Номер замера',date:'Дата замера',notes:'Особенности замера'}[k];return <label className="hardware-field" key={k}>{label}{k==='notes'?<textarea aria-label={label} value={measure[k]} maxLength={2000} rows={4} placeholder="Перепады стен, плинтус, розетки, доступ к коммуникациям…" onChange={e=>change(e.target.value)}/>:<input aria-label={label} type={k==='date'?'date':'text'} maxLength={k==='number'?60:10} value={measure[k]} onChange={e=>change(e.target.value)}/>}</label>;})}</details>
              <details className="measurement-fields"><summary>Мебель в нише · вычеты СТП</summary><p className="field-note">Введите минимальные размеры по нескольким точкам. Отклонение стены измеряется относительно уровня.</p>{!project.measurement?.niche?<button className="outline" onClick={()=>commitProject({...project,measurement:{number:'',date:'',notes:'',...project.measurement,niche:{width:project.room.width,height:project.room.height,depth:project.room.depth,deviation:0}}})}>Рассчитать по замеру</button>:<>{(['width','height','depth','deviation'] as const).map(k=><NumberField key={k} label={{width:'Минимальная ширина ниши',height:'Нижняя точка потолка',depth:'Минимальная глубина ниши',deviation:'Отклонение стены'}[k]} value={project.measurement!.niche![k]} min={k==='deviation'?0:500} max={k==='deviation'?300:20000} onChange={v=>commitProject({...project,measurement:{...project.measurement!,niche:{...project.measurement!.niche!,[k]:v}}})}/>)}{(()=>{const fit=nicheSize(project.measurement!.niche!);return <div className="niche-result"><strong>Предельные габариты мебели</strong><p>{fit.width} × {fit.height} × {fit.depth} мм</p><small>Ширина −{fit.side}, высота −30, глубина −5 мм. Каждый отдельный корпус — не более 900 × 2200 мм.</small></div>;})()}<p className="field-note">При отклонении ровно 10 мм выбран запас 15 мм. Проверьте светильники, выступы и карнизы. Расчёт не меняет размеры комнаты и модулей автоматически.</p></>}</details>
              <details className="measurement-fields"><summary>Сдвинуть всю композицию</summary><p className="field-note">Все {project.modules.length} корпуса сдвигаются вместе. Стыки, расстояния и положение антресолей относительно нижних модулей сохраняются.</p>{(['x','z','y'] as const).map(axis=><NumberField key={axis} label={{x:'Композиция от левой стены',z:'Композиция от задней стены',y:'Композиция от пола'}[axis]} value={Math.round(mountingComposition[axis]*10)/10} min={0} max={{x:project.room.width-mountingComposition.w,z:project.room.depth-mountingComposition.d,y:project.room.height-mountingComposition.h}[axis]} onChange={v=>{try{commitProject(setCompositionDistance(project,axis,v));}catch(e){setError((e as Error).message);}}}/>)}<p className="field-note">Отступы — по монтажному габариту, как у отдельного корпуса. Выступы ручек проверяются отдельными подсказками. Отмена возвращает всю расстановку одним шагом.</p></details>
              <RoomWarnings project={project} select={mid=>{selectModule(mid);setRoomPlan(true);}}/>
              <RoomEditor selected={selectedOpening} onSelect={setSelectedOpening} room={project.room} onChange={room=>commitProject({...project,room})}/>
              <RoomObstacles selected={selectedObstacle} onSelect={setSelectedObstacle} room={project.room} onChange={room=>commitProject({...project,room})}/>
              <button className="text-action" onClick={() => setTab("module")}>
                К выбранному модулю
              </button>
            </div>
          ) : tab === "module" ? (
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
                    <small>Одна или две створки по ширине</small>
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
              {m.sections.some(s=>s.drawers>0)&&<div className="property-section"><h2>Фасады ящиков</h2><button className="text-action" onClick={()=>{setMaterialTarget('drawerFacadeDecor');setModal('materials');}}>Материал ящиков: {m.drawerFacadeDecor??m.facadeDecor}<ChevronDown size={13}/></button>{m.drawerFacadeDecor&&<button className="text-action" onClick={()=>modify(n=>delete n.drawerFacadeDecor)}>Как у распашных фасадов</button>}</div>}
              <div className="property-section">
                <h2>Положение в помещении</h2>
                <button className="outline" onClick={()=>{try{if(commitProject(mirrorModule(project,active))){setSelectedPart(null);setDrawerPreview(false);setOpenDoors(true);}}catch(e){setError((e as Error).message);}}}>Зеркально отразить наполнение</button><p className="field-note">Меняет левую и правую секции местами и сторону петель. Размеры и положение корпуса сохраняются.</p>
                <label className="hardware-field">Поворот корпуса<select aria-label="Поворот корпуса" value={placed.rotation??0} onChange={e=>{try{commitProject(rotateModule(project,placed.id,Number(e.target.value) as 0|90|180|270));}catch(e){setError((e as Error).message);}}}>{[0,90,180,270].map(r=><option key={r} value={r}>{r}°</option>)}</select></label><p className="field-note">Поворот — вокруг центра; у стены корпус сдвигается внутрь комнаты. Перетащите его в сцене для расстановки, на виде спереди — по высоте.</p><NumberField label="От пола" value={placed.y??0} min={moveAll?placedBounds.y-mountingComposition.y:0} max={moveAll?project.room.height-mountingComposition.h+placedBounds.y-mountingComposition.y:project.room.height-m.height} onChange={v=>movePlaced('y',v)}/>
                <NumberField
                  label="От левой стены"
                  value={placedBounds.x}
                  min={moveAll?placedBounds.x-mountingComposition.x:0}
                  max={moveAll?project.room.width-mountingComposition.w+placedBounds.x-mountingComposition.x:project.room.width-placedBounds.w}
                  onChange={(v) => movePlaced("x", v)}
                />
                <NumberField
                  label="От задней стены"
                  value={placedBounds.z}
                  min={moveAll?placedBounds.z-mountingComposition.z:0}
                  max={moveAll?project.room.depth-mountingComposition.d+placedBounds.z-mountingComposition.z:project.room.depth-placedBounds.d}
                  onChange={(v) => movePlaced("z", v)}
                />
                <p className="field-note">Отступы учитывают поворот, выступ задней стенки и место под фасады.</p>{moveAll&&<p className="field-note"><b>Общий сдвиг:</b> отступ выбранного корпуса перемещает всю композицию.</p>}
                <button
                  className="text-action danger"
                  disabled={project.modules.length === 1}
                  onClick={() =>
                    commitProject({
                      ...project,
                      modules: project.modules.filter(
                        (a) => a.id !== placed.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={14} /> Удалить модуль
                </button>
              </div>
              <div className="property-section">
                <h2>Конструкция цеха</h2>
                <label className="hardware-field">Задняя стенка<select aria-label="Тип задней стенки" value={m.backType??'nailed'} onChange={e=>modify(n=>n.backType=e.target.value as Module['backType'])}><option value="nailed">ЛХДФ · набивная</option><option value="groove">ЛХДФ · в паз</option><option value="board">ЛДСП 16 · вкладная</option><option value="none">Без задней стенки</option></select></label>
                {m.backType==='none'&&<p className="field-note">Корпус без задней стенки: крепление к стене и жёсткость проверяет технолог.</p>}
                {m.backType==='board'&&<p className="field-note">ЛДСП 16 мм в цвет корпуса, между боковинами, дном и крышей. Уменьшает полезную глубину на 17 мм. Крепёж уточняет технолог.</p>}
                {m.backType==='groove'&&<><NumberField label="Отступ паза от зада" value={m.grooveInset??16} min={8} max={30} onChange={v=>modify(n=>n.grooveInset=v)}/><NumberField label="Глубина паза" value={m.grooveDepth??8} min={4} max={10} onChange={v=>modify(n=>n.grooveDepth=v)}/><p className="field-note">Профиль паза проверяет технолог перед выпуском.</p></>}
                <label className="hardware-field">Цоколь<select aria-label="Высота цоколя" value={plinth(m)} onChange={e=>modify(n=>n.plinthHeight=Number(e.target.value))}>{[0,80,100,120,150].map(v=><option key={v} value={v}>{v===0?'Без цоколя':v+' мм'}</option>)}</select></label>
                <label className="hardware-field">Петли одиночной двери<select aria-label="Сторона петель" value={m.hingeSide??'left'} onChange={e=>modify(n=>n.hingeSide=e.target.value as Module['hingeSide'])}><option value="left">Слева</option><option value="right">Справа</option></select></label>
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
                    <dd>{plinth(m)} мм</dd>
                  </div>
                  <div>
                    <dt>Задняя стенка</dt>
                    <dd>{m.backType==='none'?'Нет':m.backType==='board'?'ЛДСП 16 мм':'ЛХДФ 3 мм'}</dd>
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
                {canRemove&&<div className="selected-filling"><span>{selectedFillingName}</span><button className="text-action danger" onClick={removeSelected}><Trash2 size={14}/>{removalLabel}</button><small>Можно нажать Delete · Ctrl+Z отменит удаление</small></div>}
                <NumberField
                  label="Внутренняя ширина"
                  value={Math.round(b.width * 10) / 10}
                  min={RULES.minSection}
                  max={m.sections.length===1?b.width:b.width+boxes(m)[idx<m.sections.length-1?idx+1:idx-1].width-RULES.minSection}
                  onChange={resizeSection}
                />
                <p className="field-note">
                  {m.sections.length===1?'Ширину единственной секции задаёт габарит корпуса.':`Изменится только соседняя секция ${idx<m.sections.length-1?'справа':'слева'}. Остальные проёмы сохранят ширину.`}
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
                {s.drawers > 0 && (
                  <div className="drawer-selection">
                    <h3>Настройка ящиков</h3>
                    <div className="drawer-tabs">
                      {Array.from({ length: s.drawers }, (_, j) => (
                        <button
                          key={j}
                          aria-pressed={(drawerIndex ?? 0) === j}
                          onClick={() => {setDrawerIndex(j);setSelectedPart({mid:placed.id,sid:s.id,pid:s.id+':drawer:'+j+':facade'});setMode('fill');setOpenDoors(true);}}
                        >
                          <span>Ящик {j + 1}</span><small>{Math.round(drawerOffsets(s)[j])} мм от дна</small>
                        </button>
                      ))}
                    </div>
                    <button className="outline full" aria-pressed={drawerPreview} onClick={()=>{setDrawerPreview(!drawerPreview);setOpenDoors(true);setExploded(false);setRoomPlan(false);setView('iso');}}>{drawerPreview?'Задвинуть ящик':'Выдвинуть для просмотра'}</button>
                    <p className="field-note">Просмотр конструкции. Положение ящика не меняет деталировку.</p>
                    {(() => {
                      const j = Math.min(drawerIndex ?? 0, s.drawers - 1),
                        c = drawerConfig(m, s, j);
                      const update = (patch: Partial<DrawerConfig>) =>
                        modifySection((a, n) => {
                          const offsets=drawerOffsets(a);
                          a.drawerConfigs = Array.from(
                            { length: a.drawers },
                            (_, k) => ({...drawerConfig(n, a, k),...(patch.y===undefined?{}:{y:offsets[k]})}),
                          );
                          a.drawerConfigs[j] = {
                            ...a.drawerConfigs[j],
                            ...patch,
                          };
                        });
                      return (
                        <>
                          <label className="hardware-field">
                            Направляющие
                            <select
                              aria-label="Направляющие ящика"
                              value={c.slide}
                              onChange={(e) => {
                                const slide=e.target.value as DrawerConfig['slide'],length=compatibleSlideLength(slide,c.length,m.depth-rearClear(m)-(m.doors?44:25));
                                if(length===undefined){setError('Для этой глубины нет подходящих направляющих выбранного типа.');return;}
                                update({slide,handle:undefined,length});
                              }}
                            >
                              {Object.entries(SLIDES).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="hardware-field">
                            Номинальная длина
                            <select
                              aria-label="Длина направляющих"
                              value={c.length}
                              onChange={(e) =>
                                update({ length: Number(e.target.value) })
                              }
                            >
                              {SLIDES[c.slide].lengths.map((l) => (
                                <option key={l} value={l}>
                                  {l} мм
                                  {l > m.depth - rearClear(m) - (m.doors?44:25) ? " · не помещается" : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="hardware-field">Ручка ящика<select aria-label="Ручка ящика" value={c.handle===undefined?'auto':c.handle?'yes':'no'} onChange={e=>update({handle:e.target.value==='auto'?undefined:e.target.value==='yes'})}><option value="auto">{c.slide==='gtv0fpo'?'Без ручки · Push to Open':'Ручка 128 мм'}</option>{c.slide==='gtv0fpo'&&<option value="yes">Добавить ручку 128 мм</option>}{c.slide==='gtv0fpo'&&<option value="no">Без ручки</option>}</select></label>
                          <NumberField label="Ящик от дна проёма" value={drawerOffsets(s)[j]} min={0} max={b.top-b.bottom-c.height-40} onChange={v=>update({y:v})}/>
                          <NumberField
                            label="Высота боковины ящика"
                            value={c.height}
                            min={68}
                            max={300}
                            onChange={(v) => update({ height: v })}
                          />
                          <p className="field-note">{SLIDES[c.slide].note}</p>
                          {c.slide === "gtv0fpo" && (
                            <a
                              className="text-action"
                              href={GTV_SOURCE}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Техническая карта GTV ↗
                            </a>
                          )}
                        </>
                      );
                    })()}
                    <details className="drawer-group-tools"><summary>Весь блок ящиков</summary>
                    <button className="text-action" onClick={()=>{try{commitProject(compactDrawers(project,placed.id,s.id));}catch(e){setError((e as Error).message);}}}>Собрать ящики от дна</button><p className="field-note">Убирает разрывы между ящиками. Порядок снизу вверх, высоты и направляющие сохраняются; полка над блоком перемещается вместе с ним.</p>
                    {s.drawers>1&&<><button className="text-action" onClick={()=>{try{commitProject(applyDrawerSlide(project,placed.id,s.id,Math.min(drawerIndex??0,s.drawers-1)));}catch(e){setError((e as Error).message);}}}>Эти направляющие всем ящикам секции</button><p className="field-note">Копирует тип и длину. Высота и положение каждого ящика сохраняются.</p></>}
                    </details>
                  </div>
                )}
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
                <button className="outline full" onClick={()=>modifySection(a=>{a.pantograph=!a.pantograph;a.rod=false})}>{s.pantograph?'Убрать пантограф':'Добавить пантограф'}</button>
                {(s.rod||s.pantograph)&&<NumberField label="Высота штанги от дна" value={Math.round((parts(m).find(p=>p.id===s.id+':rod'||p.id===s.id+':pantograph:rod')?.position[1]??b.bottom)-b.bottom)} min={100} max={b.top-b.bottom-50} onChange={v=>modifySection(a=>a.rodAt=v/(b.top-b.bottom))}/>}
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
                    <h3>Проёмы в свету</h3>
                    {shelfGaps(m, selectedId).map((g, j) => (
                      <NumberField
                        key={"gap" + j}
                        label={"Проём " + (j + 1)}
                        value={g.height}
                        min={64}
                        max={b.top - b.bottom}
                        onChange={(v) =>
                          modify((n) => setShelfGap(n, selectedId, j, v))
                        }
                      />
                    ))}
                    <h3>Высота центра полки</h3>
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
                    commitProject(clearSection(project,placed.id,selectedId))
                  }
                >
                  <Trash2 size={15} /> Очистить наполнение
                </button>
                {m.sections.length > 1 && (
                  <button
                    className="text-action danger"
                    onClick={() => {
                      try{commitProject(removeSection(project,placed.id,selectedId));}catch(e){setError((e as Error).message);}
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
          3D-редактор модулей <b>03</b>
        </span>
        <button onClick={() => setModal("parts")}>
          <Layers size={14} />
          {allParts.filter((p) => p.material !== "metal").length} деталей{" "}
          <span>Посмотреть</span>
        </button>
        <button className="room-warning-link" hidden={!placementWarnings.length} onClick={()=>{setRoomPlan(true);setTab("room");}}>Проверить расстановку · {placementWarnings.length}</button>
        <PriceStatus project={project} open={()=>{setOutputTab("estimate");setModal("output");}}/>
        <button className="stage-note" onClick={() => {if(roomPlan){setRoomPlan(false);setView("iso");setShowRoom(true);}setOutputTab("sheets");setModal("output");}}>
          Lamarty 2750 × 1830 · Карты листов и КП
        </button>
      </footer>
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className={`modal ${modal === "parts" || modal === "output" || modal === "cloud" || modal === "render" || modal === "library" ? "wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">МОДУЛЬ</span>
                <h2 id="modal-title">
                  {modal === "new" ? "Новый проект" : modal === "library" ? "Моя библиотека модулей" : modal === "render" ? "Изображение проекта" : modal === "cloud" ? "Кабинет проектов" : modal === "output"
                    ? "Документы проекта"
                    : modal === "materials"
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
            {modal === "new" ? <NewProjectPanel project={project} open={next=>{if(commitProject(next)){selectModule(next.modules[0].id);setRoomPlan(false);setView("iso");setMode("move");setModal(null);return true;}return false;}}/> : modal === "library" ? <ModuleLibrary module={m} insert={source=>{const next=appendModule(project,source);next.modules.at(-1)!.module.name=source.name;if(commitProject(next)){selectModule(next.modules.at(-1)!.id);setModal(null);return true;}return false;}}/> : modal === "render" ? <div className="render-preview"><img src={renderImage} alt="Изображение мебели для клиента"/><a className="primary render-download" href={renderImage} download="Проект мебели.png">Скачать PNG</a><p className="field-note">PNG, до 2560 пикселей. Если встроенный браузер не скачивает файл, откройте редактор в Edge или Chrome.</p></div> : modal === "cloud" ? <CloudPanel project={project} update={commitProject}/> : modal === "output" ? (
              <OutputPanel
                  initialTab={outputTab}
                project={project}
                capture={() => capture.current?.()}
                update={commitProject}
              />
            ) : modal === "materials" ? (
              <>
                <p className="field-note">Материал: {materialTarget==='decor'?'корпуса':materialTarget==='facadeDecor'?'распашных фасадов':'фасадов ящиков'}.</p><label className="cloud-filters"><input type="checkbox" aria-label="Все модули проекта" checked={allMaterials} onChange={e=>setAllMaterials(e.target.checked)}/>Все модули проекта ({project.modules.length})</label>
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
                        aria-pressed={(m[materialTarget]??m.facadeDecor) === c.n}
                        onClick={() => {
                          const ok=allMaterials?commitProject({...project,modules:project.modules.map(a=>({...a,module:{...a.module,[materialTarget]:c.n}}))}):modify((n) => (n[materialTarget] = c.n));
                          if(!ok)return;
                          setAllMaterials(false);
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
                        {(m[materialTarget]??m.facadeDecor) === c.n && <Check size={15} />}
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
                <div className="help-steps">
                  <button onClick={()=>{setModal(null);setRoomPlan(true);setTab('room');}}><b>1. Замерьте помещение</b><span>Габариты комнаты, окна и двери. В карточке замера — номер, дата и особенности.</span></button>
                  <button onClick={()=>{setModal(null);setRoomPlan(false);setTab('module');setMode('move');}}><b>2. Соберите шкаф из корпусов</b><span>Добавьте модули до 900 × 2200 мм. Тяните их в режиме «Двигать корпуса» или на плане: края притягиваются к соседям. Удерживайте Alt для точного отступа без привязки.</span></button>
                  <button onClick={()=>{setModal(null);setRoomPlan(false);setTab('section');setMode('fill');setOpenDoors(true);}}><b>3. Настройте наполнение</b><span>В режиме «Наполнение» тяните полки и ящики по высоте или в другой корпус. Новые элементы перетаскивайте слева. Перегородки тяните влево или вправо. Нажмите ящик, чтобы выбрать направляющие.</span></button>
                  <button onClick={()=>{setOutputTab('sheets');setModal('output');}}><b>4. Проверьте проект</b><span>Смета, деталировка, карты Lamarty 2750 × 1830, ведомость и проверочные бирки — в «Выдать документы».</span></button>
                  <button onClick={()=>{setModal(null);setPresentation(true);setRoomPlan(false);setView('iso');setOpenDoors(false);}}><b>5. Покажите клиенту</b><span>Крупный вид без рабочих панелей. Покажите помещение и фасады, сохраните изображение. КП — в документах.</span></button>
                  <button onClick={()=>setModal('cloud')}><b>6. Сохраните вариант</b><span>Кабинет хранит проекты и историю версий. Сейчас сервер работает на этом компьютере. Файл проекта можно перенести кнопками «Скачать» и «Открыть».</span></button>
                </div>
                <p><strong>Размеры:</strong> нажмите число на модели или введите справа и нажмите Enter. Проёмы показывают расстояние в свету между полками.</p>
                <p><strong>Камера:</strong> режим «Повернуть вид» — вращение мышью; колесо — масштаб; правая кнопка — сдвиг вида.</p>
                <p><strong>Отмена:</strong> Ctrl+Z; повтор — Ctrl+Shift+Z. Delete удаляет выбранное наполнение. Escape отменяет незавершённое перетаскивание.</p>
                <p><strong>Повторное использование:</strong> «Моя библиотека модулей» сохраняет удачные корпуса в этом браузере.</p>
                <div className="help-note">Карты, ведомость и бирки предназначены для проверки технологом. Присадка, производственные чертежи и проверенные управляющие программы ещё не выпускаются.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}







