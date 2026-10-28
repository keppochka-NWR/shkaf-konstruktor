import {FacadeEditor} from './FacadeEditor';
import {Eye,EyeOff,PanelTopClose,PanelTopOpen,BrickWall} from 'lucide-react';
import {readCutaway,saveCutaway} from './roomCutaway';
import './editor-visibility.css';
import {repairHinges} from './hingeRepair';
import {savePng} from './savePng';
import {SettingsTree,revealSettings} from './SettingsTree';
import {SettingsSection} from './SettingsSection';
import {setDoorHinge,setModuleHingeSide,singleLeafDoors} from './facadeEditing';
import {applyFacadeStyle} from './applyFacadeStyle';
import {WorkspacePanels} from './WorkspacePanels';
import {layoutKitchenDrawers} from './kitchenEditing';
import {EditorBrand} from './EditorBrand';
import {RoomObjectProperties,type EnvironmentSelection} from './RoomObjectProperties';
import {RoomSurveyEditor} from './RoomSurveyEditor';
import { refitKDrawers } from "./kitchenDrawers";
import { configureColumn } from "./kitchenTall";
import { syncKitchenLift } from "./kitchenLift";
import {facadeHandleId,setFacadeHandle,mirrorEdgeHandles,mirrorBracketDoors,doorHandleFloorInfo,setDoorHandleFloor,doorHandlePos,handlePosIssue,setDoorHandlePos,setModuleHandlePos,isUpperModule,HANDLE_POS_LABEL,type HandlePos,facadeTop,facadeBottom,fitDrawersAfterResize,pulloutLength,vernissageSizes,falshGlue,drawerFaceSpan,drawerGripOn,aluDrawersAvailable} from './model';
import {CURRENT_PROJECT,persistProject,ProjectStorageConflict} from './projectStorage';
import {backupProject} from './projectStorage';
import {CornerModulePanel} from './CornerModulePanel';
import OpeningLayoutEditor from './OpeningLayoutEditor';
import PartialDividerPanel from './PartialDividerPanel';
import {setPartialDivider,dividerInfo,dividerBounds,setDividerByShelves,moveDividerEnd,oneLeafAtDivider,announceDividerNotes} from './partialDivider';
import {resizeOpening} from './sectionLayout';
import {placeInRow,gaps,fillGap,flush,setGap,flushBlock,widthLock,planStretch,fillAdd,fillerNote,type GapSide} from './rowResize';
import {rowShortage} from './rowFit';
import {offWallNote} from './freeSpot';
import {RoomObstacles} from './RoomObstacles';
import {RoomFixtures} from './RoomFixtures';
import {StageBar} from './StageBar';
import {ModulePalette} from './ModulePalette';
import {KitchenPalette} from './KitchenPalette';

