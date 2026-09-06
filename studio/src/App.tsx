import {CURRENT_PROJECT,persistProject,ProjectStorageConflict} from './projectStorage';
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
  shelfGaps, shelfInsertionHeight,
  setShelfGap,
  drawerConfig, drawerOffsets, drawerStackHeight, plinth, rearClear,
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
import { decorPrice } from "./pricing";
import { HANDLES, DEFAULT_HANDLE, handleById } from "./handles";
import { MESH, DEFAULT_MESH, MESH_KIND_LABEL, meshById } from "./mesh";
import { compatibleSlideLength, SLIDES, GTV_SOURCE, type DrawerConfig } from "./hardware";
import {
  newProject,
  parseProject,
  projectErrors,
  appendModule, appendModuleGroup, copyModuleGroup, snapComposition, snapPlacement, bounds, compositionBounds, mountingCompositionBounds, applyCornerFillers,
  type Project,
} from "./project";
import {insertedPartId,captureSectionFilling,pasteSectionFilling,type SectionFilling,duplicatePart,moveComposition,compactDrawers,setCompositionDistance,applyDrawerSlide,clearSection,removeSection,addUpperModule,rotateModuleGroup,rotateModule,setWallDistance,mirrorModule,moveDivider,insertItem,moveModule,movePart,removePart,transferPart,type FillKind} from './operations';
const KEY = CURRENT_PROJECT;
function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  onSelect,
  selected,
}: {
  onSelect?:()=>void;
  selected?:boolean;
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
  const Wrapper=onSelect?'div':'label';
  return (
    <Wrapper className="number-field">
      {onSelect?<button className="number-label-select" aria-label={'Выбрать: '+label} aria-pressed={selected} onClick={onSelect}>{label}</button>:<span>{label}</span>}
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
    </Wrapper>
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
    let original:string|null=null,currentRaw:string|null=null;
    try {
      currentRaw=localStorage.getItem(KEY);
      const s = original =
        currentRaw || localStorage.getItem("module-studio-v2") || localStorage.getItem("module-studio-v1");
      return {
        model: s ? parseProject(JSON.parse(s)) : newProject(),
        error: "",
        damaged:undefined as string|undefined,
        storageUnavailable:false,
        currentRaw,
      };
    } catch {
      return {
        model: newProject(),
        error:
          "Сохранённый проект не удалось прочитать. Открыт пример; перед автосохранением исходник будет помещён в резервную копию.",
        damaged:original??undefined,
        storageUnavailable:original===null,
        currentRaw,
      };
    }
  });
  const [history, setHistory] = useState<Project[]>([startup.model]),
    [cursor, setCursor] = useState(0);
  const project = history[cursor];
  const lastLocalWrite=useRef(startup.currentRaw);
  const currentProject=useRef(project),importSequence=useRef(0);currentProject.current=project;
  const [active, setActive] = useState(project.modules[0].id);
  const placed =
    project.modules.find((a) => a.id === active) || project.modules[0];
  const m = placed.module;
  const placedBounds=bounds(placed);
  const mountingComposition=useMemo(()=>mountingCompositionBounds(project),[project]);
  const composition=useMemo(()=>compositionBounds(project),[project]);
  const placementWarnings=useMemo(()=>roomWarnings(project),[project]);
  const [moduleSearch,setModuleSearch]=useState('');
  const moduleList=useRef<HTMLDivElement>(null);
  const moduleWords=moduleSearch.toLocaleLowerCase('ru-RU').trim().split(/\s+/).filter(Boolean);
  const visibleModules=project.modules.map((a,i)=>({a,i})).filter(({a,i})=>moduleWords.every(word=>([i+1,a.module.name,a.module.width,a.module.height,a.module.depth].join(' ').toLocaleLowerCase('ru-RU')).includes(word)));
  useEffect(()=>{setModuleSearch('');},[active]);
  useEffect(()=>{moduleList.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({block:'nearest'});},[active,moduleSearch]);
  const [materialScope,setMaterialScope]=useState<"active"|"group"|"all">("active");
  const [mode,setMode]=useState<"move"|"fill"|"orbit">("move");
  const [drawerPreview,setDrawerPreview]=useState(false);
  const [drawerIndex, setDrawerIndex] = useState<number | null>(null);
  const [meshChoice, setMeshChoice] = useState<string>(DEFAULT_MESH);
  const [fillingCopy,setFillingCopy]=useState<SectionFilling|null>(null);
  const [selectedPart,setSelectedPart]=useState<{mid:string;sid:string;pid:string}|null>(null);
  const selectedDetail=selectedPart?.mid===placed.id?parts(m).find(p=>p.id===selectedPart.pid):undefined;
  const canRemove=selectedDetail&&(/:shelf:|:drawer:|:pantograph:|:flange:/.test(selectedDetail.id)||selectedDetail.id.endsWith(':rod'));
  const selectedFillingName=selectedDetail?.id.includes(':drawer:')?'Ящик '+(Number(selectedDetail.id.split(':drawer:')[1].split(':')[0])+1):selectedDetail?.id.includes(':pantograph:')?'Пантограф':selectedDetail?.id.includes(':flange:')||selectedDetail?.id.endsWith(':rod')?'Штанга':selectedDetail?.id.includes(':shelf:')?'Полка '+(Number(selectedDetail.id.split(':shelf:')[1])+1):selectedDetail?.name;
  const removalLabel=selectedDetail?.id.includes(':drawer:')?'Удалить ящик целиком':selectedDetail?.id.includes(':pantograph:')?'Удалить пантограф':selectedDetail?.id.includes(':flange:')||selectedDetail?.id.endsWith(':rod')?'Удалить штангу':'Удалить полку';
  function removeSelected(){if(!selectedPart||!canRemove)return;try{if(commitProject(removePart(project,selectedPart.mid,selectedPart.sid,selectedPart.pid)))setSelectedPart(null);}catch(e){setError((e as Error).message);}}
  function nudgeSelected(delta:number){if(!selectedPart||!canRemove)return;try{moveFilling(selectedPart.mid,selectedPart.sid,selectedPart.pid,delta);}catch(e){setError((e as Error).message);}}
  function copySelected(){if(!selectedPart)return;try{const result=duplicatePart(project,selectedPart.mid,selectedPart.sid,selectedPart.pid);if(commitProject(result.project)){setSelectedPart({...selectedPart,pid:result.partId});setDrawerIndex(result.partId.includes(':drawer:')?Number(result.partId.split(':drawer:')[1].split(':')[0]):null);setDrawerPreview(false);setMode('fill');}}catch(e){setError((e as Error).message);}}
  const [snapping,setSnapping]=useState(true);
  const [moveAll,setMoveAll]=useState(false);
  const [groupIds,setGroupIds]=useState<string[]>([]);
  const liveGroupIds=groupIds.filter(id=>project.modules.some(a=>a.id===id));
  const movingTogether=moveAll||liveGroupIds.includes(placed.id);
  const groupBounds=moveAll?mountingComposition:mountingCompositionBounds({...project,modules:project.modules.filter(a=>liveGroupIds.includes(a.id))});
  const [focusActive,setFocusActive]=useState(false);
  const [transparent, setTransparent] = useState(false);
  const [clearFacades, setClearFacades] = useState(false);
  const [showRoom, setShowRoom] = useState(false);
  const [roomPlan,setRoomPlan]=useState(false);
  const [selectedOpening,setSelectedOpening]=useState<string>();
  const [selectedObstacle,setSelectedObstacle]=useState<string>();
  const [presentation,setPresentation]=useState(false);
  const beforePresentation=useRef<{view:View;roomPlan:boolean;openDoors:boolean;showRoom:boolean}|null>(null);
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
  function movedBodies(mid:string,pos:{x:number;y:number;z:number}){return moveAll?moveComposition(project,mid,pos):liveGroupIds.includes(mid)?moveComposition(project,mid,pos,liveGroupIds):moveModule(project,mid,pos);}
  function moveBody(mid:string,pos:{x:number;y:number;z:number}){return commitProject(movedBodies(mid,pos));}
  function snapBodies(mid:string,pos:{x:number;y:number;z:number}){return moveAll?snapComposition(project,mid,pos):liveGroupIds.includes(mid)?snapComposition(project,mid,pos,35,liveGroupIds):snapPlacement(project,mid,pos);}
  function moveFilling(mid:string,sid:string,pid:string,delta:number){return commitProject(movePart(project,mid,sid,pid,delta));}
  function selectInserted(next:Project,mid:string,sid:string,kind:FillKind){
    const pid=insertedPartId(project,next,mid,sid,kind);
    setActive(mid);chooseSection(sid);setMode('fill');setOpenDoors(true);
    if(pid){setSelectedPart({mid,sid,pid});if(kind==='drawer'||kind==='mesh')setDrawerIndex(Number(pid.split(':drawer:')[1].split(':')[0]));}
  }
  function dropFilling(kind:string,mid:string,sid:string,y:number,meshId?:string){if(!['shelf','drawer','rod','pantograph','mesh'].includes(kind))return false;try{const next=insertItem(project,kind as FillKind,mid,sid,y,undefined,meshId);if(commitProject(next)){selectInserted(next,mid,sid,kind as FillKind);return true;}}catch(e){setError(e instanceof Error?e.message:'Не удалось добавить элемент.')}return false;}
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
      "materials" | "handles" | "parts" | "help" | "output" | "cloud" | "render" | "library" | "new" | null
    >(null),
    [materialTarget, setMaterialTarget] = useState<"decor" | "facadeDecor" | "drawerFacadeDecor">(
      "decor",
    ),
    [search, setSearch] = useState("");
  const materialRecipients=project.modules.filter(a=>materialScope==='all'||(materialScope==='group'?liveGroupIds.includes(a.id):a.id===placed.id));
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
  function clearHistorySelection(){
    setSelectedPart(null);setDrawerIndex(null);setDrawerPreview(false);
    setSelectedOpening(undefined);setSelectedObstacle(undefined);
  }
  const undo = () => {
    clearHistorySelection();
    setCursor((c) => Math.max(0, c - 1));
    setError("");
    touched.current = true;
  };
  const redo = () => {
    clearHistorySelection();
    setCursor((c) => Math.min(history.length - 1, c + 1));
    setError("");
    touched.current = true;
  };
  function commitProject(raw: Project) {
    // Угловые фальши ставятся и снимаются автоматически по факту примыкания корпусов под 90°.
    const next = applyCornerFillers(raw);
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
  useEffect(()=>{setMaterialScope("active");},[modal]);
  function movePlaced(key: "x" | "y" | "z", value: number) {
    try{commitProject(setWallDistance(project,placed.id,key,value,moveAll,liveGroupIds));}catch(e){setError((e as Error).message);}
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
    if(startup.storageUnavailable){setSaved("Не сохранено");setError("При запуске не удалось прочитать хранилище. Автосохранение отключено, чтобы не заменить недоступный проект. Скачайте текущую работу и перезагрузите редактор.");return;}
    try {
      lastLocalWrite.current=persistProject(localStorage,project,startup.damaged,lastLocalWrite.current);
      setSaved("Сохранено в браузере");
    } catch (error) {
      setSaved("Не сохранено");
      setError(error instanceof ProjectStorageConflict?error.message:"Хранилище браузера недоступно. Сохраните модуль кнопкой «Скачать».");
    }
  }, [project]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const editing = e.target instanceof Element && !!e.target.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""]');
      if (e.defaultPrevented || editing || direct || modal) return;
      if(presentation){
        if(e.key==='Escape'){e.preventDefault();changePresentation(false);}
        if(e.key==='Delete'||((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())))e.preventDefault();
        return;
      }
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
  function changePresentation(enabled:boolean) {
    if(enabled){
      beforePresentation.current={view,roomPlan,openDoors,showRoom};
      setRoomPlan(false);setView('iso');setOpenDoors(false);setPresentation(true);
    }else{
      const previous=beforePresentation.current;
      if(previous){setView(previous.view);setRoomPlan(previous.roomPlan);setOpenDoors(previous.openDoors);setShowRoom(previous.showRoom);}
      beforePresentation.current=null;setPresentation(false);setFit(f=>f+1);
    }
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
            key={placed.id+':'+m.name}
            defaultValue={m.name}
            onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){e.currentTarget.value=m.name;e.currentTarget.blur();}}}
            onBlur={e=>{if(e.target.value!==m.name&&!modify(n=>{n.name=e.target.value;}))e.target.value=m.name;}}
          />
          <span>
            <i className={saved === "Не сохранено" ? "bad" : ""} />
            {saved}
          </span>
        </div>
        <div className="header-actions">
          <button className="outline presentation-trigger" onClick={()=>changePresentation(!presentation)}>{presentation?'Вернуться к редактору':'Показать клиенту'}</button>
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
          const request=++importSequence.current,before=currentProject.current;
          if (file.size > 2000000) {
            setError("Файл слишком большой. Откройте файл проекта до 2 МБ.");
            return;
          }
          try {
            const text=await file.text();
            if(request!==importSequence.current)return;
            if(currentProject.current!==before)throw Error("Проект изменился во время чтения файла. Откройте файл ещё раз, чтобы сохранить последние правки в истории отмены.");
            const imported = parseProject(JSON.parse(text));
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
              setSelectedPart(null);setDrawerPreview(false);setSelectedObstacle(undefined);setSelectedOpening(undefined);setMoveAll(false);setGroupIds([]);setTab("module");
              setActive(imported.modules[0].id);
              setSelected(next.sections[0].id);
              setFit((f) => f + 1);
            }
          } catch (e) {
            if(request!==importSequence.current)return;
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
            {(project.modules.length>6||moduleSearch)&&<label className="module-search"><input type="search" aria-label="Найти корпус в проекте" placeholder="Название, номер, размер…" value={moduleSearch} onChange={e=>setModuleSearch(e.target.value)}/><small>{visibleModules.length} из {project.modules.length} корпусов</small></label>}
            <div className="module-list" ref={moduleList}>
            {visibleModules.map(({a,i}) => (
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
            {!visibleModules.length&&<p className="field-note">Корпуса не найдены. Измените запрос.</p>}
            </div>
<label className="snap-control"><input type="checkbox" aria-label="Привязки корпусов" checked={snapping} onChange={e=>setSnapping(e.target.checked)}/> Привязки корпусов</label>
<label className="snap-control"><input type="checkbox" aria-label="Двигать всю композицию" checked={moveAll} onChange={e=>{setMoveAll(e.target.checked);if(e.target.checked){setGroupIds([]);setFocusActive(false);setFit(f=>f+1);}setMode('move');}}/> Двигать всю композицию</label>
            {project.modules.length>1&&<details className="move-group"><summary>Двигать группу{liveGroupIds.length?' · '+liveGroupIds.length:''}</summary><p className="field-note">Отметьте корпуса и тяните один из отмеченных. Остальные корпуса двигаются отдельно.</p><div className="move-group-list">{project.modules.map((a,i)=><label key={a.id}><input type="checkbox" aria-label={'В группу: '+(i+1)+'. '+a.module.name} checked={liveGroupIds.includes(a.id)} onChange={e=>{setGroupIds(ids=>e.target.checked?[...ids,a.id]:ids.filter(id=>id!==a.id));setMoveAll(false);if(e.target.checked){setFocusActive(false);setFit(f=>f+1);}setMode('move');}}/><span>{i+1}. {a.module.name}</span></label>)}</div><button className="text-action" disabled={!liveGroupIds.length} onClick={()=>{try{const result=copyModuleGroup(project,liveGroupIds);if(commitProject(result.project)){setGroupIds(result.ids);setMoveAll(false);setFocusActive(false);selectModule(result.ids[0]);setMode('move');}}catch(e){setError(e instanceof Error?e.message:'Не удалось скопировать группу.');}}}>Копировать группу</button><button className="text-action" disabled={!liveGroupIds.length} onClick={()=>{try{if(commitProject(rotateModuleGroup(project,liveGroupIds))){setFocusActive(false);setFit(f=>f+1);setMode('move');}}catch(e){setError((e as Error).message);}}}>Повернуть группу на 90°</button><p className="field-note">Стыки сохраняются. У стены группа сдвинется внутрь комнаты.</p><button className="text-action" disabled={!liveGroupIds.length} onClick={()=>setGroupIds([])}>Снять группу</button></details>}
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
              onClick={()=>dropFilling('shelf',placed.id,selectedId,shelfInsertionHeight(m,selectedId))}
            >
              <Rows3 size={19} />
              <span>Добавить полку</span>
              <Plus size={15} />
            </button>
            <button draggable onDragStart={e=>startFill(e,'drawer')}
              onClick={()=>dropFilling('drawer',placed.id,selectedId,b.bottom+drawerStackHeight(s))}
            >
              <Archive size={19} />
              <span>Добавить ящик</span>
              <Plus size={15} />
            </button>
            <div className="mesh-add">
              <button draggable onDragStart={e=>startFill(e,'mesh')}
                onClick={()=>dropFilling('mesh',placed.id,selectedId,b.bottom+drawerStackHeight(s),meshChoice)}
              >
                <Archive size={19} />
                <span>Сетка Лемана Про</span>
                <Plus size={15} />
              </button>
              <select aria-label="Элемент Лемана Про" value={meshChoice} onChange={e=>setMeshChoice(e.target.value)}>
                {(['basket','trousers','shoes'] as const).map(kind=><optgroup key={kind} label={MESH_KIND_LABEL[kind]}>{MESH.filter(i=>i.kind===kind).map(i=><option key={i.id} value={i.id}>{i.label} · проём {i.reqW}×{i.reqD} · {i.price} ₽</option>)}</optgroup>)}
              </select>
            </div>
            <button draggable onDragStart={e=>startFill(e,'rod')}
              onClick={() => {
                setTab("section");
                if(s.rod)modifySection(a=>{a.rod=false;delete a.rodAt;});else dropFilling('rod',placed.id,selectedId,b.top-RULES.rodTopOffset);
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
          {roomPlan?<RoomPlan groupIds={liveGroupIds} moveAll={moveAll} selectedObstacle={selectedObstacle} onObstacleSelect={id=>{setSelectedObstacle(id);setSelectedOpening(undefined);}} selectedOpening={selectedOpening} onOpeningSelect={id=>{setSelectedOpening(id);setSelectedObstacle(undefined);}} snapping={snapping} project={project} active={placed.id} onSelect={selectModule} onRoom={()=>setTab('room')} update={commitProject}/>:<Scene
            moveAll={moveAll}
            groupIds={liveGroupIds}
            mode={presentation?'orbit':mode}
            presentation={presentation}
            drawerPreview={!presentation&&drawerPreview&&s.drawers>0?{sid:s.id,index:Math.min(drawerIndex??0,s.drawers-1)}:undefined}
            snap={(mid,p)=>snapping?snapBodies(mid,p):{x:Math.round(p.x),y:Math.round(p.y),z:Math.round(p.z)}}
            onMoveModule={moveBody}
            moveProblem={(mid,p)=>projectErrors(movedBodies(mid,p))[0]}
            onMoveDivider={(mid,sid,delta)=>{try{return commitProject(moveDivider(project,mid,sid,delta));}catch(e){setError((e as Error).message);return false;}}}
            dividerProblem={(mid,sid,delta)=>{try{moveDivider(project,mid,sid,delta);return undefined;}catch(e){return (e as Error).message;}}}
            partProblem={(mid,sid,pid,delta,to)=>{try{const next=to&&(to.mid!==mid||to.sid!==sid)?transferPart(project,mid,sid,pid,to.mid,to.sid,to.y):movePart(project,mid,sid,pid,delta);return projectErrors(next)[0];}catch(e){return (e as Error).message;}}}
            onMovePart={moveFilling}
            onDropItem={dropFilling}
            onTransfer={(mid,sid,pid,toMid,toSid,y)=>{try{const next=transferPart(project,mid,sid,pid,toMid,toSid,y);if(commitProject(next)){selectInserted(next,toMid,toSid,pid.includes(':pantograph:')?'pantograph':pid.includes(':drawer:')?'drawer':pid.includes(':shelf:')?'shelf':'rod');return true;}}catch(e){setError((e as Error).message);}return false;}}
            captureReady={(fn) => (capture.current = fn)}
            module={m}
            arrangement={project.modules}
            activeId={placed.id}
            room={showRoom ? project.room : undefined}
            selectedObstacle={selectedObstacle}
            onObstacleSelect={id=>{setSelectedObstacle(id);setSelectedOpening(undefined);setSelectedPart(null);setTab('room');}}
            onModuleSelect={selectModule}
            transparent={presentation?false:transparent}
            clearFacades={presentation?false:clearFacades}
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
            onPartSelect={(sid, pid,mid=placed.id) => {
              setActive(mid);
              chooseSection(sid);
              setSelectedPart({mid,sid,pid});
              if(pid.includes(":shelf:")||pid.includes(":drawer:"))setMode("fill");
              if (pid.includes(":drawer:")) {
                setDrawerIndex(Number(pid.split(":drawer:")[1].split(":")[0]));
              }
            }}
            onHandleClick={(mid)=>{setActive(mid);setModal("handles");}}
            selectedPart={!presentation&&selectedPart?.mid===placed.id?selectedPart.pid:undefined}
            selected={presentation?'':selectedId}
            onSelect={chooseSection}
            texture={texture(m.decor)}
            facadeTexture={texture(m.facadeDecor)}
            view={view}
            fit={fit}
            focusActive={!presentation&&focusActive}
            openDoors={openDoors}
            exploded={presentation?false:exploded}
            dimensions={presentation?false:dimensions}
          />}
          {presentation&&<div className="presentation-tools"><button aria-pressed={showRoom} onClick={()=>setShowRoom(!showRoom)}>Помещение</button><button aria-pressed={openDoors} onClick={()=>setOpenDoors(!openDoors)}>{openDoors?'Закрыть фасады':'Открыть фасады'}</button><button className="primary" onClick={()=>{try{const png=capture.current?.();if(!png){setError('Изображение ещё загружается. Повторите через несколько секунд.');return;}setRenderImage(png);setModal('render');}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить изображение. Попробуйте ещё раз.');}}}>Сохранить изображение</button></div>}
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
                <strong>{saved==="Не сохранено"?"Текущий вариант не сохранён":"Изменение не применено"}</strong>
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
              aria-label="Прозрачные фасады"
              title="Прозрачные фасады"
              aria-pressed={clearFacades}
              onClick={() => setClearFacades((v) => !v)}
            >
              <PanelTop size={19} />
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
            <button aria-label="Приблизить выбранный корпус" title="Приблизить выбранный корпус" aria-pressed={focusActive} onClick={()=>{setFocusActive(v=>!v);setFit(f=>f+1);}}><Search size={19}/></button>
            <button
              aria-label="Вписать модель"
              title="Вписать модель"
              onClick={() => {setFocusActive(false);setFit((f) => f + 1);}}
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
            <button
              aria-label="Повернуть корпус на 90°"
              title="Повернуть выбранный корпус на 90°"
              onClick={() => {try{commitProject(rotateModule(project,placed.id,(((placed.rotation??0)+90)%360) as 0|90|180|270));}catch(e){setError((e as Error).message);}}}
            >
              <RotateCcw size={19} />
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
            <RotateCcw size={13} /> {focusActive?"Крупный вид выбранного корпуса · ":""}{mode==='move'?(moveAll?'Тяните любой корпус — движется вся композиция':liveGroupIds.length?'Отмеченные корпуса двигаются вместе':snapping?'Тяните корпус · Alt — без привязки':'Тяните корпус · привязки отключены'):mode==='fill'?'Полки и ящики — по высоте, перегородки — по ширине':'Перетащите, чтобы повернуть'} <span>·</span>{" "}
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
              <details className="measurement-fields"><summary>Карточка замера</summary><p className="field-note">Номер и дата из задания на корпус. Примечания сохранятся в ведомости проекта.</p>{(['number','date','notes'] as const).map(k=>{const measure=project.measurement||{number:'',date:'',notes:''};const change=(value:string)=>commitProject({...project,measurement:{...measure,[k]:value}});const label={number:'Номер замера',date:'Дата замера',notes:'Особенности замера'}[k];return <label className="hardware-field" key={k}>{label}{k==='notes'?<textarea key={measure[k]} aria-label={label} defaultValue={measure[k]} maxLength={2000} rows={4} placeholder="Перепады стен, плинтус, розетки, доступ к коммуникациям…" onBlur={e=>{if(e.target.value!==measure[k]&&!change(e.target.value))e.target.value=measure[k];}}/>:<input key={measure[k]} aria-label={label} type={k==='date'?'date':'text'} maxLength={k==='number'?60:10} defaultValue={measure[k]} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} onBlur={e=>{if(e.target.value!==measure[k]&&!change(e.target.value))e.target.value=measure[k];}}/>}</label>;})}</details>
              <details className="measurement-fields"><summary>Мебель в нише · вычеты СТП</summary><p className="field-note">Введите минимальные размеры по нескольким точкам. Отклонение стены измеряется относительно уровня.</p>{!project.measurement?.niche?<button className="outline" onClick={()=>commitProject({...project,measurement:{number:'',date:'',notes:'',...project.measurement,niche:{width:project.room.width,height:project.room.height,depth:project.room.depth,deviation:0}}})}>Рассчитать по замеру</button>:<>{(['width','height','depth','deviation'] as const).map(k=><NumberField key={k} label={{width:'Минимальная ширина ниши',height:'Нижняя точка потолка',depth:'Минимальная глубина ниши',deviation:'Отклонение стены'}[k]} value={project.measurement!.niche![k]} min={k==='deviation'?0:500} max={k==='deviation'?300:20000} onChange={v=>commitProject({...project,measurement:{...project.measurement!,niche:{...project.measurement!.niche!,[k]:v}}})}/>)}{(()=>{const fit=nicheSize(project.measurement!.niche!);return <div className="niche-result"><strong>Предельные габариты мебели</strong><p>{fit.width} × {fit.height} × {fit.depth} мм</p><small>Ширина −{fit.side}, высота −30, глубина −5 мм. Каждый отдельный корпус — не более 900 × 2200 мм.</small></div>;})()}<p className="field-note">При отклонении ровно 10 мм выбран запас 15 мм. Проверьте светильники, выступы и карнизы. Расчёт не меняет размеры комнаты и модулей автоматически. Габариты всей закрытой композиции сравниваются с нишей; превышения видны в замечаниях и документах.</p><button className="text-action" onClick={()=>{const measurement={...project.measurement!};delete measurement.niche;commitProject({...project,measurement});}}>Убрать расчёт ниши</button></>}</details>
              <details className="measurement-fields"><summary>Сдвинуть всю композицию</summary><p className="field-note">Все {project.modules.length} корпуса сдвигаются вместе. Стыки, расстояния и положение антресолей относительно нижних модулей сохраняются.</p>{(['x','z','y'] as const).map(axis=><NumberField key={axis} label={{x:'Композиция от левой стены',z:'Композиция от задней стены',y:'Композиция от пола'}[axis]} value={Math.round(mountingComposition[axis]*10)/10} min={0} max={{x:project.room.width-mountingComposition.w,z:project.room.depth-mountingComposition.d,y:project.room.height-mountingComposition.h}[axis]} onChange={v=>{try{commitProject(setCompositionDistance(project,axis,v));}catch(e){setError((e as Error).message);}}}/>)}<p className="field-note">Отступы — по монтажному габариту, как у отдельного корпуса. Выступы ручек проверяются отдельными подсказками. Отмена возвращает всю расстановку одним шагом.</p></details>
              <RoomWarnings project={project} select={w=>{selectModule(w.moduleId);setSelectedOpening(w.openingId);setSelectedObstacle(w.obstacleId);setRoomPlan(true);}}/>
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
                {project.modules.length>1&&<details className="measurement-fields"><summary>Фасады всей композиции</summary><p className="field-note">Сохраняются материалы каждого корпуса. Детали, фальши и смета пересчитаются; отмена возвращает всё одним шагом.</p>{[true,false].map(enabled=><button key={String(enabled)} className="text-action" disabled={project.modules.every(a=>a.module.doors===enabled)} onClick={()=>{if(commitProject({...project,modules:project.modules.map(a=>({...a,module:{...a.module,doors:enabled}}))})){setSelectedPart(null);setDrawerPreview(false);setOpenDoors(false);}}}>{enabled?'Добавить фасады всем корпусам':'Убрать фасады у всех корпусов'}</button>)}</details>}
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
                {m.doors && (
                  <button className="text-action" onClick={() => setModal("handles")}>
                    Ручка: {handleById(m.handleId).label} <ChevronDown size={13} />
                  </button>
                )}
              </div>
              {m.sections.some(s=>s.drawers>0)&&<div className="property-section"><h2>Фасады ящиков</h2><button className="text-action" onClick={()=>{setMaterialTarget('drawerFacadeDecor');setModal('materials');}}>Материал ящиков: {m.drawerFacadeDecor??m.facadeDecor}<ChevronDown size={13}/></button>{m.drawerFacadeDecor&&<button className="text-action" onClick={()=>modify(n=>delete n.drawerFacadeDecor)}>Как у распашных фасадов</button>}{!m.doors&&<button className="text-action" onClick={()=>setModal('handles')}>Ручка: {handleById(m.handleId).label}<ChevronDown size={13}/></button>}</div>}
              <div className="property-section">
                <h2>Положение в помещении</h2>
                <button className="outline" onClick={()=>{try{if(commitProject(mirrorModule(project,active))){setSelectedPart(null);setDrawerPreview(false);setOpenDoors(true);}}catch(e){setError((e as Error).message);}}}>Зеркально отразить наполнение</button><p className="field-note">Меняет левую и правую секции местами и сторону петель. Размеры и положение корпуса сохраняются.</p>
                <label className="hardware-field">Поворот корпуса<select aria-label="Поворот корпуса" value={placed.rotation??0} onChange={e=>{try{commitProject(rotateModule(project,placed.id,Number(e.target.value) as 0|90|180|270));}catch(e){setError((e as Error).message);}}}>{[0,90,180,270].map(r=><option key={r} value={r}>{r}°</option>)}</select></label><p className="field-note">Поворот — вокруг центра; у стены корпус сдвигается внутрь комнаты. Перетащите его в сцене для расстановки, на виде спереди — по высоте.</p><NumberField label="От пола" value={placed.y??0} min={movingTogether?placedBounds.y-groupBounds.y:0} max={movingTogether?project.room.height-groupBounds.h+placedBounds.y-groupBounds.y:project.room.height-m.height} onChange={v=>movePlaced('y',v)}/>
                <NumberField
                  label="От левой стены"
                  value={placedBounds.x}
                  min={movingTogether?placedBounds.x-groupBounds.x:0}
                  max={movingTogether?project.room.width-groupBounds.w+placedBounds.x-groupBounds.x:project.room.width-placedBounds.w}
                  onChange={(v) => movePlaced("x", v)}
                />
                <NumberField
                  label="От задней стены"
                  value={placedBounds.z}
                  min={movingTogether?placedBounds.z-groupBounds.z:0}
                  max={movingTogether?project.room.depth-groupBounds.d+placedBounds.z-groupBounds.z:project.room.depth-placedBounds.d}
                  onChange={(v) => movePlaced("z", v)}
                />
                <details className="measurement-fields"><summary>От противоположных стен и потолка</summary>{(['x','z','y'] as const).map(axis=>{const size={x:'w',z:'d',y:'h'}[axis] as 'w'|'d'|'h',roomSize={x:project.room.width,z:project.room.depth,y:project.room.height}[axis],extent=placedBounds[size],near=placedBounds[axis],groupOffset=near-groupBounds[axis],minNear=movingTogether?groupOffset:0,maxNear=movingTogether?roomSize-groupBounds[size]+groupOffset:roomSize-extent;return <NumberField key={axis} label={{x:'От правой стены',z:'От передней стены',y:'До потолка'}[axis]} value={Math.round((roomSize-near-extent)*10)/10} min={Math.max(0,roomSize-extent-maxNear)} max={roomSize-extent-minNear} onChange={v=>movePlaced(axis,roomSize-extent-v)}/>;})}<p className="field-note">Меняется положение корпуса, а не его размер. Для антресоли можно задать расстояние до потолка.</p></details>
                <p className="field-note">Отступы учитывают поворот, выступ задней стенки и место под фасады.</p>{movingTogether&&<p className="field-note"><b>Общий сдвиг:</b> отступ выбранного корпуса перемещает {moveAll?'всю композицию':'отмеченную группу'}.</p>}
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
                <label className="hardware-field">Цоколь<select aria-label="Высота цоколя" value={plinth(m)} onChange={e=>modify(n=>n.plinthHeight=Number(e.target.value))}>{plinth(m)===0&&<option value={0}>Без цоколя · антресоль</option>}{[80,100,120,150].map(v=><option key={v} value={v}>{v} мм</option>)}</select></label>
                <p className="field-note">Вариант без цоколя (каркас на регулируемых опорах, подъём 30 мм, накладное дно) пока не делаем: нижние корпуса только на цоколе.</p>
                <label className="hardware-field">Петли одиночной двери<select aria-label="Сторона петель" value={m.hingeSide??'left'} onChange={e=>modify(n=>n.hingeSide=e.target.value as Module['hingeSide'])}><option value="left">Слева</option><option value="right">Справа</option></select></label>
                <label className="hardware-field"><span><input type="checkbox" aria-label="Подсветка в стойках" checked={!!m.standLight} onChange={e=>modify(n=>{if(e.target.checked)n.standLight=true;else delete n.standLight;})}/> Подсветка врезная в стойках</span></label>
                <p className="field-note">LED-профиль по внутренним граням боковин и перегородок на всю высоту проёма. В смете — {RULES.lightRetailPerM.toLocaleString('ru-RU')} ₽ за пог.м по прайсу цеха, поверх коэффициента.</p>
                <button className="text-action" onClick={()=>setModal('handles')}>Ручка: {handleById(m.handleId).label} <ChevronDown size={13}/></button>
                <p className="field-note">Ручку можно выбрать и кликом по ней в 3D. Одна на распашной фасад и на каждый ящик с ручкой; push-to-open без ручки.</p>
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
                <div className="section-copy"><button className="text-action" onClick={()=>{try{setFillingCopy(captureSectionFilling(project,placed.id,s.id));}catch(e){setError((e as Error).message);}}}>Копировать наполнение секции</button>{fillingCopy&&<><p className="field-note">Скопировано: {fillingCopy.name}</p><button className="outline full" onClick={()=>{try{if(commitProject(pasteSectionFilling(project,placed.id,s.id,fillingCopy))){setSelectedPart(null);setDrawerIndex(null);setDrawerPreview(false);setMode('fill');setOpenDoors(true);}}catch(e){setError((e as Error).message);}}}>{s.drawers||s.shelves.length||s.rod||s.pantograph?'Заменить наполнение копией':'Вставить наполнение секции'}</button><p className="field-note">Высоты от дна и фурнитура сохранятся. Корпус и материалы остаются его собственными. Ctrl+Z отменит вставку.</p></>}</div>
                {canRemove&&<div className="selected-filling"><span>{selectedFillingName}</span><div className="filling-nudge" role="group" aria-label="Точное перемещение наполнения" onKeyDown={e=>{if(e.ctrlKey||e.metaKey||e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();nudgeSelected((e.key==='ArrowUp'?1:-1)*(e.shiftKey?10:1));}}><button className="outline" aria-label="Опустить выбранный элемент на 10 мм" onClick={()=>nudgeSelected(-10)}>↓ Ниже на 10</button><button className="outline" aria-label="Поднять выбранный элемент на 10 мм" onClick={()=>nudgeSelected(10)}>↑ Выше на 10</button></div><small>На этих кнопках: ↑ / ↓ — 1 мм, Shift — 10 мм.</small>{selectedDetail?.id.includes(':shelf:')&&<><NumberField label="Высота выбранной полки" value={Math.round((selectedDetail.position[1]-b.bottom)*10)/10} min={80} max={b.top-b.bottom-80} onChange={v=>{if(selectedPart)moveFilling(selectedPart.mid,selectedPart.sid,selectedPart.pid,v-(selectedDetail.position[1]-b.bottom));}}/><small>От дна проёма до центра полки.</small></>}{selectedDetail&&/:shelf:|:drawer:/.test(selectedDetail.id)&&<button className="text-action" onClick={copySelected}>Копировать {selectedDetail.id.includes(':drawer:')?'ящик с настройками':'полку'}</button>}<button className="text-action danger" onClick={removeSelected}><Trash2 size={14}/>{removalLabel}</button><small>{selectedDetail&&/:shelf:|:drawer:/.test(selectedDetail.id)?"Копия займёт ближайшее свободное место. ":""}Delete — удалить · Ctrl+Z — отменить</small></div>}
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
                          <span>{drawerConfig(m,s,j).mesh?MESH_KIND_LABEL[meshById(drawerConfig(m,s,j).mesh!)?.kind??'basket']:'Ящик'} {j + 1}</span><small>{Math.round(drawerOffsets(s)[j])} мм от дна</small>
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
                      const meshItem=c.mesh?meshById(c.mesh):undefined;
                      return (
                        <>
                          <label className="hardware-field">Тип элемента<select aria-label="Тип ящика" value={c.mesh??'box'} onChange={e=>{const v=e.target.value;if(v==='box')update({mesh:undefined,height:RULES.drawerH,handle:undefined});else{const item=meshById(v)!;update({mesh:v,height:item.h,handle:undefined});}}}><option value="box">Ящик ЛДСП 16 с фасадом</option>{(['basket','trousers','shoes'] as const).map(kind=><optgroup key={kind} label={MESH_KIND_LABEL[kind]+' · Лемана Про'}>{MESH.filter(i=>i.kind===kind).map(i=><option key={i.id} value={i.id}>{i.label} · проём {i.reqW}×{i.reqD} · {i.price} ₽</option>)}</optgroup>)}</select></label>
                          {meshItem&&<p className="field-note">Арт. {meshItem.art}, высота {meshItem.h} мм, нужен проём {meshItem.reqW}–{meshItem.reqW+60} мм в ширину и глубина от {meshItem.reqD} мм. Направляющие в комплекте, без фасада и ручки; за распашными дверями ставятся фальши.</p>}
                          {meshItem&&<NumberField label="Элемент от дна проёма" value={drawerOffsets(s)[j]} min={0} max={b.top-b.bottom-c.height-40} onChange={v=>update({y:v})}/>}
                          {!meshItem&&<>
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
                          </>}
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
                  onChange={c=>{if(c>s.shelves.length)dropFilling('shelf',placed.id,selectedId,shelfInsertionHeight(m,selectedId));else{modifySection(a=>a.shelves=a.shelves.slice(0,c));setSelectedPart(null);}}}
                />
                <Counter
                  label="Ящики"
                  value={s.drawers}
                  max={RULES.maxDrawers}
                  onChange={c=>{if(c>s.drawers)dropFilling('drawer',placed.id,selectedId,b.bottom+drawerStackHeight(s));else{modifySection(a=>a.drawers=c);setSelectedPart(null);}}}
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
                {(s.rod||s.pantograph)&&<NumberField label="Высота штанги от дна" selected={selectedPart?.pid===(s.pantograph?s.id+':pantograph:rod':s.id+':rod')} onSelect={()=>{setSelectedPart({mid:placed.id,sid:s.id,pid:s.pantograph?s.id+':pantograph:rod':s.id+':rod'});setDrawerIndex(null);setDrawerPreview(false);setMode('fill');setOpenDoors(true);}} value={Math.round((parts(m).find(p=>p.id===s.id+':rod'||p.id===s.id+':pantograph:rod')?.position[1]??b.bottom)-b.bottom)} min={100} max={b.top-b.bottom-50} onChange={v=>modifySection(a=>a.rodAt=v/(b.top-b.bottom))}/>}
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
                    <h3>Высота центра полки</h3><p className="field-note">Нажмите название полки, чтобы выбрать её в модели.</p>
                    {s.shelves.map((f, j) => (
                      <NumberField
                        key={j}
                        label={`Полка ${j + 1}`}
                        selected={selectedPart?.pid===s.id+':shelf:'+j}
                        onSelect={()=>{setSelectedPart({mid:placed.id,sid:s.id,pid:s.id+':shelf:'+j});setDrawerIndex(null);setDrawerPreview(false);setMode('fill');setOpenDoors(true);}}

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
                      : modal === "handles"
                      ? "Ручка фасадов и ящиков"
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
            {modal === "new" ? <NewProjectPanel project={project} open={next=>{if(commitProject(next)){selectModule(next.modules[0].id);setRoomPlan(false);setView("iso");setMode("move");setModal(null);return true;}return false;}}/> : modal === "library" ? <ModuleLibrary module={m} group={project.modules.filter(a=>liveGroupIds.includes(a.id))} insertGroup={source=>{const result=appendModuleGroup(project,source);if(commitProject(result.project)){setGroupIds(result.ids);setMoveAll(false);setFocusActive(false);selectModule(result.ids[0]);setMode('move');setModal(null);return true;}return false;}} insert={source=>{const next=appendModule(project,source);next.modules.at(-1)!.module.name=source.name;if(commitProject(next)){selectModule(next.modules.at(-1)!.id);setModal(null);return true;}return false;}}/> : modal === "render" ? <div className="render-preview"><img src={renderImage} alt="Изображение мебели для клиента"/><a className="primary render-download" href={renderImage} download="Проект мебели.png">Скачать PNG</a><p className="field-note">PNG, до 2560 пикселей. Если встроенный браузер не скачивает файл, откройте редактор в Edge или Chrome.</p></div> : modal === "cloud" ? <CloudPanel project={project} update={commitProject}/> : modal === "output" ? (
              <OutputPanel
                  initialTab={outputTab}
                project={project}
                capture={() => capture.current?.()}
                inspect={(mid,pid)=>{const body=project.modules.find(a=>a.id===mid);if(!body)return;selectModule(mid);const sec=body.module.sections.find(s=>pid.startsWith(s.id+':'));if(sec)chooseSection(sec.id);setSelectedPart({mid,sid:sec?.id||body.module.sections[0].id,pid});if(pid.includes(':drawer:'))setDrawerIndex(Number(pid.split(':drawer:')[1].split(':')[0]));setRoomPlan(false);setView('iso');setMode('fill');setFocusActive(true);setOpenDoors(true);setModal(null);}}

                update={commitProject}
              />
            ) : modal === "materials" ? (
              <>
                <p className="field-note">Материал: {materialTarget==='decor'?'корпуса':materialTarget==='facadeDecor'?'распашных фасадов':'фасадов ящиков'}.</p><label className="hardware-field">Применить материал<select aria-label="К каким корпусам применить материал" value={materialScope} onChange={e=>setMaterialScope(e.target.value as typeof materialScope)}><option value="active">Выбранный корпус: {m.name}</option><option value="group" disabled={!liveGroupIds.length}>Отмеченная группа ({liveGroupIds.length})</option><option value="all">Все корпуса проекта ({project.modules.length})</option></select></label><p className="field-note">Меняется только указанный выше материал. Группу можно отметить в списке корпусов, в разделе «Двигать группу».</p>
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
                        aria-pressed={materialRecipients.length>0&&materialRecipients.every(a=>(a.module[materialTarget]??a.module.facadeDecor)===c.n)}
                        onClick={() => {
                          if(materialScope==='group'&&!liveGroupIds.length){setError("Сначала отметьте корпуса в группе.");return;}
                          const ok=materialScope==='active'?modify((n) => (n[materialTarget] = c.n)):commitProject({...project,modules:project.modules.map(a=>materialScope==='all'||liveGroupIds.includes(a.id)?({...a,module:{...a.module,[materialTarget]:c.n}}):a)});
                          if(!ok)return;
                          setMaterialScope("active");
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
                        <small className="decor-meta">{c.tier.toLowerCase()} · {decorPrice(c.n).price?.toLocaleString('ru-RU')} ₽/лист</small>
                        {materialRecipients.length>0&&materialRecipients.every(a=>(a.module[materialTarget]??a.module.facadeDecor)===c.n) && <Check size={15} />}
                      </button>
                    ))}
                </div>
              </>
            ) : modal === "handles" ? (
              <>
                <p className="field-note">Корпус «{m.name}». Одна ручка на распашной фасад и на каждый ящик с ручкой; цена — в смете. Ручка длиннее фасада не применится.</p>
                <label className="hardware-field">Применить<select aria-label="К каким корпусам применить ручку" value={materialScope} onChange={e=>setMaterialScope(e.target.value as typeof materialScope)}><option value="active">Выбранный корпус: {m.name}</option><option value="group" disabled={!liveGroupIds.length}>Отмеченная группа ({liveGroupIds.length})</option><option value="all">Все корпуса проекта ({project.modules.length})</option></select></label>
                <label className="search"><Search size={18} /><input autoFocus placeholder="Найти ручку: 128, чёрный, HEXA…" aria-label="Найти ручку" value={search} onChange={e=>setSearch(e.target.value)}/></label>
                <div className="handle-list">
                  {(["workshop","lemana"] as const).map(vendor=>{
                    const items=HANDLES.filter(h=>h.vendor===vendor&&(h.label+' '+h.len+' '+(h.art??'')).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.len-b.len||a.price-b.price);
                    if(!items.length)return null;
                    return <div key={vendor}><h3>{vendor==='workshop'?'Закупка цеха':'Лемана Про · выбор клиента, розница'}</h3>{items.map(h=>{
                      const current=(m.handleId??DEFAULT_HANDLE)===h.id;
                      return <button key={h.id} className="handle-item" aria-pressed={current} onClick={()=>{
                        if(materialScope==='group'&&!liveGroupIds.length){setError('Сначала отметьте корпуса в группе.');return;}
                        const value=h.id===DEFAULT_HANDLE?undefined:h.id;
                        const ok=materialScope==='active'?modify(n=>{if(value===undefined)delete n.handleId;else n.handleId=value;}):commitProject({...project,modules:project.modules.map(a=>materialScope==='all'||liveGroupIds.includes(a.id)?({...a,module:{...a.module,...(value===undefined?{handleId:undefined}:{handleId:value})}}):a)});
                        if(!ok)return;setMaterialScope('active');setModal(null);setSearch('');
                      }}><span className="handle-bar" style={{width:Math.min(100,Math.max(14,h.len/12))+'px'}}/><span className="handle-name">{h.label}</span><span className="handle-meta">{h.len} мм · {h.price} ₽{h.art?' · арт. '+h.art:''}</span>{current&&<Check size={15}/>}</button>;
                    })}</div>;
                  })}
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
                  <button onClick={()=>{setOutputTab('sheets');setModal('output');}}><b>4. Проверьте проект</b><span>Смета, деталировка, карты Lamarty 2750 × 1830, ведомость и бирки — в «Выдать документы». «Скачать комплект ZIP» собирает их вместе для технолога.</span></button>
                  <button onClick={()=>{setModal(null);changePresentation(true);}}><b>5. Покажите клиенту</b><span>Крупный вид без рабочих панелей. Покажите помещение и фасады, сохраните изображение. КП — в документах.</span></button>
                  <button onClick={()=>setModal('cloud')}><b>6. Сохраните вариант</b><span>Кабинет хранит проекты и историю версий. Сейчас сервер работает на этом компьютере. Файл проекта можно перенести кнопками «Скачать» и «Открыть».</span></button>
                </div>
                <p><strong>Размеры:</strong> нажмите число на модели или введите справа и нажмите Enter. Проёмы показывают расстояние в свету между полками.</p>
                <p><strong>Камера:</strong> режим «Повернуть вид» — вращение мышью; колесо — масштаб; правая кнопка — сдвиг вида. Лупа приближает выбранный корпус, «Вписать модель» возвращает общий вид.</p>
                <p><strong>Отмена:</strong> Ctrl+Z; повтор — Ctrl+Shift+Z. Delete удаляет выбранное наполнение, когда вы не редактируете поле или список. Escape отменяет незавершённое перетаскивание.</p>
                <details><summary>Как двигать шкаф вместе с антресолью?</summary><p>Слева раскройте «Двигать группу» и отметьте нижний корпус и антресоль. Тяните любой из отмеченных: они двигаются вместе. Отступы в свойствах тоже сдвигают группу. В этом же разделе можно скопировать группу или повернуть её на 90°.</p><p>«Снять группу» возвращает отдельное перемещение. Изменение ширины и удаление относятся к активному корпусу.</p></details>
                <details><summary>Как повторно использовать удачный шкаф?</summary><p>Отметьте нужные корпуса в группе, откройте «Моя библиотека модулей», задайте название и сохраните группу. Можно сохранить и один корпус. При вставке каждый корпус остаётся независимым; антресоли сохраняют положение над нижними модулями. Нижний край шаблона ставится на пол.</p><p>Поиск понимает названия, декоры и размеры, например «500 × 2000 Вотан». Библиотека хранится в браузере и переносится одним файлом. В свойствах секции отдельно можно скопировать её наполнение и вставить в другую секцию.</p><button className="text-action" onClick={()=>setModal('library')}>Открыть мою библиотеку</button></details>
                <details><summary>Как поменять материал у нескольких корпусов?</summary><p>Отметьте группу, затем откройте каталог нужного материала: корпуса, распашных фасадов или фасадов ящиков. В «Применить материал» выберите группу либо все корпуса проекта. Одна отмена вернёт предыдущие материалы.</p></details>
                <details><summary>Как точно поставить полку или ящик?</summary><p>Нажмите на элемент в режиме наполнения. В карточке задайте высоту от дна проёма либо используйте «Выше на 10» и «Ниже на 10». Пока фокус на этих кнопках, стрелки ↑/↓ двигают на 1 мм, Shift со стрелкой — на 10 мм.</p><p>Кнопка добавления полки делит самый большой свободный проём, сохраняя остальные высоты. Полка над блоком ящиков создаётся автоматически. «Распределить полки» равномерно расставляет все съёмные полки.</p></details>
                <details><summary>Что сохранять для клиента и для технолога?</summary><p>Клиенту подготовьте КП в документах: проверьте цену, текст и изображение. Кнопка «Подставить текущую смету» обновляет цену по вашему нажатию; незаполненные позиции сметы требуют уточнения.</p><p>Технологу передайте «Комплект ZIP»: там проект, ведомость, расстановка, размерные виды, карты листов, деталировка, бирки и закупочная смета. После правок сформируйте комплект заново.</p><p>«Сохранено в браузере» означает локальную запись. Для сохранения в кабинете откройте его и сохраните проект на сервер. В кабинете доступна история версий.</p></details>
                <p><strong>Большая композиция:</strong> поиск над списком появляется после шестого корпуса. Флажок «Двигать всю композицию» переносит все корпуса вместе — в3D, на плане или через отступы.</p>
                <div className="help-note">Карты, ведомость и бирки предназначены для проверки технологом. Присадка, производственные чертежи и проверенные управляющие программы ещё не выпускаются.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}