import {KitchenPanel} from './KitchenPanel';
import {isKitchenProject} from './kitchenProject';
import {placeModuleAt,placeToWall,cornerTurns,continueAroundCorner,WALL_LABEL,type PlaceTarget,type Wall,type CornerTurn} from './wallPlacement';
import {CornerDownRight} from 'lucide-react';
import {FillingComposer,addFillingBatch,addFittedDrawers} from './FillingComposer';
import {STAGES,STAGE_KEY,stageIndex,nextStage,normalizeStage,restoredStage,storedStage,type Stage} from './stages';
import {ChevronRight,TriangleAlert} from 'lucide-react';
import {ManagerMode,FACADE_KIND_LABEL,decorLabel,decorTitle,newModuleName} from './clientLabels';
import {buildCheck} from './buildCheck';
import {NewProjectPanel} from './NewProjectPanel';
import {NicheReadings} from './NicheReadings';
import {MEASUREMENT_RULES,nicheSize,nicheMinimum,ceilingClearance} from './measurement';
import {ModuleLibrary} from './ModuleLibrary';
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useId } from "react";
import {historyShortcut,editsText,viewShortcut} from './historyShortcuts';
import {editDrawerConfig} from './drawerEditing';
import {maxEvenShelves,setShelfCount} from './shelfCount';
import {explainErrors,errorPlace,splitAction,type ErrorDetail} from './errorDetails';
import {fieldReasons} from './paletteCheck';
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
  MAX_SHELVES_REASON, MAX_DRAWERS_REASON,
  shelfGaps, shelfInsertionHeight, shelfMaxDepth,
  setShelfGap,
  drawerConfig, drawerOffsets, drawerStackHeight, drawerPitch, drawerCapTop, distributeDrawers, hasDrawerCap, drawersToRoof, drawersFillRoof, plinth, rearClear, needsWallFiller, cornerStrip, RAIL_PLACES, skewAngle, deskModule, deskGeometry, hasHandles,
  EDGE_CHOICES, HINGE_ANGLES, HINGE_ANGLE_LABEL,
  type EdgeThickness,
  type Module,
  type Section,
  maxHeightOf,
  nicheDrawers,
  minHeightOf,
  TOP_STRIP_STEPS,
} from "./model";
import { setAllHingeAngles, allHingeAngles } from "./model";
import { moduleWeight, weightText, LDSP_DENSITY } from "./weight"; // вес изделия (решение Макса 26.10.2026) // интеграция 26.10: петли 155–165° всем дверям модуля = угол по створке
import { setRodTiers, drawerFaceInset } from "./model"; // заказ 7437584: вешалка в два яруса, фасады ящиков в шкафу-купе
import { Scene, type View } from "./Scene";
import { ProjectDock, type OutputTab } from "./ProjectDock";
import { KupePanel } from "./KupePanel";
import { kupeLeafWidth, kupeSystem } from "./kupe";
import { isClientBundle, type ClientBundle } from "./clientIndex";
import { OutputPanel } from "./OutputPanel";
import {SafeBoundary} from './SafeBoundary';
import {RoomWarnings} from './RoomWarningPanel';
import {roomWarnings} from './roomWarnings';
import { RoomEditor } from './RoomEditor';
import {RoomPlan} from './RoomPlan';
import {CloudPanel} from './CloudPanel';
import { catalog } from "./catalog";
import { decorPrice, withPriceStamp } from "./pricing";
import { HANDLES, DEFAULT_HANDLE, handleById, handleShape, HANDLE_SHAPE_LABELS } from "./handles";
import { HandleThumb } from "./HandleThumb";
import { MESH, DEFAULT_MESH, MESH_KIND_LABEL, meshById } from "./mesh";
import { ALU_INSERTS, DEFAULT_ALU, aluProfile } from "./alu";
import { moveShelfKeepRod } from "./shelfRod";
import { AluPicker, AluDrawersCheck } from "./AluPicker";
import { DEFAULT_VERNISSAGE } from "./facadesVernissage";
import { VernissagePicker } from "./VernissagePicker";
import { compatibleSlideLength, SLIDES, GTV_SOURCE, SLIDE_SYSTEMS, SLIDE_BRANDS, SLIDE_MOTIONS, slideSystem, slideMotion, HINGE_BRANDS, type DrawerConfig, type HingeBrand } from "./hardware";
import { slidePrice } from "./pricing";
import { RadialMenu, type RadialItem } from "./RadialMenu";
import {addMenuItem,worktopMaterialItem} from './addMenu';
import {quickItems,quickMenuApplies,lightUnavailable,upperItem,menuDropY,doorQuickItems,cornerItems,type QuickMenuOps} from './quickMenu';
import {allStandsLit,applyToAll,pickTargets,setAllStands,toggleGroup,type LightOrient} from './lights';
import {LightModeBar,LightPanel} from './LightPanel';
import {composeContextMenu,menuArea} from './contextMenu';
import { Palette, DoorClosed, RotateCw, ArrowUpToLine, Trash, GripHorizontal, Lock, LockOpen, ArrowUp, ArrowDown, Hand, MousePointerClick, Link2, Spline, SlidersHorizontal, ArrowRightToLine, ArrowLeftToLine, ChevronsRight, ChevronsLeft } from "lucide-react";
import { withSlideSystem } from "./hardwareSwap";
import {
  newProject,
  parseProject,
  projectErrors,
  appendModule, appendModuleGroup, copyModuleGroup, snapComposition, snapPlacement, bounds, compositionBounds, mountingCompositionBounds, applyAutoFillers, setWallFillersOff,
  type Project,
} from "./project";
import {fitMeshItem,insertedPartId,captureSectionFilling,pasteSectionFilling,type SectionFilling,duplicatePart,moveComposition,compactDrawers,setCompositionDistance,applyDrawerSlide,clearSection,removeSection,addUpperModule,rotateModuleGroup,rotateModule,setWallDistance,mirrorModule,moveDivider,insertItem,insertGlassShelf,moveModule,movePart,removePart,transferPart,type FillKind} from './operations';
import {drawerAddReason,drawerFitsOnTop} from './drawerLimit';
import {moduleHandleFloor,setModuleHandleFloor} from './handleFloorGroup';
function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  onSelect,
  selected,
  unit="мм",
  reasons,
}: {
  unit?:string;
  /** п.3 w-formerrors (23.10): все причины отказа поля — кроме предела, что ещё не выполняется при этом значении (validate all). */
  reasons?:(n:number)=>{list:string[];moduleId?:string;moduleName?:string};
  onSelect?:()=>void;
  selected?:boolean;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [fieldError,setFieldError]=useState(''),[fieldReasons,setFieldReasons]=useState<string[]>([]);
  const hintId=useId();
  const cancelled = useRef(false);
  useEffect(() => {setDraft(String(value));setFieldError('');setFieldReasons([]);}, [value]);
  const apply = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(String(value));
      setFieldError('');setFieldReasons([]);
      return;
    }
    const n = Number(draft);
    if(draft.trim()===''||!Number.isFinite(n)||n<min||n>max){
      setDraft(String(value));
      setFieldError(`Введите число от ${min} до ${max} ${unit}${unit.endsWith('.')?'':'.'} Изменение не применено.`);
      // x2 (замер кухонь 22.10): отказ поля виден и в общем сообщении, а не только мелкой строкой под полем (950 молча оставалось 557)
      const text=`«${label}» ${n} ${unit}: допустимо от ${min} до ${max} ${unit}${unit.endsWith('.')?'':'.'} Изменение не применено.`;
      // п.3 w-formerrors: другие причины отказа (не только предел) — списком под полем и в общем сообщении
      let more:{list:string[];moduleId?:string;moduleName?:string}={list:[]};
      if(reasons&&draft.trim()!==''&&Number.isFinite(n)){try{more=reasons(n);}catch{more={list:[]};}}
      setFieldReasons(more.list);
      if(draft.trim()!==''&&Number.isFinite(n))window.dispatchEvent(new CustomEvent('studio-error',{detail:more.list.length?{text,list:more.list,moduleId:more.moduleId,moduleName:more.moduleName,problem:`«${label}» ${n} ${unit}: ${n>max?`больше ${max}`:`меньше ${min}`}`,action:n>max?`Максимум ${max} ${unit}.`:`Минимум ${min} ${unit}.`}:text}));
      return;
    }
    setFieldError('');setFieldReasons([]);
    if (n === value) {
      setDraft(String(value));
      return;
    }
    onChange(n);
    setDraft(String(value));
  };
  const Wrapper=onSelect?'div':'label';
  return (
    <Wrapper className={'number-field'+(fieldError?' has-error':'')}>
      {onSelect?<button className="number-label-select" aria-label={'Выбрать: '+label} aria-pressed={selected} onClick={onSelect}>{label}</button>:<span>{label}</span>}
      <div>
        <input
          aria-label={label}
          aria-invalid={!!fieldError}
          aria-describedby={hintId}
          type="number"
          min={min}
          max={max}
          step="1"
          value={draft}
          onChange={(e) => {setDraft(e.target.value);setFieldError('');setFieldReasons([]);}}
          onBlur={apply}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              cancelled.current = true;
              setDraft(String(value));
              setFieldError('');
              e.currentTarget.blur();
            }
          }}
        />
        <small>{unit}</small>
      </div>
      <span id={hintId} className={fieldError?'number-feedback':'number-range'} role={fieldError?'alert':undefined}>{fieldError||`От ${min} до ${max} ${unit} · Enter — применить, Esc — отменить`}</span>
      {fieldError&&fieldReasons.length>0&&<ul className="number-reasons" aria-label={`Ещё причины: ${label}`}>{fieldReasons.map((r,i)=><li key={i}>{r}</li>)}</ul>}
    </Wrapper>
  );
}
function Counter({
  label,
  value,
  max,
  maxHint,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  /** Почему «+» неактивен на пределе (подсказка и подпись под счётчиком — тот же текст, что у ПКМ «Добавить»). */
  maxHint?: string;
  onChange: (n: number) => void;
}) {
  const full = value >= max;
  return (
    <>
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
          disabled={full}
          title={full ? maxHint : undefined}
          onClick={() => onChange(value + 1)}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
    {full && maxHint && <p className="field-note counter-max" role="note" data-testid="counter-max">{maxHint}</p>}
    </>
  );
}
export default function App({initialProject,projectKey,clientBar,onProjectChange,onImportBundle,saveManagedProject,externalVersion,viewKey,onEmptyProject,managedHistory}:{initialProject?:Project;projectKey?:string;clientBar?:React.ReactNode;onProjectChange?:(p:Project)=>void;onImportBundle?:(bundle:ClientBundle)=>void;saveManagedProject?:(p:Project)=>boolean;externalVersion?:number;viewKey?:string;onEmptyProject?:(p:Project)=>boolean;managedHistory?:{undo:()=>void;redo:()=>void;undoCount:number;redoCount:number}}={}) {
  const [environmentSelection,setEnvironmentSelection]=useState<EnvironmentSelection|null>(null);
  const KEY=CURRENT_PROJECT+(projectKey?':'+projectKey:'');
  const [startup] = useState(() => {
    if(saveManagedProject&&initialProject)return {model:initialProject,error:'',damaged:undefined as string|undefined,storageUnavailable:false,currentRaw:null};
    let original:string|null=null,currentRaw:string|null=null;
    try {
      currentRaw=localStorage.getItem(KEY);
      const s = original =
        currentRaw || (projectKey?null:localStorage.getItem("module-studio-v2") || localStorage.getItem("module-studio-v1"));
      return {
        model: s ? parseProject(JSON.parse(s)) : initialProject??newProject({...initialModule(),name:'Новый шкаф',sections:[section()]}),
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
  const [active, setActive] = useState(()=>{try{const id=viewKey?sessionStorage.getItem('garderyob-selection:'+viewKey):null;return project.modules.some(a=>a.id===id)?id!:project.modules[0].id;}catch{return project.modules[0].id;}});
  useEffect(()=>{if(viewKey)try{sessionStorage.setItem('garderyob-selection:'+viewKey,active);}catch{}},[viewKey,active]);
  const placed =
    project.modules.find((a) => a.id === active) || project.modules[0];
  const m = placed.module;
  const kitchenModule=!!m.kitchen;
  const kitchenMode=isKitchenProject(project); // вкладка «Кухня»: кухонная палитра слева, KitchenPanel справа
  const placedBounds=bounds(placed);
  const mountingComposition=useMemo(()=>mountingCompositionBounds(project),[project]);
  const composition=useMemo(()=>compositionBounds(project),[project]);
  const placementWarnings=useMemo(()=>roomWarnings(project),[project]);
  const check=useMemo(()=>buildCheck(project,placed.id),[project,placed.id]);
  const [moduleSearch,setModuleSearch]=useState('');
  const moduleList=useRef<HTMLDivElement>(null);
  const moduleWords=moduleSearch.toLocaleLowerCase('ru-RU').trim().split(/\s+/).filter(Boolean);
  const visibleModules=project.modules.map((a,i)=>({a,i})).filter(({a,i})=>moduleWords.every(word=>([i+1,a.module.name,a.module.width,a.module.height,a.module.depth].join(' ').toLocaleLowerCase('ru-RU')).includes(word)));
  useEffect(()=>{setModuleSearch('');},[active]);
  useEffect(()=>{moduleList.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({block:'nearest'});},[active,moduleSearch]);
  const [materialScope,setMaterialScope]=useState<"active"|"group"|"all">("active");
  const [mode,setMode]=useState<"move"|"fill"|"orbit"|"select">("move");
  const [drawerPreview,setDrawerPreview]=useState(false);
  const [drawerIndex, setDrawerIndex] = useState<number | null>(null);
  const [meshFit,setMeshFit]=useState<{mid:string;sid:string;meshId:string;y:number;width:number}|null>(null);
  const [handleTarget,setHandleTarget]=useState<'doors'|'drawers'>('doors');
  const [handleFace,setHandleFace]=useState<string>('');
  const [meshChoice, setMeshChoice] = useState<string>(DEFAULT_MESH);
  const [fillingCopy,setFillingCopy]=useState<SectionFilling|null>(null);
  const [selectedPart,setSelectedPart]=useState<{mid:string;sid:string;pid:string}|null>(null);
  // Esc снял выделение модуля (п.19 волны 22.10): в сцене нет подсветки секции, плашек зазоров и ручек растяжения; панель справа — «Ничего не выбрано» (m5 релиза)
  const [deselected,setDeselected]=useState(false);
  // m4: почему не добавился ящик — показывается под счётчиком «Ящики», пока секция и число ящиков те же
  const [drawerBlock,setDrawerBlock]=useState<{mid:string;sid:string;drawers:number;text:string}|null>(null);
  const propertiesRef=useRef<HTMLElement>(null);
  // u4 (замер удобства 22.10): после ввода значения панель перерисовывается и прокрутка прыгала — следующий клик мимо поля.
  // Позиция прокрутки правой панели запоминается и возвращается после правки того же модуля (выбор другого — как раньше).
  const propScroll=useRef<{top:number;mid:string}>({top:0,mid:''});
  useEffect(()=>{const el=propertiesRef.current;if(!el)return;const on=()=>{propScroll.current={top:el.scrollTop,mid:placed.id};};el.addEventListener('scroll',on,{passive:true});return()=>el.removeEventListener('scroll',on);},[placed.id]);
  useLayoutEffect(()=>{const el=propertiesRef.current,s=propScroll.current;if(!el||s.mid!==placed.id)return;if(Math.abs(el.scrollTop-s.top)>1)el.scrollTop=s.top;},[project]); // eslint-disable-line react-hooks/exhaustive-deps
  // v4 (замер удобства 22.10): поле в фокусе («Проём 4») не прячется под нижнюю панель — правая панель докручивается до него
  useEffect(()=>{const el=propertiesRef.current;if(!el)return;const on=(e:FocusEvent)=>{const t=e.target as HTMLElement|null;if(!t?.matches?.('input,select,textarea'))return;
    requestAnimationFrame(()=>{const r=t.getBoundingClientRect(),box=el.getBoundingClientRect(),dock=document.querySelector('.project-dock')?.getBoundingClientRect(),bottom=Math.min(box.bottom,dock&&dock.top>box.top?dock.top:Infinity)-8;
      if(r.bottom>bottom)el.scrollTop+=r.bottom-bottom;else if(r.top<box.top+8)el.scrollTop-=box.top+8-r.top;propScroll.current={top:el.scrollTop,mid:placed.id};});};
    el.addEventListener('focusin',on);return()=>el.removeEventListener('focusin',on);},[placed.id]);
  const [gapDimensions,setGapDimensions]=useState(true);
  const selectedDetail=selectedPart?.mid===placed.id?parts(m).find(p=>p.id===selectedPart.pid):undefined;
  // Explicit selection opens only the relevant controls; initial module settings stay closed.
  useEffect(()=>{
    if(!selectedDetail)return;
    const title=selectedDetail.role==='door'?'Фасад':selectedDetail.id.includes(':drawer:')?'Ящики':selectedDetail.id.includes(':shelf:')?'Полки':/:rod|:pantograph:|:pullout:/.test(selectedDetail.id)?'Штанги':'Секция';
    propertiesRef.current?.querySelectorAll<HTMLDetailsElement>('details[data-setting]').forEach(d=>{if(d.dataset.setting===title)revealSettings(d);});
  },[selectedDetail?.id]);
  const canRemove=selectedDetail&&(/:door:|:shelf:|:drawer:|:pantograph:|:pullout:|:flange:/.test(selectedDetail.id)||selectedDetail.id.endsWith(':rod'));
  const selectedFillingName=selectedDetail?.id.includes(':drawer:')?'Ящик '+(Number(selectedDetail.id.split(':drawer:')[1].split(':')[0])+1):selectedDetail?.id.includes(':pantograph:')?'Пантограф':selectedDetail?.id.includes(':flange:')||selectedDetail?.id.endsWith(':rod')?'Штанга':selectedDetail?.id.includes(':shelf:')?'Полка '+(Number(selectedDetail.id.split(':shelf:')[1])+1):selectedDetail?.name;
  const removalLabel=(selectedDetail?.role==='door'||selectedDetail?.id.endsWith(':facade'))?'Удалить выбранный фасад':selectedDetail?.id.includes(':drawer:')?'Удалить ящик целиком':selectedDetail?.id.includes(':pantograph:')?'Удалить пантограф':selectedDetail?.id.includes(':pullout:')?'Удалить тремпель':selectedDetail?.id.includes(':flange:')||selectedDetail?.id.endsWith(':rod')?'Удалить штангу':'Удалить полку';
  function removeSelected(){if(!selectedPart||!canRemove)return;try{if(commitProject(removePart(project,selectedPart.mid,selectedPart.sid,selectedPart.pid)))setSelectedPart(null);}catch(e){setError((e as Error).message);}}
  function nudgeSelected(delta:number){if(!selectedPart||!canRemove||selectedDetail?.role==='door')return;try{moveFilling(selectedPart.mid,selectedPart.sid,selectedPart.pid,delta);}catch(e){setError((e as Error).message);}}
  function copySelected(){if(!selectedPart)return;try{const result=duplicatePart(project,selectedPart.mid,selectedPart.sid,selectedPart.pid);if(commitProject(result.project)){setSelectedPart({...selectedPart,pid:result.partId});setDrawerIndex(result.partId.includes(':drawer:')?Number(result.partId.split(':drawer:')[1].split(':')[0]):null);setDrawerPreview(false);setMode('fill');}}catch(e){setError((e as Error).message);}}
  const [snapping,setSnapping]=useState(true);
  const [moveAll,setMoveAll]=useState(false);
  const [groupIds,setGroupIds]=useState<string[]>([]);
  const toggleModuleGroup=(id:string)=>{setGroupIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);setMoveAll(false);setFocusActive(false);};
  const liveGroupIds=groupIds.filter(id=>project.modules.some(a=>a.id===id));
  // m5 (критик релиза 22.10): после Esc выделение снято — справа не настройки прежнего модуля, а «Ничего не выбрано» и проект
  const nothingSelected=deselected&&!liveGroupIds.length&&project.modules.length>0;
  const movingTogether=moveAll||liveGroupIds.includes(placed.id);
  const groupBounds=moveAll?mountingComposition:mountingCompositionBounds({...project,modules:project.modules.filter(a=>liveGroupIds.includes(a.id))});
  const [focusActive,setFocusActive]=useState(false);
  const [transparent, setTransparent] = useState(false);
  const [clearFacades, setClearFacades] = useState(false);
  const [hideFacades,setHideFacades]=useState(false);
  const [cutaway,setCutawayState]=useState(readCutaway);const toggleCutaway=()=>setCutawayState(v=>{saveCutaway(!v);return !v;});
  const [hiddenModules,setHiddenModules]=useState<string[]>([]);
  const hiddenIds=hiddenModules.filter(id=>project.modules.some(a=>a.id===id));
  const [compactTop,setCompactTop]=useState(()=>{try{return localStorage.getItem('yo-compact-top')!=='0';}catch{return true;}});
  const toggleTop=()=>setCompactTop(v=>{try{localStorage.setItem('yo-compact-top',v?'0':'1');}catch{}return !v;});
  const hideModule=(id:string)=>{setHiddenModules(ids=>ids.includes(id)?ids:[...ids,id]);setSelectedPart(null);setCtxMenu(null);};
  const [showRoom, setShowRoom] = useState(false);
  const [roomPlan,setRoomPlan]=useState(false);
  const [selectedOpening,setSelectedOpening]=useState<string>();
  const [selectedObstacle,setSelectedObstacle]=useState<string>();
  const [selectedFixture,setSelectedFixture]=useState<string>();
  const [presentation,setPresentation]=useState(false);
  const beforePresentation=useRef<{view:View;roomPlan:boolean;openDoors:boolean;showRoom:boolean}|null>(null);
  const [outputTab,setOutputTab] = useState<OutputTab>("sheets");
  // Пошаговый режим: этап определяет, какие панели видны и куда ведёт «Дальше». Сохраняется в браузере.
  const [stage,setStageState]=useState<Stage>(()=>restoredStage(startup.model.modules.length>0,storedStage()));
  const [advanced,setAdvanced]=useState(()=>{try{return localStorage.getItem(STAGE_KEY+'-advanced')==='1';}catch{return false;}});
  useEffect(()=>{try{localStorage.setItem(STAGE_KEY,stage);localStorage.setItem(STAGE_KEY+'-advanced',advanced?'1':'0');}catch{/* без хранилища этап не запоминается */}},[stage,advanced]);
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
    setDeselected(false);
    setHiddenModules(ids=>ids.filter(id=>id!==mid));
    setSelectedOpening(undefined);
    setSelectedObstacle(undefined);
    setDrawerPreview(false);
    setSelectedPart(null);
    setActive(mid);
    setTab(stage==='filling'?"section":"module");
    // Камера не сбрасывается при выборе корпуса (в т.ч. правой кнопкой для меню) — подгонка только в режиме «Приблизить выбранный корпус».
    if(focusActive)setFit((f) => f + 1);
    if(stage==='room'||stage==='fixtures')setStageState('bodies'); // выбрали корпус — работаем с мебелью
  }
  /** Размер помещения, проёма или объекта на стене, нажатый на эскизе или в 3D: открывает поле ввода и применяет к комнате. */
  function roomDimension(kind:'room'|'opening'|'fixture',id:string,field:string,value:number){
    const room=project.room;
    const labels:Record<string,string>={width:'Ширина',depth:'Глубина комнаты',height:'Высота',offset:'От угла стены',end:'До конца стены',sill:'Подоконник от пола',fromFloor:'От пола'};
    const label=(kind==='room'?{width:'Ширина комнаты',depth:'Глубина комнаты',height:'Высота потолка'}[field]:labels[field])??field;
    editDimension(label,Math.round(value),v=>{
      if(kind==='room')return commitProject({...project,room:{...room,[field]:v}});
      const list=kind==='opening'?(room.openings||[]):(room.fixtures||[]);
      const item=list.find(x=>x.id===id) as {wall:'back'|'left'|'right'|'front';offset:number;width:number}|undefined;if(!item)return false;
      const len=item.wall==='back'||item.wall==='front'?room.width:room.depth;
      const patch=field==='end'?{offset:len-item.width-v}:{[field]:v};
      const next=kind==='opening'?{...room,openings:(room.openings||[]).map(o=>o.id===id?{...o,...patch}:o)}:{...room,fixtures:(room.fixtures||[]).map(f=>f.id===id?{...f,...patch}:f)};
      return commitProject({...project,room:next});
    });
  }
  /** Переход на этап: подстраивает вкладку, режим, вид и открытие фасадов. */
  function goStage(next:Stage){
    setStageState(normalizeStage(next));setModal(m=>m==='room-setup'?null:m);
    if(next==='room'){setTab('room');setShowRoom(true);setRoomPlan(false);setView('iso');setFit(f=>f+1);}
    else if(next==='fixtures'){setTab('room');setShowRoom(true);setRoomPlan(true);}
    else if(next==='bodies'){setTab('module');setMode('move');setRoomPlan(false);setShowRoom(true);setOpenDoors(false);}
    else if(next==='filling'){setTab('section');setMode('fill');setRoomPlan(false);setOpenDoors(true);}
    else if(next==='facades'){setTab('module');setMode('select');setHideFacades(false);setRoomPlan(false);setOpenDoors(false);}
    else {setRoomPlan(false);setView('iso');setShowRoom(true);setOutputTab('sheets');setModal('output');}
  }
  const stageDone:Partial<Record<Stage,boolean>>={room:true,fixtures:!!((project.room.openings?.length||0)+(project.room.fixtures?.length||0)+(project.room.obstacles?.length||0)),bodies:project.modules.length>0,filling:project.modules.some(a=>a.module.sections.some(s=>s.shelves.length||s.drawers||s.rod)),facades:project.modules.some(a=>a.module.doors||a.module.sections.some(s=>s.drawers))};
  function addUpper(){try{const n=addUpperModule(project,placed.id);if(commitProject(n))selectModule(n.modules[n.modules.length-1].id);}catch(e){setError((e as Error).message);}}
  function movedBodies(mid:string,pos:{x:number;y:number;z:number}){return moveAll?moveComposition(project,mid,pos):liveGroupIds.includes(mid)?moveComposition(project,mid,pos,liveGroupIds):moveModule(project,mid,pos);}
  function moveBody(mid:string,pos:{x:number;y:number;z:number}){return commitProject(movedBodies(mid,pos));}
  function snapBodies(mid:string,pos:{x:number;y:number;z:number}){return moveAll?snapComposition(project,mid,pos):liveGroupIds.includes(mid)?snapComposition(project,mid,pos,35,liveGroupIds):snapPlacement(project,mid,pos);}
  function moveFilling(mid:string,sid:string,pid:string,delta:number){return commitProject(movePart(project,mid,sid,pid,delta));}
  function selectInserted(next:Project,mid:string,sid:string,kind:FillKind,keepMode=false){
    const pid=insertedPartId(project,next,mid,sid,kind);
    // из кругового меню режим не переключаем (ручной тест 19.10: в «Наполнении» менеджер терял меню)
    setActive(mid);chooseSection(sid);if(!keepMode)setMode('fill');setOpenDoors(true);
    if(pid){setSelectedPart({mid,sid,pid});if(kind==='drawer'||kind==='mesh')setDrawerIndex(Number(pid.split(':drawer:')[1].split(':')[0]));}
  }
  /** Сырой модуль из Базиса (m.raw): наполнение не настраивается — пресеты, композер и перетаскивание выходят без записи в историю (A5). */
  const RAW_FILLING_MESSAGE='Модуль перенесён из Базиса как есть — наполнение здесь не настраивается. Правится в Базисе (переимпорт).';
  function dropFilling(kind:string,mid:string,sid:string,y:number,meshId?:string,glass?:boolean,keepMode=false){
    if(!['shelf','drawer','rod','pantograph','mesh'].includes(kind))return false;
    const target=project.modules.find(a=>a.id===mid)?.module;
    if(target?.kupe){setError('Двери купе — это только двери. Полки, ящики и штанги ставьте в корпус за ними.');return false;}
    if(target?.raw){setError(RAW_FILLING_MESSAGE);return false;}
    setMeshFit(null);
    try{const next=glass&&kind==='shelf'?insertGlassShelf(project,mid,sid,y):insertItem(project,kind as FillKind,mid,sid,y,undefined,meshId);if(commitProject(next)){selectInserted(next,mid,sid,kind as FillKind,keepMode);return true;}}
    catch(e){
      let message=e instanceof Error?e.message:'Не удалось добавить элемент.';
      if(kind==='mesh'){try{const fitted=fitMeshItem(project,mid,sid,meshId??DEFAULT_MESH,y);const width=fitted.modules.find(a=>a.id===mid)!.module.width;setMeshFit({mid,sid,meshId:meshId??DEFAULT_MESH,y,width});}catch(fitError){message+=' '+(fitError as Error).message;}}
      setError(message);
    }
    return false;
  }
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
    [view, setView] = useState<View>(()=>{try{const v=viewKey?JSON.parse(sessionStorage.getItem('garderyob-camera:'+viewKey)||'null')?.view:null;return ['iso','front','side','left','top'].includes(v)?v:'iso';}catch{return 'iso';}}),
    [fit, setFit] = useState(0),
    [openDoors, setOpenDoors] = useState(true),
    [exploded, setExploded] = useState(false),
    [dimensions, setDimensions] = useState(true),
    [tab, setTab] = useState<"module" | "section" | "room">("module");
  const [errorList,setErrorList]=useState<ErrorDetail[]>([]);
  const [error, setError] = useState(startup.error),
    [saved, setSaved] = useState("На этом компьютере"),
    [modal, setModal] = useState<
      "facade-editor" | "materials" | "handles" | "parts" | "help" | "output" | "cloud" | "render" | "library" | "new" | "room-setup" | null
    >(null),
    [materialTarget, setMaterialTarget] = useState<"decor" | "facadeDecor" | "drawerFacadeDecor">(
      "decor",
    ),
    [search, setSearch] = useState("");
  const [facadePreview,setFacadePreview]=useState<{base:Project;next:Project}|null>(null);
  const editingFacades=modal==='facade-editor';
  const sceneProject=editingFacades&&facadePreview?.base===project?facadePreview.next:project;
  useEffect(()=>{setFacadePreview(null);setModal(value=>value==='facade-editor'?null:value);},[project,active,stage]);
  const [composer,setComposerState]=useState<'shelf'|'drawer'|null>(null);
  // композер полок/ящиков для сырого модуля Базиса не открывается (наполнение правится в Базисе)
  const setComposer=(kind:'shelf'|'drawer'|null)=>{if(kind&&m.raw)return;setComposerState(kind);};
  useEffect(()=>setComposerState(null),[active,stage]);
  // Restore the workspace as well as the stage label after a reload.
  useEffect(()=>{goStage(stage);},[]);
  useEffect(()=>{if((stage==='room'||stage==='fixtures')&&tab!=='room'&&!advanced)setTab('room');},[stage,tab,advanced]);
  const materialRecipients=project.modules.filter(a=>materialScope==='all'||(materialScope==='group'?liveGroupIds.includes(a.id):a.id===placed.id));
  const capture = useRef<((opts?: {frame?: boolean}) => string) | undefined>(undefined);
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
  const externalSeen=useRef(externalVersion);
  useEffect(()=>{if(externalVersion===externalSeen.current)return;externalSeen.current=externalVersion;if(saveManagedProject&&initialProject){setHistory([initialProject]);setCursor(0);setActive(a=>initialProject.modules.some(m=>m.id===a)?a:initialProject.modules[0].id);clearHistorySelection();}},[externalVersion]);
  const undo = () => {
    if(managedHistory){managedHistory.undo();return;}
    if(saveManagedProject&&!saveManagedProject(history[Math.max(0,cursor-1)]))return;
    clearHistorySelection();
    setCursor((c) => Math.max(0, c - 1));
    setError("");
    touched.current = true;
  };
  const redo = () => {
    if(managedHistory){managedHistory.redo();return;}
    if(saveManagedProject&&!saveManagedProject(history[Math.min(history.length-1,cursor+1)]))return;
    clearHistorySelection();
    setCursor((c) => Math.min(history.length - 1, c + 1));
    setError("");
    touched.current = true;
  };
  function commitProject(raw: Project) {
    // Угловые фальши ставятся и снимаются автоматически по факту примыкания корпусов под 90°.
    const next = applyAutoFillers(raw);
    const e = projectErrors(next,!!onEmptyProject);
    if (e.length) {
      setError(e[0]);
      // п.4 волны 22.10: все ошибки списком — где (корпус, секция, деталь) и что сделать
      try{setErrorList(explainErrors(next,e));}catch{setErrorList(e.map(text=>({text,problem:text,action:''})));}
      return false;
    }
    if (JSON.stringify(next) === JSON.stringify(project)) {
      setError("");
      return true;
    }
    if (!next.modules.length && onEmptyProject) return onEmptyProject(next);
    if(saveManagedProject&&!saveManagedProject(next))return false;
    touched.current = true;
    setHistory((h) => [...h.slice(0, cursor + 1), next].slice(-61));
    setCursor(Math.min(cursor + 1, 60));
    setError("");
    return true;
  }
  function commit(next: Module) {
    // Ширина изменилась — по правилу ряда (rowResize): сосед сужается, у стены — от стены; иначе просто замена модуля.
    let p: Project;
    try{p=placeInRow(project,placed.id,next);}catch(e){setError((e as Error).message);return false;}
    // x4 (замер кухонь 22.10): корпус под потолком (антресоль из палитры) растёт по высоте вниз — верх остаётся у потолка,
    // иначе «выходит за границы помещения», пока не задашь «От пола»
    const top=(placed.y??0)+m.height;
    if(next.height>m.height&&(placed.y??0)>0&&Math.abs(top-project.room.height)<=2){const y=Math.max(0,Math.round((top-next.height)*10)/10);p={...p,modules:p.modules.map(a=>a.id===placed.id?{...a,y}:a)};}
    return commitProject(p);
  }
  // Зазоры в ряду, «Дотянуть», «Вплотную», «Задать зазор…», растяжение мышью (запрос Макса 20.10.2026, РЕШЕНИЯ.md «Ширина в ряду»).
  const [gapMenu,setGapMenu]=useState<{side:'left'|'right';x:number;y:number}|null>(null);
  // плашка «Изменение не применено» скрывается сама через 6 с (критик 20.10, m1); с кнопкой «Подогнать…» и ошибкой открытия — нет
  // список ошибок с «Показать» (п.4 волны 22.10) висит дольше — 20 с, чтобы успеть прочитать и нажать
  const errorDetails=error&&errorList.some(d=>d.text===error)?errorList:[];
  // K2 (критик 22.10, раунд 2): модуль встал не у стены (ряд занят) — предупреждение, не ошибка; скрывается само через 12 с
  const [placeNote,setPlaceNote]=useState<string|null>(null);
  useEffect(()=>{if(!placeNote)return;const t=setTimeout(()=>setPlaceNote(null),12000);return()=>clearTimeout(t);},[placeNote]);
  // критик релиза 24.10: студия сама поменяла что-то по правилу (две створки у частичной перегородки → одна) — сообщение, не ошибка; 12 с
  const [notice,setNotice]=useState<{title:string;text:string}|null>(null);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(null),12000);return()=>clearTimeout(t);},[notice]);
  useEffect(()=>{const on=(e:Event)=>{const d=(e as CustomEvent).detail as {title?:string;text?:string}|undefined;if(d?.text)setNotice({title:d.title??'Сделано',text:d.text});};window.addEventListener('studio-note',on);return()=>window.removeEventListener('studio-note',on);},[]);
  useEffect(()=>{if(!error||meshFit||error===startup.error)return;const t=setTimeout(()=>setError(''),errorDetails.length?20000:6000);return()=>clearTimeout(t);},[error,meshFit]); // eslint-disable-line react-hooks/exhaustive-deps
  /** «Показать в 3D» детали (карты раскроя, «не помещается в лист»): выбрать корпус, секцию и деталь, открыть наполнение. */
  function inspectPart(mid:string,pid:string){const body=project.modules.find(a=>a.id===mid);if(!body)return;selectModule(mid);const sec=body.module.sections.find(s=>pid.startsWith(s.id+':'));if(sec)chooseSection(sec.id);setSelectedPart({mid,sid:sec?.id||body.module.sections[0].id,pid});if(pid.includes(':drawer:'))setDrawerIndex(Number(pid.split(':drawer:')[1].split(':')[0]));setRoomPlan(false);setView('iso');setMode('fill');setFocusActive(true);setOpenDoors(true);setModal(null);}
  // u1 (замер удобства 22.10): действие кругового меню бросило исключение — сообщение на экране, а не только в консоли
  useEffect(()=>{const on=(e:Event)=>{const d=(e as CustomEvent).detail as unknown;
      // п.3 w-formerrors (23.10): отказ поля по нескольким причинам — все списком (предел поля первым, затем остальное с «Что сделать»)
      if(d&&typeof d==='object'&&'text' in d&&Array.isArray((d as {list?:unknown}).list)){const x=d as {text:string;list:string[];moduleId?:string;moduleName?:string;problem?:string;action?:string};
        const rest=x.list.map(text=>{const sec=text.match(/^Секция (\d+): /),body=sec?text.slice(sec[0].length):text,{problem,action}=splitAction(body);return {text,problem:problem.replace(/^./,c=>c.toUpperCase()),action:/Ctrl\+Z/.test(action)?'Измените значение так, чтобы правило выполнялось.':action,moduleId:x.moduleId,moduleName:x.moduleName,sectionNo:sec?Number(sec[1]):undefined};});
        setErrorList([{text:x.text,problem:x.problem??x.text,action:x.action??'',moduleId:x.moduleId,moduleName:x.moduleName},...rest]);setError(x.text);return;}
      setError(String(d||'Действие не выполнено.'));};window.addEventListener('studio-error',on);return()=>window.removeEventListener('studio-error',on);},[]);
  /** «Показать» у ошибки: выбрать корпус, секцию и деталь, приблизить. */
  function showError(d:ErrorDetail){
    const a=project.modules.find(x=>x.id===d.moduleId);if(!a)return;
    selectModule(a.id);setRoomPlan(false);setFocusActive(true);setFit(f=>f+1);
    const sid=d.sectionId&&a.module.sections.some(s=>s.id===d.sectionId)?d.sectionId:undefined;
    if(sid)chooseSection(sid);
    if(d.partId&&sid&&parts(a.module).some(p=>p.id===d.partId)){setSelectedPart({mid:a.id,sid,pid:d.partId});setMode('select');if(/:door:|:drawer:/.test(d.partId))setOpenDoors(!d.partId.includes(':door:'));}
  }
  // столешница, объекты ряда, Базис, угловой, купе — без плашек зазоров и ручек (их ширина краем не меняется)
  const rowGaps=useMemo(()=>{try{return widthLock(placed.module)?null:gaps(project,placed.id);}catch{return null;}},[project,placed.id,placed.module]);
  useEffect(()=>{setGapMenu(null);},[project,placed.id]);
  useEffect(()=>{if(!gapMenu)return;const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')setGapMenu(null);};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc);},[gapMenu]);
  function rowEdit(make:()=>Project){try{return commitProject(make());}catch(e){setError((e as Error).message);return false;}}
  const sideWord=(side:'left'|'right')=>side==='right'?'справа':'слева';
  // «Задать зазор…» меняет ширину: край со стороны зазора, противоположный на месте (критик 20.10, m3); «мм» добавляет само окно
  function askGap(mid:string,side:'left'|'right',g:GapSide){editDimension(`Зазор ${sideWord(side)} до ${g.to}`,g.gap,v=>rowEdit(()=>setGap(project,mid,side,v)));}
  // u2 (замер удобства 22.10): менеджер ждал сдвига — явный выбор: «сдвинуть модуль» (ширина та же, flush с зазором) или «изменить ширину»
  function askGapShift(mid:string,side:'left'|'right',g:GapSide){editDimension(`Зазор ${sideWord(side)} до ${g.to} — сдвинуть модуль`,g.gap,v=>rowEdit(()=>flush(project,mid,side,v)));}
  /** Пункты «Размеры ›»: дотянуть край до соседа/стены и придвинуть вплотную; неактивные — с причиной в подсказке. */
  function rowGapItems(mid:string):RadialItem[]{
    const a=project.modules.find(x=>x.id===mid);if(!a)return [];
    let g:ReturnType<typeof gaps>;try{g=gaps(project,mid);}catch{return [];}
    const lock=widthLock(a.module),both=!g.left.gap&&!g.right.gap,Side=(side:'left'|'right')=>side==='right'?'Справа':'Слева';
    const why=(side:'left'|'right')=>lock?lock[0].toUpperCase()+lock.slice(1):both?'Вплотную с обеих сторон — зазора нет':!g[side].gap?`${Side(side)} вплотную — зазора нет`:undefined;
    const fill=(side:'left'|'right'):RadialItem=>{const no=why(side);return {id:'fill-'+side,label:`Дотянуть ${side==='right'?'вправо':'влево'}`+(!no?` (+${fillAdd(g[side])})`:''),icon:side==='right'?ArrowRightToLine:ArrowLeftToLine,disabled:!!no,
      hint:no??`До ${g[side].to}: ширина ${g[side].fillWidth} мм, ${side==='right'?'левый':'правый'} край на месте`+(g[side].filler?`; ${fillerNote(g[side])}`:''),run:()=>{rowEdit(()=>fillGap(project,mid,side));}};};
    const push=(side:'left'|'right'):RadialItem=>{const block=flushBlock(project,mid,side),no=why(side)??(block?`Нельзя: ${block}. Закрыть зазор — «Дотянуть»`:undefined);return {id:'flush-'+side,label:`Вплотную ${side==='right'?'вправо':'влево'}`,icon:side==='right'?ChevronsRight:ChevronsLeft,disabled:!!no,
      hint:no??`Сдвинуть на ${g[side].gap} мм до ${g[side].to}, ширина та же`,run:()=>{rowEdit(()=>flush(project,mid,side));}};};
    const gapItem=(side:'left'|'right',shift:boolean):RadialItem=>({id:'gap-'+(shift?'move-':'width-')+side,label:`Зазор ${sideWord(side)} — ${shift?'сдвинуть':'ширина'}`,icon:shift?(side==='right'?ChevronsRight:ChevronsLeft):(side==='right'?ArrowRightToLine:ArrowLeftToLine),disabled:!shift&&!!lock,
      hint:!shift&&lock?lock[0].toUpperCase()+lock.slice(1):shift?`Задать зазор ${sideWord(side)} (сейчас ${g[side].gap} мм до ${g[side].to}): модуль сдвигается, ширина та же`:`Задать зазор ${sideWord(side)} (сейчас ${g[side].gap} мм до ${g[side].to}): меняется ширина, ${side==='right'?'левый':'правый'} край на месте`,run:()=>{(shift?askGapShift:askGap)(mid,side,g[side]);}});
    return [fill('right'),fill('left'),push('right'),push('left'),{id:'gap-set',label:'Задать зазор',icon:Ruler,hint:'Сдвинуть модуль или изменить ширину так, чтобы зазор стал нужным',children:[gapItem('right',true),gapItem('right',false),gapItem('left',true),gapItem('left',false)]}];
  }
  useEffect(()=>{setMaterialScope("active");},[modal]);
  function movePlaced(key: "x" | "y" | "z", value: number) {
    try{return commitProject(setWallDistance(project,placed.id,key,value,moveAll,liveGroupIds));}catch(e){setError((e as Error).message);return false;}
  }
  // Положение одним изменением (w-lwing 23.10): X/Y/Z и поворот вместе, проверка — у итога; soft — без сообщения (поля «ещё не применено»).
  // Общий сдвиг композиции/группы — по осям, как раньше.
  function placePlaced(t:PlaceTarget,soft:boolean):true|string{
    try{
      let next:Project;
      if(movingTogether){next=project;for(const k of ['y','x','z'] as const){const v=t[k];if(v!==undefined)next=setWallDistance(next,placed.id,k,v,moveAll,liveGroupIds);}if(t.rotation!==undefined&&t.rotation!==(placed.rotation??0))next=rotateModule(next,placed.id,t.rotation);}
      else next=placeModuleAt(project,placed.id,t);
      if(soft){const e=projectErrors(applyAutoFillers(next),!!onEmptyProject)[0];if(e)return e;}
      return commitProject(next)?true:'не применено';
    }catch(e){const m=(e as Error).message;if(!soft)setError(m);return m;}
  }
  /** «Поставить к стене» модуль mid; «Продолжить ряд за угол» — такой же модуль (или перенос выбранного) на соседнюю стену от угла. */
  function moduleToWall(mid:string,wall:Wall){try{if(commitProject(placeToWall(project,mid,wall))){selectModule(mid);setFit(f=>f+1);}}catch(e){setError((e as Error).message);}}
  function aroundCorner(mid:string,turn:CornerTurn,move?:string){
    const a=project.modules.find(x=>x.id===mid);if(!a)return;
    try{const r=continueAroundCorner(project,turn,move?{id:move}:{module:{...structuredClone(a.module),name:a.module.name.replace(/ · копия$/,'')},y:a.y});if(commitProject(r.project)){selectModule(r.id);setFit(f=>f+1);}}catch(e){setError((e as Error).message);}
  }
  function modify(update: (draft: Module) => void) {
    const next = structuredClone(m);
    try{update(next);if(next.kitchen&&next.width!==m.width&&/^(Нижний кухонный|Нижний с ящиками|Под мойку|Под духовку|Бутылочница|Навесной кухонный|Навесной открытый|Антресоль|Пенал) \d+$/.test(m.name))next.name=m.name.replace(/ \d+$/,` ${next.width}`);if(next.kitchen&&next.depth!==m.depth)for(const s of next.sections){if(s.shelfDepth!==undefined){const old=m.sections.find(v=>v.id===s.id)?.shelfDepth;if(!s.shelves.length)delete s.shelfDepth;else s.shelfDepth=Math.max(60,Math.min(shelfMaxDepth(next),next.depth-(m.depth-(old??s.shelfDepth))));}}if(next.height!==m.height&&!next.corner){fitDrawersAfterResize(next,m);if(next.gola&&next.kdrawers?.length)next.kdrawers=layoutKitchenDrawers(next,next.kdrawers.length,undefined,next.kdrawers[0].system);}}catch(e){setError((e as Error).message);return false;}
    return commit(next);
  }
  function modifySection(update: (draft: Section, next: Module) => void) {
    return modify((next) => {
      update(next.sections[idx], next);
      const a = next.sections[idx];
      if (a.drawerConfigs)
        a.drawerConfigs = a.drawerConfigs.slice(0, Math.max(0, a.drawers));
    });
  }
  function chooseSection(id: string) {
    setDeselected(false);
    setDrawerPreview(false);
    setSelectedPart(null);
    setSelected(id);
    setDrawerIndex(null);
    setTab("section");
  }
  // Контекстное меню по правой кнопке на корпусе в 3D (как в B Planner): редактировать, наполнение, материал, ручка, копия, поворот, антресоль, удалить.
  // Круговое меню по правой кнопке (06.10.2026): набор действий зависит от того, что под курсором — корпус, полка, ящик или дверь.
  const [ctxMenu,setCtxMenu]=useState<{mid:string;sid:string;x:number;y:number;pid?:string;role?:string;localY?:number}|null>(null);
  function ctxAction(run:()=>void){setCtxMenu(null);try{run();}catch(e){setError((e as Error).message);}}
  // Режим «Подсветка» (запрос Макса 20.10.2026): id корпуса, у которого клик по детали ставит/снимает её подсветку; Esc или «Готово» — выход.
  const [lightMode,setLightMode]=useState<string|null>(null);
  const [lightNote,setLightNote]=useState('');
  // задача 14 (22.10): что ставит клик в режиме (вертикаль/горизонталь/обе) и окно «Подсветка» (id корпуса) — src/LightPanel.tsx
  const [lightOrient,setLightOrient]=useState<LightOrient>('both');
  const [lightPanel,setLightPanel]=useState<string|null>(null);
  // Esc при открытом круговом меню закрывает только меню, режим остаётся
  useEffect(()=>{if(!lightMode||ctxMenu)return;const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){setLightMode(null);setLightNote('');}};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc);},[lightMode,ctxMenu]);
  useEffect(()=>{if(lightMode&&!project.modules.some(x=>x.id===lightMode))setLightMode(null);},[project,lightMode]);
  function pickLight(mid:string,pid:string,alts:string[]=[]){
    const a=project.modules.find(x=>x.id===mid);if(!a)return;
    if(!quickMenuApplies(a.module)){setLightNote(lightUnavailable(a.module));return;}
    const keys=pickTargets(a.module,[pid,...alts],lightOrient)?.keys??[];
    if(!keys.length){setLightNote(lightOrient==='vertical'?'Ставится вертикаль — кликните стойку или перегородку (полки — «Горизонталь»)':lightOrient==='horizontal'?'Ставится горизонталь — кликните полку или крышу (стойки — «Вертикаль»)':'В эту деталь подсветка не ставится — кликните стойку, полку, перегородку или крышу');return;}
    if(mid!==lightMode){selectModule(mid);setLightMode(mid);}
    if(modifyAt(mid,n=>{toggleGroup(n,keys);}))setLightNote('');
  }
  // Одноразовая подсказка про круговое меню: исчезает после первого правого клика или по кнопке «Понятно».
  const [rmbTip,setRmbTip]=useState(()=>{try{return !localStorage.getItem('studio-tip-rmb');}catch{return false;}});
  function hideRmbTip(){setRmbTip(false);try{localStorage.setItem('studio-tip-rmb','1');}catch{/* без хранилища — просто скрываем */}}
  useEffect(()=>{if(ctxMenu&&rmbTip)hideRmbTip();},[ctxMenu]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Правка любого корпуса по id (круговое меню работает и с неактивным корпусом). */
  function modifyAt(mid:string,update:(draft:Module)=>void){
    const a=project.modules.find(x=>x.id===mid);if(!a)return false;
    const next=structuredClone(a.module);
    try{update(next);if(next.height!==a.module.height&&!next.corner)fitDrawersAfterResize(next,a.module);return commitProject(placeInRow(project,mid,next));}catch(e){setError((e as Error).message);return false;}
  }
  /** Полка над ящиками секции (п.29 волны 22.10): auto — есть, если над ящиками есть место; on — есть (ящики, дошедшие до крыши, опускаются
   *  под полку с проёмом 80 мм, как при уменьшении высоты); off — нет, ящики остаются на месте. */
  function setDrawerCapAt(mid:string,sid:string,v:'auto'|'on'|'off'){
    return modifyAt(mid,n=>{
      const sec=n.sections.find(x=>x.id===sid);if(!sec)return;
      if(v==='auto')delete sec.drawerCap;else sec.drawerCap=v==='on';
      // «нет» в секции из одних ящиков (комод): ящики снова поровну до крыши, если так они до неё достают; «авто» ящики не двигает
      if(v==='off'&&!sec.shelves.length&&!sec.rod&&!sec.pantograph&&!sec.drawerConfigs?.some(c=>c.mesh||c.tray)){try{const cfg=drawersToRoof(n,sec);if(drawersFillRoof(n,{...sec,drawerConfigs:cfg}))sec.drawerConfigs=cfg;}catch{/* не помещаются — ящики как были */}}
      if(!hasDrawerCap(n,sec))return;
      const b=boxes(n).find(x=>x.id===sid)!,h=b.top-b.bottom,ceiling=Math.min(b.top-RULES.shelfMinClear,...sec.shelves.map(f=>b.bottom+f*h-RULES.panel/2-RULES.shelfMinClear));
      if(drawerCapTop(n,sec)>ceiling)sec.drawerConfigs=distributeDrawers(n,sec,ceiling);
    });
  }
  /** Правый клик по любой детали — меню всего модуля (решение Макса 16.10); действия с самой деталью — одним пунктом внутри. */
  // Уточнение 19.10 (ручной тест): по детали — сначала действия детали + «Корпус ›»; по корпусу — меню модуля (src/contextMenu.ts).
  function radialMenu(c:NonNullable<typeof ctxMenu>):{title:string;subtitle:string;items:RadialItem[]}{
    const out:{ring?:RadialItem[]}={},r=partRadial(c,out),m0=project.modules.find(x=>x.id===c.mid)!.module;
    return composeContextMenu(m0,r,m0.kupe?null:out.ring??null,!!c.pid);
  }
  function partRadial(c:NonNullable<typeof ctxMenu>,out:{ring?:RadialItem[]}):{title:string;subtitle:string;items:RadialItem[]}{
    const a=project.modules.find(x=>x.id===c.mid)!,mod=a.module,sidx=Math.max(0,mod.sections.findIndex(s=>s.id===c.sid)),sec=mod.sections[sidx];
    const pid=c.pid??'',y=c.localY??mod.height/2;
    const select=()=>{selectModule(a.id);chooseSection(c.sid);};
    const size=(key:'width'|'height'|'depth',label:string)=>({id:'size-'+key,label,icon:Ruler,hint:`Сейчас ${mod[key]} мм. Введите новое значение`,run:()=>{select();editDimension(label+' корпуса, мм',mod[key],v=>modifyAt(a.id,n=>{n[key]=v;}));}});
    const hinges:RadialItem={id:'hinges',label:'Петли',icon:Link2,hint:'Бренд петель этого корпуса. Цена меняется сразу',disabled:!mod.doors,children:(Object.keys(HINGE_BRANDS) as HingeBrand[]).map(k=>({id:'hinge-'+k,label:HINGE_BRANDS[k].label,icon:Link2,active:(mod.hingeBrand??'gtv')===k,hint:`${HINGE_BRANDS[k].note}`,run:()=>modifyAt(a.id,n=>{if(k==='gtv')delete n.hingeBrand;else n.hingeBrand=k;})}))};
    const opening:RadialItem={id:'opening',label:'Открывание',icon:MousePointerClick,hint:'С ручками или нажатием на фасад',disabled:!mod.doors,children:[
      {id:'open-handle',label:'С ручками',icon:Hand,active:mod.doorOpen!=='push',hint:'Ручка и петли с доводчиком',run:()=>modifyAt(a.id,n=>{delete n.doorOpen;})},
      {id:'open-push',label:'Нажатием',icon:MousePointerClick,active:mod.doorOpen==='push',hint:'Push-to-open: без ручек, толкатель',run:()=>modifyAt(a.id,n=>{n.doorOpen='push';})},
      ...(()=>{const single=mod.doors&&!mod.raw?singleLeafDoors(mod):[];return single.length?(['left','right'] as const).map(side=>({id:'hinge-all-'+side,label:side==='left'?'Петли слева':'Петли справа',icon:DoorOpen,active:single.every(d=>d.hinge===side),hint:'Все одностворчатые фасады корпуса. Отдельный фасад — правой кнопкой по нему',run:()=>modifyAt(a.id,n=>{setModuleHingeSide(n,side);})})):[];})()]};
    const editFacade:RadialItem={id:'edit-facade',label:'Редактировать фасад',icon:SlidersHorizontal,hint:'Материал, плёнка, краска и фрезеровка фасадов корпуса',disabled:!!mod.raw||!!mod.bazis||!!mod.kupe,run:()=>{select();setSelectedPart({mid:a.id,sid:c.sid,pid});setModal('facade-editor');}};
    const hideItem:RadialItem={id:'hide-module',label:'Скрыть модуль',icon:EyeOff,hint:'Только с экрана. Остаётся в проекте и стоимости',run:()=>hideModule(a.id)};
    const above=project.modules.find(x=>x.id!==a.id&&Math.abs((x.y??0)-((a.y??0)+mod.height))<2&&Math.abs(x.x-a.x)<2&&Math.abs(x.z-a.z)<2);
    const quickOps:QuickMenuOps={modify:u=>{modifyAt(a.id,u);},addUpper:()=>{try{const n=addUpperModule(project,a.id);if(commitProject(n))selectModule(n.modules[n.modules.length-1].id);}catch(e){setError((e as Error).message);}},
      removeUpper:above?()=>{commitProject({...project,modules:project.modules.filter(x=>x.id!==above.id)});}:undefined,
      lightMode:quickMenuApplies(mod)?()=>{selectModule(a.id);setLightNote('');setLightMode(a.id);}:undefined,
      lightPanel:quickMenuApplies(mod)?()=>{selectModule(a.id);setLightPanel(a.id);}:undefined,
      ask:(label,v,update)=>{select();editDimension(label,v,x=>modifyAt(a.id,update(x)));},elevated:(a.y??0)>0};
    const bodyRing:RadialItem[]=[hideItem,
      {id:'size',label:'Размеры',icon:Ruler,hint:`${mod.width} × ${mod.height} × ${mod.depth} мм`,children:[size('width','Ширина'),size('height','Высота'),size('depth','Глубина'),...rowGapItems(a.id)]},
      mod.worktop?worktopMaterialItem(mod,u=>modifyAt(a.id,u)):addMenuItem(mod,c.sid,{drop:(kind,o)=>{select();dropFilling(kind,a.id,c.sid,menuDropY(mod,c.sid,kind,y),o?.meshId,o?.glass,true);},modify:u=>modifyAt(a.id,u),split:()=>{try{commitProject(placeInRow(project,a.id,splitSection(mod,c.sid)));}catch(e){setError((e as Error).message);}},openKitchen:()=>{setActive(a.id);goStage('filling');}}),
      ...quickItems(mod,c.sid,quickOps),...cornerItems(mod,quickOps),
      {id:'decor',label:'Цвет',icon:Palette,hint:'Декор корпуса: '+mod.decor,run:()=>{setActive(a.id);setMaterialTarget('decor');setModal('materials');}},
      {id:'facades',label:'Фасады',icon:DoorOpen,hint:mod.doors?'Цвет, ручки, петли, открывание':'У корпуса нет распашных фасадов',children:[
        editFacade,{id:'facades-add',label:'Добавить',icon:Plus,hint:'Установить или восстановить распашные фасады',disabled:!!mod.desk||!!mod.raw||!!mod.worktop,run:()=>{const next=structuredClone(project),target=next.modules.find(x=>x.id===a.id)!.module;target.doors=true;target.sections.forEach(s=>delete s.removedDoors);if(commitProject(next)){setActive(a.id);goStage('facades');}}},
        {id:'facades-remove',label:'Удалить',icon:Trash,danger:true,disabled:!mod.doors||!!mod.raw||!!mod.kupe,hint:'Снять все распашные фасады корпуса. Вернуть — «Добавить» или Ctrl+Z. Отдельный фасад — правой кнопкой по нему',run:()=>modifyAt(a.id,n=>{n.doors=false;})},
        {id:'doors-toggle',label:openDoors?'Закрыть створки':'Открыть створки',icon:openDoors?DoorClosed:DoorOpen,hint:'Только вид: распахнуть створки на экране, чтобы показать, что внутри. Настройка фасада — «Редактировать фасад»',run:()=>setOpenDoors(o=>!o)},
        {id:'facade-decor',label:'Цвет',icon:Palette,hint:'Декор фасадов: '+mod.facadeDecor,disabled:!mod.doors,run:()=>{setActive(a.id);setMaterialTarget('facadeDecor');setModal('materials');}},
        {id:'handles',label:'Ручки',icon:GripHorizontal,hint:'Одна ручка на все фасады корпуса',disabled:!hasHandles(mod),run:()=>{setActive(a.id);setHandleFace('');setModal('handles');}},
        hinges,opening,...doorQuickItems(mod,c.sid,quickOps)]},
      {id:'copy',label:'Копия',icon:Copy,hint:'Такой же корпус рядом',run:()=>{const r=copyModuleGroup(project,[a.id]);if(commitProject(r.project))selectModule(r.ids[0]);}},
      {id:'rotate',label:'Повернуть',icon:RotateCw,hint:'На 90° по часовой',run:()=>{if(commitProject(rotateModule(project,a.id,(((a.rotation??0)+90)%360) as 0|90|180|270)))setFit(f=>f+1);}},
      // w-lwing (23.10): постановка второго крыла — к стене одним действием и продолжение ряда за угол
      ...(mod.worktop?[]:[{id:'to-wall',label:'Поставить к стене',icon:BrickWall,hint:'Фасадом в комнату, вплотную к стене — в ближайшее свободное место',children:(['back','left','right'] as Wall[]).map(w=>({id:'to-wall-'+w,label:`К ${WALL_LABEL[w]}`,icon:BrickWall,active:false,hint:`Повернуть фасадом в комнату и поставить вплотную к ${WALL_LABEL[w]} стене`,run:()=>moduleToWall(a.id,w)}))} as RadialItem]),
      ...(()=>{const turns=mod.worktop?[]:cornerTurns(project,a.id);if(!turns.length)return [];const other=active!==a.id&&project.modules.some(x=>x.id===active)?project.modules.find(x=>x.id===active):undefined;
        return [{id:'around-corner',label:'Продолжить ряд за угол',icon:CornerDownRight,hint:'Крайний модуль ряда: следующий — на соседнюю стену от угла, за глубиной этого ряда',children:turns.flatMap(t=>[{id:'corner-copy-'+t.wall,label:`Такой же ${t.label}`,icon:Copy,hint:`Копия «${mod.name}» на ${WALL_LABEL[t.wall]} стене от угла, фасадом в комнату`,run:()=>aroundCorner(a.id,t)},...(other?[{id:'corner-move-'+t.wall,label:`Перенести «${other.module.name}»`,icon:CornerDownRight,hint:`Выбранный модуль — на ${WALL_LABEL[t.wall]} стену от угла`,run:()=>aroundCorner(a.id,t,other.id)}]:[])])} as RadialItem];})(),
      quickMenuApplies(mod)?upperItem(quickOps):{id:'upper',label:'Антресоль',icon:ArrowUpToLine,hint:'Корпус сверху той же ширины',run:quickOps.addUpper},
      {id:'delete',label:'Удалить',icon:Trash,danger:true,disabled:project.modules.length===1&&!onEmptyProject,hint:'Убрать корпус. Вернуть — Ctrl+Z',run:()=>{commitProject({...project,modules:project.modules.filter(x=>x.id!==a.id)});}},
    ];
    out.ring=bodyRing;
    const facades:RadialItem={...bodyRing.find(item=>item.id==='facades')!,label:'Фасад'};
    const body:RadialItem={id:'body',label:'Корпус',icon:Box,hint:'Размеры, наполнение и действия со всем корпусом',children:bodyRing.filter(item=>item.id!=='facades')};
    const facadeMenu=(items:RadialItem[]):RadialItem[]=>[
      {id:'facade',label:'Фасад',icon:DoorOpen,hint:'Материал, ручки, петли и открывание выбранного фасада',children:items.filter(item=>item.id!=='body'&&item.id!=='hide-module')},body,
    ];
    if(mod.kupe){
      // Двери купе: своё кольцо — наполнение, количество дверей, доводчики, сдвинуть, профиль, размеры, копия, удалить.
      const k=mod.kupe,setK=(patch:Partial<NonNullable<Module['kupe']>>)=>modifyAt(a.id,n=>{n.kupe={...n.kupe!,...patch};});
      const fillItem=(name:string,label:string):RadialItem=>({id:'kf-'+name,label,icon:Palette,active:k.fills.every(f=>f===name),hint:name,run:()=>setK({fills:[name],sectionFills:undefined})});
      const panel=()=>{selectModule(a.id);setTab('module');};
      return {title:'Двери купе',subtitle:`${mod.width} × ${mod.height} · ${k.doors} дв.`,items:[hideItem,
        {id:'kupe-fill',label:'Наполнение',icon:Palette,hint:'Зеркало, стекло, ЛДСП — для всех дверей',children:[fillItem('Зеркало Серебро 4мм','Зеркало'),fillItem('Зеркало Бронза 4мм','Бронза'),fillItem('Зеркало Графит 4мм','Графит'),fillItem('Стекло сатин матовый 4мм','Сатин'),fillItem(mod.decor,'ЛДСП корпуса'),{id:'kf-more',label:'Другое…',icon:SlidersHorizontal,hint:'Весь каталог наполнений и разное по дверям',run:panel}]},
        {id:'kupe-doors',label:'Дверей',icon:Columns2,hint:`Сейчас ${k.doors}, полотно ${Math.round(kupeLeafWidth(mod.width,k.doors,kupeSystem(k)).width)} мм с нахлёстом`,children:[2,3,4,5].map(n=>({id:'kd-'+n,label:String(n),icon:Columns2,active:k.doors===n,hint:`Полотно ${Math.round(kupeLeafWidth(mod.width,n,kupeSystem(k)).width)} мм с нахлёстом`,run:()=>setK({doors:n,fills:k.fills.slice(0,n)})}))},
        {id:'kupe-soft',label:k.softClose?'Без доводчиков':'Доводчики',icon:Hand,hint:'Плавное закрывание дверей',run:()=>setK({softClose:k.softClose?undefined:true})},
        {id:'kupe-open',label:openDoors?'Закрыть':'Сдвинуть',icon:openDoors?DoorClosed:DoorOpen,hint:'Посмотреть, что внутри',run:()=>setOpenDoors(o=>!o)},
        {id:'kupe-panel',label:'Профиль',icon:SlidersHorizontal,hint:'Система, цвет профиля, секции — справа',run:panel},
        {id:'size',label:'Размеры',icon:Ruler,hint:`Проём ${mod.width} × ${mod.height} мм`,children:[size('width','Ширина'),size('height','Высота')]},
        {id:'copy',label:'Копия',icon:Copy,hint:'Ещё такой же комплект',run:()=>{const r=copyModuleGroup(project,[a.id]);if(commitProject(r.project))selectModule(r.ids[0]);}},
        {id:'delete',label:'Удалить',icon:Trash,danger:true,disabled:project.modules.length===1&&!onEmptyProject,hint:'Убрать двери купе. Вернуть — Ctrl+Z',run:()=>{commitProject({...project,modules:project.modules.filter(x=>x.id!==a.id)});}},
      ]};
    }
    const part=(label:string)=>({remove:{id:'remove',label:'Удалить',icon:Trash,danger:true,hint:label+': убрать. Вернуть — Ctrl+Z',run:()=>{try{if(commitProject(removePart(project,a.id,c.sid,pid)))setSelectedPart(null);}catch(e){setError((e as Error).message);}}} as RadialItem,
      copy:{id:'copy-part',label:'Копия',icon:Copy,hint:'Ещё такой же элемент в этой секции (если есть место)',run:()=>{try{const r=duplicatePart(project,a.id,c.sid,pid);commitProject(r.project);}catch(e){setError((e as Error).message);}}} as RadialItem,
      up:{id:'up',label:'Выше',icon:ArrowUp,hint:'Поднять на 32 мм (шаг полкодержателя)',run:()=>moveFilling(a.id,c.sid,pid,32)} as RadialItem,
      down:{id:'down',label:'Ниже',icon:ArrowDown,hint:'Опустить на 32 мм',run:()=>moveFilling(a.id,c.sid,pid,-32)} as RadialItem,
      params:{id:'params',label:'Параметры',icon:SlidersHorizontal,hint:'Все настройки справа',run:()=>{select();setSelectedPart({mid:a.id,sid:c.sid,pid});setTab('section');setMode('fill');}} as RadialItem});
    if(/:shelf:\d+$/.test(pid)){
      const j=Number(pid.split(':shelf:')[1]),isFixed=!!sec.fixed?.includes(j),p=part('Полка');
      return {title:'Полка '+(j+1),subtitle:mod.name,items:[p.up,p.down,p.copy,{id:'fixed',label:isFixed?'Съёмная':'Жёсткая',icon:isFixed?LockOpen:Lock,hint:isFixed?'Сделать съёмной: на полкодержателях':'Закрепить на конфирматах: держит корпус',run:()=>modifyAt(a.id,n=>{const s=n.sections.find(x=>x.id===c.sid)!;const f=new Set(s.fixed??[]);if(isFixed)f.delete(j);else f.add(j);s.fixed=f.size?[...f].sort((x,z)=>x-z):undefined;})},p.params,body,p.remove]};
    }
    if(/^kd:\d+:facade$/.test(pid))return {title:'Фасад ящика',subtitle:mod.name,items:facadeMenu([editFacade])};
    if(pid.includes(':drawer:')){
      const j=Number(pid.split(':drawer:')[1].split(':')[0]),cfg=drawerConfig(mod,sec,j),cur=slideSystem(cfg),p=part('Ящик');
      const slideItem=(id:string):RadialItem=>{const s=SLIDE_SYSTEMS.find(x=>x.id===id)!,q=slidePrice({slide:s.slide,operation:s.motion,brand:s.brand,length:cfg.length});return {id:'slide-'+id,label:s.slide==='ball'?SLIDE_MOTIONS[s.motion].replace(/^./,ch=>ch.toUpperCase()):SLIDE_BRANDS[s.brand]+(s.motion==='push'?' · push':' · доводчик'),icon:s.motion==='push'?MousePointerClick:Spline,active:cur.id===id,hint:s.label+(q.price===null?' · цена требует уточнения':''),run:()=>modifyAt(a.id,n=>{const ns=n.sections.find(x=>x.id===c.sid)!;ns.drawerConfigs=Array.from({length:ns.drawers},(_,k)=>k===j?withSlideSystem(n,ns,{...drawerConfig(n,ns,k)},id):{...drawerConfig(n,ns,k)});})};};
      const slides:RadialItem={id:'slides',label:'Направляющие',icon:Spline,hint:'Сейчас: '+cur.label,children:[
        {id:'ball',label:'Шариковые',icon:Spline,hint:'GTV: с доводчиком, без, push',active:cur.slide==='ball',children:SLIDE_SYSTEMS.filter(s=>s.slide==='ball').map(s=>slideItem(s.id))},
        {id:'hidden',label:'Скрытые',icon:Spline,hint:'Unihopper, DTC, Premial',active:cur.slide==='gtv0fpo',children:SLIDE_SYSTEMS.filter(s=>s.slide==='gtv0fpo').map(s=>slideItem(s.id))}]};
      const capOn=hasDrawerCap(mod,sec),capItem:RadialItem={id:'drawer-cap',label:capOn?'Убрать полку сверху':'Полка над ящиками',icon:Rows3,disabled:!!mod.kitchen||!!mod.corner||!!mod.raw||(!capOn&&!!sec.drawerConfigs?.every(x=>x.tray)),
        hint:capOn?'Ящики без полки над ними: полку уберут, ящики останутся на месте':'Поставить полку над ящиками; ящики до крыши опустятся под неё',run:()=>{setDrawerCapAt(a.id,c.sid,capOn?'off':'on');}};
      const drawerItems:RadialItem[]=[slides,{id:'drawer-handle',label:'Ручка',icon:GripHorizontal,hint:'Ручка этого ящика',disabled:!!cfg.noFacade||!!cfg.mesh,run:()=>{setActive(a.id);setHandleFace(`${c.sid}:drawer:${j}:facade`);setModal('handles');}},capItem,p.up,p.down,p.copy,p.params,p.remove];
      return {title:'Ящик '+(j+1),subtitle:mod.name+' · '+cur.label,items:pid.endsWith(':facade')?
        [...facadeMenu([editFacade,drawerItems[1]]),{id:'drawer',label:'Ящик',icon:Archive,hint:'Направляющие и положение ящика',children:drawerItems.filter(item=>item.id!=='drawer-handle')}]:[...drawerItems,body]};
    }
    if(pid.includes(':door:')||/:(hingecup|hingearm|hingeplate):/.test(pid)||pid.includes(':handle:')){
      const doorId=pid.replace(/:(hingecup|hingearm|hingeplate|handle):/,':door:').replace(/(:door:\d+):\d+$/,'$1'),p={...part('Фасад')};
      const currentHinge=parts(mod).find(p=>p.id===doorId)?.hinge;
      const doorOpening:RadialItem={...opening,hint:'Сторона петель и подъёмный механизм выбранного фасада',children:[
        ...(['left','right','bottom'] as const).map(side=>({id:'hinge-side-'+side,label:side==='left'?'Петли слева':side==='right'?'Петли справа':'Петли снизу',icon:DoorOpen,active:currentHinge===side,hint:'Только выбранный фасад; ручка переходит на свободный край',run:()=>modifyAt(a.id,n=>setDoorHinge(n,doorId,side))})),
        {id:'hinge-top',label:'Петли сверху',icon:ArrowUp,children:([{id:'adagio',label:'Газлифты АДАЖИО'},{id:'sempre',label:'Подъёмник СЕМПРЕ'}] as const).map(l=>({id:l.id,label:l.label,icon:ArrowUp,hint:'Premial · усилие и цена требуют подбора',run:()=>modifyAt(a.id,n=>setDoorHinge(n,doorId,'top',l.id))}))},
        ...(opening.children??[]),
      ]};
      const hf=doorHandleFloorInfo(mod,doorId),elev=Math.round(a.y??0);
      const handleBase:RadialItem[]=[
        {id:'handle-pick',label:'Выбрать ручку',icon:GripHorizontal,hint:'Каталог ручек для этого фасада',run:()=>{setActive(a.id);setHandleFace(doorId);setModal('handles');}},
        {id:'handle-floor',label:'Высота от пола…',icon:Ruler,disabled:!hf,hint:hf?`Сейчас ${hf.value+elev} мм от пола до ${hf.long?'низа':'центра'} ручки${hf.set?'':' (по правилу)'}`:'Только у вертикальной ручки распашного фасада',run:()=>{if(!hf)return;select();editDimension(`Высота ручки от пола до ${hf.long?'низа':'центра'}, мм`,hf.set||hf.long?hf.value+elev:RULES.handleFloorStd,v=>modifyAt(a.id,n=>setDoorHandleFloor(n,doorId,v-elev)));}},
        {id:'handle-floor-rule',label:'Высота по правилу',icon:RotateCcw,disabled:!hf?.set,hint:hf?.long?'Длинная ручка — низом на 100 мм от пола (не ниже низа двери + 50)':'По центру фасада',run:()=>modifyAt(a.id,n=>setDoorHandleFloor(n,doorId,null))},
      ];
      // расположение ручки (запрос Макса 20.10): у верхних модулей варианты «снизу» первыми, у остальных — «сверху»; «По правилу» — как раньше
      const dsec=mod.sections.find(x=>x.id===c.sid),dk=Number(doorId.split(':door:')[1]),curPos=dsec?doorHandlePos(mod,dsec,dk):'rule',upper=isUpperModule(mod);
      const posOrder:HandlePos[]=upper?['bottomCenter','bottomCorner','topCenter','topCorner','rule']:['topCorner','topCenter','bottomCorner','bottomCenter','rule'];
      const posItems:RadialItem[]=posOrder.map(pos=>{const issue=handlePosIssue(mod,doorId,pos);return {id:'handle-pos-'+pos,label:HANDLE_POS_LABEL[pos],icon:pos==='rule'?RotateCcw:GripHorizontal,active:curPos===pos,disabled:!!issue,
        hint:issue??(pos==='rule'?'Как раньше: по центру высоты у кромки открывания (или высота от пола, место ручки из проекта Базиса)':pos.endsWith('Corner')?'Вертикально у кромки открывания, напротив петель; перевесили петли — ручка переезжает сама':'Горизонтально по центру ширины фасада'),
        run:()=>modifyAt(a.id,n=>setDoorHandlePos(n,doorId,pos))};});
      const doorHandle:RadialItem={id:'door-handle',label:'Ручка',icon:GripHorizontal,hint:'Ручка этого фасада: модель, расположение и высота от пола',disabled:mod.doorOpen==='push',children:[
        ...(upper?posItems.slice(0,2):[]),...handleBase,...(upper?posItems.slice(2):posItems),
        {id:'handle-pos-all',label:'Для всех фасадов модуля',icon:Layers,hint:`Расположение «${HANDLE_POS_LABEL[curPos]}» — всем распашным фасадам этого модуля`,run:()=>modifyAt(a.id,n=>{setModuleHandlePos(n,curPos);})},
      ]};
      return {title:'Фасад',subtitle:mod.name,items:facadeMenu([editFacade,doorHandle,
        hinges,doorOpening,...doorQuickItems(mod,c.sid,quickOps),{id:'facade-decor',label:'Цвет',icon:Palette,hint:'Декор фасадов: '+mod.facadeDecor,run:()=>{setActive(a.id);setMaterialTarget('facadeDecor');setModal('materials');}},
        {id:'doors-toggle',label:openDoors?'Закрыть створки':'Открыть створки',icon:openDoors?DoorClosed:DoorOpen,hint:'Только вид: распахнуть створки на экране, чтобы показать, что внутри. Настройка фасада — «Редактировать фасад»',run:()=>setOpenDoors(o=>!o)},
        {...p.params,run:()=>{select();setSelectedPart({mid:a.id,sid:c.sid,pid:doorId});setTab('section');}},body,
        {...p.remove,run:()=>{try{if(commitProject(removePart(project,a.id,c.sid,doorId)))setSelectedPart(null);}catch(e){setError((e as Error).message);}}}])};
    }
    // Перегородка (решение Макса 23.10.2026): во всю высоту или частичная — «от … до …» мм от пола, от полки / до полки
    if(/:divider(:under|:over)?$/.test(pid)&&quickMenuApplies(mod)&&!mod.sectionLayout){
      const dsid=pid.split(':')[0],di=mod.sections.findIndex(s=>s.id===dsid),info=dividerInfo(mod,di),p=part('Перегородка');
      if(info){
        const askRange=()=>{select();editDimension('Перегородка от, мм от пола',Math.round(info.partial?info.from:info.bottom+Math.round((info.top-info.bottom)*0.3)),v=>{const from=v;setTimeout(()=>editDimension('Перегородка до, мм от пола',Math.round(info.partial?info.to:info.bottom+Math.round((info.top-info.bottom)*0.75)),w=>{let notes:string[]=[];if(modifyAt(a.id,n=>{notes=setPartialDivider(n,dsid,{from,to:w});}))announceDividerNotes(notes);return true;}),0);return true;});};
        const cur=(n:Module,edge:'lo'|'hi')=>{const bs=dividerBounds(n,di),it=dividerInfo(n,di)!;if(!it.partial)return bs.find(x=>x.key===(edge==='lo'?'floor':'roof'))!;const y=edge==='lo'?(it.from===it.bottom?it.from:it.from-8):(it.to===it.top?it.to:it.to+8);return bs.find(x=>Math.abs(x.y-y)<9)??bs.find(x=>x.key===(edge==='lo'?'floor':'roof'))!;};
        const bs=dividerBounds(mod,di);
        const pick=(edge:'lo'|'hi'):RadialItem=>({id:'divider-'+(edge==='lo'?'from':'to'),label:edge==='lo'?'От полки':'До полки',icon:edge==='lo'?ArrowDown:ArrowUp,disabled:bs.length<3,hint:bs.length<3?'В секциях у перегородки нет полок — задайте «Частичная…» в мм':edge==='lo'?'Нижняя опора перегородки: дно или полка — она станет сквозной горизонталью':'Верхняя опора перегородки: полка или крыша',
          children:bs.filter(b=>b.key!==(edge==='lo'?'roof':'floor')).map(b=>({id:'divider-'+edge+'-'+b.key,label:b.label,icon:Rows3,hint:edge==='lo'?'Перегородка от этой горизонтали':'Перегородка до этой горизонтали',
            run:()=>{let notes:string[]=[];if(modifyAt(a.id,n=>{const nb=dividerBounds(n,di),one=nb.find(x=>x.key===b.key)!,other=cur(n,edge==='lo'?'hi':'lo');notes=setDividerByShelves(n,dsid,edge==='lo'?one.bound:other.bound,edge==='lo'?other.bound:one.bound);}))announceDividerNotes(notes);}}))});
        return {title:info.partial?`Перегородка ${Math.round(info.from)}–${Math.round(info.to)}`:'Перегородка',subtitle:mod.name,items:[
          {id:'divider-full',label:'Во всю высоту',icon:Columns2,active:!info.partial,hint:'От дна до крыши, как раньше',run:()=>modifyAt(a.id,n=>{setPartialDivider(n,dsid,null);})},
          {id:'divider-partial',label:'Частичная…',icon:Ruler,active:info.partial,hint:'«От» и «до» в мм от пола. Над и под перегородкой полки — во всю ширину двух секций',run:askRange},
          pick('lo'),pick('hi'),
          {...p.params,hint:'Перегородки секции — справа, в «Наполнении»'},body]};
      }
    }
    if(pid.endsWith(':rod')||pid.includes(':flange:')){
      const p=part('Штанга');
      return {title:'Штанга',subtitle:mod.name,items:[p.up,p.down,p.params,body,{...p.remove,run:()=>{try{if(commitProject(removePart(project,a.id,c.sid,c.sid+':rod')))setSelectedPart(null);}catch(e){setError((e as Error).message);}}}]};
    }
    return {title:mod.name,subtitle:`${mod.width} × ${mod.height} × ${mod.depth} · секция ${sidx+1}`,items:[facades,body]};
  }
  // Папка клиента: новый проект сразу пишется в браузер под своим ключом, а вкладка получает цену без ожидания первой правки.
  useEffect(()=>{
    if(saveManagedProject)return;
    if((projectKey||onProjectChange)&&!startup.currentRaw&&!startup.storageUnavailable){try{lastLocalWrite.current=persistProject(localStorage,project,undefined,null,KEY);}catch{/* хранилище недоступно — сохранится при первой правке */}}
    onProjectChange?.(project);
  },[]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!touched.current) return;
    if(saveManagedProject){setSaved('Комната сохранена в браузере');return;}
    if(startup.storageUnavailable){setSaved("Не сохранено");setError("При запуске не удалось прочитать хранилище. Автосохранение отключено, чтобы не заменить недоступный проект. Скачайте текущую работу и перезагрузите редактор.");return;}
    try {
      lastLocalWrite.current=persistProject(localStorage,project,startup.damaged,lastLocalWrite.current,KEY);
      onProjectChange?.(project);
      setSaved("Сохранено в браузере");
    } catch (error) {
      setSaved("Не сохранено");
      setError(error instanceof ProjectStorageConflict?error.message:"Хранилище браузера недоступно. Сохраните модуль кнопкой «Скачать».");
    }
  }, [project]);
  /** Esc по шагам (п.19 волны 22.10): открытое меню/окно → тяга (Scene помечает событие) → режим подсветки → выделение детали → выделение модуля.
   *  Окна, круговое меню, меню зазора и режим подсветки закрываются своими обработчиками — здесь их только пропускаем. */
  function escapeStep(e:KeyboardEvent){
    if(ctxMenu||gapMenu||lightMode)return;
    if(composer){e.preventDefault();setComposer(null);return;}
    if(environmentSelection){e.preventDefault();setEnvironmentSelection(null);return;}
    // K8 (критик 22.10): клик по секции в «Наполнении» выбирает задник — у такой детали нет ни плашки, ни своей подсветки, и первое Esc
    // «ничего не делало». Невидимое выделение детали снимается вместе с выделением модуля — сразу «Ничего не выбрано», как в других режимах.
    if(selectedPart&&!canRemove&&!drawerPreview&&!selectedOpening&&!selectedObstacle&&!selectedFixture){e.preventDefault();setSelectedPart(null);setDrawerIndex(null);setGroupIds([]);setDeselected(true);return;}
    if(selectedPart||drawerPreview||selectedOpening||selectedObstacle||selectedFixture){e.preventDefault();setSelectedPart(null);setDrawerIndex(null);setDrawerPreview(false);setSelectedOpening(undefined);setSelectedObstacle(undefined);setSelectedFixture(undefined);return;}
    if(!deselected||liveGroupIds.length){e.preventDefault();setGroupIds([]);setDeselected(true);}
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || editsText(e.target)) return;
      const command=historyShortcut(e);
      if(presentation){
        if(e.key==='Escape'){e.preventDefault();changePresentation(false);}
        if(e.key==='Delete'||command)e.preventDefault();
        return;
      }
      if(command){e.preventDefault();command==='undo'?undo():redo();return;}
      if(direct||modal)return;
      if(e.key==='Delete'&&!modal&&canRemove){e.preventDefault();removeSelected();}
      if (e.key === "Escape") {escapeStep(e);return;}
      // W/A/S/D/Q/E — виды сцены (п.28 волны 22.10); в полях ввода и списках не срабатывают
      const v=viewShortcut(e);
      if(v&&!ctxMenu&&!gapMenu){e.preventDefault();setView(v);setRoomPlan(false);setFit(f=>f+1);}
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
  function preset(type: "shelves" | "wardrobe" | "drawers" | "empty" | "desk") {
    // сырой модуль Базиса: шаблон раньше копировал модуль вместе с raw и молча писал шаг в историю (1/1 → 2/2), ничего не меняя
    if (m.raw) { setError(RAW_FILLING_MESSAGE); return; }
    if (type === "desk") { const n = deskModule(m); if (commit(n)) { setSelected(n.sections[0].id); setTab("module"); } return; }
    const n = {...structuredClone(m),sections:[section()]};
    delete n.desk; if (m.desk) { n.height = 2000; n.doors = true; delete n.plinthHeight; delete n.bottomType; delete n.backType; }
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
    if(m.sectionLayout){modify(n=>resizeOpening(n,selectedId,width));return;}
    if (m.sections.length === 1) {
      modify(n=>n.width=width+2*RULES.panel);
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
  async function localBackup(){try{const response=await fetch('/__local-project-backup',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Backup-Token':document.querySelector<HTMLMetaElement>('meta[name=local-backup-token]')?.content??''},body:JSON.stringify({project:withPriceStamp(project),image:capture.current?.()})});const result=await response.json();if(!response.ok)throw Error(result.error);setSaved('Резервная копия: '+result.path);}catch(e){setError('Не удалось сохранить резервную копию: '+String(e));}}
  function download() {
    const blob = new Blob([JSON.stringify(withPriceStamp(project), null, 2)], {
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
    <div className={'app'+(presentation?' presentation':'')+(advanced?' advanced':'')+(kitchenMode?' kitchen-mode':'')+(compactTop?' compact-top':'')} data-stage={stage} style={{'--stage':STAGES[stageIndex(stage)].color} as React.CSSProperties}>
      <ManagerMode.Provider value={advanced}>
      <header className="header">
        <EditorBrand kitchen={kitchenMode}/>
        {!presentation&&<button className="top-toggle" aria-label={compactTop?"Заказ и инструменты":"Свернуть верхнюю панель"} aria-expanded={!compactTop} onClick={toggleTop} title="Свернуть или раскрыть управление заказом и комнатами">{compactTop?<PanelTopOpen size={18}/>:<PanelTopClose size={18}/>}<span>{compactTop?'Заказ и инструменты':'Свернуть верхнюю панель'}</span></button>}
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
        {!presentation && <div className="history" title="История изменений проекта. Отмена — Ctrl+Z, повтор — Ctrl+Shift+Z">
          <button title="Шаг назад · Ctrl+Z" aria-label="Отменить" disabled={managedHistory?managedHistory.undoCount===0:cursor===0} onClick={undo}><Undo2 size={16} /><span className="history-label">Назад</span></button>
          {/* счётчик шагов «2/2» клиенту не нужен (аудит магазина): остаются «Назад» и «Вперёд» */}
          <button title="Шаг вперёд · Ctrl+Shift+Z" aria-label="Повторить" disabled={managedHistory?managedHistory.redoCount===0:cursor===history.length-1} onClick={redo}><span className="history-label">Вперёд</span><Redo2 size={16} /></button>
        </div>}
        <div className="header-actions">
          <button className="outline presentation-trigger" onClick={()=>changePresentation(!presentation)}>{presentation?'Вернуться к редактору':'Показать клиенту'}</button>
          {!saveManagedProject&&<button className="outline" onClick={()=>setModal("cloud")}>Кабинет</button>}
          <button className="outline documents-action" aria-label="Выдать документы" title="Карты листов, деталировка и КП" onClick={() => {if(roomPlan){setRoomPlan(false);setView("iso");setShowRoom(true);}setOutputTab("sheets");setModal("output");}}>
            <Layers size={16} /> <span>Выдать документы</span>
          </button>
          <button
            className="quiet"
            aria-label="Открыть"
            onClick={() => upload.current?.click()}
          >
            <Upload size={16} />
            <span>{saveManagedProject?'Заменить мебель комнаты':'Открыть'}</span>
          </button>
          {import.meta.env.DEV&&<button className="outline" onClick={localBackup}>Резервная копия</button>}
          <button className="primary" aria-label="Сохранить проект файлом" title="Скачать проект для открытия на другом компьютере. Автосохранение работает в этом браузере." onClick={download}>
            <Download size={16} />
            <span>{saveManagedProject?'Скачать комнату':'Сохранить файл'}</span>
          </button>
        </div>
      </header>
      {!presentation&&<div className="editor-order-area" hidden={compactTop}>{clientBar}</div>}
      {/* K9 (критик 22.10): на этапах «Помещение»/«Объекты» свойства выбранного объекта уже в правой панели — плашку не показываем */}
      {!presentation&&!environmentSelection&&stage!=='room'&&stage!=='fixtures'&&(selectedOpening||selectedFixture||selectedObstacle)&&<button className="environment-properties-trigger" onClick={()=>setEnvironmentSelection(selectedOpening?{kind:'opening',id:selectedOpening}:selectedFixture?{kind:'fixture',id:selectedFixture}:{kind:'obstacle',id:selectedObstacle!})}>Свойства выбранного объекта</button>}
      {environmentSelection&&!presentation&&<RoomObjectProperties room={project.room} selection={environmentSelection} onChange={room=>commitProject({...project,room})} onClose={()=>setEnvironmentSelection(null)}/>}
      {!presentation&&<StageBar stage={stage} advanced={advanced} onStage={goStage} onAdvanced={setAdvanced} done={stageDone} rawSelected={!!m.raw}/>}
      {!presentation&&stage==='bodies'&&canRemove&&<div className="selection-action-bar" role="group" aria-label="Действия с выбранной деталью">
        <div className="selection-context"><strong>{selectedFillingName}</strong><span>{m.name} · секция {idx+1}</span></div>
        <button className="outline" onClick={()=>{setTab('section');requestAnimationFrame(()=>{const target=propertiesRef.current?.querySelector<HTMLElement>('.selected-filling');revealSettings(target);target?.scrollIntoView({block:'nearest'});target?.querySelector<HTMLInputElement>('input')?.focus();});}}>Параметры</button>
        {selectedDetail?.role!=='door'&&<><button className="outline" aria-label="Быстро опустить элемент на 10 мм" onClick={()=>nudgeSelected(-10)}>↓ 10 мм</button>
        <button className="outline" aria-label="Быстро поднять элемент на 10 мм" onClick={()=>nudgeSelected(10)}>↑ 10 мм</button></>}
        {selectedDetail&&/:shelf:|:drawer:/.test(selectedDetail.id)&&<button className="outline" onClick={copySelected}>Копировать</button>}
        {selectedDetail&&(selectedDetail.id.includes(':door:')||selectedDetail.id.endsWith(':facade'))&&<button className="outline" onClick={()=>{setHandleFace(selectedDetail.id);setMaterialScope('active');setModal('handles');}}>Ручка этого фасада</button>}
        <button className="text-action danger" onClick={removeSelected}>Удалить</button>
        <button className="text-action" aria-label="Снять выделение детали" onClick={()=>setSelectedPart(null)}>Закрыть</button>
      </div>}
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
            const raw=JSON.parse(text);
            if(isClientBundle(raw)){if(!onImportBundle)throw Error('Папку клиента открывайте в основном редакторе, без ссылки на отдельный проект.');onImportBundle(raw);return;}
            const imported = parseProject(raw);
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
      <WorkspacePanels>
        <aside className="library"><SafeBoundary label="Палитра и модули" resetKey={project}>
          <div className="panel-heading">
            <span className="eyebrow">КОНСТРУКЦИЯ</span>
            <h1>{(kitchenMode||kitchenModule||!!m.worktop)?'Соберите кухню':'Соберите шкаф'}</h1>
            <p>
              <span title="Габарит закрытой мебели Ш × В × Г: включает промежутки, задники, фасады и ручки.">Вся композиция:<br/><span style={{whiteSpace:'nowrap'}}>{Math.round(composition.w)} × {Math.round(composition.h)} × {Math.round(composition.d)} мм</span></span>
            </p>
          </div>
          <button className="text-action upper-add" onClick={()=>setModal("new")}>Новый проект / восстановить</button>
          {advanced&&<a className="text-action upper-add" href="?order=votan">Заказ Вотан · две угловые группы</a>}

          <div className="stage-note" data-stages="room fixtures"><b>{stage==='room'?'Начните с размеров комнаты':'Что мешает установке мебели?'}</b><p>{stage==='room'?'Введите размеры справа или нажмите на размер в сцене. Затем выберите следующий шаг сверху.':'Добавьте окна, двери и коммуникации справа. Если их нет, переходите к корпусам сверху.'}</p></div>
          <div data-stages="bodies"><ModulePalette source={m} fit={source=>rowShortage(project,source)} onAdd={source=>{const next=appendModule(project,source);next.modules.at(-1)!.module.name=newModuleName(source.name);if(!commitProject(next))return false;selectModule(next.modules.at(-1)!.id);setPlaceNote(offWallNote(next,[next.modules.at(-1)!.id]));return true;}} room={project.room} onAddGroup={(group,keep)=>{try{const r=appendModuleGroup(project,group,false,keep);if(!commitProject(r.project))return false;selectModule(r.ids[r.ids.length-1]);setFit(f=>f+1);return true;}catch(e){setError((e as Error).message);return false;}}} kitchenTemplates={<KitchenPalette project={project} source={m} commit={commitProject} onError={setError} onNote={setPlaceNote} onAdded={(ids,fit)=>{selectModule(ids[ids.length-1]);if(fit)setFit(f=>f+1);}}/>}/></div>
          <div className="project-modules" data-stages="bodies filling facades">
            {advanced&&<button className="primary full" onClick={() => addModule()}>
              <Plus size={17} /> Добавить модуль
            </button>}
            {(project.modules.length>6||moduleSearch)&&<label className="module-search"><input type="search" aria-label="Найти корпус в проекте" placeholder="Название, номер, размер…" value={moduleSearch} onChange={e=>setModuleSearch(e.target.value)}/><small>{visibleModules.length} из {project.modules.length} корпусов</small></label>}
            <p className="module-selection-hint">Ctrl + клик — выбрать несколько модулей.</p>{!!liveGroupIds.length&&<div><button className="outline" onClick={()=>{const id=liveGroupIds.includes(placed.id)?placed.id:liveGroupIds[0];selectModule(id);setModal("facade-editor");}}>Фасады выделенных ({liveGroupIds.length})</button><button className="text-action" onClick={()=>setGroupIds([])}>Снять выделение</button></div>}
            <div className="module-list" ref={moduleList}>
            {visibleModules.map(({a,i}) => (
              <button
                key={a.id}
                className={"module-item"+(hiddenIds.includes(a.id)?" module-hidden":"")+(liveGroupIds.includes(a.id)?" module-group-selected":"")}
                onContextMenu={e=>{e.preventDefault();setCtxMenu({mid:a.id,sid:a.module.sections[0]?.id??"",x:e.clientX,y:e.clientY});}}
                title={a.module.name}
                aria-pressed={!deselected&&a.id === placed.id}
                onClick={e=>{if(e.ctrlKey||e.metaKey){toggleModuleGroup(a.id);return;}selectModule(a.id);}}
              >
                <Box size={18} />
                <span>
                  <b>{a.module.name}</b>{liveGroupIds.includes(a.id)&&<small>В выделенной группе</small>}{hiddenIds.includes(a.id)&&<small className="hidden-module-note">Скрыт · нажмите, чтобы показать</small>}
                  <small>
                    {a.module.width} × {a.module.height} × {a.module.depth}
                    {a.module.raw&&<em className="module-badge" title="Детали и фурнитура — как в проекте Базиса; наполнение правится в Базисе">Базис · как есть</em>}
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
              <Copy size={14} /> Копировать с наполнением
            </button>
            <button className="text-action danger" disabled={project.modules.length===1&&!onEmptyProject} title="Удалить выбранный корпус. Ctrl+Z — отменить" onClick={()=>{if(commitProject({...project,modules:project.modules.filter(a=>a.id!==placed.id)}))setSelectedPart(null);}}><Trash2 size={14}/>Удалить выбранный модуль</button>
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
          <button className="text-action upper-add" data-stages="bodies" title={`Высота до 600 мм; под потолком остаётся ${MEASUREMENT_RULES.ceilingClearance} мм по СТП`} onClick={addUpper}><Plus size={16}/> Антресоль сверху</button>
          <button className="text-action upper-add" data-stages="bodies filling" onClick={()=>setModal("library")}>Моя библиотека модулей</button>
          {/* сырой модуль Базиса: вместо пресетов и кнопок наполнения — заметка; «Пересобрать модулем студии» появится вместе с распознавателем (ярус C) */}
          {!!m.raw&&<div className="stage-note raw-note" data-stages="bodies filling"><b>Модуль перенесён из Базиса как есть</b><p>Наполнение здесь не настраивается. Правится в Базисе (переимпорт). Положение в комнате, смета и раскрой работают как обычно. Кнопка «Пересобрать модулем студии» будет позже — когда появится распознаватель корпусов Базиса.</p></div>}
          <details hidden={!!m.corner||kitchenModule||!!m.worktop||!!m.raw} className="replace-filling" data-stages="filling"><summary>Заменить всё наполнение корпуса</summary>
          <div className="presets" data-stages="filling">
            {(
              [
                { type: "empty", title: "Пустой корпус", icon: Box },
                { type: "shelves", title: "Полочный", icon: Rows3 },
                { type: "wardrobe", title: "Платяной", icon: Shirt },
                { type: "drawers", title: "С ящиками", icon: Archive },
                { type: "desk", title: "Стол", icon: PanelTop },
              ] as const
            ).map((p) => (
              <button key={p.type} onClick={() => preset(p.type)}>
                <p.icon size={30} strokeWidth={1.3} />
                <span>{p.title}</span>
              </button>
            ))}
          </div>
          <p className="small-note" data-stages="filling">
            Шаблон заменит наполнение.
            <br />
            Изменение можно отменить.
          </p>
          </details>
          <div className="library-label section-title" data-stages="filling" hidden={!!m.raw}>
            Наполнение <span>в секцию {idx + 1}</span>
          </div>
          <div className="fill-buttons" data-stages="filling" hidden={!!m.kitchen||!!m.worktop||!!m.raw}>
            <button hidden={!!m.corner} draggable onDragStart={e=>startFill(e,'pantograph')} onClick={()=>dropFilling('pantograph',placed.id,selectedId,b.top-100)}><Shirt size={19}/><span>Пантограф</span><Plus size={15}/></button>
            <button draggable onDragStart={e=>startFill(e,'shelf')}
              onClick={()=>m.corner?dropFilling('shelf',placed.id,selectedId,(b.top+b.bottom)/2):setComposer('shelf')}
            >
              <Rows3 size={19} />
              <span>Добавить полку</span>
              <Plus size={15} />
            </button>
            <button draggable onDragStart={e=>startFill(e,'drawer')}
              onClick={()=>m.corner?dropFilling('drawer',placed.id,selectedId,b.bottom+drawerStackHeight(s)):setComposer('drawer')}
            >
              <Archive size={19} />
              <span>Добавить ящик</span>
              <Plus size={15} />
            </button>
            <div hidden={!!m.corner} className="mesh-add">
              <button draggable onDragStart={e=>startFill(e,'mesh')}
                onClick={()=>dropFilling('mesh',placed.id,selectedId,b.bottom+drawerStackHeight(s),meshChoice)}
              >
                <Archive size={19} />
                <span>Сетка Лемана Про</span>
                <Plus size={15} />
              </button>
              <select aria-label="Элемент Лемана Про" value={meshChoice} onChange={e=>setMeshChoice(e.target.value)}>
                {(['basket','trousers','shoes'] as const).map(kind=><optgroup key={kind} label={MESH_KIND_LABEL[kind]}>{MESH.filter(i=>i.kind===kind).map(i=><option key={i.id} value={i.id}>{i.label} · проём {i.reqW}×{i.reqD}</option>)}</optgroup>)}
              </select>
            </div>
            <button hidden={!!m.corner&&(m.corner.level==='upper'||idx!==2)} draggable onDragStart={e=>startFill(e,'rod')}
              onClick={() => {
                setTab("section");
                if(s.rod)modifySection(a=>{a.rod=false;delete a.rodAt;});else dropFilling('rod',placed.id,selectedId,b.top-RULES.rodTopOffset);
              }}
            >
              <Shirt size={19} />
              <span>{s.rod ? "Убрать штангу" : "Добавить штангу"}</span>
              {s.rod ? <Minus size={15} /> : <Plus size={15} />}
            </button>
            <button hidden={!!m.corner}
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
        </SafeBoundary></aside>
        <section className="viewport" aria-label="Рабочая область">
          <div className="view-header">
            <div className="view-tabs">
              {(
                [
                  { id: "iso", label: "3D", title: "Объёмный вид · клавиша Q или E" },
                  { id: "front", label: "Спереди", title: "Вид спереди · клавиша S" },
                  { id: "side", label: "Сбоку", title: "Вид справа · клавиша D (слева — A)" },
                  { id: "top", label: "Сверху", title: "Вид сверху · клавиша W" },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  title={v.title}
                  aria-pressed={!roomPlan&&(view === v.id||(v.id==='side'&&view==='left'))}
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
          <div className="interaction-bar" style={{display:roomPlan||(!advanced&&stage==='fixtures')?"none":undefined}}>{([{id:'select',label:'Выбрать',icon:Check},{id:'move',label:'Двигать корпуса',icon:Move3D},{id:'fill',label:'Наполнение',icon:Rows3},{id:'orbit',label:'Свободная камера',icon:RotateCcw}] as const).map(t=><button key={t.id} aria-pressed={mode===t.id} onClick={()=>{setMode(t.id);if(t.id==='fill')setOpenDoors(true)}}><t.icon size={16}/>{t.label}</button>)}<button aria-pressed={hideFacades} onClick={()=>setHideFacades(v=>!v)}>{hideFacades?'Показать фасады':'Скрыть фасады'}</button>{stage==='bodies'&&!m.corner&&<button className="gap-toggle" aria-label="Размеры проёмов между полками" aria-pressed={gapDimensions} onClick={()=>setGapDimensions(v=>!v)}>Проёмы</button>}</div>
          {hiddenIds.length>0&&!presentation&&<button className="restore-modules" onClick={()=>setHiddenModules([])}><Eye size={16}/>Показать все скрытые ({hiddenIds.length})</button>}
          <SafeBoundary label="Сцена" resetKey={project}>{roomPlan?<RoomPlan onToggleModule={toggleModuleGroup} hiddenModuleIds={hiddenIds} onModuleContext={(mid,x,y)=>{const a=project.modules.find(a=>a.id===mid)!;setCtxMenu({mid,sid:a.module.sections[0]?.id??"",x,y});}} onEnvironmentContext={(kind,id)=>setEnvironmentSelection({kind,id})} showModules={advanced||stage!=='fixtures'} groupIds={liveGroupIds} moveAll={moveAll} selectedObstacle={selectedObstacle} onObstacleSelect={id=>{setSelectedObstacle(id);setSelectedOpening(undefined);setSelectedFixture(undefined);}} selectedOpening={selectedOpening} onOpeningSelect={id=>{setSelectedOpening(id);setSelectedObstacle(undefined);setSelectedFixture(undefined);}} selectedFixture={selectedFixture} onFixtureSelect={id=>{setSelectedFixture(id);setSelectedObstacle(undefined);setSelectedOpening(undefined);}} onDimension={roomDimension} snapping={snapping} project={project} active={placed.id} onSelect={selectModule} onRoom={()=>setTab('room')} update={commitProject}/>:<Scene onToggleModule={toggleModuleGroup} hiddenModuleIds={hiddenIds} viewKey={viewKey}
            moveAll={moveAll}
            groupIds={liveGroupIds}
            mode={presentation||editingFacades?'orbit':mode}
            presentation={presentation||editingFacades}
            cutaway={cutaway}
            drawerPreview={!presentation&&drawerPreview&&s.drawers>0?{sid:s.id,index:Math.min(drawerIndex??0,s.drawers-1)}:undefined}
            snap={(mid,p)=>snapping?snapBodies(mid,p):{x:Math.round(p.x),y:Math.round(p.y),z:Math.round(p.z)}}
            onMoveModule={moveBody}
            moveProblem={(mid,p)=>projectErrors(movedBodies(mid,p))[0]}
            onMoveDivider={(mid,sid,delta)=>{try{return commitProject(moveDivider(project,mid,sid,delta));}catch(e){setError((e as Error).message);return false;}}}
            onMoveDividerEnd={(mid,sid,edge,delta)=>{try{const n=structuredClone(project),t=n.modules.find(x=>x.id===mid)!.module,notes=moveDividerEnd(t,sid,edge,delta),ok=commitProject(n);if(ok)announceDividerNotes(notes);return ok;}catch(e){setError((e as Error).message);return false;}}}
            dividerEndProblem={(mid,sid,edge,delta)=>{try{const n=structuredClone(project),t=n.modules.find(x=>x.id===mid)!.module;moveDividerEnd(t,sid,edge,delta);return validate(t)[0];}catch(e){return (e as Error).message;}}}
            dividerProblem={(mid,sid,delta)=>{try{moveDivider(project,mid,sid,delta);return undefined;}catch(e){return (e as Error).message;}}}
            partProblem={(mid,sid,pid,delta,to)=>{try{const next=to&&(to.mid!==mid||to.sid!==sid)?transferPart(project,mid,sid,pid,to.mid,to.sid,to.y):movePart(project,mid,sid,pid,delta);return projectErrors(next)[0];}catch(e){return (e as Error).message;}}}
            onMovePart={moveFilling}
            onDropItem={dropFilling}
            onTransfer={(mid,sid,pid,toMid,toSid,y)=>{try{const next=transferPart(project,mid,sid,pid,toMid,toSid,y);if(commitProject(next)){selectInserted(next,toMid,toSid,pid.includes(':pantograph:')?'pantograph':pid.includes(':drawer:')?'drawer':pid.includes(':shelf:')?'shelf':'rod');return true;}}catch(e){setError((e as Error).message);}return false;}}
            captureReady={(fn) => (capture.current = fn)}
            module={sceneProject.modules.find(a=>a.id===placed.id)?.module??m}
            arrangement={sceneProject.modules}
            activeId={placed.id}
            room={showRoom ? project.room : undefined}
            appliances={project.room.obstacles}
            onEnvironmentContext={(kind,id)=>setEnvironmentSelection({kind,id})}
            selectedObstacle={selectedObstacle}
            onObstacleSelect={id=>{setSelectedObstacle(id);setSelectedOpening(undefined);setSelectedFixture(undefined);setSelectedPart(null);setTab('room');}}
            selectedFixture={selectedFixture}
            onFixtureSelect={id=>{setSelectedFixture(id);setSelectedObstacle(undefined);setSelectedOpening(undefined);setSelectedPart(null);setTab('room');}}
            selectedOpening={selectedOpening}
            onRoomDimension={roomDimension}
            onModuleSelect={selectModule}
            transparent={presentation?false:transparent}
            clearFacades={presentation?false:clearFacades}
            hideFacades={!presentation&&(hideFacades||!!lightMode)}
            lightMode={!!lightMode&&!presentation}
            onLightPick={pickLight}
            hideFurniture={!advanced&&stage==='fixtures'}
            onDimension={(key) =>
              editDimension(
                key === "width"
                  ? "Ширина"
                  : key === "height"
                    ? "Высота"
                    : "Глубина",
                m[key],
                (v) => modify((n) => {n[key]=v;if(n.corner&&key!=='height'){n.width=v;n.depth=v;}if(n.kitchen?.column&&key!=='width')configureColumn(n);else if(n.kdrawers&&key!=='width')n.kdrawers=refitKDrawers(n,key==='depth'?'depth':'height');}),
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
              setDeselected(false);
              setActive(mid);
              chooseSection(sid);
              setSelectedPart({mid,sid,pid});
              if(mode!=="select"&&(pid.includes(":shelf:")||pid.includes(":drawer:")))setMode("fill");
              if (pid.includes(":drawer:")) {
                setDrawerIndex(Number(pid.split(":drawer:")[1].split(":")[0]));
              }
            }}
            onHandleClick={(mid,pid)=>{setActive(mid);setHandleFace(pid);setMaterialScope("active");setModal("handles");}}
            onContextMenu={(mid,sid,x,y,info)=>{if(mid!==placed.id)selectModule(mid);setCtxMenu({mid,sid,x,y,...info});}}
            onDrawerStack={(sid)=>{const sec=m.sections.find(s=>s.id===sid),bb=boxes(m).find(x=>x.id===sid);if(!sec||!bb)return;editDimension('От дна пенала до верха полки над ящиками',Math.round(drawerCapTop(m,sec)-bb.bottom),v=>{try{const configs=distributeDrawers(m,sec,bb.bottom+v);return modify(n=>{const target=n.sections.find(s=>s.id===sid);if(target)target.drawerConfigs=configs;});}catch(e){setError((e as Error).message);return false;}});}}
            selectedPart={!presentation&&selectedPart?.mid===placed.id?selectedPart.pid:undefined}
            selected={presentation||deselected?'':selectedId}
            onSelect={chooseSection}
            texture={texture(m.decor)}
            facadeTexture={texture(m.facadeDecor)}
            view={view}
            fit={fit}
            focusActive={!presentation&&focusActive}
            openDoors={openDoors}
            exploded={presentation?false:exploded}
            dimensions={presentation?false:dimensions&&!((stage==='room'||stage==='fixtures')&&!advanced)}
            roomDimensions={!presentation&&dimensions&&(advanced||stage==='room'||stage==='fixtures')}
            gapDimensions={gapDimensions}
            rowGaps={lightMode||deselected?null:rowGaps}
            onGapClick={(side,x,y)=>setGapMenu({side,x,y})}
            stretchable={!widthLock(m)&&!lightMode&&!deselected}
            stretchPlan={(mid,side,raw,snap)=>{try{return planStretch(project,mid,side,raw,snap);}catch(e){return {problem:(e as Error).message};}}}
            onStretch={(mid,side,raw,snap)=>{try{const plan=planStretch(project,mid,side,raw,snap);if(plan.problem){setError(plan.problem);return false;}return plan.project?commitProject(plan.project):false;}catch(e){setError((e as Error).message);return false;}}}
          />}</SafeBoundary>
          {presentation&&<div className="presentation-tools">{import.meta.env.DEV&&<button onClick={localBackup}>Резервная копия</button>}<button aria-pressed={showRoom} onClick={()=>setShowRoom(!showRoom)}>Помещение</button>{showRoom&&<button aria-pressed={cutaway} onClick={toggleCutaway}><BrickWall size={16}/>{cutaway?'Ближние стены: показать':'Ближние стены: скрыть'}</button>}<button aria-pressed={openDoors} onClick={()=>setOpenDoors(!openDoors)}>{openDoors?'Закрыть фасады':'Открыть фасады'}</button><button className="primary" onClick={()=>{try{const png=capture.current?.();if(!png){setError('Изображение ещё загружается. Повторите через несколько секунд.');return;}setRenderImage(png);setModal('render');}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить изображение. Попробуйте ещё раз.');}}}>Сохранить изображение</button></div>}
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
                <strong>{saved==="Не сохранено"?"Текущий вариант не сохранён":"Изменение не применено"}{errorDetails.length>1?` · ошибок: ${errorDetails.length}`:''}</strong>
                {errorDetails.length?<ol className="error-list" aria-label="Что мешает применить изменение">
                  {errorDetails.slice(0,5).map((d,i)=><li key={i} data-text={d.text}>
                    <p>{errorPlace(d)&&<b className="error-place">{errorPlace(d)}: </b>}{d.problem}{d.moduleId&&project.modules.some(a=>a.id===d.moduleId)&&<button className="error-show" aria-label={'Показать: '+errorPlace(d)} onClick={()=>showError(d)}><Search size={12}/> Показать</button>}</p>
                    {d.action&&<p className="error-fix"><b>Что сделать:</b> {d.action}{d.moduleId&&d.sectionId&&/«Одна створка в секции»/.test(d.action)&&<> <button className="error-show" onClick={()=>{if(modifyAt(d.moduleId!,n=>{if(!oneLeafAtDivider(n,d.sectionId!))throw Error('Секция не у частичной перегородки.');}))setError('');}}>Одна створка в секции</button></>}</p>}
                  </li>)}
                  {errorDetails.length>5&&<li className="error-more">…и ещё {errorDetails.length-5}. Исправьте эти — проверка покажет остальные.</li>}
                </ol>:<p>{error}</p>}
                {meshFit&&<button className="primary" onClick={()=>{try{const next=fitMeshItem(project,meshFit.mid,meshFit.sid,meshFit.meshId,meshFit.y);if(commitProject(next)){selectInserted(next,meshFit.mid,meshFit.sid,'mesh');setMeshFit(null);}}catch(e){setMeshFit(null);setError((e as Error).message);}}}>Подогнать ширину до {meshFit.width} мм и добавить</button>}
              </div>
              <button
                aria-label="Закрыть сообщение"
                onClick={() => {setError("");setMeshFit(null);}}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {notice&&!error&&<div className="error-banner place-note" role="status" data-testid="studio-note"><Info size={20}/><div><strong>{notice.title}</strong><p>{notice.text}</p></div><button aria-label="Закрыть сообщение" onClick={()=>setNotice(null)}><X size={17}/></button></div>}
          {placeNote&&!error&&<div className="error-banner place-note" role="status" data-testid="place-note"><Info size={20}/><div><strong>Модуль поставлен не у стены</strong><p>{placeNote}</p></div><button aria-label="Закрыть предупреждение" onClick={()=>setPlaceNote(null)}><X size={17}/></button></div>}
          {ctxMenu&&project.modules.some(x=>x.id===ctxMenu.mid)&&(()=>{const r=radialMenu(ctxMenu);
            /* находка 6: меню в области сцены и левее правой панели инструментов */
            const tools=document.querySelector('.scene-tools'),canvas=tools?.parentElement?.querySelector('canvas')??document.querySelector('canvas'),visible=(el:Element|null|undefined)=>{const b=el?.getBoundingClientRect();return b&&b.width>0?b:null;};
            const area=menuArea({width:window.innerWidth,height:window.innerHeight},visible(canvas),visible(tools),[visible(document.querySelector('.view-header')),visible(document.querySelector('.interaction-bar'))]); /* m1: верх области — под плавающими полосами вида */
            return <RadialMenu key={ctxMenu.x+":"+ctxMenu.y} x={ctxMenu.x} y={ctxMenu.y} title={r.title} subtitle={r.subtitle} items={r.items} area={area} onClose={()=>setCtxMenu(null)}/>;})()}
          {gapMenu&&rowGaps&&rowGaps[gapMenu.side].gap>0&&(()=>{const side=gapMenu.side,g=rowGaps[side],close=()=>setGapMenu(null),where=sideWord(side);
            return <div className="gap-menu-backdrop" onPointerDown={close} onContextMenu={e=>{e.preventDefault();close();}}>
              <div className="gap-menu" role="menu" aria-label={`Зазор ${where} ${g.gap} мм до ${g.to}`} style={{left:Math.max(8,Math.min(gapMenu.x-20,window.innerWidth-296)),top:Math.max(8,Math.min(gapMenu.y+14,window.innerHeight-200))}} onPointerDown={e=>e.stopPropagation()}>
                <div className="gap-menu-title">{where[0].toUpperCase()+where.slice(1)} {g.gap} мм до {g.to}</div>
                <button role="menuitem" autoFocus onClick={()=>{close();rowEdit(()=>fillGap(project,placed.id,side));}}>Дотянуть (+{fillAdd(g)} мм){g.filler?<small> — {fillerNote(g)}</small>:null}</button>
                {(()=>{const block=flushBlock(project,placed.id,side);return <button role="menuitem" disabled={!!block} title={block?`Нельзя: ${block}. Закрыть зазор — «Дотянуть»`:`Сдвинуть на ${g.gap} мм, ширина та же`} onClick={()=>{close();rowEdit(()=>flush(project,placed.id,side));}}>Придвинуть вплотную{block&&<small> — {block}</small>}</button>;})()}
                <button role="menuitem" title="Модуль сдвигается, ширина та же" onClick={()=>{close();askGapShift(placed.id,side,g);}}>Задать зазор — сдвинуть модуль…</button>
                <button role="menuitem" title={`Меняется ширина, ${side==='right'?'левый':'правый'} край на месте`} onClick={()=>{close();askGap(placed.id,side,g);}}>Задать зазор — изменить ширину…</button>
              </div></div>;})()}
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
            {showRoom&&<button aria-label="Ближние стены: скрыть" title={cutaway?'Ближние стены: показать (сейчас скрыты — стена между камерой и комнатой не видна)':'Ближние стены: скрыть (сейчас видны все стены)'} aria-pressed={cutaway} onClick={toggleCutaway}><BrickWall size={19}/></button>}
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
            {(m.doors || !!m.kdrawers?.length) && (
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
          <div className="section-picker" style={{display:!!m.worktop||roomPlan||(!advanced&&stage!=='filling')?"none":undefined}}>
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
          {lightMode&&!presentation&&(()=>{const lm=project.modules.find(x=>x.id===lightMode)?.module;if(!lm)return null;
            return <LightModeBar module={lm} orient={lightOrient} note={lightNote} onOrient={o=>{setLightOrient(o);setLightNote('');}} onTone={t=>modifyAt(lightMode,n=>applyToAll(n,{tone:t}))} onPanel={()=>setLightPanel(lightMode)} onDone={()=>{setLightMode(null);setLightNote('');}}/>;})()}
          {lightPanel&&(()=>{const lp=project.modules.find(x=>x.id===lightPanel)?.module;if(!lp)return null;
            return <LightPanel module={lp} onModify={u=>{modifyAt(lightPanel,u);}} onClose={()=>setLightPanel(null)} onMode={lightMode?undefined:()=>{setLightPanel(null);setLightNote('');setLightMode(lightPanel);}}/>;})()}
          {rmbTip&&!presentation&&!roomPlan&&(stage==='bodies'||stage==='filling'||stage==='facades')&&<div className="rmb-tip" role="status"><span>Нажмите на шкаф <b>правой кнопкой мыши</b> — откроется меню: размеры, полки, ящики, петли, цвет.</span><button onClick={hideRmbTip}>Понятно</button></div>}
          <div className="orbit-help" style={{display:roomPlan?"none":undefined}}>
            <RotateCcw size={13} /> {focusActive?"Крупный вид выбранного корпуса · ":""}{mode==='move'?(moveAll?'Тяните любой корпус — движется вся композиция':liveGroupIds.length?'Отмеченные корпуса двигаются вместе':snapping?'Тяните корпус · Alt — без привязки':'Тяните корпус · привязки отключены'):mode==='fill'?'Полки и ящики — по высоте, перегородки — по ширине':mode==='select'?'Нажмите на деталь, чтобы выбрать':'Перетащите, чтобы повернуть'} <span>·</span>{" "}
            Колесо — масштаб <span>·</span> Зажатое колесо — вращение <span>·</span> <span className="view-keys" title="W — сверху, S — спереди, A — слева, D — справа, Q или E — 3D. Esc — закрыть меню, отменить перетаскивание, снять выделение детали, затем модуля">W A S D — виды, Q — 3D, Esc — снять выделение</span> <span>·</span> <b className="rmb-hint">Правая кнопка — меню действий</b>
          </div>
        </section>
        <aside className="properties" ref={propertiesRef}><SafeBoundary label="Свойства" resetKey={project}>
          {editingFacades?<section className="facade-panel" role="region" aria-label="Редактор фасадов" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setModal(null);}}}>
            <header><h2>Редактор фасадов</h2><button className="text-action" aria-label="Закрыть редактор фасадов" onClick={()=>setModal(null)}><X size={18}/></button></header>
            <p className="facade-preview-note">Предпросмотр · камера доступна. Чтобы продолжить построение, примените изменения или отмените.</p>
            <FacadeEditor key={placed.id} project={project} moduleId={placed.id} selectedIds={liveGroupIds} commit={commitProject} close={()=>setModal(null)} onPreview={setFacadePreview}/>
          </section>:<>

          {composer&&<div><FillingComposer key={placed.id+selectedId+composer} module={m} sid={selectedId} kind={composer} onCancel={()=>setComposer(null)} onApply={(count,config,fit)=>{try{const next=composer==='drawer'&&fit&&config?addFittedDrawers(project,placed.id,selectedId,count,config):addFillingBatch(project,placed.id,selectedId,composer,count,config);if(commitProject(next)){selectInserted(next,placed.id,selectedId,composer);setComposer(null);return true;}}catch(e){setError((e as Error).message);}return false;}}/></div>}
          {tab!=='room'&&!nothingSelected&&!m.raw&&!m.worktop&&!m.kupe&&<div className="selected-module-heading"><strong>{m.name}</strong><label>Секция<select aria-label="Выбранная секция" value={selectedId} onChange={e=>chooseSection(e.target.value)}>{m.sections.map((section,i)=><option key={section.id} value={section.id}>Секция {i+1}</option>)}</select></label></div>}
          {tab === "room" ? (
            <div className="property-section">
              <h2>{stage==='fixtures'&&!advanced?'Окна, двери и коммуникации':'Замер помещения'}</h2>
              <div data-stages="room bodies filling facades docs"><details className="measurement-fields"><summary>Точки замера и кривые стены</summary><RoomSurveyEditor room={project.room} onChange={room=>commitProject({...project,room})}/></details>
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
              <details className="measurement-fields"><summary>Мебель в нише · вычеты СТП</summary><p className="field-note">Введите минимальные размеры по нескольким точкам. Отклонение стены измеряется относительно уровня.</p>{!project.measurement?.niche?<button className="outline" onClick={()=>commitProject({...project,measurement:{number:'',date:'',notes:'',...project.measurement,niche:{width:project.room.width,height:project.room.height,depth:project.room.depth,deviation:0}}})}>Рассчитать по замеру</button>:<>{(['width','height','depth','deviation'] as const).map(k=><NumberField key={k} label={{width:'Минимальная ширина ниши',height:'Нижняя точка потолка',depth:'Минимальная глубина ниши',deviation:'Отклонение стены'}[k]} value={k==='deviation'?project.measurement!.niche![k]:nicheMinimum(project.measurement!.niche!,k)} min={k==='deviation'?0:500} max={k==='deviation'?300:20000} onChange={v=>commitProject({...project,measurement:{...project.measurement!,niche:{...project.measurement!.niche!,[k]:v,readings:Object.fromEntries(Object.entries(project.measurement!.niche!.readings??{}).filter(([axis])=>axis!==k))}}})}/>)}<NicheReadings niche={project.measurement!.niche!} onApply={niche=>commitProject({...project,measurement:{...project.measurement!,niche}})}/>{(()=>{const fit=nicheSize(project.measurement!.niche!,project.room.ceiling);return <div className="niche-result"><strong>Предельные габариты мебели</strong><p>{fit.width} × {fit.height} × {fit.depth} мм</p><small>Ширина −{fit.side}, высота −{ceilingClearance(project.room.ceiling)}, глубина −5 мм. Предел редактора для одного корпуса — {RULES.maxW} × {RULES.maxH} мм; логистику крупных корпусов проверьте отдельно.</small></div>;})()}<p className="field-note">При отклонении ровно 10 мм выбран запас 15 мм. Проверьте светильники, выступы и карнизы. Расчёт не меняет размеры комнаты и модулей автоматически. Габариты всей закрытой композиции сравниваются с нишей; превышения видны в замечаниях и документах.</p><button className="text-action" onClick={()=>{const measurement={...project.measurement!};delete measurement.niche;commitProject({...project,measurement});}}>Убрать расчёт ниши</button></>}</details>
              <details className="measurement-fields"><summary>Сдвинуть всю композицию</summary><p className="field-note">Все {project.modules.length} корпуса сдвигаются вместе. Стыки, расстояния и положение антресолей относительно нижних модулей сохраняются.</p>{(['x','z','y'] as const).map(axis=><NumberField key={axis} label={{x:'Композиция от левой стены',z:'Композиция от задней стены',y:'Композиция от пола'}[axis]} value={Math.round(mountingComposition[axis]*10)/10} min={0} max={{x:project.room.width-mountingComposition.w,z:project.room.depth-mountingComposition.d,y:project.room.height-mountingComposition.h}[axis]} onChange={v=>{try{commitProject(setCompositionDistance(project,axis,v));}catch(e){setError((e as Error).message);}}}/>)}<p className="field-note">Отступы — по монтажному габариту, как у отдельного корпуса. Выступы ручек проверяются отдельными подсказками. Отмена возвращает всю расстановку одним шагом.</p></details>
              </div>
              <div data-stages="room fixtures bodies filling facades docs"><RoomWarnings project={project} select={w=>{selectModule(w.moduleId);setSelectedOpening(w.openingId);setSelectedObstacle(w.obstacleId);setSelectedFixture(w.fixtureId);setRoomPlan(true);}}/></div>
              <div data-stages="room"><RoomEditor part="walls" selected={selectedOpening} onSelect={setSelectedOpening} room={project.room} onChange={room=>commitProject({...project,room})}/></div>
              <div data-stages="fixtures"><RoomEditor part="openings" selected={selectedOpening} onSelect={setSelectedOpening} room={project.room} onChange={room=>commitProject({...project,room})}/>
              <RoomFixtures selected={selectedFixture} onSelect={id=>{setSelectedFixture(id);setSelectedObstacle(undefined);setSelectedOpening(undefined);}} room={project.room} roomName={project.measurement?.number?'Замер '+project.measurement.number:project.offer?.customer} onChange={room=>commitProject({...project,room})} onImport={r=>{const room={...project.room,...r.room};if(commitProject({...project,room,measurement:{number:project.measurement?.number||'',date:project.measurement?.date||'',notes:[project.measurement?.notes||'',r.name?'Замер из Базиса: '+r.name:'',...r.notes].filter(Boolean).join('\n')}})){setShowRoom(true);setFit(f=>f+1);}}}/>
              <RoomObstacles modules={project.modules} selected={selectedObstacle} onSelect={setSelectedObstacle} room={project.room} onChange={room=>commitProject({...project,room})}/></div>
              <button className="text-action" data-stages="bodies filling facades" onClick={() => setTab("module")}>
                К выбранному модулю
              </button>
            </div>
          ) : nothingSelected ? (
            <div className="property-section nothing-selected" data-testid="nothing-selected">
              <h2>Ничего не выбрано</h2>
              <p className="essential-note">Нажмите на модуль в сцене или в списке слева — здесь откроются его настройки.</p>
              <p className="nothing-summary">Проект: {project.modules.length} {project.modules.length%10===1&&project.modules.length%100!==11?'модуль':project.modules.length%10>=2&&project.modules.length%10<=4&&(project.modules.length%100<10||project.modules.length%100>=20)?'модуля':'модулей'} · комната {project.room.width} × {project.room.depth} × {project.room.height} мм{placementWarnings.length?` · замечаний к расстановке: ${placementWarnings.length}`:''}</p>
              <button className="outline full" onClick={()=>selectModule(placed.id)}>Настройки «{m.name}»</button>
              <button className="text-action" onClick={()=>setTab('room')}>Замер помещения и проверка расстановки</button>
            </div>
          ) : m.raw||m.worktop||kitchenModule ? <KitchenPanel allowEmpty={!!onEmptyProject} m={m} placed={placed} project={project} stage={stage} modify={modify} commit={commitProject} move={movePlaced} place={placePlaced} toWall={m.worktop?undefined:w=>moduleToWall(placed.id,w)} turns={m.worktop?[]:cornerTurns(project,placed.id)} aroundCorner={t=>aroundCorner(placed.id,t)} position={placedBounds} room={project.room} rotate={rotation=>{try{return commitProject(rotateModule(project,placed.id,rotation));}catch(e){setError((e as Error).message);return false;}}} material={target=>{setMaterialTarget(target);setModal('materials');}} handles={()=>{setHandleFace('');setHandleTarget('doors');setModal('handles');}} showInside={()=>{setHideFacades(false);setOpenDoors(true);}}/> : m.kupe ? <KupePanel m={m} modify={modify} openDoors={openDoors} setOpenDoors={setOpenDoors} selectedPid={selectedPart?.mid===placed.id?selectedPart.pid:undefined}/> : m.corner ? <CornerModulePanel module={m} stage={tab==='section'?'filling':stage} selected={selectedId} update={commit} select={chooseSection} material={target=>{setMaterialTarget(target);setModal('materials');}} addUpper={addUpper} rotation={placed.rotation??0} rotate={rotation=>{try{return commitProject(rotateModule(project,placed.id,rotation));}catch(e){setError((e as Error).message);return false;}}} position={placedBounds} room={project.room} move={movePlaced} preview={(sid,j,pid)=>{chooseSection(sid);setMode('fill');setOpenDoors(true);setDrawerIndex(j);setDrawerPreview(j!==null);setSelectedPart({mid:placed.id,sid,pid});}}/> : (
            <SettingsTree className="furniture-settings" key={active}>
              <SettingsSection title="Габариты">
                <label className="hardware-field expert-only"><span><input type="checkbox" aria-label="Боковины над цоколем" checked={!!m.raisedSides} onChange={e=>modify(n=>{n.raisedSides=e.target.checked;})}/> Боковины над цоколем</span></label>
                <label className="hardware-field expert-only"><span><input type="checkbox" aria-label="Открытый угловой стык" checked={!!m.openJunction} onChange={e=>modify(n=>{n.openJunction=e.target.checked;delete n.cornerFiller;delete n.wallFiller;})}/> Открытый угловой стык без дверных фальшей</span></label>
                <div className="section-heading">
                  <h2>Габариты корпуса</h2>
                  <Ruler size={17} />
                </div>
                {/* вес изделия по деталям (решение Макса 26.10.2026; weight.ts — плотность ЛДСП константой) */}
                {(()=>{let w:ReturnType<typeof moduleWeight>|null=null;try{w=moduleWeight(m);}catch{w=null;}return w?<p className="field-note" data-testid="module-weight" title={`ЛДСП ${weightText(w.board)} · ЛХДФ ${weightText(w.hdf)}${w.mdf?' · МДФ '+weightText(w.mdf):''}${w.glass?' · стекло '+weightText(w.glass):''}${w.mirror?' · зеркало '+weightText(w.mirror):''} кг; фурнитура без массы (${w.hardwareNoMass} дет.) не учтена; плотность ЛДСП ${LDSP_DENSITY} кг/м³`}>Вес изделия: <b>{weightText(w.total)} кг</b> <small>(плита, ЛХДФ, стекло; без фурнитуры)</small></p>:null;})()}
                <button className="outline full upper-cta" onClick={addUpper}><Plus size={16}/> Антресоль сверху на этот корпус</button>
                <p className="field-note">Антресоль встанет на крышу корпуса той же ширины и глубины, без цоколя; до потолка останется зазор по регламенту.</p>
                <NumberField
                  label="Ширина"
                  value={m.width}
                  min={RULES.minW}
                  max={RULES.maxW}
                  reasons={v=>({list:fieldReasons(m,'width',v),moduleId:placed.id,moduleName:m.name})}
                  onChange={(v) => modify((n) => (n.width = v))}
                />
                <NumberField
                  label="Высота"
                  value={m.height}
                  min={minHeightOf(m)}
                  max={maxHeightOf(m)}
                  reasons={v=>({list:fieldReasons(m,'height',v),moduleId:placed.id,moduleName:m.name})}
                  onChange={(v) => modify((n) => (n.height = v))}
                />
                <NumberField
                  label="Глубина"
                  value={m.depth}
                  min={RULES.minD}
                  max={RULES.maxD}
                  reasons={v=>({list:fieldReasons(m,'depth',v),moduleId:placed.id,moduleName:m.name})}
                  onChange={(v) => modify((n) => (n.depth = v))}
                />
                <p className="field-note">
                  Размеры включают боковины и цоколь.
                </p>
              </SettingsSection>
<SettingsSection title="Положение">
                <h2>Положение в помещении</h2>
                <button className="outline" onClick={()=>{try{if(commitProject(mirrorModule(project,active))){setSelectedPart(null);setDrawerPreview(false);setOpenDoors(true);}}catch(e){setError((e as Error).message);}}}>Зеркально отразить наполнение</button><p className="field-note">Меняет левую и правую секции местами и сторону петель. Размеры и положение корпуса сохраняются.</p>
                <NumberField label="Поворот корпуса" value={placed.rotation??0} min={-360} max={360} unit="°" onChange={v=>{try{commitProject(rotateModule(project,placed.id,v));}catch(e){setError((e as Error).message);}}}/><p className="field-note">Поворот — вокруг центра; у стены корпус сдвигается внутрь комнаты. Перетащите его в сцене для расстановки, на виде спереди — по высоте.</p><NumberField label="От пола" value={placed.y??0} min={movingTogether?placedBounds.y-groupBounds.y:0} max={movingTogether?project.room.height-groupBounds.h+placedBounds.y-groupBounds.y:project.room.height-m.height} onChange={v=>movePlaced('y',v)}/>{m.hanging?<p className="field-note" role="status" data-testid="hanging-label"><b>Навесной (поднят от пола)</b>: на двух навесах, без цоколя и ножек. «От пола» 0 — снова на полу.</p>:quickMenuApplies(m)&&!m.feet&&!(placed.y)?<p className="field-note">«От пола» больше 0 — шкаф станет навесным: без цоколя, на навесах.</p>:null}
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
                  disabled={project.modules.length === 1&&!onEmptyProject}
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
              </SettingsSection>
<SettingsSection title="Материал корпуса">
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
                    <b title={decorTitle(m.decor)}>{decorLabel(m.decor)}</b>
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
              </SettingsSection>
<SettingsSection title="Полки">                <Counter
                  label="Полки"
                  value={s.shelves.length}
                  max={RULES.maxShelves}
                  maxHint={MAX_SHELVES_REASON}
                  onChange={c=>{if(c>s.shelves.length)dropFilling('shelf',placed.id,selectedId,shelfInsertionHeight(m,selectedId));else{modifySection(a=>{a.shelves=a.shelves.slice(0,c);if(a.shelfLights){a.shelfLights=a.shelfLights.filter(j=>j<c);if(!a.shelfLights.length)delete a.shelfLights;}});setSelectedPart(null);}}}
                />
                {/* п.17 волны 22.10: число полок вводом — все полки секции встают поровну; предел — сколько помещается с проёмом 80 мм */}
                {(()=>{const most=maxEvenShelves(m,s);return <NumberField unit="шт." label="Полок в секции" value={s.shelves.length} min={0} max={RULES.maxShelves} onChange={v=>{/* v3: причина отказа — здесь, а не «от 0 до 0 шт..» поля */if(v>most){setError(most?`В секцию ${idx+1} помещается не больше ${most} полок поровну: между полками, дном, крышей и ящиками нужно не менее ${RULES.shelfMinClear} мм.`:`В секцию ${idx+1} полка не помещается: ${s.drawers?"над ящиками":"между дном и крышей"} нужно не менее ${2*RULES.shelfMinClear+RULES.panel} мм (по ${RULES.shelfMinClear} мм над и под полкой).`);return;}if(modifySection((a,n)=>setShelfCount(n,a,v)))setSelectedPart(null);}}/>;})()}
                <p className="field-note">Введите число — полки встанут поровну по высоте секции. «+» добавляет полку в самый большой проём, не двигая остальные.</p>
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
                        onChange={(v) => modify((n) => { Object.assign(n, moveShelfKeepRod(n, s.id, j, v)); })}

                      />
                    ))}
                    {!m.skew&&<><NumberField label="Глубина полок" value={s.shelfDepth??m.depth-rearClear(m)-RULES.shelfDepthMinus} min={100} max={shelfMaxDepth(m)} onChange={v=>modifySection(a=>a.shelfDepth=v)}/>{s.shelfDepth!==undefined&&<button className="text-action" onClick={()=>modifySection(a=>delete a.shelfDepth)}>Глубина по корпусу</button>}<p className="essential-note">Обычные полки можно сделать мельче. Полка над ящиками рассчитывается отдельно.</p></>}
                    <h3>Крепление полок</h3>
                    <div className="shelf-kind">{s.shelves.map((_, j) => <label key={j}><input type="checkbox" aria-label={`Полка ${j + 1} жёсткая`} checked={!!s.fixed?.includes(j)} onChange={e => modifySection(a => { const set = new Set(a.fixed ?? []); if (e.target.checked) set.add(j); else set.delete(j); const next = [...set].sort((x, y) => x - y); if (next.length) a.fixed = next; else delete a.fixed; })} /> Полка {j + 1}: {s.fixed?.includes(j) ? 'жёсткая' : 'съёмная'}</label>)}</div>
                    <p className="field-note">Съёмная — на полкодержателях, короче проёма на 2 мм с каждой стороны. Жёсткая — в точную ширину проёма, на евровинтах или эксцентриках как дно и крыша; она же связывает боковины.</p>
                  </>
                )}
</SettingsSection>
<SettingsSection title="Ящики">                {s.drawers>0&&<NumberField label="Зазор между фасадами ящиков" value={s.drawerGap??(m.doors&&!s.externalDrawers?RULES.drawerFrontGap:RULES.faceGap)} min={2} max={10} onChange={v=>modifySection(a=>a.drawerGap=v)}/>}
                {s.drawers>0&&(falshGlue(m)[s.id+':left']||falshGlue(m)[s.id+':right'])&&<p className="field-note" role="note" data-testid="falsh-glue-note">Фальш 32 мм: склейка, разрыв у петель — петля в зоне ящиков не сдвигается, фальш из двух плит 16 с разрывом 100 мм у петли.</p>}

                <Counter
                  label="Ящики"
                  value={s.drawers}
                  max={RULES.maxDrawers}
                  maxHint={MAX_DRAWERS_REASON}
                  onChange={c=>{if(c>s.drawers){/* заказ 7442203: первый ящик в проёме между рядами фасадов встаёт к низу проёма, а не на дно секции (там его не пустит проверка проёма) */const nicheY=nicheDrawers(m,s)&&!s.drawers?facadeBottom(m)+s.doorSplit!:null;if(nicheY!==null?dropFilling('drawer',placed.id,selectedId,nicheY):drawerFitsOnTop(project,placed.id,selectedId)&&dropFilling('drawer',placed.id,selectedId,b.bottom+drawerStackHeight(s)))setDrawerBlock(null);else{const why=drawerAddReason(project,placed.id,selectedId);setError(why);setDrawerBlock({mid:placed.id,sid:selectedId,drawers:s.drawers,text:why});}}else{modifySection(a=>a.drawers=c);setSelectedPart(null);setDrawerBlock(null);}}}
                />
                {drawerBlock&&drawerBlock.mid===placed.id&&drawerBlock.sid===s.id&&drawerBlock.drawers===s.drawers&&<p className="field-note drawer-limit" role="note" data-testid="drawer-limit">{drawerBlock.text}</p>}
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
                    {!m.sectionLayout&&!s.drawerConfigs?.every(c=>c.tray)&&<label className="hardware-field">Полка над ящиками<select aria-label="Полка над ящиками" value={s.drawerCap===undefined?'auto':s.drawerCap?'on':'off'} onChange={e=>setDrawerCapAt(placed.id,s.id,e.target.value as 'auto'|'on'|'off')}><option value="auto">Авто · {hasDrawerCap(m,s)?'есть':'нет, ящики до крыши'}</option><option value="on">Есть</option><option value="off">Нет</option></select><small>Авто: полка есть, если над ящиками остаётся место; ящики до крыши (комод) — без полки.</small></label>}
                    <div className="floor-height" style={{display:m.sectionLayout||s.drawerConfigs?.every(c=>c.tray)||!hasDrawerCap(m,s)?'none':undefined}}>
                      <NumberField label="От дна пенала до верха полки над ящиками" value={Math.round(drawerCapTop(m,s)-b.bottom)} min={RULES.panel+s.drawers*(68+RULES.drawerStep)} max={b.top-b.bottom-RULES.shelfMinClear} onChange={v=>{try{const configs=distributeDrawers(m,s,b.bottom+v);modifySection(a=>{a.drawerConfigs=configs;});}catch(e){setError((e as Error).message);}}}/>
                      <span className="hint" tabIndex={0} role="note" aria-label="Размер от дна: от верхней плоскости дна пенала до верхней плоскости полки над блоком ящиков. Показан линией в 3D. При изменении ящики делятся поровну по высоте." title="Размер от дна: от верхней плоскости дна пенала до верхней плоскости полки над блоком ящиков. Показан линией в 3D. При изменении ящики делятся поровну по высоте.">?</span>
                    </div>
                    <NumberField unit="шт." label="Ящиков в секции" value={s.drawers} min={1} max={RULES.maxDrawers} onChange={v=>{
                      let next=project;
                      try{
                        const count=Math.max(1,Math.min(RULES.maxDrawers,Math.round(v)));
                        for(let k=s.drawers;k<count;k++){if(!drawerFitsOnTop(next,placed.id,s.id))throw Error('нет места');const sec=next.modules.find(a=>a.id===placed.id)!.module.sections.find(x=>x.id===s.id)!;next=insertItem(next,'drawer',placed.id,s.id,boxes(next.modules.find(a=>a.id===placed.id)!.module).find(x=>x.id===s.id)!.bottom+drawerStackHeight(sec),drawerConfig(next.modules.find(a=>a.id===placed.id)!.module,sec,Math.max(0,sec.drawers-1)));}
                        for(let k=s.drawers;k>count;k--)next=removePart(next,placed.id,s.id,s.id+':drawer:'+(k-1)+':bottom');
                        if(commitProject(next)){setDrawerIndex(Math.min(drawerIndex??0,count-1));setDrawerBlock(null);}
                      }catch(e){
                        // m4: не молча «нет места» — правило, свободная высота и сколько ящиков секция вмещает (drawerLimit.ts)
                        const why=Math.round(v)>s.drawers?drawerAddReason(next,placed.id,s.id):(e as Error).message;setError(why);
                        if(Math.round(v)>s.drawers)setDrawerBlock({mid:placed.id,sid:s.id,drawers:s.drawers,text:why});
                      }
                    }}/>
                    <p className="field-note">Новые ящики копируют настройки последнего; лишние убираются сверху.</p>
                    <button className="outline full" aria-pressed={drawerPreview} onClick={()=>{setDrawerPreview(!drawerPreview);setOpenDoors(true);setExploded(false);setRoomPlan(false);setView('iso');}}>{drawerPreview?'Задвинуть ящик':'Выдвинуть для просмотра'}</button>
                    <p className="field-note">Просмотр конструкции. Положение ящика не меняет деталировку.</p>
                    {(() => {
                      const j = Math.min(drawerIndex ?? 0, s.drawers - 1),
                        c = drawerConfig(m, s, j);
                      const update = (patch: Partial<DrawerConfig>) =>
                        modifySection((a, n) => {
                          a.drawerConfigs=editDrawerConfig(n,a,j,patch);
                        });
                      const meshItem=c.mesh?meshById(c.mesh):undefined;
                      return (
                        <>
                          <label className="hardware-field">Тип элемента<select aria-label="Тип ящика" value={c.mesh??(c.tray?'tray':'box')} onChange={e=>{const v=e.target.value;if(v==='tray')update({mesh:undefined,tray:true,slide:'gtv0fpo',height:50,facadeH:50,handle:false});else if(v==='box')update({mesh:undefined,tray:undefined,height:RULES.drawerH,facadeH:undefined,handle:undefined});else{const item=meshById(v)!;update({mesh:v,tray:undefined,height:item.h,handle:undefined});}}}><option value="box">Ящик ЛДСП 16 с фасадом</option><option value="tray">Выкатная полка / лоток 40–60 мм</option>{(['basket','trousers','shoes'] as const).map(kind=><optgroup key={kind} label={MESH_KIND_LABEL[kind]+' · Лемана Про'}>{MESH.filter(i=>i.kind===kind).map(i=><option key={i.id} value={i.id}>{i.label} · проём {i.reqW}×{i.reqD}</option>)}</optgroup>)}</select></label>
                          {meshItem&&<p className="field-note">Арт. {meshItem.art}, высота {meshItem.h} мм, нужен проём {meshItem.reqW}–{meshItem.reqW+60} мм в ширину и глубина от {meshItem.reqD} мм. Направляющие в комплекте, без фасада и ручки; за распашными дверями ставятся фальши.</p>}
                          {meshItem&&<NumberField label="Элемент от дна проёма" value={drawerOffsets(s)[j]} min={0} max={b.top-b.bottom-c.height-40} onChange={v=>update({y:v})}/>}
                          {!meshItem&&<>
                          <label className="hardware-field">
                            Направляющие
                            <select
                              aria-label="Направляющие ящика"
                              value={slideSystem(c).id}
                              onChange={(e) => {
                                try{const next=withSlideSystem(m,s,c,e.target.value);update({...next,handle:undefined,brand:next.brand,operation:next.operation});}
                                catch(err){setError(err instanceof Error?err.message:'Для этой глубины нет подходящих направляющих.');}
                              }}
                            >
                              <optgroup label="Шариковые">{SLIDE_SYSTEMS.filter(x=>x.slide==='ball').map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>
                              <optgroup label="Скрытого монтажа">{SLIDE_SYSTEMS.filter(x=>x.slide==='gtv0fpo').map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>
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
                          <label className="hardware-field">Ручка ящика<select aria-label="Ручка ящика" value={s.drawerGrip&&!c.tray?'grip':c.handle===undefined?'auto':c.handle?'yes':'no'} onChange={e=>{const v=e.target.value;if(v==='grip')modifySection(a=>{a.drawerGrip=true;});else modifySection((a,n)=>{delete a.drawerGrip;a.drawerConfigs=editDrawerConfig(n,a,j,{handle:v==='auto'?undefined:v==='yes'});});}}><option value="auto">{slideMotion(c)==='push'?'Без ручки · нажать на фасад':'С ручкой'}</option><option value="yes">Всегда с ручкой</option><option value="no">Без ручки</option><option value="grip">Зазор между ящиками 30 мм</option></select></label>{s.drawerGrip&&<p className="field-note" role="note" data-testid="drawer-grip-note">Для всех ящиков секции: ручки нет, между фасадами ящиков зазор {RULES.drawerGrip} мм (фасады ниже), короб ниже верха своего фасада не менее чем на {RULES.drawerGrip} мм — хват сверху за фасад.</p>}
                          <NumberField label="Ящик от дна проёма" value={drawerOffsets(s)[j]} min={0} max={b.top-b.bottom-c.height-40} onChange={v=>update({y:v})}/>
                          <NumberField
                            label="Высота боковины ящика"
                            value={c.height}
                            min={c.tray?40:68}
                            max={300}
                            onChange={(v) => update({ height: v })}
                          />
                          <label className="hardware-field"><span><input type="checkbox" aria-label="Ящик без фасада" checked={!!c.noFacade} onChange={e=>update({noFacade:e.target.checked?true:undefined,handle:undefined})}/> Внутренний ящик без фасада</span></label>
                          {c.noFacade?<p className="field-note">Только короб и направляющие: ящик за распашными дверями или в открытом каркасе. Фасад, ручка и зазоры не считаются.</p>:<>
                          <NumberField label="Высота фасада ящика" value={drawerGripOn(m,s,c)?drawerFaceSpan(m,s,c)[1]-drawerFaceSpan(m,s,c)[0]:c.facadeH??(drawerPitch(c,s.drawerGap)-(s.drawerGap??(m.doors&&!s.externalDrawers?RULES.drawerFrontGap:RULES.faceGap)))} min={c.tray?40:60} max={800} onChange={v=>update({facadeH:v})}/>
                          {c.facadeH!==undefined?<button className="text-action" onClick={()=>update({facadeH:undefined})}>Фасад по боковине (боковина + 40 − зазор)</button>:<p className="field-note">Фасад можно сделать выше короба: короб останется низким и сэкономит плиту, шаг ящиков подстроится под фасад.</p>}</>}
                          <p className="field-note">{SLIDES[c.slide].note}</p>
                          {c.slide==='gtv0fpo'&&<p className="field-note">Геометрия ящика под скрытые направляющие — по карте GTV 0FPO. Артикул бренда согласовать перед производством.</p>}
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
</SettingsSection>
<SettingsSection title="Штанги">                <div className="toggle-row">
                  <span>Штанга</span>
                  <button
                    className="switch"
                    role="switch"
                    aria-label="Штанга"
                    aria-checked={s.rod}
                    onClick={() => modifySection((a) => { a.rod = !a.rod; if (!a.rod) delete a.rodLower; })}
                  >
                    <span />
                  </button>
                </div>
                {/* заказ 7437584: двухъярусная вешалка — вторая штанга ниже и вертикальная труба D25 по центру секции */}
                {!s.pantograph&&<div className="toggle-row">
                  <span>Вешалка в два яруса<small>Вторая штанга ниже, вертикальная труба D25 от дна до полки</small></span>
                  <button className="switch" role="switch" aria-label="Вешалка в два яруса" aria-checked={s.rod&&s.rodLower!==undefined} onClick={()=>modifySection((a,n)=>setRodTiers(n,a,!(a.rod&&a.rodLower!==undefined)))}><span /></button>
                </div>}
                {s.rod&&s.rodLower!==undefined&&<NumberField label="Нижняя штанга от дна" selected={selectedPart?.pid===s.id+':rod:lower'} onSelect={()=>{setSelectedPart({mid:placed.id,sid:s.id,pid:s.id+':rod:lower'});setDrawerIndex(null);setDrawerPreview(false);setMode('fill');setOpenDoors(true);}} value={Math.round(s.rodLower*(b.top-b.bottom))} min={100} max={b.top-b.bottom-RULES.rodTierClear} onChange={v=>modifySection(a=>{a.rodLower=v/(b.top-b.bottom);})}/>}
                <button className="outline full" onClick={()=>modifySection(a=>{a.pantograph=!a.pantograph;a.rod=false})}>{s.pantograph?'Убрать пантограф':'Добавить пантограф'}</button>
                <div className="kupe-field"><span>Выдвижной тремпель{s.pullouts?' · '+pulloutLength(m)+' мм':''}</span>
                  <div className="kupe-chips" role="group" aria-label="Выдвижные тремпели в секции">{[0,1,2,3].map(n=><button key={n} type="button" aria-pressed={(s.pullouts??0)===n} onClick={()=>modifySection(a=>{if(n)a.pullouts=n;else delete a.pullouts;})}>{n?n:'нет'}</button>)}</div>
                </div>
                {(s.rod||s.pantograph)&&<NumberField label="Высота штанги от дна" selected={selectedPart?.pid===(s.pantograph?s.id+':pantograph:rod':s.id+':rod')} onSelect={()=>{setSelectedPart({mid:placed.id,sid:s.id,pid:s.pantograph?s.id+':pantograph:rod':s.id+':rod'});setDrawerIndex(null);setDrawerPreview(false);setMode('fill');setOpenDoors(true);}} value={Math.round((parts(m).find(p=>p.id===s.id+':rod'||p.id===s.id+':pantograph:rod')?.position[1]??b.bottom)-b.bottom)} min={100} max={b.top-b.bottom-50} onChange={v=>modifySection(a=>a.rodAt=v/(b.top-b.bottom))}/>}
</SettingsSection>
<SettingsSection title="Опоры">                {(placed.y??0)>0&&!m.feet&&quickMenuApplies(m)?<><p className="field-note" role="status" data-testid="base-hanging">{m.hanging?<><b>Навесной (поднят от пола)</b> — низ на {Math.round(placed.y??0)} мм от пола, на двух навесах; цоколя и ножек нет.</>:<>Корпус над полом (низ на {Math.round(placed.y??0)} мм): цоколя и ножек нет{plinth(m)>0?' — сейчас под ним цоколь '+plinth(m)+' мм.':'.'}</>}</p>{plinth(m)>0&&<button className="outline full" onClick={()=>modify(n=>{delete n.feet;n.plinthHeight=0;})}>Убрать цоколь · дно внизу корпуса</button>}</>:<>
                <label className="hardware-field">Основание<select aria-label="Основание корпуса" value={m.feet?'feet':plinth(m)===0?'none':'plinth'} onChange={e=>modify(n=>{if(e.target.value==='feet'){n.feet={height:18};delete n.plinthRecess;}else if(e.target.value==='none'){delete n.feet;n.plinthHeight=0;delete n.plinthRecess;}else{delete n.feet;if(plinth(n)===0)n.plinthHeight=RULES.plinth;}})}><option value="plinth">Цоколь</option><option value="none">Без цоколя (дно на полу)</option><option value="feet">Ножки (боковины на ножках)</option></select></label>
                {!m.feet&&plinth(m)>0&&<label className="hardware-field">Цоколь<select aria-label="Высота цоколя" value={plinth(m)} onChange={e=>modify(n=>n.plinthHeight=Number(e.target.value))}>{[60,80,100,120,150].map(v=><option key={v} value={v}>{v} мм</option>)}</select></label>}
                {/* заказ 7441182: цоколь утоплен — фасады над цоколем */}
                {!m.feet&&!m.kitchen&&plinth(m)>0&&<label className="hardware-field"><span><input type="checkbox" aria-label="Цоколь утоплен" checked={m.plinthRecess!==undefined} onChange={e=>modify(n=>{if(e.target.checked)n.plinthRecess=RULES.plinthRecessStd;else delete n.plinthRecess;})}/> Цоколь утоплен · фасады над цоколем</span></label>}
                {m.plinthRecess!==undefined&&<NumberField label="Утопление цоколя" value={m.plinthRecess} min={RULES.plinthInset} max={RULES.plinthRecessMax} onChange={v=>modify(n=>{n.plinthRecess=v;})}/>}
                {!m.feet&&plinth(m)===0&&<p className="field-note">Дно на полу, боковины до пола — без цоколя и опор, как у таких шкафов в Базисе.</p>}</>}
                {m.feet&&<label className="hardware-field">Ножки<select aria-label="Высота ножек" value={m.feet.height} onChange={e=>modify(n=>{n.feet={height:Number(e.target.value)};})}><option value={18}>M6×18 под боковинами · 18 мм</option><option value={100}>Регулируемые 1033 · 100 мм</option><option value={120}>Регулируемые · 120 мм</option></select></label>}
</SettingsSection>
<SettingsSection title="Подсветка">                <label className="hardware-field"><span><input type="checkbox" aria-label="Подсветка в стойках" checked={allStandsLit(m)} onChange={e=>modify(n=>setAllStands(n,e.target.checked))}/> Подсветка врезная в стойках</span></label>
                <p className="field-note">LED-профиль по внутренним граням боковин и перегородок на всю высоту проёма. Стоимость подсветки входит в итог проекта.</p>
                {quickMenuApplies(m)&&<button className="outline full" onClick={()=>setLightPanel(placed.id)}>Настроить подсветку…</button>}
</SettingsSection>
<SettingsSection title="Фасад"><button className="outline full" onClick={()=>{try{commitProject(applyFacadeStyle(project,placed.id));}catch(e){setError((e as Error).message);}}}>Применить ко всем модулям</button><p className="field-note">Тип и материал фасадов — всем редактируемым корпусам. Размеры и индивидуальные ручки сохраняются. {advanced?"Импорт Базиса, столешницы":"Столешницы"}, столы и двери купе пропускаются.</p>
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
                    onClick={() => modify((n) => {n.doors=!n.doors;if(n.doors)n.sections.forEach(s=>delete s.removedDoors);})}
                  >
                    <span />
                  </button>
                </div>
                {!m.doors&&<button className="primary full" onClick={()=>{if(modify(n=>{n.doors=true;n.sections.forEach(s=>delete s.removedDoors);})){setHideFacades(false);setOpenDoors(false);}}}>Добавить распашные фасады</button>}
                {m.doors && (
                  <label className="hardware-field">Тип фасадов<select aria-label="Тип распашных фасадов" value={m.vernissage?'vernissage':m.alu?'alu':'ldsp'} onChange={e=>modify(n=>{const v=e.target.value;if(v==='alu'){n.alu={...DEFAULT_ALU};if(n.vernissage){delete n.vernissage;delete n.facadeT;}}else if(v==='vernissage'){delete n.alu;delete n.aluDrawers;n.vernissage={...DEFAULT_VERNISSAGE};n.facadeT=DEFAULT_VERNISSAGE.thickness;}else{delete n.alu;delete n.aluDrawers;if(n.vernissage){delete n.vernissage;delete n.facadeT;}}})}><option value="ldsp">{FACADE_KIND_LABEL.ldsp} 16 мм</option><option value="alu">{FACADE_KIND_LABEL.alu}</option><option value="vernissage">{FACADE_KIND_LABEL.vernissage}</option></select></label>
                )}
                {m.doors && m.vernissage && <VernissagePicker value={m.vernissage} sizes={vernissageSizes(m)} onChange={v=>modify(n=>{n.vernissage=v;n.facadeT=v.thickness;})} />}

                {m.doors && m.alu && (<>
                  <AluPicker value={m.alu} onChange={v=>modify(n=>{n.alu=v;})}/>{aluDrawersAvailable(m)&&<AluDrawersCheck checked={!!m.aluDrawers} onChange={v=>modify(n=>{if(v)n.aluDrawers=true;else delete n.aluDrawers;})}/>}
                  <p className="field-note">Цена — по калькулятору фасадов ALU: профиль по периметру, наполнение по площади фасада, уплотнитель; петли — строками фурнитуры. По СТП рамка не выше 2000 и не шире 600 мм, петли GTV с доводчиком. Вставка режется с припуском {aluProfile(m.alu.profile)!.allowance} мм.</p>
                </>)}
                {m.doors && !m.alu && (
                  <button
                    className="text-action"
                    onClick={() => {
                      setMaterialTarget("facadeDecor");
                      setModal("materials");
                    }}
                  >
                    Материал фасадов: {decorLabel(m.facadeDecor)} <ChevronDown size={13} />
                  </button>
                )}
                {m.doors && (
                  <button className="text-action" onClick={() => {setHandleFace("");setHandleTarget("doors");setModal("handles");}}>
                    Ручки фасадов: {m.sections.some(s=>s.doorHandles?.some(Boolean))?'индивидуальные':handleById(m.handleId).label} <ChevronDown size={13} />
                  </button>
                )}
              {m.doors&&<details className="section-facades" open={stage==='facades'||selectedDetail?.role==='door'||undefined}><summary>Фасады секции {idx+1}</summary>
<div className="facade-pick-list" role="group" aria-label="Выбрать отдельный фасад">{parts(m).filter(p=>p.sectionId===s.id&&(p.role==='door'||p.id.endsWith(':facade'))).map((p,i)=><button key={p.id} className="outline" aria-pressed={selectedPart?.pid===p.id} onClick={()=>{setSelectedPart({mid:placed.id,sid:s.id,pid:p.id});setDrawerIndex(p.id.includes(':drawer:')?Number(p.id.split(':drawer:')[1].split(':')[0]):null);setMode('select');}}>{p.role==='door'?'Дверь '+(i+1):p.name} · {Math.round(p.width)}×{Math.round(p.length)}</button>)}</div>
{selectedDetail?.role==='door'&&<button className="outline full" onClick={()=>{setHandleFace(selectedDetail.id);setHandleTarget('doors');setModal('handles');}}>Ручка выбранной двери</button>}
{selectedDetail?.role==='door'&&<label className="hardware-field">Открывание выбранной двери<select aria-label="Открывание выбранной двери" value={selectedDetail.hinge??'left'} onChange={e=>modify(n=>setDoorHinge(n,selectedDetail.id,e.target.value as 'left'|'right'|'top'|'bottom'))}><option value="left">Петли слева</option><option value="right">Петли справа</option><option value="top">Петли сверху · подъёмный</option><option value="bottom">Петли снизу · откидной</option></select></label>}
{selectedDetail?.role==='door'&&/:door:\d+$/.test(selectedDetail.id)&&m.doors&&!m.kitchen&&(()=>{const did=selectedDetail.id,ds=m.sections.find(x=>x.id===did.split(':')[0]),dk=Number(did.split(':door:')[1]);if(!ds)return null;const cur=ds.hingeAngles?.[dk]??0;return <label className="hardware-field" data-testid="hinge-angle">Угол открывания петель этой створки<select aria-label="Угол открывания петель" value={cur} onChange={e=>modify(n=>{const sec=n.sections.find(x=>x.id===ds.id);if(!sec)return;const v=Number(e.target.value),arr=[...(sec.hingeAngles??[])];while(arr.length<=dk)arr.push(null);arr[dk]=v===90||v===165?v:null;if(arr.some(Boolean))sec.hingeAngles=arr;else delete sec.hingeAngles;})}><option value={0}>Стандарт 110°</option>{HINGE_ANGLES.map(a=><option key={a} value={a}>{HINGE_ANGLE_LABEL[a]}</option>)}</select></label>;})()}
{selectedDetail?.role==='door'&&selectedDetail.hinge==='top'&&<label className="hardware-field">Подъёмный механизм<select aria-label="Подъёмный механизм фасада" value={s.doorLifts?.[Number(selectedDetail.id.split(':door:')[1])]??''} onChange={e=>{if(e.target.value)modify(n=>setDoorHinge(n,selectedDetail.id,'top',e.target.value as 'adagio'|'sempre'));}}><option value="" disabled>Как в исходном проекте</option><option value="adagio">Premial АДАЖИО · газлифты</option><option value="sempre">Premial СЕМПРЕ · механический</option></select><small>Артикул, усилие, присадка и цена — после подбора по фасаду.</small></label>}
{s.doorHinges?.includes('top')&&m.kitchen&&!s.doorLifts?.some(Boolean)&&<label className="rail-row"><input type="checkbox" aria-label="Газлифт PD-G-N02 подъёмного фасада" checked={!!m.kitchenLift} onChange={e=>{const on=e.target.checked;modify(n=>{if(on)n.kitchenLift={system:'pd-g-n02'};else delete n.kitchenLift;});}}/>Газлифт PD-G-N02 на обе боковины (как в Базисе)</label>}
{s.doorHinges?.includes('top')&&m.kitchen&&m.kitchenLift&&<p className="construction-note" role="status">Подъёмный фасад по Базису: петли на крыше, {m.kitchenLift.system==='gl104'?'газлифт GL104':'газлифт PD-G-N02'} на обеих боковинах (присадка рассчитана, цена газлифта не задана).</p>}
{s.doorHinges?.includes('top')&&!m.kitchenLift&&!s.doorLifts?.some(Boolean)&&m.bazis&&<p className="construction-note" role="status">Подъёмный фасад по проекту Базиса: петли на крыше, подъёмника в проекте нет — студия его не добавляет.</p>}
{s.doorHinges?.includes('top')&&!(m.kitchen&&m.kitchenLift)&&!s.doorLifts?.some(Boolean)&&!m.bazis&&<p className="construction-note" role="status">Подъёмный фасад показан геометрически. Механизм нужно подобрать по массе и размерам; его цена не задана, присадка не рассчитана.</p>}
<label className="hardware-field">Створки<select aria-label="Створки выбранной секции" value={s.doorLeaves??'auto'} onChange={e=>modifySection(a=>{a.doorLeaves=e.target.value==='auto'?undefined:Number(e.target.value) as 1|2;delete a.removedDoors;})}><option value="auto">Автоматически по ширине</option><option value="1">Одна створка</option><option value="2">Две створки</option></select></label>
<label className="hardware-field">Петли одной створки<select aria-label="Петли выбранной секции" value={s.hingeSide??m.hingeSide??'left'} onChange={e=>modifySection(a=>a.hingeSide=e.target.value as 'left'|'right')}><option value="left">Слева</option><option value="right">Справа</option></select></label>
<p className="field-note">Выберите дверь выше: её ручка и сторона открывания меняются независимо.</p>
<label className="hardware-field"><span><input type="checkbox" checked={!!s.externalDrawers} onChange={e=>modifySection(a=>a.externalDrawers=e.target.checked)}/> Ящики снаружи, дверь над ящиками</span></label>
<p className="field-note">Дверь начинается над полкой ящиков. Ручка каждого фасада выбирается отдельно нажатием на фасад в модели.</p>
<label className="hardware-field"><span><input type="checkbox" checked={s.doorSplit!==undefined} onChange={e=>modifySection(a=>{a.doorSplit=e.target.checked?Math.round((facadeTop(m)-(a.externalDrawers&&a.drawers?drawerCapTop(m,a)+(a.doorGap??RULES.faceGap):facadeBottom(m)))/2):undefined;delete a.removedDoors;})}/> Разделить фасады по высоте</span></label>
{s.doorSplit!==undefined&&<NumberField label="Высота нижнего ряда фасадов" value={s.doorSplit} min={RULES.doorMinH} max={m.height-RULES.doorMinH} onChange={v=>modifySection(a=>a.doorSplit=v)}/>}
{s.doorSplit!==undefined&&m.kitchen&&<label className="hardware-field">Рядов фасадов<select aria-label="Рядов фасадов пенала" value={2+(s.doorRows?.length??0)} onChange={e=>modifySection(a=>{const n=Number(e.target.value)-2,r=[...(a.doorRows??[])].slice(0,n);while(r.length<n)r.push(400);if(r.length)a.doorRows=r;else delete a.doorRows;delete a.removedDoors;delete a.doorHinges;delete a.doorLifts;if(a.hingeYMid){const hm=a.hingeYMid.slice(0,n),hf=(a.hingeYMidFor??[]).slice(0,n);if(hm.length){a.hingeYMid=hm;a.hingeYMidFor=hf;}else{delete a.hingeYMid;delete a.hingeYMidFor;}}if(a.hingeless){const hl=a.hingeless.filter(k=>k<2*(n+2));if(hl.length)a.hingeless=hl;else delete a.hingeless;}})}>{[2,3,4].map(n=><option key={n} value={n}>{n}</option>)}</select></label>}
{s.doorSplit!==undefined&&m.kitchen&&(s.doorRows??[]).map((h,i)=><NumberField key={'dr'+i} label={`Высота фасада ${i+2}-го ряда`} value={h} min={100} max={m.height-200} onChange={v=>modifySection(a=>{const r=[...(a.doorRows??[])];r[i]=v;a.doorRows=r;})}/>)}
{s.doorSplit!==undefined&&<NumberField label={m.kitchen?"Ниша под технику между рядами, мм (0 — без ниши)":"Открытый проём между рядами фасадов, мм (ящики и ниша; 0 — без проёма)"} value={s.doorNiche??0} min={0} max={Math.max(0,m.height-200-s.doorSplit)} onChange={v=>modifySection(a=>{if(v>0)a.doorNiche=v;else delete a.doorNiche;})}/>}
{s.doorSplit!==undefined&&!m.kitchen&&s.doorNiche!==undefined&&<p className="field-note">Ящики секции стоят в проёме между рядами: фасады накладные, вровень с дверями. Положение ящика — поле «Ящик от дна проёма» у выбранного ящика.</p>}
<NumberField label="Зазор между створками" value={s.doorGap??RULES.faceGap} min={2} max={10} onChange={v=>modifySection(a=>a.doorGap=v)}/>
{!!s.removedDoors?.length&&<button className="outline" onClick={()=>modifySection(a=>delete a.removedDoors)}>Вернуть снятые фасады секции</button>}
</details>}</SettingsSection>
{m.sections.some(s=>s.drawers>0)&&<SettingsSection title="Фасады ящиков"><h2>Фасады ящиков</h2><button className="text-action" onClick={()=>{setMaterialTarget('drawerFacadeDecor');setModal('materials');}}>Материал ящиков: {m.drawerFacadeDecor??m.facadeDecor}<ChevronDown size={13}/></button>{m.drawerFacadeDecor&&<button className="text-action" onClick={()=>modify(n=>delete n.drawerFacadeDecor)}>Как у распашных фасадов</button>}<button className="text-action" onClick={()=>{setHandleFace('');setHandleTarget('drawers');setModal('handles');}}>Ручки ящиков: {m.sections.some(s=>s.drawerConfigs?.some(c=>c.handleId))?'индивидуальные':handleById(m.drawerHandleId??m.handleId).label}<ChevronDown size={13}/></button></SettingsSection>}
<SettingsSection title="Ручки">                <button className="text-action" onClick={()=>{setHandleFace('');setModal('handles');}}>Ручки фасадов: {m.sections.some(s=>s.doorHandles?.some(Boolean))?'индивидуальные':handleById(m.handleId).label} <ChevronDown size={13}/></button>
                <p className="field-note">Ручку можно выбрать и кликом по ней в 3D. Одна на распашной фасад и на каждый ящик с ручкой; push-to-open без ручки.</p>
                {(()=>{const g=moduleHandleFloor(m),elev=Math.round(placed.y??0);if(!g)return null;return <div className="handle-floor" data-testid="module-handle-floor"><NumberField label="Высота ручек от пола · все двери" value={g.value+elev} min={g.min+elev} max={g.max+elev} onChange={v=>{modify(n=>setModuleHandleFloor(n,v-elev));}}/><small>Распашных дверей с ручкой в модуле: {g.ids.length}{' · '}{g.long==='all'?'длинная ручка: от пола до её низа':g.long==='none'?'от пола до центра ручки':'у длинных ручек — до низа, у обычных — до центра'}{g.mixed?' · сейчас у дверей разная высота':g.set?'':g.long==='all'?' · по правилу: 100 мм от пола':' · сейчас по центру фасада'}</small>{g.set&&<button className="text-action" onClick={()=>modify(n=>setModuleHandleFloor(n,null))}>Высота ручек по правилу</button>}</div>;})()}
</SettingsSection>
<SettingsSection title="Тип открывания">                {m.doors&&<label className="hardware-field">Открывание фасадов<select aria-label="Открывание фасадов" value={m.doorOpen==='push'?'push':m.hingeSoft===false?'simple':'handle'} onChange={e=>modify(n=>{const v=e.target.value;if(v==='push'){n.doorOpen='push';delete n.hingeSoft;}else{delete n.doorOpen;if(v==='simple')n.hingeSoft=false;else delete n.hingeSoft;}})}><option value="handle">Ручка · петли с доводчиком</option>{/* заказ 7441182: петли без доводчика */}<option value="simple">Ручка · петли без доводчика</option><option value="push">Push-to-open · без ручек, петли без пружины</option></select></label>}
                {m.doors&&!m.kitchen&&m.doorMount!=='inset'&&<>{/* решение Макса 26.10 «подгонять под эскиз всё» (заказ 7437584); интеграция 26.10 — то же поле facadeFrom, что «Фасады по эскизу» (o-7427796) */}<NumberField label="Высота фасадов по эскизу" value={Math.round(facadeTop(m)-facadeBottom(m))} min={100} max={2750} onChange={v=>modify(n=>{n.facadeFrom=Math.round((facadeTop(n)-v)*10)/10;})}/>{m.facadeFrom!==undefined||m.facadeTo!==undefined?<button className="text-action" onClick={()=>modify(n=>{delete n.facadeFrom;delete n.facadeTo;})}>Высота по правилу зазоров</button>:<p className="field-note">Верх фасада — по правилу (под крышей или карнизом), низ опускается на заданную высоту (у корпуса на цоколе — не ниже 30 мм от пола). Ручное отклонение от зазоров цеха — по эскизу дизайнера.</p>}</>}
                {m.doors&&<label className="hardware-field">Петли<select aria-label="Петли корпуса" value={m.hingeBrand??'gtv'} onChange={e=>modify(n=>{const v=e.target.value as HingeBrand;if(v==='gtv')delete n.hingeBrand;else n.hingeBrand=v;})}>{(Object.keys(HINGE_BRANDS) as HingeBrand[]).map(k=><option key={k} value={k}>{HINGE_BRANDS[k].label} · {HINGE_BRANDS[k].note}</option>)}</select></label>}
                {m.doors&&m.doorOpen!=='push'&&<label className="hardware-field"><span><input type="checkbox" aria-label="Петли 155–165°" checked={allHingeAngles(m,165)} onChange={e=>{const on=e.target.checked;modify(n=>setAllHingeAngles(n,on?165:null));}}/> Петли с углом открывания 155–165° · все двери модуля</span><small>Дверь откидывается к соседней и не загораживает проём. Петля 155° — 1 700 ₽ клиенту. Угол одной двери — в её настройках (клик по двери).</small></label>}
                {m.doors&&!m.kitchen&&<><button className="outline full" onClick={()=>modify(n=>Object.assign(n,repairHinges(n)))}>Подобрать положение петель</button><p className="field-note">Подбирает свободные высоты и отступ чашки. Старые проекты меняются только по этой кнопке; Ctrl+Z отменяет. Присадку и достаточность опоры створки проверяет технолог.</p></>}
</SettingsSection>
<SettingsSection title="Секция">
                <div className="section-heading">
                  <h2>Секция {idx + 1}</h2>
                  <Columns2 size={17} />
                </div>
                <div className="section-copy"><button className="text-action" onClick={()=>{try{setFillingCopy(captureSectionFilling(project,placed.id,s.id));}catch(e){setError((e as Error).message);}}}>Копировать наполнение секции</button>{fillingCopy&&<><p className="field-note">Скопировано: {fillingCopy.name}</p><button className="outline full" onClick={()=>{try{if(commitProject(pasteSectionFilling(project,placed.id,s.id,fillingCopy))){setSelectedPart(null);setDrawerIndex(null);setDrawerPreview(false);setMode('fill');setOpenDoors(true);}}catch(e){setError((e as Error).message);}}}>{s.drawers||s.shelves.length||s.rod||s.pantograph?'Заменить наполнение копией':'Вставить наполнение секции'}</button><p className="field-note">Высоты от дна и фурнитура сохранятся. Корпус и материалы остаются его собственными. Ctrl+Z отменит вставку.</p></>}</div>
                {selectedDetail?.id.includes(':drawer:')&&<button className="text-action danger" onClick={()=>{if(selectedPart&&commitProject(removePart(project,placed.id,s.id,selectedPart.pid.replace(':facade',':bottom'))))setSelectedPart(null);}}>Удалить ящик целиком</button>}
                {canRemove&&<div className="selected-filling"><span>{selectedFillingName}</span><div style={{display:selectedDetail?.role==='door'?'none':undefined}} className="filling-nudge" role="group" aria-label="Точное перемещение наполнения" onKeyDown={e=>{if(e.ctrlKey||e.metaKey||e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();nudgeSelected((e.key==='ArrowUp'?1:-1)*(e.shiftKey?10:1));}}><button className="outline" aria-label="Опустить выбранный элемент на 10 мм" onClick={()=>nudgeSelected(-10)}>↓ Ниже на 10</button><button className="outline" aria-label="Поднять выбранный элемент на 10 мм" onClick={()=>nudgeSelected(10)}>↑ Выше на 10</button></div>{selectedDetail?.role!=='door'&&<small>На этих кнопках: ↑ / ↓ — 1 мм, Shift — 10 мм.</small>}{selectedDetail?.role==='door'&&(()=>{const did=selectedDetail.id,ds=m.sections.find(x=>x.id===did.split(':')[0]),dk=Number(did.split(':door:')[1]);if(!ds||!parts(m).some(p=>p.id===did.replace(':door:',':handle:')))return null;const cur=doorHandlePos(m,ds,dk),order:HandlePos[]=isUpperModule(m)?['bottomCenter','bottomCorner','topCenter','topCorner','rule']:['topCorner','topCenter','bottomCorner','bottomCenter','rule'];return <label className="hardware-field" data-testid="handle-pos">Расположение ручки<select value={cur} onChange={e=>modify(n=>setDoorHandlePos(n,did,e.target.value as HandlePos))}>{order.map(pos=>{const issue=handlePosIssue(m,did,pos);return <option key={pos} value={pos} disabled={!!issue&&pos!==cur} title={issue}>{HANDLE_POS_LABEL[pos]}{issue?' — не подходит':''}</option>;})}</select></label>;})()}{selectedDetail?.role==='door'&&(()=>{const hf=doorHandleFloorInfo(m,selectedDetail.id),elev=Math.round(placed.y??0),did=selectedDetail.id;if(!hf)return null;return <div className="handle-floor" data-testid="handle-floor"><NumberField label="Высота ручки от пола" value={hf.value+elev} min={Math.min(hf.min,hf.max)+elev} max={Math.max(hf.min,hf.max)+elev} onChange={v=>{modify(n=>setDoorHandleFloor(n,did,v-elev));}}/><small>{hf.long?'Длинная ручка: от пола до её низа':'От пола до центра ручки'}{hf.set?'':hf.long?' · по правилу: 100 мм от пола, не ниже низа двери + 50':' · сейчас по центру фасада'}</small>{hf.set&&<button className="text-action" onClick={()=>modify(n=>setDoorHandleFloor(n,did,null))}>Высота ручки по правилу</button>}</div>;})()}{selectedDetail?.id.includes(':shelf:')&&<><NumberField label="Высота выбранной полки" value={Math.round(selectedDetail.position[1]-b.bottom)} min={80} max={b.top-b.bottom-80} onChange={v=>{if(selectedPart)moveFilling(selectedPart.mid,selectedPart.sid,selectedPart.pid,v-(selectedDetail.position[1]-b.bottom));}}/><small>От дна проёма до центра полки.</small></>}{selectedDetail&&/:shelf:|:drawer:/.test(selectedDetail.id)&&<button className="text-action" onClick={copySelected}>Копировать {selectedDetail.id.includes(':drawer:')?'ящик с настройками':'полку'}</button>}<button className="text-action danger" onClick={removeSelected}><Trash2 size={14}/>{removalLabel}</button><small>{selectedDetail&&/:shelf:|:drawer:/.test(selectedDetail.id)?"Копия займёт ближайшее свободное место. ":""}Delete — удалить · Ctrl+Z — отменить</small></div>}

                {!m.doors&&!m.desk&&<button className="primary full" onClick={()=>{if(modify(n=>{n.doors=true;n.sections.forEach(s=>delete s.removedDoors);})){setHideFacades(false);setOpenDoors(false);}}}>Добавить распашные фасады</button>}
<NumberField
                  label="Внутренняя ширина"
                  value={Math.round(b.width * 10) / 10}
                  min={m.sections.length===1?RULES.minW-2*RULES.panel:RULES.minSection}
                  max={m.sections.length===1?RULES.maxW-2*RULES.panel:b.width+boxes(m)[idx<m.sections.length-1?idx+1:idx-1].width-RULES.minSection}
                  onChange={resizeSection}
                />
                <p className="field-note">
                  {m.sections.length===1?'Изменение проёма изменит ширину корпуса: сосед вплотную в ряду сузится или расширится на ту же величину (справа, а если справа никого — слева; у стены корпус меняется от стены).':`Изменится только соседняя секция ${idx<m.sections.length-1?'справа':'слева'}. Остальные проёмы сохранят ширину.`}
                </p>
                <button
                  className="outline full"
                  disabled={m.sections.length >= RULES.maxSections}
                  onClick={() => commit(splitSection(m, selectedId))}
                >
                  <Columns2 size={16} /> Разделить пополам
                </button>
              </SettingsSection>
{quickMenuApplies(m)&&!m.sectionLayout&&m.sections.length>1&&<SettingsSection title="Перегородки секции"><PartialDividerPanel module={m} sectionIndex={idx} edit={modify}/></SettingsSection>}
<SettingsSection title="Дополнительные параметры секции">
                <label className="hardware-field"><span><input type="checkbox" aria-label="Вкладные фасады ящиков" checked={drawerFaceInset(m,s)} disabled={!!m.kupeZone} onChange={e=>modifySection(a=>{a.drawerMount=e.target.checked?'inset':undefined;})}/> Фасады ящиков внутри проёма, без растяжения к цоколю</span></label>{m.kupeZone&&<p className="field-note">Шкаф-купе с дверями внутри: фасады ящиков всегда внутри проёма — боковины выдвинуты на зону дверей купе.</p>}
                {s.rod&&<NumberField label="Минимальный просвет под штангой" value={s.rodClearance??900} min={300} max={1500} onChange={v=>modifySection(a=>{a.rodClearance=v;})}/>}
                {selectedDetail?.id.includes(':shelf:')&&<label className="hardware-field"><span><input type="checkbox" aria-label="Стеклянная полка" checked={!!s.glassShelves?.includes(Number(selectedDetail.id.split(':shelf:')[1]))} onChange={e=>{const j=Number(selectedDetail.id.split(':shelf:')[1]);modifySection(a=>{a.glassShelves=e.target.checked?[...new Set([...(a.glassShelves??[]),j])]:(a.glassShelves??[]).filter(k=>k!==j);});}}/> Стекло 6 мм вместо ЛДСП</span></label>}
                {selectedDetail&&/:shelf:\d+(:glue)?$/.test(selectedDetail.id)&&(()=>{const j=Number(selectedDetail.id.split(':shelf:')[1].split(':')[0]),on=!!s.thickShelves?.includes(j);return <><label className="hardware-field" data-testid="seat-32"><span><input type="checkbox" aria-label="Посадочное место 32 мм" checked={on} onChange={e=>modifySection(a=>{const rest=(a.thickShelves??[]).filter(k=>k!==j);if(e.target.checked){a.thickShelves=[...rest,j].sort((x,z)=>x-z);a.fixed=[...new Set([...(a.fixed??[]),j])].sort((x,z)=>x-z);a.glassShelves=(a.glassShelves??[]).filter(k=>k!==j);if(!a.glassShelves.length)delete a.glassShelves;}else if(rest.length)a.thickShelves=rest;else delete a.thickShelves;})}/> Посадочное место 32 мм · две плиты 16 склейкой под одну кромку</span></label>{on&&<p className="field-note">Жёсткая полка на конфирматах, снизу вторая плита 16. Склейка — 1000 ₽/м² в смете. Над ящиками полку можно убрать («Полка над ящиками» — нет), тогда сиденье лежит прямо над ящиком.</p>}</>;})()}
              </SettingsSection>
<SettingsSection title="Состав модуля">
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
              </SettingsSection>
<SettingsSection title="Очистка секции">
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
              </SettingsSection>
<details className="property-section construction-options" data-stages="bodies facades" ><summary>Конструкция и фурнитура</summary>
                <label className="hardware-field">Задняя стенка<select aria-label="Тип задней стенки" value={m.backType??'nailed'} onChange={e=>modify(n=>n.backType=e.target.value as Module['backType'])}><option value="nailed">ЛХДФ · набивная</option><option value="groove">ЛХДФ · в паз</option><option value="board">ЛДСП 16 · вкладная</option><option value="none">Без задней стенки</option></select></label>
                {m.backType==='none'&&<p className="field-note">Корпус без задней стенки: крепление к стене и жёсткость проверяет технолог.</p>}
                {m.backType==='board'&&<p className="field-note">ЛДСП 16 мм в цвет корпуса, между боковинами, дном и крышей. Уменьшает полезную глубину на 17 мм. Крепёж уточняет технолог.</p>}
                {m.backType==='board'&&!m.kitchen&&<NumberField label="Задник ЛДСП от высоты от пола, мм (0 — от дна)" value={m.backFrom??0} min={0} max={m.height-RULES.minSection} onChange={v=>modify(n=>{if(v>0)n.backFrom=v;else delete n.backFrom;})}/>}
                {m.backType==='board'&&m.backFrom!==undefined&&<p className="field-note">Задник только выше {m.backFrom} мм от пола (например, у ниши над сиденьем); ниже — без задника.</p>}
                {m.backType==='groove'&&<><NumberField label="Отступ паза от зада" value={m.grooveInset??16} min={8} max={30} onChange={v=>modify(n=>n.grooveInset=v)}/><NumberField label="Глубина паза" value={m.grooveDepth??8} min={4} max={10} onChange={v=>modify(n=>n.grooveDepth=v)}/><p className="field-note">Профиль паза проверяет технолог перед выпуском.</p></>}
                <label className="hardware-field">Дно<select aria-label="Дно корпуса" value={m.bottomType??'panel'} onChange={e=>modify(n=>{if(e.target.value==='none'){n.bottomType='none';/* скамья «без дна» (решение Макса 26.10.2026): обувь на полу, спереди царга 80 для жёсткости */if(n.seatTop&&!n.rails?.length)n.rails=[{place:'front-bottom',height:80}];}else delete n.bottomType;})}><option value="panel">ЛДСП 16</option><option value="none">{m.seatTop?'Без дна · обувь на полу, царга спереди':'Без дна · каркас на стяжках'}</option></select></label>
                {m.seatTop&&m.bottomType==='none'&&<p className="field-note" data-testid="bench-open-bottom">Скамья без дна: обувь стоит на полу. Жёсткость — царга спереди снизу (стяжка ниже), перегородки стоят на полу; царга между перегородками кусками на конфирматах.</p>}
                <div className="rails-editor"><span className="rails-title">Стяжки между боковинами</span>{(Object.keys(RAIL_PLACES) as (keyof typeof RAIL_PLACES)[]).map(place=>{const r=m.rails?.find(x=>x.place===place);return <label key={place} className="rail-row"><input type="checkbox" aria-label={'Стяжка '+RAIL_PLACES[place]} checked={!!r} onChange={e=>modify(n=>{const rest=(n.rails??[]).filter(x=>x.place!==place);n.rails=e.target.checked?[...rest,{place,height:place.endsWith('bottom')?150:100}]:rest;if(!n.rails.length)delete n.rails;})}/><span>{RAIL_PLACES[place]}</span>{r&&<input type="number" aria-label={'Высота стяжки '+RAIL_PLACES[place]} min={RULES.railMin} max={RULES.railMax} step={10} key={r.height} defaultValue={r.height} onKeyDown={ev=>{if(ev.key==='Enter')ev.currentTarget.blur();}} onBlur={ev=>{const v=Number(ev.target.value);if(!modify(n=>{n.rails=(n.rails??[]).map(x=>x.place===place?{place,height:v}:x);}))ev.target.value=String(r.height);}}/>}</label>;})}</div>
                {/* заказ 7441182: щит 16 над сиденьем на задней стене ниши, свой декор */}
                {!m.topGlass&&!m.slope&&!m.skew&&!m.kitchen&&m.topType!=='none'&&<label className="hardware-field"><span><input type="checkbox" aria-label="Щит над сиденьем" checked={!!m.seatPanel} onChange={e=>modify(n=>{if(e.target.checked)n.seatPanel={height:1500};else delete n.seatPanel;})}/> Щит над сиденьем · ЛДСП 16 у стены</span></label>}
                {m.seatPanel&&<><NumberField label="Высота щита над сиденьем" value={m.seatPanel.height} min={RULES.seatPanelMin} max={RULES.maxH-RULES.minH} onChange={v=>modify(n=>{n.seatPanel={...n.seatPanel!,height:v};})}/>
                  <label className="hardware-field">Декор щита<select aria-label="Декор щита над сиденьем" value={m.seatPanel.decor??m.decor} onChange={e=>modify(n=>{const v=e.target.value;n.seatPanel={height:n.seatPanel!.height,...(v===n.decor?{}:{decor:v})};})}>{catalog.map(c=><option key={c.n} value={c.n}>{c.n}</option>)}</select></label></>}
                {m.seatTop&&<p className="field-note" data-testid="seat-top-note">Сиденье скамьи: две плиты 16 склеены в 32 под одну кромку 2 мм, лежат на боковинах на всю ширину и глубину. Склейка — 1000 ₽/м² клиенту.</p>}
                {/* карниз в плоскость фасадов (заказ 7437584 — 90 мм): список шагом и текущее значение, если оно не из списка */}
                <label className="hardware-field">Планка под крышей<select aria-label="Планка под крышей" value={m.topStrip??0} onChange={e=>modify(n=>{const v=Number(e.target.value);if(v)n.topStrip=v;else delete n.topStrip;})}><option value={0}>Нет</option>{[...new Set([...TOP_STRIP_STEPS,...(m.topStrip?[m.topStrip]:[])])].sort((a,b)=>a-b).map(v=><option key={v} value={v}>{v} мм · карниз в плоскости фасадов</option>)}</select></label>
                {m.topStrip!==undefined&&<NumberField label="Планка под крышей (карниз), мм" value={m.topStrip} min={RULES.topStripMin} max={RULES.topStripMax} onChange={v=>modify(n=>{n.topStrip=v;})}/>}
                {m.doors&&!m.kitchen&&<label className="hardware-field"><span><input type="checkbox" aria-label="Фасады по эскизу" checked={m.facadeFrom!==undefined||m.facadeTo!==undefined} onChange={e=>modify(n=>{if(e.target.checked){n.facadeFrom=Math.round(facadeBottom(n)*10)/10;n.facadeTo=Math.round(facadeTop(n)*10)/10;}else{delete n.facadeFrom;delete n.facadeTo;}})}/> Фасады по эскизу — свои низ и верх (отклонение от правил студии)</span></label>}
                {m.doors&&!m.kitchen&&(m.facadeFrom!==undefined||m.facadeTo!==undefined)&&<><NumberField label="Низ фасадов от низа корпуса, мм" value={facadeBottom(m)} min={0} max={m.height-RULES.doorMinH} onChange={v=>modify(n=>{n.facadeFrom=v;if(n.facadeTo===undefined)n.facadeTo=facadeTop(m);})}/><NumberField label="Верх фасадов от низа корпуса, мм" value={facadeTop(m)} min={RULES.doorMinH} max={m.height} onChange={v=>modify(n=>{n.facadeTo=v;if(n.facadeFrom===undefined)n.facadeFrom=facadeBottom(m);})}/><p className="field-note">Фасад {Math.round(facadeTop(m)-facadeBottom(m))} мм по высоте. Правило студии (низ на 30 от пола у цоколя, зазоры 2) не действует — проверьте зазоры к соседям. Планка под крышей встаёт вплотную к верху корпуса.</p></>}
                {m.doors&&<label className="hardware-field">Монтаж фасадов<select aria-label="Монтаж фасадов" value={m.doorMount??'overlay'} onChange={e=>modify(n=>{if(e.target.value==='inset')n.doorMount='inset';else delete n.doorMount;})}><option value="overlay">Накладные</option><option value="inset">Вкладные в проём</option></select></label>}
                {m.doors&&!m.alu&&!m.vernissage&&!m.kitchen&&<label className="hardware-field">Зеркало на фасадах<select aria-label="Зеркало на фасадах" value={m.mirror??''} onChange={e=>modify(n=>{if(e.target.value){n.mirror=e.target.value;mirrorEdgeHandles(n);}else delete n.mirror;})}><option value="">Нет · фасады ЛДСП</option>{ALU_INSERTS.filter(i=>i.mirror).map(i=><option key={i.id} value={i.id}>{i.label} на основе ЛДСП 16 · во весь фасад</option>)}</select></label>}
                {m.mirror&&<p className="field-note">Зеркало 4 мм с армирующей плёнкой наклеивается на фасад ЛДСП 16 (основа в раскрое), кромка зеркала полируется. Наклейка — 1 200 ₽/м² (клеит цех). Открывание — торцевой ручкой (решение 26.10).</p>}
                {m.mirror&&mirrorBracketDoors(m)>0&&<p className="essential-note" role="status">На зеркальном фасаде стоит скоба ({mirrorBracketDoors(m)} шт.): зеркальная дверь открывается торцевой ручкой. <button type="button" className="outline" onClick={()=>modify(n=>mirrorEdgeHandles(n))}>Поставить торцевую</button></p>}
                {m.doors&&<label className="hardware-field">Кромка фасадов<select aria-label="Кромка фасадов корпуса" value={m.edgeFacade??2} onChange={e=>modify(n=>{const v=Number(e.target.value) as EdgeThickness;if(v===2)delete n.edgeFacade;else n.edgeFacade=v;})}>{EDGE_CHOICES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>}
                {(['left','right'] as const).map(side=>{const sp=m.sidePanels?.[side];return <label key={side} className="hardware-field"><span><input type="checkbox" aria-label={'Боковая фальшпанель '+(side==='left'?'слева':'справа')} checked={!!sp} onChange={e=>modify(n=>{const next={...n.sidePanels};if(e.target.checked)next[side]={height:Math.max(n.height,2400),depth:n.depth+18};else delete next[side];if(Object.keys(next).length)n.sidePanels=next;else delete n.sidePanels;})}/> Боковая фальшпанель {side==='left'?'слева':'справа'} до потолка</span>{sp&&<span className="side-panel-fields"><input type="number" aria-label={'Высота боковой панели '+side} min={m.height} max={RULES.sidePanelMaxH} step={10} key={'h'+sp.height} defaultValue={sp.height} onKeyDown={ev=>{if(ev.key==='Enter')ev.currentTarget.blur();}} onBlur={ev=>{const v=Number(ev.target.value);if(!modify(n=>{n.sidePanels={...n.sidePanels,[side]:{...sp,height:v}};}))ev.target.value=String(sp.height);}}/><input type="number" aria-label={'Глубина боковой панели '+side} min={m.depth} max={RULES.sidePanelMaxD} step={10} key={'d'+sp.depth} defaultValue={sp.depth} onKeyDown={ev=>{if(ev.key==='Enter')ev.currentTarget.blur();}} onBlur={ev=>{const v=Number(ev.target.value);if(!modify(n=>{n.sidePanels={...n.sidePanels,[side]:{...sp,depth:v}};}))ev.target.value=String(sp.depth);}}/></span>}</label>;})}
                {(['left','right'] as const).map(side=>{const sp=m.sidePanels?.[side];if(!sp)return null;return <label key={'t'+side} className="hardware-field"><span><input type="checkbox" aria-label={'Добор 32 мм '+(side==='left'?'слева':'справа')} checked={sp.thick===32} onChange={e=>modify(n=>{const cur=n.sidePanels?.[side];if(!cur)return;const next={...cur};if(e.target.checked)next.thick=32;else delete next.thick;n.sidePanels={...n.sidePanels,[side]:next};})}/> {side==='left'?'Слева':'Справа'}: 32 мм — две плиты 16 склейкой (добор в цвет корпуса)</span></label>;})}
                {m.vernissage&&(['left','right'] as const).map(side=>{const sp=m.sidePanels?.[side];if(!sp)return null;return <label key={'f'+side} className="hardware-field"><span><input type="checkbox" aria-label={'Видимый бок из фасада '+(side==='left'?'слева':'справа')} checked={!!sp.facade} onChange={e=>modify(n=>{const cur=n.sidePanels?.[side];if(!cur)return;const next={...cur};if(e.target.checked){next.facade=true;delete next.thick;}else delete next.facade;n.sidePanels={...n.sidePanels,[side]:next};})}/> {side==='left'?'Слева':'Справа'}: видимый бок из фасада — МДФ Вернисаж гладкий в цвет фасадов</span></label>;})}
                {m.sections.some(s=>s.rod)&&<label className="hardware-field">Штанга<select aria-label="Тип штанги" value={m.rodType??'round'} onChange={e=>modify(n=>{if(e.target.value==='oval')n.rodType='oval';else delete n.rodType;})}><option value="round">Круглая D25 хром</option><option value="oval">Овальная 15×30</option></select></label>}
                {(['left','right'] as const).map(side=>{const w=m.wallFiller?.[side];if(!w&&m.cornerFiller!==side)return null;return <div key={side} className="filler-status">{m.cornerFiller===side?<p className="field-note">{cornerStrip(m)?`${side==='left'?'Слева':'Справа'} фасад упирается в соседний корпус: фальш-планка 100 из фасадного материала вровень с фасадами, на эксцентриках, зазор 3 мм к фасаду.`:`У ${side==='left'?'левой':'правой'} боковины сосед под 90°: планка 100×16 торцом, выступает на 40 мм вперёд.`}</p>:<NumberField label={`Фальш к ${side==='left'?'левой':'правой'} стене торцом, ширина планки`} value={w!.width} min={RULES.wallFillerMin} max={RULES.wallFillerMax} onChange={v=>modify(n=>{n.wallFiller={...n.wallFiller,[side]:{kind:'edge',width:v}};})}/>}</div>;})}
                {/* эскиз главнее регламента (решение Макса 26.10.2026): фальш у стены снимается флагом, корпус встаёт вплотную к стене */}
                {/* интеграция 26.10: один флаг autoFillersOff — «Без фальша у стены» (o-7441182) = «Без автофальшей — по эскизу» (o-7442203) */}
                {needsWallFiller(m)&&!m.kitchen&&<label className="hardware-field"><span><input type="checkbox" aria-label="Без фальша у стены" checked={!!m.autoFillersOff} onChange={e=>{try{commitProject(setWallFillersOff(project,placed.id,e.target.checked));}catch(err){setError((err as Error).message);}}}/> Без фальша у стены · по эскизу (корпус вплотную к стене, без угловой планки)</span></label>}
                {needsWallFiller(m)&&!m.kitchen&&m.autoFillersOff&&<p className="field-note">Автофальши у стен выключены: корпус стоит без планки у стены, как на эскизе. Проверьте, что фасад открывается и не задевает стену.</p>}
                {needsWallFiller(m)&&!m.autoFillersOff&&!m.wallFiller&&!m.cornerFiller&&<p className="field-note">Фальши — планка 100×16 торцом снаружи боковины. Добавляются сами, когда корпус придвинут к стене (зазор 5 мм) или к другому корпусу под 90°.</p>}
                <label className="hardware-field">Крыша<select aria-label="Материал крыши" value={m.topType==='none'?'none':m.seatTop?'seat':(m.topGlass??'ldsp')} onChange={e=>modify(n=>{const v=e.target.value;delete n.seatTop;if(v==='none'){n.topType='none';delete n.topGlass;}else{delete n.topType;if(v==='ldsp'||v==='seat')delete n.topGlass;else n.topGlass=v;if(v==='seat')n.seatTop=true;}})}><option value="ldsp">ЛДСП 16 в цвет корпуса</option>{/* заказ 7437584: сиденье скамьи */}<option value="seat">Посадочное место 32 · две плиты ЛДСП склейкой</option><option value="none">Без крыши · каркас на стяжках</option>{ALU_INSERTS.map(i=><option key={i.id} value={i.id}>Стекло · {i.label}</option>)}</select></label>
                {m.topGlass&&<p className="field-note">Закалённое стекло 4 мм ложится на боковины сверху, кромка полируется по периметру. В раскрой ЛДСП не идёт, в смете — стекло, закалка и полировка.</p>}
                {m.desk&&<>
                  <label className="hardware-field">Опоры стола<select aria-label="Опоры стола" value={m.desk.sides} onChange={e=>modify(n=>{n.desk={...n.desk!,sides:e.target.value as NonNullable<Module['desk']>['sides']};})}><option value="both">Две боковины до пола</option><option value="left">Только левая · справа на соседний корпус</option><option value="right">Только правая · слева на соседний корпус</option><option value="none">Без опор · между двумя корпусами</option></select></label>
                  <p className="field-note">Столешница {RULES.deskTop} мм (две плиты 16 склейкой, кромка 2 по периметру) — её ширина и глубина задаются габаритами корпуса выше. Подстолье настраивается отдельно.</p>
                  <h3>Подстолье</h3>
                  <NumberField label="Ширина подстолья по внешним граням опор" value={deskGeometry(m).baseWidth} min={RULES.minW} max={m.width-deskGeometry(m).x0} onChange={v=>modify(n=>{n.desk={...n.desk!,baseWidth:v};})}/>
                  <NumberField label="Отступ подстолья от левого края столешницы" value={deskGeometry(m).x0} min={0} max={m.width-RULES.minW} onChange={v=>modify(n=>{const bw=Math.min(deskGeometry(n).baseWidth,n.width-v);n.desk={...n.desk!,baseX:v,baseWidth:bw};})}/>
                  <NumberField label="Глубина опор (от задней кромки)" value={deskGeometry(m).baseDepth} min={RULES.minD} max={m.depth} onChange={v=>modify(n=>{n.desk={...n.desk!,baseDepth:v};})}/>
                  <NumberField label="Царга: высота" value={m.desk.apron} min={RULES.deskApronMin} max={RULES.deskApronMax} onChange={v=>modify(n=>{n.desk={...n.desk!,apron:v};})}/>
                  <NumberField label="Царга: отступ от задней кромки вперёд" value={deskGeometry(m).apronOffset} min={0} max={Math.max(0,deskGeometry(m).baseDepth-RULES.panel-50)} onChange={v=>modify(n=>{n.desk={...n.desk!,apronOffset:v};})}/>
                  <p className="field-note">Царгу смещают вперёд, когда за столом батарея. Опоры и царга крепятся к соседнему корпусу стяжкой эксцентрик + шкант, если своей опоры с этой стороны нет.</p>
                  <label className="hardware-field"><span><input type="checkbox" aria-label="Решётка в столешнице" checked={!!m.desk.grille} onChange={e=>modify(n=>{if(e.target.checked)n.desk={...n.desk!,grille:{x:Math.round((n.width-Math.min(600,n.width-60))/2),width:Math.min(600,n.width-60),depth:Math.min(100,n.depth-RULES.deskGrilleRear-30)}};else{const {grille:_g,...rest}=n.desk!;void _g;n.desk=rest;}})}/> Вентиляционная решётка в столешнице над батареей</span></label>
                  {m.desk.grille&&<>
                    <NumberField label="Решётка: отступ от левого края" value={m.desk.grille.x} min={30} max={m.width-30-RULES.deskGrilleMinW} onChange={v=>modify(n=>{n.desk={...n.desk!,grille:{...n.desk!.grille!,x:v}};})}/>
                    <NumberField label="Решётка: ширина" value={m.desk.grille.width} min={RULES.deskGrilleMinW} max={m.width-30-m.desk.grille.x} onChange={v=>modify(n=>{n.desk={...n.desk!,grille:{...n.desk!.grille!,width:v}};})}/>
                    <NumberField label="Решётка: глубина" value={m.desk.grille.depth} min={60} max={m.depth-RULES.deskGrilleRear-30} onChange={v=>modify(n=>{n.desk={...n.desk!,grille:{...n.desk!.grille!,depth:v}};})}/>
                    <p className="field-note">Решётка стоит в {RULES.deskGrilleRear} мм от задней кромки, вырез в обеих плитах столешницы. В смете — решётка по оценке, подтвердить счётом.</p>
                  </>}
                  <p className="field-note">Высота стола {RULES.deskMinH}–{RULES.deskMaxH}, ширина до {RULES.deskMaxW} мм. Под столешницу можно поставить тумбу: пересечение считается только со столешницей, опорами и царгой. Чтобы вернуть шкаф — выберите другой шаблон наполнения.</p>
                </>}
                <label className="hardware-field">Крепёж корпуса<select aria-label="Крепёж корпуса" value={m.fastening??'confirmat'} onChange={e=>modify(n=>{if(e.target.value==='eccentric')n.fastening='eccentric';else delete n.fastening;})}><option value="confirmat">Евровинты · видны снаружи, под заглушки</option><option value="eccentric">Эксцентрики D15 · скрытый крепёж</option></select></label>
                <label className="hardware-field">Кромка корпуса<select aria-label="Кромка корпуса" value={m.edgeBody??2} onChange={e=>modify(n=>{const v=Number(e.target.value) as EdgeThickness;if(v===2)delete n.edgeBody;else n.edgeBody=v;})}>{EDGE_CHOICES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
                <p className="field-note">{m.fastening==='eccentric'?'Бочонок в пласти горизонталей на 34 мм от торца, шток в боковине; снаружи корпус чистый. В 3D — светлые бочонки при открытых фасадах.':'Конфирматы 5×50 через боковины в дно, крышу, жёсткие полки и полку над ящиками; снаружи — заглушки в цвет. В 3D — тёмные головки на боковинах.'}</p>
                {m.topType!=='none'&&!m.topGlass&&!m.alu&&<label className="hardware-field">Скос под потолок<select aria-label="Скос под потолок" value={m.slope?.side??'none'} onChange={e=>modify(n=>{const v=e.target.value;if(v==='none')delete n.slope;else n.slope={side:v as 'left'|'right',lowHeight:Math.min(n.height-RULES.slopeMinDrop,Math.max(RULES.slopeMinLow,n.slope?.lowHeight??Math.round((n.height*0.65)/10)*10))};})}><option value="none">Нет · крыша ровная</option><option value="left">Ниже слева</option><option value="right">Ниже справа</option></select></label>}
                {m.slope&&<NumberField label={`Высота корпуса у ${m.slope.side==='left'?'левой':'правой'} стороны`} value={m.slope.lowHeight} min={RULES.slopeMinLow} max={m.height-RULES.slopeMinDrop} onChange={v=>modify(n=>{n.slope={...n.slope!,lowHeight:v};})}/>}
                {m.slope&&<p className="field-note">Как задать: выберите, с какой стороны потолок ниже, и впишите высоту корпуса у этой стороны (от {RULES.slopeMinLow} до {m.height-RULES.slopeMinDrop} мм). Высокая сторона — общая высота корпуса выше.</p>}
                {m.slope&&<p className="field-note">Конструкция цеха: крыша плоская на высоте низкой стороны, низкая боковина — до крыши, высокая — до потолка. Фасады прямоугольные до низкой стороны, треугольник над ними закрывает фальш из фасадного материала вровень с фасадами (трапеция в раскрое). Набивной задник — трапецией. Так дешевле, чем косая крыша.</p>}
                {!m.slope&&!m.alu&&m.doorMount!=='inset'&&!m.sections.some(s=>s.drawers>0)&&<label className="hardware-field">Скос фронта в плане<select aria-label="Скос фронта в плане" value={m.skew?.side??'none'} onChange={e=>modify(n=>{const v=e.target.value;if(v==='none')delete n.skew;else n.skew={side:v as 'left'|'right',depth:n.skew?.depth??Math.max(RULES.minD,Math.round((n.depth-150)/10)*10)};})}><option value="none">Нет · фронт ровный</option><option value="left">Мельче слева</option><option value="right">Мельче справа</option></select></label>}
                {m.skew&&<NumberField label={`Глубина корпуса у ${m.skew.side==='left'?'левой':'правой'} стороны`} value={m.skew.depth} min={RULES.minD} max={m.depth-30} onChange={v=>modify(n=>{n.skew={...n.skew!,depth:v};})}/>}
                {m.skew&&<p className="field-note">Фасады и цоколь идут под углом {Math.round(Math.abs(skewAngle(m))*180/Math.PI)}° к задней стенке, боковины разной глубины, дно, крыша и полки — трапецией (в раскрое габарит с пометкой «скос»). Ящики, вкладные и алюминиевые фасады при скосе не ставятся.</p>}
                <label className="hardware-field">Петли одиночной двери<select aria-label="Сторона петель" value={m.hingeSide??'left'} onChange={e=>modify(n=>n.hingeSide=e.target.value as Module['hingeSide'])}><option value="left">Слева</option><option value="right">Справа</option></select></label>
              </details>

              {!m.casework&&<SettingsSection title="Состав секции"><OpeningLayoutEditor module={m} sid={s.id} edit={modify}/></SettingsSection>}
            </SettingsTree>
          )}
          <div className={"property-footer"+(check.ok?"":" warn")}>
            {check.ok?<CheckCircle2 size={18} />:<TriangleAlert size={18} />}
            <div>
              <strong>{check.title}</strong>
              <span>{check.detail}</span>
            </div>
          </div>
        </>}
        </SafeBoundary></aside>
      </WorkspacePanels>
      {!presentation&&<SafeBoundary label="Нижняя панель" resetKey={project}><ProjectDock project={project} commit={commitProject} inspect={inspectPart} warnings={placementWarnings.length} onWarnings={()=>{setRoomPlan(true);setTab("room");}} openParts={()=>setModal("parts")} onLayout={()=>setFit(f=>f+1)} openOutput={t=>{if(roomPlan){setRoomPlan(false);setView("iso");setShowRoom(true);}setOutputTab(t);setModal("output");}}/></SafeBoundary>}
      {modal && modal!=="facade-editor" && (
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
                <span className="eyebrow">{modal === "parts" || modal === "handles" ? "МОДУЛЬ" : "ПРОЕКТ"}</span>
                <h2 id="modal-title">
                  {modal === "room-setup" ? "Шаг 1 · Параметры помещения" : modal === "new" ? "Новый проект" : modal === "library" ? "Моя библиотека модулей" : modal === "render" ? "Изображение проекта" : modal === "cloud" ? "Кабинет проектов" : modal === "output"
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
            {modal === "room-setup" ? <div className="room-setup">
                <p className="field-note">Начнём с комнаты: размеры, потолок и номер замера. Потом окна, двери и коммуникации, затем каркасы, наполнение и фасады. Всё можно изменить позже во вкладке помещения.</p>
                {(["width","depth","height"] as const).map(k=><NumberField key={k} label={{width:'Ширина комнаты (стена с мебелью)',depth:'Глубина комнаты',height:'Высота потолка'}[k]} value={project.room[k]} min={500} max={20000} onChange={v=>commitProject({...project,room:{...project.room,[k]:v}})}/>)}
                <label className="hardware-field">Тип потолка<select aria-label="Тип потолка" value={project.room.ceiling??'stationary'} onChange={e=>commitProject({...project,room:{...project.room,ceiling:e.target.value as typeof project.room.ceiling}})}><option value="stationary">Стационарный · зазор 30 мм</option><option value="stretch">Натяжной · зазор 20 мм</option></select></label>
                <label className="hardware-field">Номер замера<input aria-label="Номер замера" maxLength={60} key={project.measurement?.number??''} defaultValue={project.measurement?.number??''} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} onBlur={e=>{const v=e.target.value.trim();if(v!==(project.measurement?.number??''))commitProject({...project,measurement:{number:v,date:project.measurement?.date??'',notes:project.measurement?.notes??''}});}}/></label>
                <div className="room-setup-actions"><button className="primary" onClick={()=>goStage('fixtures')}>Дальше: окна, двери, коммуникации <ChevronRight size={15}/></button><button className="outline" onClick={()=>{setModal(null);goStage('bodies');}}>Пропустить, сразу к каркасам</button></div>
                <p className="field-note">Есть Config.xml из скрипта Базиса «Замер помещения»? Его можно загрузить на шаге «Коммуникации» — комната и объекты появятся сами.</p>
              </div> : modal === "new" ? <NewProjectPanel project={project} allowEmpty={!!onEmptyProject} open={next=>{if(commitProject(next)){if(next.modules[0])selectModule(next.modules[0].id);setRoomPlan(false);setView("iso");setMode("move");setModal(null);return true;}return false;}}/> : modal === "library" ? <ModuleLibrary module={m} group={project.modules.filter(a=>liveGroupIds.includes(a.id))} insertGroup={source=>{const result=appendModuleGroup(project,source);if(commitProject(result.project)){setGroupIds(result.ids);setMoveAll(false);setFocusActive(false);selectModule(result.ids[0]);setMode('move');setModal(null);return true;}return false;}} insert={source=>{const next=appendModule(project,source);next.modules.at(-1)!.module.name=source.name;if(commitProject(next)){selectModule(next.modules.at(-1)!.id);setModal(null);return true;}return false;}}/> : modal === "render" ? <div className="render-preview"><img src={renderImage} alt="Изображение мебели для клиента"/><button className="primary render-download" onClick={()=>savePng(renderImage)}>Скачать PNG</button><p className="field-note">PNG, до 2560 пикселей. Файл можно сохранить и отправить клиенту.</p></div> : modal === "cloud" ? <CloudPanel project={project} update={commitProject}/> : modal === "output" ? (
              <SafeBoundary label="Документы проекта" resetKey={project}><OutputPanel
                  initialTab={outputTab}
                project={project}
                capture={(opts) => capture.current?.(opts)}
                inspect={inspectPart}

                update={commitProject}
              /></SafeBoundary>
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
                        title={decorTitle(c.n)}
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
                        {decorLabel(c.n)}
                        <small className="decor-meta">{c.tier.toLowerCase()}</small>
                        {materialRecipients.length>0&&materialRecipients.every(a=>(a.module[materialTarget]??a.module.facadeDecor)===c.n) && <Check size={15} />}
                      </button>
                    ))}
                </div>
              </>
            ) : modal === "handles" ? (
              <>
                <p className="field-note">Корпус «{m.name}». Выберите конкретный фасад или нажмите на его ручку в 3D. Групповое назначение заменит индивидуальные ручки выбранной группы; геометрия и цена обновляются вместе. Ручка длиннее своего фасада не применится.</p>
                <label className="hardware-field">Конкретный фасад<select aria-label="Конкретный фасад для ручки" value={handleFace} onChange={e=>{setHandleFace(e.target.value);setMaterialScope('active');}}><option value="">Групповое назначение</option>{parts(m).filter(p=>p.id.includes(':door:')||p.id.endsWith(':facade')).map(p=><option key={p.id} value={p.id}>{p.name} · секция {m.sections.findIndex(s=>s.id===p.sectionId)+1}{p.id.includes(':door:')?' · створка '+(Number(p.id.split(':door:')[1])+1):''}</option>)}</select></label>
                {!handleFace&&<><label className="hardware-field">Ручки для<select aria-label="Назначение ручек" value={handleTarget} onChange={e=>setHandleTarget(e.target.value as 'doors'|'drawers')}><option value="doors">Распашных фасадов</option><option value="drawers">Ящиков</option></select></label>
                <label className="hardware-field">Применить<select aria-label="К каким корпусам применить ручку" value={materialScope} onChange={e=>setMaterialScope(e.target.value as typeof materialScope)}><option value="active">Выбранный корпус: {m.name}</option><option value="group" disabled={!liveGroupIds.length}>Отмеченная группа ({liveGroupIds.length})</option><option value="all">Все корпуса проекта ({project.modules.length})</option></select></label></>}
                <label className="search"><Search size={18} /><input autoFocus placeholder="Найти ручку: 128, чёрный, HEXA…" aria-label="Найти ручку" value={search} onChange={e=>setSearch(e.target.value)}/></label>
                <div className="handle-list">
                  {(["workshop","lemana"] as const).map(vendor=>{
                    const items=HANDLES.filter(h=>h.vendor===vendor&&(h.label+' '+h.len+' '+(h.art??'')).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.len-b.len||a.price-b.price);
                    if(!items.length)return null;
                    return <div key={vendor}><h3>{vendor==='workshop'?'Ручки цеха':'Лемана Про · выбор клиента, розница'}</h3>{items.map(h=>{
                      const current=(handleFace?(facadeHandleId(m,handleFace)??DEFAULT_HANDLE):((handleTarget==='drawers'?m.drawerHandleId??m.handleId:m.handleId)??DEFAULT_HANDLE))===h.id;
                      return <button key={h.id} className="handle-item" aria-pressed={current} onClick={()=>{
                        if(materialScope==='group'&&!liveGroupIds.length){setError('Сначала отметьте корпуса в группе.');return;}
                        const value=h.id===DEFAULT_HANDLE?undefined:h.id;
                        const applyHandle=(n:Module)=>{if(handleFace){setFacadeHandle(n,handleFace,h.id);return;}if(handleTarget==='drawers'){n.drawerHandleId=h.id;for(const section of n.sections)for(const c of section.drawerConfigs??[])delete c.handleId;}else{for(const section of n.sections)delete section.doorHandles;n.drawerHandleId??=n.handleId??DEFAULT_HANDLE;n.handleId=value;}};
                        const ok=handleFace||materialScope==='active'?modify(applyHandle):commitProject({...project,modules:project.modules.map(a=>{if(materialScope!=='all'&&!liveGroupIds.includes(a.id))return a;const module=structuredClone(a.module);applyHandle(module);return {...a,module};})});
                        if(!ok)return;setMaterialScope('active');setModal(null);setSearch('');
                      }}><HandleThumb h={h}/><span className="handle-name">{h.label}<small className="handle-form">{HANDLE_SHAPE_LABELS[handleShape(h)]}</small></span><span className="handle-meta">{h.len} мм{h.art?' · арт. '+h.art:''}</span>{current&&<Check size={15}/>}</button>;
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
                <details><summary>Что сохранять для клиента и для технолога?</summary><p>Клиенту подготовьте КП в документах: проверьте цену, текст и изображение. Кнопка «Подставить текущую смету» обновляет цену по вашему нажатию; незаполненные позиции сметы требуют уточнения.</p><p>«Комплект ZIP» содержит ведомость, расстановку, размерные виды, карты листов, деталировку, бирки и итоговую стоимость. Редактируемый файл сохраняйте отдельно кнопкой «Скачать комнату». После правок сформируйте комплект заново.</p><p>«Сохранено в браузере» означает локальную запись. Для сохранения в кабинете откройте его и сохраните проект на сервер. В кабинете доступна история версий.</p></details>
                <p><strong>Большая композиция:</strong> поиск над списком появляется после шестого корпуса. Флажок «Двигать всю композицию» переносит все корпуса вместе — в3D, на плане или через отступы.</p>
                <div className="help-note">Карты, ведомость и бирки предназначены для проверки технологом. Присадка, производственные чертежи и проверенные управляющие программы ещё не выпускаются.</div>
              </div>
            )}
          </div>
        </div>
      )}
      </ManagerMode.Provider>
    </div>
  );
}
