import {dishwasherServiceModel} from './dishwasherServices';
import {applianceModel,APPLIANCE_MODEL_TYPES} from './applianceGeometry';
import {surfacePoint} from './roomSurvey';
import {hiddenWalls,roomEdges,edgeVisible,readCutaway,hiddenEdges,outlineEdges,type CutawayWall,type CutKey} from './roomCutaway';
import {edgePanels,edgeLegacyWall,floorPolygon,openingEdge,wallFace,wallPrism,wallSpot,type OnWall} from './roomEdges';
import {edgeLength,type RoomOutline} from './roomOutline';
import {finishById,floorUv,wallUv,defaultAlong,type FinishUnit} from './roomFinishes';
import {drawFinish,FINISH_TEXTURE_PX} from './finishTextures';
import {facadeHandleId} from './model';
import {frameDistance,frameHeight} from './framing';
import {shapeGeometry,worktopGeometry,boardGeometry,aluFrameGeometry,taperGeometry,planTaperGeometry,planContourGeometry,golaSideGeometry,faceContourGeometry,rearNotchSideGeometry,topNotchGeometry} from './boardGeometry';
import {aluProfile,aluInsert,aluFill,aluFillLookId} from './alu';
import {facadeGeometry} from './vernissageGeometry';
import {vernissageLayout,vernissageColor,vernissageGlossy,vernissageTexture} from './facadesVernissage';
import {meshById} from './mesh';
import {meshModel} from './meshModels';
import {procModel,faceAt,fastenerAxis,fastenerGeometry,hingeFallbackModel,nativePlacement} from './hardwareModels';
import {ledLook,TONE_INFO} from './lights';
// Цвета профиля рамочного фасада для сцены.
const ALU_COLOURS:Record<string,number>={silver:0xc9ccd1,white:0xf2f2f2,black:0x2b2b2b,gold:0xc9a86a,champagne:0xd8c7a3,cognac:0x8a5a2b};
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Module as LedModule, Part as LedPart } from "./model";
// Свет подсветки на деталях (задача 14, 22.10.2026) — без источников света (они дорожают с каждым LED и пересобирают шейдеры):
// полупрозрачная аддитивная «засветка» с градиентом цвета тона — на грани стойки вокруг вертикального LED и на поверхности под
// горизонтальным (полка ниже или дно секции), ярче у LED. Плоскости не выбираются кликом (raycast пустой) и не дают тени.
let glowMaps: { mid: THREE.Texture; down: THREE.Texture } | null = null;
function glowTextures() {
  if (glowMaps) return glowMaps;
  const make = (vertical: boolean) => {
    const c = document.createElement("canvas"); c.width = vertical ? 4 : 128; c.height = vertical ? 128 : 4;
    const g = c.getContext("2d")!, grad = vertical ? g.createLinearGradient(0, 128, 0, 0) : g.createLinearGradient(0, 0, 128, 0);
    if (vertical) { grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.3, "rgba(255,255,255,0.45)"); grad.addColorStop(1, "rgba(255,255,255,0)"); }
    else { grad.addColorStop(0, "rgba(255,255,255,0)"); grad.addColorStop(0.5, "rgba(255,255,255,1)"); grad.addColorStop(1, "rgba(255,255,255,0)"); }
    g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  glowMaps = { mid: make(false), down: make(true) };
  return glowMaps;
}
function ledGlow(mesh: THREE.Mesh, p: LedPart, m: LedModule, all: LedPart[]) {
  if (typeof document === "undefined") return;
  const tone = TONE_INFO[ledLook(m, p.id).tone], maps = glowTextures();
  const mat = (map: THREE.Texture, opacity: number) => new THREE.MeshBasicMaterial({ color: tone.glow, map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const add = (geo: THREE.PlaneGeometry, material: THREE.Material, pos: [number, number, number], rot: [number, number, number]) => {
    const g = new THREE.Mesh(geo, material); g.position.set(...pos); g.rotation.set(...rot); g.raycast = () => {}; g.renderOrder = 2; g.userData = { glow: true }; mesh.add(g);
  };
  const stand = /:light:(left|right)$/.exec(p.id);
  if (stand) {
    const left = stand[1] === "left", front = Math.max(20, m.depth - p.position[2]), w = 2 * Math.min(170, front);
    add(new THREE.PlaneGeometry(w, p.size[1]), mat(maps.mid, 0.5), [(left ? -1 : 1) * (p.size[0] / 2 - 0.6), 0, 0], [0, left ? Math.PI / 2 : -Math.PI / 2, 0]);
    return;
  }
  // горизонталь (полка, крыша): светит вниз — на ближайшую горизонталь под ней в пределах LED по X
  const y0 = p.position[1] - p.size[1] / 2, x = p.position[0];
  const below = all.filter((q) => q !== p && q.material !== "metal" && (q.role === "shelf" || q.role === "body") && q.size[1] <= 40 && q.size[0] > 100 && q.size[2] > 100 && !q.rotY && !q.rotZ
    && Math.abs(q.position[0] - x) < q.size[0] / 2 && q.position[1] + q.size[1] / 2 < y0 - 1).sort((a, z) => (z.position[1] + z.size[1] / 2) - (a.position[1] + a.size[1] / 2))[0];
  if (!below) return;
  const top = below.position[1] + below.size[1] / 2, zFront = below.position[2] + below.size[2] / 2, depth = below.size[2] * 0.9, len = Math.min(p.size[0], below.size[0]);
  add(new THREE.PlaneGeometry(len, depth), mat(maps.down, 0.55), [0, top + 0.6 - p.position[1], zFront - depth / 2 - p.position[2]], [-Math.PI / 2, 0, 0]);
}
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { handleById } from "./handles";
import { handleModel } from "./handleModels";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
// Модели ручек (Blender → GLB, scripts/blender_handles.py): кэш по файлу, экземпляры делят геометрию.
const gltfLoader = new GLTFLoader();
const handleModels = new Map<string, Promise<THREE.Group>>();
// Сбой загрузки (сеть, локальный сервер демо, обрыв при пересборке сцены) не кэшируется: раньше отклонённый промис оставался в кэше
// до перезагрузки страницы, и все петли/конфирматы проекта рисовались заглушками — серые коробки и штыри над крышей (баг Макса 20.10).
// Теперь — попытки с растущей паузой, отказ убирается из кэша (следующая пересборка сцены пробует снова) и пишется в консоль с адресом.
// Паузы 0,5–1–2–4 с (≈7,5 с всего), а не 3×0,5: пересборка демо (vite build, emptyOutDir) держит папку models пустой дольше 1,5 с —
// вкладка, открытая во время пересборки, рисовала крепёж заглушками и декоры без текстур (снимок Макса 20.10, «что-то выпирает»).
const RETRY_DELAYS = [500, 1000, 2000, 4000];
/** Отделка стены (покраска, обои, плитка), руководство 30.10, п. 3: левую стену солнце (слева-спереди) не освещает, её видно только
 *  в холодном заполняющем свете и небе — бежевая покраска уходила в серо-зелёный, хотя у всех стен один цвет. Часть цвета отделки —
 *  собственное свечение: стены одного цвета остаются одного оттенка, свет и тени мебели дают только естественную разницу яркости. */
const WALL_LIT = 0.5, WALL_GLOW = 0.55;
function evenWallLight(mat: THREE.MeshStandardMaterial) {
  const base = mat.color.clone();
  mat.color.copy(base).multiplyScalar(WALL_LIT);
  mat.emissive.copy(base).multiplyScalar(WALL_GLOW);
  if (mat.map) mat.emissiveMap = mat.map;
}
function withRetry<T>(load: (ok: (v: T) => void, fail: (e: unknown) => void) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const attempt = (k: number) => load(resolve, (e) => k < RETRY_DELAYS.length ? setTimeout(() => attempt(k + 1), RETRY_DELAYS[k]) : reject(e));
    attempt(0);
  });
}
function loadHandleModel(file: string) {
  let p = handleModels.get(file);
  if (!p) {
    const url = `${import.meta.env.BASE_URL}models/${file.includes("/") ? file : "handles/" + file}`;
    const q: Promise<THREE.Group> = withRetry<THREE.Group>((ok, fail) => gltfLoader.load(url, (g) => ok(g.scene), undefined, fail));
    q.catch((e) => { if (handleModels.get(file) === q) handleModels.delete(file); console.warn("Модель не загрузилась:", url, e); });
    handleModels.set(file, p = q);
  }
  return p;
}
/** Профиль из Blender (метровая заготовка: x — поперёк, y — длина, z — глубина) вписывается в габарит детали:
 *  длина тянется, сечение остаётся; mirror — зеркально по поперечной оси; length 'x' — профиль лежит горизонтально. */
function fitProfile(src: THREE.Group, part: { size: [number, number, number]; model?: { length: "x" | "y"; mirror?: boolean } }, material: THREE.Material) {
  const inner = new THREE.Group(), outer = new THREE.Group(), model = src.clone(true);
  model.scale.setScalar(1000);
  model.traverse((o) => { if (o instanceof THREE.Mesh) { o.material = material; o.castShadow = true; o.receiveShadow = true; } });
  inner.add(model);
  if (part.model?.mirror) inner.scale.x = -1;
  const pivot = new THREE.Group(); pivot.add(inner);
  if (part.model?.length === "x") pivot.rotation.z = -Math.PI / 2;
  outer.add(pivot); outer.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pivot), size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  const s = new THREE.Vector3(part.size[0] / Math.max(size.x, 1e-6), part.size[1] / Math.max(size.y, 1e-6), part.size[2] / Math.max(size.z, 1e-6));
  outer.scale.copy(s); outer.position.set(-centre.x * s.x, -centre.y * s.y, -centre.z * s.z);
  return outer;
}
import { boxes, parts, shelfGaps, drawerConfig, drawerStackHeight, RULES, type Module } from "./model";
import { catalog } from "./catalog";
import {localToRoom,roomToLocal,moduleCenter,bounds,sideExtension,type Room,type PlacedModule} from "./project";
import type {GapSide,StretchPlan} from './rowResize';
import {wallPanels} from './roomGeometry';
import {FIXTURES,fixtureBox,fixtureLabel} from './fixtures';
import {rodCylinder} from './rawModule';
import {gapLabelX,openingSizeLabel} from './clientLabels';
import {missMenuTarget,screenRect} from './missMenu';
import {labelRank,isOverallDim} from './labelPriority';
import {columnOf} from './matchSize';
import {candidateLines,guidesInView,guideSegment,makeGuide,parseTyped,placeGuide,snapMoveToGuides,snapOut,guidePlanes,v3,carcassCorners,type Guide,type GuideLine,type V3} from './guides';
import {openEase,openToggleKey,stepOpen} from './editActions';
import {altKeyupGuard,acrossSegments,markDragStarts,isMarkClick,wheelGuard,historyGuard,sideView,sideHeightFree,snapMode,isPointMode,toView,fromView,viewDelta,toSegments,pointSnap,snapDelta,snapAlong,nearestOutlineCorner,hitText,POINT_SNAP_PX,type SnapMode,type Seg2,type P2,type PointHit} from './pointSnap';
import {cornerDims,axisOf,edgeOf,typedCornerPull,parseCornerTyped,cornerHandleTitle,DIM_WORD,type CornerPull,type CornerPlan,type Dim,type End} from './cornerStretch';
import {editsText} from './historyShortcuts';
import './guides.css';
/** side — вид справа (камера с +X), left — вид слева (клавиша A, п.28 волны 22.10). */
export type View = "iso" | "front" | "side" | "left" | "top";
type Props = {
  hiddenModuleIds?:string[];
  viewKey?:string;
  isoDirection?: [number, number];
  captureReady: (fn: ((opts?: {frame?: boolean}) => string) | undefined) => void;
  module: Module;
  mode:'move'|'fill'|'orbit'|'select';
  hideFacades?:boolean;
  hideFurniture?:boolean;
  moveAll:boolean;
  /** Галочка «Привязки корпусов»: false — тяга корпуса, угла и края «↔» без привязки (решение Макса 30.10: Shift больше не «без привязки»). */
  snapping?:boolean;
  groupIds?:string[];
  snap:(id:string,p:{x:number;y:number;z:number})=>{x:number;y:number;z:number};
  /** Комната с контуром (критик 30.10): последний шаг тяги корпуса — упереться в стену (project.keepInRoom), на всех путях тяги. */
  keepIn?:(id:string,p:{x:number;y:number;z:number})=>{x:number;y:number;z:number};
  onMoveModule:(id:string,p:{x:number;y:number;z:number})=>boolean;
  moveProblem:(id:string,p:{x:number;y:number;z:number})=>string|undefined;
  onMoveDivider:(mid:string,sid:string,delta:number)=>boolean;
  dividerProblem:(mid:string,sid:string,delta:number)=>string|undefined;
  /** Частичная перегородка (решение Макса 23.10.2026): тянуть её конец — горизонталь-опору под/над ней — по высоте. Без поля — не тянется. */
  onMoveDividerEnd?:(mid:string,sid:string,edge:'under'|'over',delta:number)=>boolean;
  dividerEndProblem?:(mid:string,sid:string,edge:'under'|'over',delta:number)=>string|undefined;
  partProblem:(mid:string,sid:string,pid:string,delta:number,target?:{mid:string;sid:string;y:number})=>string|undefined;
  onMovePart:(mid:string,sid:string,pid:string,y:number)=>boolean;
  onDropItem:(kind:string,mid:string,sid:string,y:number)=>boolean;
  onTransfer:(mid:string,sid:string,pid:string,toMid:string,toSid:string,y:number)=>boolean;
  arrangement: PlacedModule[];
  activeId: string;
  room?: Room;
  appliances?: Room["obstacles"];
  selectedObstacle?:string;
  onObstacleSelect:(id:string)=>void;
  selectedFixture?:string;
  onFixtureSelect?:(id:string)=>void;
  selectedOpening?:string;
  /** Клик по размеру помещения, проёма или объекта на стене в 3D: kind room/opening/fixture, field width/depth/height/offset/end/sill/fromFloor. */
  onRoomDimension?:(kind:'room'|'opening'|'fixture',id:string,field:string,value:number)=>void;
  transparent: boolean;
  /** Полупрозрачные фасады: видно наполнение за закрытыми дверями и фасадами ящиков. */
  clearFacades?: boolean;
  /** Клик по ручке фасада или ящика: открыть выбор ручки корпуса. */
  onHandleClick?: (mid: string, pid: string) => void;
  /** Правая кнопка по корпусу: контекстное меню редактирования (как в B Planner). Координаты — экранные. */
  onEnvironmentContext?:(kind:'opening'|'fixture'|'obstacle',id:string)=>void;
  onContextMenu?: (mid: string, sid: string, x: number, y: number, info?: { pid?: string; role?: string; localY?: number }) => void;
  onToggleModule?: (id:string)=>void;
  /** Обычный щелчок по корпусу (без Shift): App снимает отметки группы, если корпус не в ней (критик 29.10). */
  onPlainModuleClick?: (id:string)=>void;
  onModuleSelect: (id: string) => void;
  onDimension: (key: "width" | "height" | "depth") => void;
  onGap: (index: number) => void;
  /** Клик по размеру «от дна до верха полки над ящиками» — задать высоту блока ящиков. */
  onDrawerStack?: (sid: string) => void;
  onPartSelect: (sid: string, pid: string, mid?: string) => void;
  selected: string;
  selectedPart?:string;
  onSelect: (id: string) => void;
  texture?: string;
  facadeTexture?: string;
  view: View;
  fit: number;
  focusActive?:boolean;
  openDoors: boolean;
  exploded: boolean;
  dimensions: boolean;
  roomDimensions?:boolean;
  gapDimensions?:boolean;
  presentation?:boolean;
  /** «Ближние стены: скрыть» — стена между камерой и комнатой прячется целиком (по умолчанию — настройка зрителя, ВКЛ). */
  cutaway?:boolean;
  drawerPreview?:{sid:string;index:number};
  /** Режим «Подсветка» (20.10.2026): левый клик по детали корпуса не выбирает и не тянет её, а переключает подсветку (onLightPick). */
  lightMode?:boolean;
  /** alts — остальные детали этого корпуса под курсором по лучу (задача 14: «вертикаль» пропускает полку перед стойкой). */
  onLightPick?:(mid:string,pid:string,alts?:string[])=>void;
  /** Зазоры выбранного модуля по оси ширины (запрос Макса 20.10.2026): плашки слева и справа в режимах «Двигать корпуса» и «Выбрать». */
  rowGaps?:{left:GapSide;right:GapSide}|null;
  onGapClick?:(side:'left'|'right',x:number,y:number)=>void;
  /** Ручки растяжения «↔» на боках выбранного модуля в режиме «Двигать корпуса». */
  stretchable?:boolean;
  stretchPlan?:(mid:string,side:'left'|'right',raw:number,snap:boolean)=>Partial<StretchPlan>;
  onStretch?:(mid:string,side:'left'|'right',raw:number,snap:boolean)=>boolean;
  /** Растяжение за угол (решение Макса 29.10.2026, как эластичная секция Базиса): квадратные ручки по углам выбранного корпуса
   *  в видах спереди/сверху/сбоку; cornerPlan — что получится (живая плашка), onCorner — применить (одна отмена). */
  cornerPlan?:(pull:CornerPull)=>CornerPlan;
  onCorner?:(pull:CornerPull)=>boolean;
  /** Помещение для линий Q (стены, пол, потолок) — и когда помещение на сцене не показано. */
  guideRoom?:Room;
  /** Вспомогательные линии (Q, guides.ts): хранятся в проекте, видны в своём виде; onGuides — новый список (одна отмена). */
  guides?:Guide[];
  onGuides?:(next:Guide[])=>boolean;
};
export function Scene(p: Props) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(p);
  current.current = p;
  const [error, setError] = useState("");
  const [guideCount, setGuideCount] = useState(0);
  const api = useRef<{ rebuild: () => void; fit: () => void; refresh: () => void; guides: () => void; clearGuides: () => void } | null>(null);
  useEffect(() => {
    const target = host.current!;
    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setError(
        "Не удалось включить 3D. Откройте редактор в Chrome или Edge с аппаратным ускорением. Ваш модуль сохранён.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    // x5 (замер кухонь 22.10): проверка шейдеров (getProgramInfoLog) синхронно ждёт компиляцию каждой новой программы —
    // в профиле перерисовки после правки это ~0,5 с на 12 действий; в рабочей сборке не нужна (картинка та же)
    renderer.debug.checkShaderErrors = import.meta.env.DEV;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xeaf0f2, 0);
    // Отражения для металла ручек (хром, сатин, золото): процедурная «комната» three.js, только в материалах ручек — остальная сцена без изменений.
    let handleEnv: THREE.Texture | null = null;
    try { const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(); handleEnv = pmrem.fromScene(room, 0.04).texture; room.dispose(); pmrem.dispose(); } catch { handleEnv = null; }
    renderer.domElement.setAttribute(
      "aria-label",
      "3D-модель шкафа. Перетаскивание — поворот, колесо — масштаб.",
    );
    renderer.domElement.setAttribute("role", "img");
    target.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),perspective=new THREE.PerspectiveCamera(34,1,5,250000),orthographic=new THREE.OrthographicCamera(-1000,1000,1000,-1000,5,250000);
    let camera:THREE.PerspectiveCamera|THREE.OrthographicCamera=perspective;
    const controls = new OrbitControls<THREE.PerspectiveCamera|THREE.OrthographicCamera>(camera, renderer.domElement);
    controls.mouseButtons.MIDDLE=THREE.MOUSE.ROTATE;
    const preventMiddleScroll=(e:MouseEvent)=>{if(e.button===1)e.preventDefault();};
    renderer.domElement.addEventListener('mousedown',preventMiddleScroll);
    const cameraKey=p.viewKey?'garderyob-camera:'+p.viewKey:undefined;
    let fitting=false;
    function saveCamera(){if(!cameraKey||fitting||current.current.presentation)return;try{sessionStorage.setItem(cameraKey,JSON.stringify({origin:sceneOrigin,view:current.current.view,position:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom,frustum:camera===orthographic?[orthographic.left,orthographic.right,orthographic.top,orthographic.bottom]:null}));}catch{/* view state must not block document saving */}}
    function restoreCamera(){if(!cameraKey||current.current.presentation)return;try{const s=JSON.parse(sessionStorage.getItem(cameraKey)||'null');if(!s||s.view!==current.current.view||![...s.position,...s.target,s.zoom].every(Number.isFinite))return;camera.position.fromArray(s.position);controls.target.fromArray(s.target);if(s.origin&&sceneOrigin){const delta=new THREE.Vector3(s.origin.x-sceneOrigin.x,0,s.origin.z-sceneOrigin.z);camera.position.add(delta);controls.target.add(delta);}camera.zoom=s.zoom;if(camera===orthographic&&s.frustum){[orthographic.left,orthographic.right,orthographic.top,orthographic.bottom]=s.frustum;}camera.updateProjectionMatrix();controls.update();}catch{}}
    controls.addEventListener('end',saveCamera);
    let needsRender=true;const requestRender=()=>{needsRender=true;};controls.addEventListener('change',requestRender);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = 350;
    controls.maxDistance = 150000;controls.minZoom=.05;controls.maxZoom=20;
    controls.maxPolarAngle = Math.PI * 0.91;
    // Для снимков сверки (scripts/kitchen-shots.ts): камера по координатам комнаты, мм — точный ракурс на узел (навес, опора, паз).
    (window as unknown as {__camera?:(pos:number[],look:number[])=>void}).__camera=(pos,look)=>{
      const o=sceneOrigin??{x:0,z:0};
      if(camera!==perspective){camera=perspective;controls.object=perspective;}
      controls.minDistance=60;controls.maxPolarAngle=Math.PI;
      perspective.position.set(pos[0]-o.x,pos[1],pos[2]-o.z);controls.target.set(look[0]-o.x,look[1],look[2]-o.z);
      perspective.updateProjectionMatrix();controls.update();needsRender=true;
    };
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8991, 2.1));
    const sun = new THREE.DirectionalLight(0xfff8ed, 3.1);
    sun.position.set(-2200, 5000, 4200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -2500,
      right: 2500,
      top: 3500,
      bottom: -2500,
      near: 100,
      far: 12000,
    });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 2;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc7e2f2, 1.4);
    fill.position.set(2500, 1600, -2000);
    scene.add(fill);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30000, 30000),
      new THREE.ShadowMaterial({ opacity: 0.15 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(18000, 72, 0xbacbd1, 0xd4dfe3);
    grid.position.y = -5;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.38;
    scene.add(grid);
    const moduleGroups=new Map<string,THREE.Group>();
    let modelGroup = new THREE.Group();
    scene.add(modelGroup);
    const loader = new THREE.TextureLoader();
    const textureLoads=new Map<string,Promise<THREE.Texture>>(),loadedTextures=new Set<THREE.Texture>();
    function cachedTexture(url:string){
      let result=textureLoads.get(url);
      // сбой (пересборка демо, сеть) — те же попытки, что у сеток, и отказ не остаётся в кэше: раньше декоры до перезагрузки страницы
      // рисовались плоским цветом (снимок Макса 20.10)
      if(!result){const q=withRetry<THREE.Texture>((ok,fail)=>loader.load(url,map=>{map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(disposed)map.dispose();else loadedTextures.add(map);ok(map);},undefined,fail));q.catch(()=>{if(textureLoads.get(url)===q)textureLoads.delete(url);});textureLoads.set(url,result=q);}
      return result;
    }
    let generation = 0,pendingTextures=0;
    // Для снимков проверки: скрипт ждёт, пока догрузятся текстуры и модели фурнитуры (window.__pending() === 0).
    (window as unknown as {__pending?:()=>number}).__pending=()=>pendingTextures;
    // Для сценариев мышью (scripts/stretch-scenario.ts): только чтение — положение и ширина корпусов на сцене.
    (window as unknown as {__arrangement?:()=>{id:string;x:number;z:number;w:number}[]}).__arrangement=()=>current.current.arrangement.map(a=>({id:a.id,x:a.x,z:a.z,w:a.module.width,y:a.y??0,h:a.module.height,d:a.module.depth}));
    // scripts/stretch-guides-scenario.ts (только чтение): вспомогательные линии проекта
    (window as unknown as {__guides?:()=>unknown}).__guides=()=>current.current.guides??[];
    // Для сценария scripts/fastener-render-check.ts (только чтение): коробки ОТРИСОВАННОЙ фурнитуры (сетки GLB, запасные модели,
    // процедурные модели, видимые заглушки) по каждому модулю — в мм модуля, и коробка корпуса (плиты без фасадов, столешницы, цоколя).
    (window as unknown as {__hardwareBoxes?:()=>unknown[]}).__hardwareBoxes=()=>current.current.arrangement.flatMap(a=>{
      const g=moduleGroups.get(a.id);if(!g)return [];
      g.updateMatrixWorld(true);
      const inv=g.matrixWorld.clone().invert(),boxes=new Map<string,{box:THREE.Box3;src:Set<string>}>();
      g.traverse(o=>{
        if(!(o instanceof THREE.Mesh)||!o.userData.partId||(o.userData.role!=='fastener'&&o.userData.role!=='hinge'))return;
        let model=false;for(let p=o.parent;p&&p!==g;p=p.parent){if(!p.visible)return;if(p instanceof THREE.Mesh)model=true;}
        const mats=(Array.isArray(o.material)?o.material:[o.material]) as THREE.Material[];
        if(!o.visible||mats.every(q=>q.transparent&&q.opacity===0))return;
        if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
        const b=o.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld)),k=String(o.userData.partId),prev=boxes.get(k);
        if(prev){prev.box.union(b);prev.src.add(model?'model':'stub');}else boxes.set(k,{box:b,src:new Set([model?'model':'stub'])});
      });
      const ps=parts(a.module),byId=new Map(ps.map(p=>[p.id,p]));
      const boards=ps.filter(p=>(p.material==='board'||p.material==='hdf')&&p.role!=='door'&&!p.rotY&&!p.rotZ&&!p.external&&!/worktop|plinth/i.test(p.id));
      const carcass=boards.length?{lo:[0,1,2].map(i=>Math.min(...boards.map(p=>p.position[i]-p.size[i]/2))),hi:[0,1,2].map(i=>Math.max(...boards.map(p=>p.position[i]+p.size[i]/2)))}:null;
      return [{id:a.id,kind:a.module.raw?'raw':a.module.kitchen?'kitchen':'studio',carcass,items:[...boxes].map(([pid,v])=>{const p=byId.get(pid);return {pid,role:p?.role,name:p?.name,file:p?.model?.file,native:!!p?.model?.native,src:[...v.src],lo:v.box.min.toArray(),hi:v.box.max.toArray()};})}];
    });
    function disposeGroup(group: THREE.Group) {
      group.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Line ||
          o instanceof THREE.Sprite
        ) {
          if (!o.userData.sharedGeometry) o.geometry?.dispose();
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          for (const mat of materials) {
            if (!mat.userData.keep) mat.dispose(); // keep — общие материалы вспомогательных линий
          }
        }
      });
      scene.remove(group);
    }
    // fixed — ручка растяжения: стоит точно на боку корпуса, другие плашки обходят её, а не она их.
    const labels: { element: HTMLButtonElement; position: THREE.Vector3; wall?: CutKey; fixed?: boolean }[] =
      [];
    // Ближние стены: что принадлежит какой стене; видимость меняется по камере без пересборки сцены.
    // Стена — имя у прямоугольника, номер ребра у контура произвольной формы (задача Макса 30.10.2026).
    const cutawayParts:{obj:THREE.Object3D;walls:CutKey[]}[]=[];
    let cutawayRoom:{x0:number;z0:number;width:number;depth:number;outline?:RoomOutline}|undefined,cutawayHidden=new Set<CutKey>(),cutawayKey='';
    // Отделка стен (обои, плитка, покраска — roomFinishes.ts): дальние стены непрозрачные, стена между камерой и комнатой
    // (если «Ближние стены» её не скрыли) — полупрозрачная, чтобы не заслонять мебель.
    const finishParts:{mat:THREE.MeshStandardMaterial;wall:CutKey}[]=[];
    function applyCutaway(){
      const r=cutawayRoom,on=current.current.cutaway??readCutaway(),cam=r?{x:camera.position.x-r.x0,z:camera.position.z-r.z0}:undefined;
      const near=(enabled:boolean):Set<CutKey>=>!r||!cam?new Set<CutKey>():r.outline?hiddenEdges(r.outline,cam,enabled):hiddenWalls(r,cam,enabled);
      const hidden=near(on),beyond=finishParts.length?near(true):new Set<CutKey>();
      const key=[...hidden].join(',')+'|'+[...beyond].join(',');if(key===cutawayKey)return;
      cutawayKey=key;cutawayHidden=hidden;
      for(const p of cutawayParts)p.obj.visible=edgeVisible(p.walls,hidden);
      for(const p of finishParts){const near=beyond.has(p.wall);p.mat.transparent=near;p.mat.opacity=near?.15:1;p.mat.depthWrite=!near;p.mat.needsUpdate=true;}
    }
    /** Текстура отделки — одна на позицию каталога, пока позиция лежит в комнате; раппорт не больше 1024 px (критик 29.10:
     *  перебор каталога копил текстуры до ~450 МБ видеопамяти, ёлочка 2048² — 21 МБ). */
    const finishMaps=new Map<string,{map:THREE.CanvasTexture;unit:FinishUnit}>(),usedFinishes=new Set<string>();
    function finishMap(id:string){
      usedFinishes.add(id);
      let t=finishMaps.get(id);if(t)return t;const f=finishById(id);if(!f)return undefined;
      const {canvas,unit}=drawFinish(f,FINISH_TEXTURE_PX),map=new THREE.CanvasTexture(canvas);
      map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      loadedTextures.add(map);finishMaps.set(id,t={map,unit});return t;
    }
    /** После сборки сцены: текстуры позиций, которых больше нет в комнате, освобождаются. */
    function releaseFinishMaps(){for(const [id,t] of finishMaps)if(!usedFinishes.has(id)){t.map.dispose();loadedTextures.delete(t.map);finishMaps.delete(id);}usedFinishes.clear();}
    (window as unknown as {__finishTextures?:()=>number}).__finishTextures=()=>finishMaps.size;
    function finishMaterial(id:string){const t=finishMap(id),f=finishById(id);if(!t||!f)return undefined;/* color чуть ниже белого: светлая плитка и обои под светом сцены не выгорают в чистый белый (рисунок и швы видны) */return {mat:new THREE.MeshStandardMaterial({map:t.map,color:0xe4e4e4,roughness:f.look==='marble'?.5:f.kind==='tile'?.65:f.kind==='laminate'?.72:.92,metalness:0,side:THREE.DoubleSide}),unit:t.unit};}
    function label(
      text: string,
      pos: THREE.Vector3,
      action?: () => void,
      small = false,
      wall?: CutKey,
    ) {
      const active=current.current.arrangement.find(a=>a.id===current.current.activeId)!;
      pos.applyAxisAngle(new THREE.Vector3(0,1,0),(active.rotation??0)*Math.PI/180);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "model-dimension" + (small ? " gap-dimension" : "");
      button.textContent = text;
      button.setAttribute(
        "aria-label",
        (small ? "Проём " : "Изменить размер ") + text,
      );
      button.title = action
        ? "Нажмите, чтобы изменить размер"
        : "Размер в свету";
      button.addEventListener("pointerdown", (e) => e.stopPropagation());
      passThrough(button);
      button.addEventListener("click", () => action?.());
      button.disabled = !action;
      target.appendChild(button);
      labels.push({ element: button, position: pos, wall });
    }

    /** Подпись в координатах комнаты (без поворота активного корпуса). */
    function roomLabel(text:string,pos:THREE.Vector3,action?:()=>void,small=false,wall?:CutKey){
      const button=document.createElement("button");button.type="button";button.className="model-dimension room-dimension"+(small?" gap-dimension":"");button.textContent=text;
      button.setAttribute("aria-label","Размер помещения: "+text);button.title=action?"Нажмите, чтобы изменить размер":text;
      button.addEventListener("pointerdown",e=>e.stopPropagation());passThrough(button);button.addEventListener("click",()=>action?.());button.disabled=!action;
      target.appendChild(button);labels.push({element:button,position:pos,wall});
    }
    /** Плашка размера ловит только левый клик (правка размера). Правая/средняя кнопка и колесо уходят в сцену:
     *  меню правой кнопки, панорама и масштаб работают и над плашкой (ручной тест 19.10, находки 1 и 4). */
    function passThrough(el:HTMLElement){
      const canvas=()=>renderer.domElement;
      el.addEventListener("pointerdown",e=>{if(e.button===0)return;e.preventDefault();canvas().dispatchEvent(new PointerEvent("pointerdown",e));},true);
      // fromLabel: плашка размера относится к выбранному корпусу — меню корпуса и вне его экранной рамки (п.2 критика 20.10 не трогает плашки).
      el.addEventListener("contextmenu",e=>{e.preventDefault();e.stopPropagation();canvas().dispatchEvent(Object.assign(new MouseEvent("contextmenu",e),{fromLabel:true}));});
      el.addEventListener("wheel",e=>{e.preventDefault();e.stopPropagation();canvas().dispatchEvent(new WheelEvent("wheel",e));},{passive:false});
    }
    function line(points: THREE.Vector3[]) {
      const active=current.current.arrangement.find(a=>a.id===current.current.activeId)!;
      points.forEach(p=>p.applyAxisAngle(new THREE.Vector3(0,1,0),(active.rotation??0)*Math.PI/180));
      modelGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color: 0x71919d, depthTest: false }),
        ),
      );
    }
    /** Линия в координатах сцены (комната минус центр выбранного корпуса), без поворота активного корпуса. */
    function roomLine(points:THREE.Vector3[]){
      const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xc9831a,depthTest:false,transparent:true}));
      l.renderOrder=50;l.userData.rowGap=true;modelGroup.add(l);
    }
    /** Плашка зазора до соседа/стены (запрос Макса 20.10.2026): клик — меню «Дотянуть / Придвинуть вплотную / Задать зазор…».
     *  До стены часть зазора займёт автофальшь (g.filler) — дотянуть можно только на остаток (m2 критика 22.10). */
    function gapPlaque(side:'left'|'right',g:GapSide,pos:THREE.Vector3){
      const b=document.createElement('button');b.type='button';b.className='model-dimension gap-dimension row-gap';b.dataset.side=side;
      b.textContent='← '+g.gap+' мм'+(g.filler?` · ${g.filler} фальш`:'')+' →';b.title='до '+g.to+(g.filler?`. Дотянуть: +${g.gap-g.filler} мм, ${g.filler} мм — фальш у стены`:'')+'. Нажмите: дотянуть, придвинуть вплотную или задать зазор';
      b.setAttribute('aria-label',`Зазор ${side==='right'?'справа':'слева'} ${g.gap} мм до ${g.to}`);
      b.addEventListener('pointerdown',e=>e.stopPropagation());passThrough(b);
      b.addEventListener('click',e=>current.current.onGapClick?.(side,e.clientX,e.clientY));
      target.appendChild(b);labels.push({element:b,position:pos});
    }
    /** Ручка растяжения «↔» на боку выбранного корпуса (режим «Двигать корпуса»). */
    function stretchHandle(side:'left'|'right',pos:THREE.Vector3){
      const b=document.createElement('button');b.type='button';b.className='stretch-handle';b.dataset.side=side;b.textContent='↔';
      b.title=(side==='right'?'Правый':'Левый')+' край: тяните, чтобы изменить ширину. Вплотную к соседу — двигается стык. Alt — к линии, Ctrl — к пересечению линий; без привязки — галочка «Привязки корпусов»';
      b.setAttribute('aria-label','Растянуть '+(side==='right'?'правый':'левый')+' край');
      passThrough(b);
      b.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();startStretch(side,e);});
      target.appendChild(b);labels.push({element:b,position:pos,fixed:true});
    }
    /** Квадратная ручка на углу выбранного корпуса (ортогональный вид): тянуть — меняются два размера, противоположный угол на месте. */
    function cornerHandle(dims:[Dim,Dim],ends:[End,End],pos:THREE.Vector3){
      const b=document.createElement('button');b.type='button';b.className='corner-handle';b.dataset.corner=ends.join('-');b.dataset.dims=dims.join('-');
      b.title=cornerHandleTitle(dims);
      b.setAttribute('aria-label',`Растянуть за угол: ${DIM_WORD[dims[0]]} и ${DIM_WORD[dims[1]]}`);
      passThrough(b);
      b.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();startCorner(dims,ends,pos,e);});
      target.appendChild(b);labels.push({element:b,position:pos,fixed:true});
    }
    let sceneOrigin: {x:number;z:number}|undefined;
    // Снимок для КП (релиз 22.10, m7): что сдвинуто «Открыть фасады»/просмотром ящика — сдвиг (dp) или поворот створки (rot: открыто,
    // закрыто); изделия сцены (корпуса и техника) — остальное (стены, проёмы, препятствия, размеры) на снимке КП прячется.
    // Плавное открывание (правка Макса 29.10): створки поворачиваются, ящики и полотна купе выезжают за OPEN_MS, а не прыгают. Всё, что
    // открывается, — «движение» с долей открытия t (0 закрыто, 1 открыто) и целью target; кадр анимации ведёт t к цели. Ключ —
    // `<корпус>|<створка / ящик / полотно>`. Средняя кнопка (колёсико) щелчком без протяжки по фасаду — открыть/закрыть его (по корпусу —
    // весь корпус): своё состояние поверх общего «Открыть створки» (openOverride), общий переключатель его сбрасывает.
    // wide — открывается вместе с корпусом (створки, ящики кухни, полотна купе; ящики шкафа — только у корпуса без дверей).
    type OpenMove={set:(t:number)=>void;t:number;target:number;wide:boolean};
    const anims=new Map<string,OpenMove>(),openOverride=new Map<string,boolean>();
    let lastOpenDoors:boolean|undefined,lastFrame=performance.now();
    const products=new Set<THREE.Object3D>();
    function rebuild() {
      needsRender=true;products.clear();
      const state = current.current,
        m = state.module;
      // перестройка сцены: положение открытия переходит в новые детали (анимация не обрывается); общий переключатель — сброс своих состояний
      const prevT=new Map([...anims].map(([k,a])=>[k,a.t]));anims.clear();
      if(lastOpenDoors!==undefined&&lastOpenDoors!==state.openDoors)openOverride.clear();
      lastOpenDoors=state.openDoors;
      /** Зарегистрировать движение: apply(e) ставит объект в долю открытия e (уже сглаженную); open — открыт ли по умолчанию. */
      const openMove=(mid:string,key:string,open:boolean,wide:boolean,apply:(e:number)=>void)=>{
        const k=mid+'|'+key,target=(openOverride.get(k)??(wide?openOverride.get(mid+'|*'):undefined)??open)?1:0,have=anims.get(k);
        if(have){const prev=have.set;have.set=t=>{prev(t);apply(openEase(t));};apply(openEase(have.t));return;}
        const t=prevT.get(k)??target;anims.set(k,{set:t=>apply(openEase(t)),t,target,wide});apply(openEase(t));
      };
      grid.visible=!state.presentation;
      scene.background=state.presentation?new THREE.Color(0xf1f0eb):null;
      for (const l of labels) l.element.remove();
      labels.length = 0;
      cutawayParts.length=0;finishParts.length=0;usedFinishes.clear();cutawayRoom=undefined;cutawayKey='\u0000';
      moduleGroups.clear();
      generation++;pendingTextures=0;
      const gen = generation;
      disposeGroup(modelGroup);
      modelGroup = new THREE.Group();
      scene.add(modelGroup);
      const focus =
        state.arrangement.find((a) => a.id === state.activeId) ||
        state.arrangement[0];
      const nextOrigin=moduleCenter(focus);
      if(sceneOrigin){
        const shift=new THREE.Vector3(sceneOrigin.x-nextOrigin.x,0,sceneOrigin.z-nextOrigin.z);
        perspective.position.add(shift);orthographic.position.add(shift);controls.target.add(shift);
      }
      sceneOrigin=nextOrigin;
      for (const placed of state.hideFurniture?[]:state.arrangement) {
        if(state.hiddenModuleIds?.includes(placed.id))continue;
        const moduleGroup=new THREE.Group();moduleGroups.set(placed.id,moduleGroup);modelGroup.add(moduleGroup);products.add(moduleGroup);
        const doorPivots=new Map<string,THREE.Group>();
        const m = placed.module,
          active = placed.id === focus.id;
        const origin=localToRoom(placed,0,0),center=moduleCenter(focus);
        moduleGroup.position.set(origin.x-center.x,placed.y??0,origin.z-center.z);moduleGroup.rotation.y=(placed.rotation??0)*Math.PI/180;moduleGroup.userData.base=moduleGroup.position.clone();
        const mParts = parts(m), byId = new Map(mParts.map((q) => [q.id, q]));
        for (const part of mParts) {
          // «Скрыть фасады» убирает двери (распашные и полотна купе) с петлями и их ручками; ящики остаются с фасадами — это наполнение.
          if(state.hideFacades&&(part.role==='door'||part.role==='hinge'||(part.role==='handle'&&!part.id.includes(':drawer:'))||(part.id.endsWith(':facade')&&!part.id.includes(':drawer:'))))continue;
          const isMetal = part.material === "metal",
            isBack = part.material === "hdf",
            isFacade = part.role === "door" || part.id.endsWith(":facade");
          const wood =
            part.decor.includes("Дуб") || part.decor.includes("Орех");
          const mat = new THREE.MeshStandardMaterial({
            color: isMetal
              ? 0xbecad0
              : isBack && !m.casework
                ? 0xd7d5cc
                : wood
                  ? 0xd2b68d
                  : part.decor === "Графит"
                    ? 0x505653
                    : 0xe6e4dc,
            transparent: !!((state.transparent && (part.role === "body" || part.role === "door")) || (state.clearFacades && isFacade)),
            opacity: state.transparent && (part.role === "body" || part.role === "door") ? 0.16 : state.clearFacades && isFacade ? 0.35 : 1,
            depthWrite: !((state.transparent && (part.role === "body" || part.role === "door")) || (state.clearFacades && isFacade)),
            roughness: isMetal ? 0.24 : 0.73,
            metalness: isMetal ? 0.8 : 0,
            /* паз Базиса (groove:*) — обработка детали, не светильник: тёмная полоса без свечения */
            /* тон подсветки (задача 14): цвет и свечение LED по тону детали/модуля (3000 / 4000 / 6000 К) */
            ...(part.role === "light" && !part.id.startsWith("groove:") ? (() => { const tn = TONE_INFO[ledLook(m, part.id).tone]; return { color: tn.led, emissive: tn.emissive, emissiveIntensity: 1.4, metalness: 0, roughness: 0.4 }; })() : {}),
          });
          // режимы «Прозрачный корпус» / «Стеклянные фасады» — только вид на экране: на снимке КП деталь непрозрачная (m7)
          if (mat.transparent) mat.userData.seeThrough = mat.opacity;
          const texture = catalog.find(
            (c) => c.n === part.decor,
          )?.tex;
          const vTex = part.vernissage && m.vernissage && !part.rotZ && part.size[2] <= Math.min(part.size[0], part.size[1]) ? vernissageTexture(m.vernissage) : null;
          if (part.vernissage && m.vernissage) {
            // плёнка с рисунком — текстура образца с сайта Вернисажа (UV фасада в образцах tileMm, повтор); однотонные и эмаль — цветом;
            // глянец — низкая шероховатость
            mat.color.set(vernissageColor(m.vernissage)); mat.roughness = vernissageGlossy(m.vernissage) ? 0.14 : 0.62;
            if (vTex) {
              pendingTextures++;
              cachedTexture(import.meta.env.BASE_URL + vTex.url).then(map=>{
                if(disposed||gen!==generation)return;
                if(map.wrapS!==THREE.RepeatWrapping){map.wrapS=map.wrapT=THREE.RepeatWrapping;map.needsUpdate=true;}
                mat.map=map;mat.color.set(0xffffff);mat.needsUpdate=true;needsRender=true;
              }).catch(()=>{}).finally(()=>{if(gen===generation)pendingTextures--;});
            }
          } else if (texture && (!isBack || m.casework) && !isMetal && part.material !== "alu" && part.material !== "glass") {
            pendingTextures++;
            cachedTexture(texture).then(map=>{
              if(disposed||gen!==generation)return;
              mat.map=map;mat.color.set(0xffffff);mat.needsUpdate=true;needsRender=true;
            }).catch(()=>{}).finally(()=>{if(gen===generation)pendingTextures--;});
          }
          const isAlu = part.material === "alu" && !!m.alu;
          // Фасад «Вернисаж»: сетка по фрезеровке строится заново под габарит детали (рамка постоянной ширины, филёнка тянется)
          // лицо фасада — в плоскости XY (толщина по Z); горизонтальная/боковая свободная панель МДФ Вернисаж — плитой цвета покрытия
          const vern = part.vernissage && m.vernissage && !part.rotZ && part.size[2] <= Math.min(part.size[0], part.size[1]) ? m.vernissage : undefined;
          // Цилиндр-заглушка только для деталей без модели: модель из Blender (part.model) — дочерний объект меша и унаследовала бы его поворот.
          // процедурная модель фурнитуры без сетки (hardwareModels.ts): профиль Gola, штанга, направляющая, эксцентрик, шкант, толкатель —
          // невидимый бокс детали для выбора + модель внутри; бокс не поворачивается (у модели свои оси)
          const proc = procModel(part, { left: part.position[0] < m.width / 2, headSign: (() => {
            if (!part.id.startsWith("ecc:") || !part.id.endsWith(":pin")) return undefined;
            const cam = byId.get(part.id.slice(0, -4)), ax = part.size.indexOf(Math.max(...part.size));
            return cam && cam.position[ax] < part.position[ax] ? -1 : 1;
          })(), face: (part.id.includes(":screw:") || part.id.startsWith("kitchen-leg-screw:")) && Math.max(...part.size) <= 5 ? faceAt(part.position, mParts) : undefined });
          const roundAlongZ = !proc && part.role === "hinge" && !part.model && (part.id.includes(":hingecup:") || part.id.includes(":latch:"));
          const geometry = proc ? new THREE.BoxGeometry(...part.size) : roundAlongZ
            ? new THREE.CylinderGeometry(part.size[0] / 2, part.size[0] / 2, part.size[2], 28)
            // у крепежа с сеткой Базиса меш не поворачивается (сетка — дочерняя) — заглушка повёрнута в самой геометрии
            : part.role === "fastener" && part.model?.native ? fastenerGeometry(part.size)
            : part.role === "fastener"
              ? (() => { const f = fastenerAxis(part.size); return new THREE.CylinderGeometry(f.r, f.r, f.h, 20); })()
              : (part.role === "rod" || part.role === "flange")
              ? (() => { const c = rodCylinder(part.size); return new THREE.CylinderGeometry(c.r, c.r, c.h, 24); })()
              : vern ? facadeGeometry(vernissageLayout(vern, part.size[0], part.size[1], part.size[2]), part.grainAxis, vTex?.tileMm)
              : isAlu ? aluFrameGeometry(part, aluProfile(m.alu!.profile)?.face ?? 19) : part.shape ? shapeGeometry(part) : part.planHoles?.length ? worktopGeometry(part) : part.planContour ? planContourGeometry(part) : part.golaCuts?.length ? golaSideGeometry(part) : part.rearNotch ? rearNotchSideGeometry(part) : part.topNotches ? topNotchGeometry(part) : part.faceContour ? faceContourGeometry(part) : part.taper ? taperGeometry(part) : part.taperZ ? planTaperGeometry(part) : boardGeometry(part);
          if (isAlu) {
            const colour = ALU_COLOURS[m.alu!.color] ?? 0xc9ccd1;
            mat.color.set(colour); mat.metalness = 0.75; mat.roughness = 0.35; mat.transparent = false; mat.opacity = 1; mat.depthWrite = true;
          }
          if (part.material === "glass") {
            const ins = aluInsert(m.topGlass ?? "");
            const dark = ins?.id.endsWith("black"), mirror = ins?.mirror;
            mat.color.set(mirror ? 0xd6dee3 : dark ? 0x1b1b1b : ins?.id === "satin" ? 0xf1f3f4 : ins?.id.includes("bronze") ? 0x8a6a45 : ins?.id.includes("graphite") ? 0x4a4f55 : 0xdfe8ec);
            mat.transparent = !mirror && !dark; mat.opacity = mirror || dark ? 1 : ins?.id === "satin" ? 0.75 : 0.45; mat.roughness = 0.05; mat.metalness = mirror ? 0.55 : 0.1; mat.depthWrite = !mat.transparent;
          }
          if (part.look) {
            // Вид из прайса купе важнее общих правил стекла: зеркало и лакобель непрозрачны, стекло — с заданной прозрачностью.
            const op = state.clearFacades && part.role === "door" ? Math.min(0.35, part.look.opacity ?? 1) : part.look.opacity ?? 1;
            mat.color.set(part.look.color); mat.metalness = part.look.metalness ?? 0; mat.roughness = part.look.roughness ?? 0.6; delete mat.userData.seeThrough;
            mat.transparent = op < 1; mat.opacity = op; mat.depthWrite = op >= 1;
          }
          let profileMaterial: THREE.Material | null = null;
          if (part.model) {
            // Профиль купе из Blender: невидимый бокс для выбора + модель с цветом профиля из прайса.
            profileMaterial = new THREE.MeshStandardMaterial({ color: part.look?.color ?? 0xc8ccd0, metalness: 0.5, roughness: 0.32 });
            mat.transparent = true; mat.opacity = 0; mat.depthWrite = false;
          }
          const isMeshItem = part.id.endsWith(":mesh");
          const isHandle = part.role === "handle";
          // невидимый бокс для выбора: сетка Лемана, ручка-модель, процедурная фурнитура (n5-hardware3d)
          if (isMeshItem || (isHandle&&!part.simpleHandle) || proc) { mat.transparent = true; mat.opacity = 0; mat.depthWrite = false; }
          // фасад Вернисажа под стекло: вторая группа сетки — стекло своим материалом (n5-vernissage); у процедурной модели бокс без групп
          const vGlass = !proc && vern && geometry.groups.some((g) => g.materialIndex === 1)
            ? new THREE.MeshStandardMaterial({ color: 0xdfe8ec, transparent: true, opacity: state.clearFacades ? 0.25 : 0.42, roughness: 0.05, metalness: 0.1, depthWrite: false }) : null;
          const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>(geometry, vGlass ? [mat, vGlass] : mat);
          if (part.model?.node) {
            // узел Базиса без сетки («Петля под фальшпанель»): не рисуем — коробка выше прозрачная, остаётся только для выбора
          } else if (part.model?.native) {
            // Фурнитура из Базиса (TriData → GLB в мм): начало координат модели — в origin, поворот quat, свои материалы, без растяжения.
            const g = generation, model = part.model; pendingTextures++;
            // сетка (или запасная модель) — в начале координат узла Базиса (origin) с его поворотом (quat)
            const place = (inst: THREE.Object3D) => {
              const holder = new THREE.Group(), at = nativePlacement(model, part.position);
              if (at.mirror) inst.scale.x = -1;
              holder.add(inst);
              holder.quaternion.copy(at.quaternion); holder.position.copy(at.offset);
              mesh.add(holder); needsRender = true;
            };
            loadHandleModel(model.file).then((src) => {
              if (disposed || g !== generation) return;
              const inst = src.clone(true);
              inst.traverse((c) => { c.userData = { partId: part.id, moduleId: placed.id, role: part.role, sectionId: part.sectionId, active, sharedGeometry: true }; if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; if (model.mirror) { c.material = (c.material as THREE.Material).clone(); (c.material as THREE.Material).side = THREE.DoubleSide; } } });
              place(inst);
            }).catch(() => {
              if (disposed || g !== generation) return;
              // сетка не загрузилась: петля — запасной моделью (чашка, плечо, планка), а не серой коробкой; крепёж — заглушкой по своей оси
              const fb = part.role === "hinge" ? hingeFallbackModel(model.file) : undefined;
              if (fb) { fb.traverse((c) => { c.userData = { partId: part.id, moduleId: placed.id, role: part.role, sectionId: part.sectionId, active }; }); place(fb); return; }
              mat.opacity = 1; mat.transparent = false; mat.depthWrite = true; needsRender = true;
            }).finally(() => { if (g === generation) pendingTextures--; });
          } else if (part.model && profileMaterial) {
            const g = generation, pm = profileMaterial; pendingTextures++;
            loadHandleModel(part.model.file).then((src) => { if (disposed || g !== generation) return; const fitted = fitProfile(src, part, pm); fitted.traverse((o) => { o.userData = { partId: part.id, moduleId: placed.id, role: part.role, sectionId: part.sectionId, active, sharedGeometry: true }; }); mesh.add(fitted); needsRender = true; })
              .catch(() => { mat.opacity = 1; mat.transparent = false; mat.depthWrite = true; needsRender = true; }).finally(() => { if (g === generation) pendingTextures--; });
          }
          if (isHandle&&!part.simpleHandle&&!part.model?.native) { // ручка Базиса (сетка библиотеки) — выше, своей моделью
            // Ручка: невидимый бокс для выбора + процедурная модель (handleModels.ts): X вдоль, +Y к центру фасада, Z наружу от лица.
            const handle = handleById(facadeHandleId(m,part.id)), vertical = part.size[1] > part.size[0];
            const face = byId.get(part.id.includes(':drawer:') ? part.id.replace(/:handle$/, ':facade') : part.id.replace(':handle:', ':door:'));
            const dx = face ? face.position[0] - part.position[0] : 0, dy = face ? face.position[1] - part.position[1] : 0;
            const holder = new THREE.Group();
            holder.rotation.z = vertical ? (dx > 0.5 ? -Math.PI / 2 : Math.PI / 2) : (dy < -0.5 ? Math.PI : 0);
            holder.position.z = face && !face.rotY === !part.rotY ? face.position[2] + face.size[2] / 2 - part.position[2] : -part.size[2] / 2; // к лицу фасада
            try {
              const model = handleModel(handle, handleEnv, face?.size[2] ?? 16);
              model.traverse((o) => { o.userData = { partId: part.id, moduleId: placed.id, role: part.role, sectionId: part.sectionId, active, sharedGeometry: true }; });
              holder.add(model); mesh.add(holder);
            } catch { mat.opacity = 1; mat.transparent = false; mat.depthWrite = true; }
          }
          if (proc) {
            proc.traverse((o) => { o.userData = { ...o.userData, partId: part.id, moduleId: placed.id, role: part.role, sectionId: part.sectionId, active }; });
            mesh.add(proc);
          }
          if (isMeshItem) {
            // Сетка Лемана: невидимый бокс для выбора + проволочная модель внутри.
            const section = m.sections.find((s) => s.id === part.sectionId);
            const j = Number(part.id.split(":drawer:")[1].split(":")[0]);
            const cfg = section ? drawerConfig(m, section, j) : undefined;
            const model = meshModel(cfg?.mesh ? meshById(cfg.mesh) : undefined, part.size);
            model.traverse((o) => { o.userData = { partId: part.id, moduleId: placed.id, role: part.role, sectionId: part.sectionId, active }; });
            mesh.add(model);
          }
          if (isAlu) {
            // Вставка: зеркало, стекло или лакобель внутри рамки.
            const fill = aluFill(m.alu!.insert), ins = fill ? { id: aluFillLookId(fill), mirror: fill.mirror } : undefined, face = aluProfile(m.alu!.profile)?.face ?? 19;
            const glassMat = new THREE.MeshStandardMaterial(ins?.mirror ? { color: ins.id.includes("bronze") ? 0xb8a58c : ins.id.includes("graphite") ? 0x8d949a : 0xd6dee3, metalness: 0.55, roughness: 0.08 } : ins?.id.startsWith("lacobel") ? { color: ins.id.endsWith("black") ? 0x1b1b1b : 0xf4f4f2, metalness: 0.2, roughness: 0.15 } : { color: ins?.id === "satin" ? 0xf1f3f4 : ins?.id.includes("bronze") ? 0x8a6a45 : ins?.id.includes("graphite") ? 0x4a4f55 : 0xdfe8ec, transparent: true, opacity: ins?.id === "satin" ? 0.75 : state.clearFacades ? 0.25 : 0.45, roughness: 0.05, metalness: 0.1, depthWrite: false });
            const glass = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1, part.size[0] - 2 * face + 8), Math.max(1, part.size[1] - 2 * face + 8), 4), glassMat);
            if(ins?.id==='satin-bronze'){glassMat.roughness=.85;glassMat.opacity=.78;}
            if(ins?.id==='moru-bronze'){
              const pixels=new Uint8Array(64*4);
              for(let k=0;k<64;k++){const nx=Math.sin(k/64*Math.PI*2)*.65;pixels[k*4]=Math.round((nx+1)*127.5);pixels[k*4+1]=128;pixels[k*4+2]=Math.round((Math.sqrt(1-nx*nx)+1)*127.5);pixels[k*4+3]=255;}
              const normal=new THREE.DataTexture(pixels,64,1,THREE.RGBAFormat);normal.wrapS=THREE.RepeatWrapping;normal.repeat.set(part.size[0]/8,1);normal.needsUpdate=true;glassMat.normalMap=normal;glassMat.roughness=.22;glassMat.opacity=.58;
            }
            glass.userData = { partId: part.id, moduleId: placed.id, role: part.role, sectionId: part.sectionId, active };
            mesh.add(glass);
          }
          if (part.mirror) {
            // зеркало 4 мм на лицевой стороне фасада-основы (Module.mirror, заказ 7427796): ребёнок фасада — открывается вместе с ним
            const mi = aluInsert(part.mirror), mirrorMat = new THREE.MeshStandardMaterial({ color: mi?.id.includes("bronze") ? 0xb8a58c : mi?.id.includes("graphite") ? 0x8d949a : 0xd6dee3, metalness: 0.55, roughness: 0.08 });
            const glass = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1, part.size[0] - 1), Math.max(1, part.size[1] - 1), 4), mirrorMat);
            glass.position.z = part.size[2] / 2 + 2;
            glass.userData = { partId: part.id, moduleId: placed.id, role: part.role, sectionId: part.sectionId, active };
            mesh.add(glass);
          }
          if(part.edgeColor&&part.material==='board'&&!vern){
            const axis=part.size.indexOf(part.thickness),edgemat=new THREE.MeshStandardMaterial({color:part.edgeColor,roughness:.7});
            mesh.material=Array.from({length:6},(_,face)=>Math.floor(face/2)===axis?mat:edgemat);
          }
          // цилиндр three.js стоит по Y: студийная штанга/фланец ложится вдоль X, вертикальная труба Базиса остаётся по Y
          if ((part.role === "rod" || part.role === "flange") && !proc && !rodCylinder(part.size).vertical) mesh.rotation.z = Math.PI / 2;
          // Металл без карты окружения при metalness ~0.85 выглядит чёрным: держим умеренный металл и светлый никель.
          if (roundAlongZ) { mesh.rotation.x = Math.PI / 2; mat.color.set(part.id.includes(":latch:") ? 0x55595d : 0xdfe3e6); mat.metalness = 0.35; mat.roughness = 0.35; }
          else if (part.role === "hinge") { mat.color.set(0xd2d7db); mat.metalness = 0.35; mat.roughness = 0.38; }
          if (part.role === "fastener" && !part.model?.native && !proc) { const ax = fastenerAxis(part.size).axis; if (ax === 0) mesh.rotation.z = Math.PI / 2; else if (ax === 2) mesh.rotation.x = Math.PI / 2; mat.color.set(part.id.startsWith("ecc:") ? 0x8d949a : part.id.startsWith("shp:") ? 0xc9ced2 : 0x2f3235); mat.metalness = 0.6; mat.roughness = 0.5; }
          if (part.rotZ) mesh.rotation.z = (part.rotZ * Math.PI) / 180;
          const rotY = part.rotY ? (part.rotY * Math.PI) / 180 : 0;
          if (rotY) mesh.rotation.y = rotY;
          mesh.position.set(
            part.position[0],
            part.position[1],
            part.position[2],
          );
          const preview=state.drawerPreview;
          // Ящик: ход и открыт ли по умолчанию. Кухня Axis PRO (kd:N) — «открыть» выдвигает короб с фасадом на 0,9 длины (направляющие
          // остаются), у выбранного корпуса; ящик шкафа — просмотр ящика (drawerPreview) на 0,8 направляющей; средняя кнопка — любой.
          // Ящик открывается анимацией (openMove) — регистрируется после «разнесённого вида», от итогового положения детали.
          let slide:{key:string;travel:number;open:boolean;wide:boolean}|undefined;
          {const kd=/^(kd:(\d+))(?::|$)/.exec(part.id),sd=/^((.+?):drawer:(\d+))(?::|$)/.exec(part.id);
            if(kd){const k=m.kdrawers?.[Number(kd[2])];if(k)slide={key:kd[1],travel:(k.box?k.box.len:(k.len??500))*.9,open:active&&state.openDoors,wide:true};}
            else if(sd){const section=m.sections.find(s=>s.id===sd[2]),j=Number(sd[3]);if(section&&j<section.drawers)slide={key:sd[1],travel:drawerConfig(m,section,j).length*.8,open:active&&!!preview&&(state.openDoors||!m.doors)&&preview.sid===sd[2]&&preview.index===j,wide:!m.doors};}}
          const slidesWith=slide&&!part.id.includes(':slide:')&&!part.id.includes(':screw:run')&&!part.id.includes(':screw:fx3');
          // направляющая с процедурной моделью: сама деталь стоит в корпусе, подвижные звенья выезжают вместе с ящиком (на тот же ход)
          if(proc&&slide&&part.id.includes(':slide:')){const s=slide;proc.traverse(o=>{const dz=o.userData.slide==='run'?s.travel:o.userData.slide==='mid'?s.travel/2:0;if(dz){const base=o.position.clone();openMove(placed.id,s.key,s.open,s.wide,e=>{o.position.set(base.x,base.y,base.z+dz*e);});}});}
          // у фурнитуры из Базиса тень даёт сама сетка; прозрачный габарит-заглушка тени не отбрасывает
          mesh.castShadow = !part.model?.native;
          // задняя стенка не принимает тень «солнца»: при открытых створках на ней было резкое светлое пятно-«треугольник»
          // (свет через проём, края — тени крыши и открытой створки; критик 22.10, A39/A47) — внутри шкаф ровный
          mesh.receiveShadow = !isBack;
          mesh.userData = {
            sectionId: part.sectionId,
            partId: part.id,
            moduleId: placed.id,
            active,
            role: part.role,
          };
          if (part.role === "light" && !part.id.startsWith("groove:")) { mesh.castShadow = false; ledGlow(mesh, part, m, mParts); }
          if (state.exploded && active) {
            mesh.position.x = (mesh.position.x-m.width/2)*1.3+m.width/2;
            mesh.position.y =
              (mesh.position.y - m.height / 2) * 1.18 + m.height / 2;
            mesh.position.z = (mesh.position.z-m.depth/2)*1.6+m.depth/2;
          }
          if(slidesWith&&slide){const s=slide,base=mesh.position.clone(),dp=new THREE.Vector3(Math.sin(rotY)*s.travel,0,Math.cos(rotY)*s.travel);openMove(placed.id,s.key,s.open,s.wide,e=>{mesh.position.copy(base).addScaledVector(dp,e);});}
          if (part.openShift !== undefined) {
            // Купе: «открыть фасады» — переднее полотно отъезжает за заднее, как в жизни.
            const base=mesh.position.clone(),shift=part.openShift;openMove(placed.id,'leaf:'+part.id,state.openDoors,true,e=>{mesh.position.set(base.x+shift*e,base.y,base.z);});
            moduleGroup.add(mesh);
          } else if (part.role === "door" && part.id !== "slope-filler" && !part.hingeless) { // фасад техники без петель (холодильник) висит на её двери — техника не открывается
            // створка всегда на петлевой оси (закрыта — поворот 0): открывается и закрывается плавно, в том числе средней кнопкой
            // Петлевая ось — на краю фасада; при скосе фронта фасад повёрнут, ось сдвигается вдоль его наклонной линии.
            const pivot = new THREE.Group();
            pivot.position.copy(mesh.position);
            const sign=part.hinge==='right'?-1:1,horizontal=part.hinge==='top'||part.hinge==='bottom',verticalOffset=part.hinge==='bottom'?part.size[1]/2:-part.size[1]/2;
            const hingeOff=new THREE.Vector3(horizontal?0:sign*part.size[0]/2,horizontal?verticalOffset:0,0).applyAxisAngle(new THREE.Vector3(0,1,0),rotY);
            pivot.position.sub(hingeOff);
            mesh.position.set(horizontal?0:sign*part.size[0]/2,horizontal?verticalOffset:0,0);mesh.rotation.y=0;
            pivot.add(mesh);
            const openX=horizontal?(part.hinge==='bottom'?Math.PI/2:-Math.PI/2):0,openY=horizontal?rotY:rotY-Math.PI*.58*sign;pivot.userData.rotY=rotY;
            openMove(placed.id,part.id,state.openDoors,true,e=>{pivot.rotation.set(openX*e,rotY+(openY-rotY)*e,0);});
            doorPivots.set(part.id,pivot);moduleGroup.add(pivot);
          } else if(part.role==='handle' && doorPivots.has(part.id.replace(':handle:',':door:'))){
            const pivot=doorPivots.get(part.id.replace(':handle:',':door:'))!;mesh.position.sub(pivot.position).applyAxisAngle(new THREE.Vector3(0,1,0),-(pivot.userData.rotY as number));mesh.rotation.y=0;pivot.add(mesh);
          } else if(/:(hingecup|hingearm):/.test(part.id) && doorPivots.has(part.id.replace(/:(hingecup|hingearm):/,':door:').replace(/:\d+$/,''))){
            // Чашка и плечо петли поворачиваются вместе с фасадом; монтажная планка остаётся на стойке.
            const pivot=doorPivots.get(part.id.replace(/:(hingecup|hingearm):/,':door:').replace(/:\d+$/,''))!;mesh.position.sub(pivot.position).applyAxisAngle(new THREE.Vector3(0,1,0),-(pivot.userData.rotY as number));pivot.add(mesh);
          } else moduleGroup.add(mesh);
          const selectedPart=active&&!state.presentation?state.selectedPart:undefined;
          const drawerPrefix=selectedPart?.includes(':drawer:')?selectedPart.split(':drawer:')[0]+':drawer:'+selectedPart.split(':drawer:')[1].split(':')[0]+':':undefined;
          const picked=!!selectedPart&&(drawerPrefix?part.id.startsWith(drawerPrefix):part.id===selectedPart);
          if (!isMetal || picked) {
            const edge = new THREE.LineSegments(
              new THREE.EdgesGeometry(geometry, vern ? 20 : 1),
              new THREE.LineBasicMaterial({
                color: picked?0x087f94:0x4a4b40,
                transparent: true,
                opacity: picked?1:0.16,
                depthTest: !picked,
              }),
            );
            edge.userData.captureGuide=picked;
            mesh.add(edge);
          }
        }
        if(!state.presentation&&state.groupIds?.includes(placed.id)){
          const box=new THREE.BoxGeometry(m.width+3,m.height+3,m.depth+3);
          const guide=new THREE.LineSegments(new THREE.EdgesGeometry(box),new THREE.LineBasicMaterial({color:0x168976,transparent:true,opacity:.85,depthTest:false}));
          box.dispose();guide.position.set(m.width/2,m.height/2,m.depth/2);guide.userData.captureGuide=true;guide.renderOrder=10;moduleGroup.add(guide);
        }
      }
      for(const o of state.appliances??[]){const appliance=applianceModel(o);/* техника всегда закрыта: «Открыть створки» — только фасады мебели (K3, 22.10) */if(!appliance)continue;appliance.position.set(o.x+o.width/2-moduleCenter(focus).x,o.y+o.height/2,o.z+o.depth/2-moduleCenter(focus).z);modelGroup.add(appliance);products.add(appliance);if(o.sinkModuleId){const hoses=dishwasherServiceModel(o,state.arrangement);hoses.position.set(-moduleCenter(focus).x,0,-moduleCenter(focus).z);modelGroup.add(hoses);products.add(hoses);}}
      if (state.room) {
        const r = state.room,
          x0 = -moduleCenter(focus).x,
          z0 = -moduleCenter(focus).z;
        if(r.outline){
        // Контур произвольной формы (задача Макса 30.10.2026: 5 углов, скос, скругление, дуга): стены по рёбрам контура (дуга — ломаной)
        // с проёмами, пол — многоугольником, проёмы и объекты — на своей стене контура (roomEdges.openingEdge). Прямоугольник без контура —
        // ниже, как было. Сетки замера (survey) — только у прямоугольника. Отделка стен — по старому имени стороны, к которой обращена
        // стена контура (edgeLegacyWall; своя отделка у каждой стены контура — этап 2).
        const o=r.outline,ro={...r,outline:o};cutawayRoom={x0,z0,width:r.width,depth:r.depth,outline:o};
        const at3=(p:{x:number;z:number},y:number,inward=0,n={x:0,z:0})=>new THREE.Vector3(x0+p.x+n.x*inward,y,z0+p.z+n.z*inward);
        // рёбра: отрезки одной стены (или угла двух стен) — одной линией, чтобы дуга не плодила сотни объектов
        const lines=new Map<string,{walls:number[];pts:THREE.Vector3[]}>();
        for(const e of outlineEdges(o,r.height)){const k=e.walls.join(','),l=lines.get(k)??{walls:e.walls,pts:[]};l.pts.push(new THREE.Vector3(x0+e.a[0],e.a[1],z0+e.a[2]),new THREE.Vector3(x0+e.b[0],e.b[1],z0+e.b[2]));lines.set(k,l);}
        for(const l of lines.values()){const edge=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(l.pts),new THREE.LineBasicMaterial({color:0x8dabb4,transparent:true,opacity:0.5}));modelGroup.add(edge);cutawayParts.push({obj:edge,walls:l.walls});}
        let openingId:string|undefined;
        /** Брусок у стены контура: w вдоль стены (по касательной в точке s), depth — наружу от поверхности стены (как wallBox), inward — сдвиг в комнату. */
        const edgeBox=(edge:number,s:number,y:number,w:number,h:number,depth:number,color:number,opacity:number,inward=0)=>{
          const q=wallSpot(o,edge,s),mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,depth),new THREE.MeshStandardMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1}));
          mesh.position.copy(at3(q.p,y,inward-depth/2,q.n));mesh.rotation.y=Math.atan2(-q.t.z,q.t.x);mesh.receiveShadow=true;if(openingId)mesh.userData.openingId=openingId;modelGroup.add(mesh);cutawayParts.push({obj:mesh,walls:[edge]});return mesh;
        };
        const nearSide=(i:number)=>{const w=edgeLegacyWall(o,i);return w==='front'||w==='right';};
        const fins=o.map((_,i)=>{const v=r.finish?.walls?.[edgeLegacyWall(o,i)];if(!v)return undefined;const m='paint' in v?{mat:new THREE.MeshStandardMaterial({color:new THREE.Color(v.paint),roughness:.95,side:THREE.DoubleSide}),unit:undefined as FinishUnit|undefined}:finishMaterial(v.id);if(m){evenWallLight(m.mat);finishParts.push({mat:m.mat,wall:i});}return m;});
        const shift=(pos:number[])=>{for(let k=0;k<pos.length;k+=3){pos[k]+=x0;pos[k+2]+=z0;}return pos;};
        for(const panel of edgePanels(ro)){
          const fin=fins[panel.edge],g=new THREE.BufferGeometry();
          if(fin){const f=wallFace(o,panel),uv:number[]=[];for(let k=0;k<f.su.length;k+=2)uv.push(...(fin.unit?wallUv(f.su[k],f.su[k+1],fin.unit):[0,0]));
            g.setAttribute('position',new THREE.Float32BufferAttribute(shift(f.pos),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
            const mesh=new THREE.Mesh(g,fin.mat);mesh.receiveShadow=true;mesh.userData.roomFinish=edgeLegacyWall(o,panel.edge);modelGroup.add(mesh);cutawayParts.push({obj:mesh,walls:[panel.edge]});continue;}
          g.setAttribute('position',new THREE.Float32BufferAttribute(shift(wallPrism(o,panel,80)),3));g.computeVertexNormals();
          const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xd5d5cc,transparent:true,opacity:nearSide(panel.edge)?0.06:0.25,depthWrite:false}));mesh.receiveShadow=true;modelGroup.add(mesh);cutawayParts.push({obj:mesh,walls:[panel.edge]});
        }
        for(const op of r.openings||[]){
          openingId=op.id;const e=openingEdge(r,op),u=e.offset+op.width/2,y=op.sill+op.height/2,fd=op.frameDepth??85,color=op.color?Number.parseInt(op.color.slice(1),16):0xf3eee4;
          for(const dx of [-op.width/2+20,op.width/2-20])edgeBox(e.edge,u+dx,y,40,op.height,fd,0xfafaf6,0.95);
          edgeBox(e.edge,u,op.sill+op.height-20,op.width,40,fd,0xfafaf6,0.95);
          if(op.type==='window'){edgeBox(e.edge,u,op.sill+20,op.width,40,fd,0xfafaf6,0.95);edgeBox(e.edge,u,y,40,op.height,fd,0xfafaf6,0.95);edgeBox(e.edge,u,y,op.width-80,op.height-80,4,0x8cbac6,0.2);}
          else edgeBox(e.edge,u,y,op.width-80,op.height-40,35,op.color?Number.parseInt(op.color.slice(1),16):0xaa8e6d,0.6);
          const casing=op.casing??0,thick=op.casingThick??12;
          if(casing){edgeBox(e.edge,e.offset-casing/2,y,casing,op.height,thick,color,.9);edgeBox(e.edge,e.offset+op.width+casing/2,y,casing,op.height,thick,color,.9);edgeBox(e.edge,u,op.sill+op.height+casing/2,op.width+2*casing,casing,thick,color,.9);}
          // подоконник: сдвиг его середины от середины проёма — по старому отсчёту, переведённому на направление стены контура (dir)
          if(op.windowSill){const w=op.windowSill;edgeBox(e.edge,u+e.dir*(w.offset+w.width/2-op.offset-op.width/2),op.sill-w.thick/2,w.width,w.thick,w.overhang+(op.reveal??0),color,.95,w.overhang);}
        }
        openingId=undefined;
        for(const ob of r.obstacles||[]){if(APPLIANCE_MODEL_TYPES.includes(ob.type))continue;const mesh=new THREE.Mesh(new THREE.BoxGeometry(ob.width,ob.height,ob.depth),new THREE.MeshStandardMaterial({color:ob.type==='radiator'?0xd9e0e4:0xc7bcae,roughness:.85}));mesh.userData.obstacleId=ob.id;mesh.position.set(x0+ob.x+ob.width/2,ob.y+ob.height/2,z0+ob.z+ob.depth/2);mesh.castShadow=true;mesh.receiveShadow=true;modelGroup.add(mesh);const edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:!state.presentation&&state.selectedObstacle===ob.id?0x087f94:0x786d62,transparent:true,opacity:!state.presentation&&state.selectedObstacle===ob.id?1:.5}));edge.userData.captureGuide=!state.presentation&&state.selectedObstacle===ob.id;mesh.add(edge);}
        // объекты на стенах: на своей стене контура, повёрнуты по касательной; выступ — в комнату, ниша — в стену
        for(const [fi,f] of (r.fixtures||[]).entries()){
          const spec=FIXTURES[f.type],e=openingEdge(r,f),recess=spec.recess,d=recess?f.depth:Math.max(2,f.depth),q=wallSpot(o,e.edge,e.offset+f.width/2);
          const geo=f.round?new THREE.CylinderGeometry(Math.min(f.width,f.height)/2,Math.min(f.width,f.height)/2,f.horizontal?f.width:f.height,20):new THREE.BoxGeometry(f.width,f.height,d);
          const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:f.color?Number.parseInt(f.color.slice(1),16):spec.color,roughness:.8,metalness:f.round?.4:0,transparent:!!recess,opacity:recess?.35:1}));
          const c=at3(q.p,f.fromFloor+f.height/2,recess?-f.depth/2:d/2+(f.wallGap??0),q.n),rot=Math.atan2(-q.t.z,q.t.x);mesh.position.copy(c);
          if(f.round&&f.horizontal)mesh.rotation.set(0,rot,Math.PI/2);else mesh.rotation.y=rot;
          mesh.userData.fixtureId=f.id;mesh.castShadow=true;mesh.receiveShadow=true;modelGroup.add(mesh);
          if(recess)cutawayParts.push({obj:mesh,walls:[e.edge]});
          const edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:state.selectedFixture===f.id?0x087f94:0x6f6a60,transparent:true,opacity:state.selectedFixture===f.id?1:.45}));mesh.add(edge);
          if(!state.presentation)label(fixtureLabel(f,fi),new THREE.Vector3(c.x,f.fromFloor+f.height+40,c.z),()=>current.current.onFixtureSelect?.(f.id),true,recess?e.edge:undefined);
        }
        // Размеры: длина каждой стены контура (по дуге — длина дуги) снаружи у пола; высота — как у прямоугольника. Правка контура — в
        // редакторе плана; отступы выбранного проёма/объекта — по его стене контура (правятся числом, только если он уже привязан к стене edge).
        if(!state.presentation&&state.onRoomDimension&&state.roomDimensions!==false){
          const dim=state.onRoomDimension;
          o.forEach((_,i)=>{const L=edgeLength(o,i),q=wallSpot(o,i,L/2);roomLabel(`${Math.round(L)} мм`,at3(q.p,-60,-80,q.n));});
          roomLabel(`${r.height} мм`,at3(o[0],r.height/2,-80,wallSpot(o,0,0).n),()=>dim('room','','height',r.height));
          const chain=(kind:'opening'|'fixture',id:string,item:OnWall,y:number,top:number,own:boolean,extra?:[string,number,string])=>{
            const e=openingEdge(r,item),L=edgeLength(o,e.edge),rest=L-e.offset-item.width,wall=own?e.edge:undefined,at=(s:number,yy:number,out=60)=>{const q=wallSpot(o,e.edge,s);return at3(q.p,yy,out,q.n);};
            const along=item.edge!==undefined; // без edge отступ хранится по старым правилам — число здесь только показываем
            roomLabel(`${Math.round(e.offset)} от угла`,at(e.offset/2,y),along?()=>dim(kind,id,'offset',e.offset):undefined,true,wall);
            roomLabel(`${Math.round(item.width)} мм`,at(e.offset+item.width/2,top+90,40),()=>dim(kind,id,'width',item.width),false,wall);
            roomLabel(`${Math.round(rest)} до угла`,at(e.offset+item.width+rest/2,y),undefined,true,wall);
            if(extra)roomLabel(extra[0],at(e.offset+item.width/2,extra[1],40),()=>dim(kind,id,extra[2],extra[1]),true,wall);
          };
          const op=(r.openings||[]).find(x=>x.id===state.selectedOpening);
          if(op)chain('opening',op.id,op,op.sill+op.height/2,op.sill+op.height,true,op.type==='window'?[`${op.sill} от пола`,op.sill/2,'sill']:[`высота ${op.height}`,op.sill+op.height/2-120,'height']);
          const fsel=(r.fixtures||[]).find(f=>f.id===state.selectedFixture);
          if(fsel)chain('fixture',fsel.id,fsel,fsel.fromFloor+fsel.height/2,fsel.fromFloor+fsel.height,!!FIXTURES[fsel.type].recess,[`${fsel.fromFloor} от пола`,Math.max(40,fsel.fromFloor/2),'fromFloor']);
        }
        // Пол — многоугольник контура; ламинат/плитка — текстура в мм комнаты, как у прямоугольника (floorUv по x, z комнаты).
        const floorFin=r.finish?.floor?finishMaterial(r.finish.floor.id):undefined,floorGeo=new THREE.ShapeGeometry(new THREE.Shape(floorPolygon(o).map(p=>new THREE.Vector2(p.x,-p.z))));
        if(floorFin){const pos=floorGeo.getAttribute('position'),uv=new Float32Array(pos.count*2),along=r.finish?.floor?.along??defaultAlong(r);
          // плоскость повёрнута на −90° вокруг X: локальный x → x комнаты, локальный y → −z
          for(let i=0;i<pos.count;i++){const [s,t]=floorUv(pos.getX(i),-pos.getY(i),floorFin.unit,along);uv[2*i]=s;uv[2*i+1]=t;}floorGeo.setAttribute('uv',new THREE.BufferAttribute(uv,2));}
        const roomFloor=new THREE.Mesh(floorGeo,floorFin?floorFin.mat:new THREE.MeshStandardMaterial({color:0xdcd6ca,roughness:0.9}));if(floorFin)roomFloor.userData.roomFinish='floor';roomFloor.rotation.x=-Math.PI/2;roomFloor.position.set(x0,-3,z0);roomFloor.receiveShadow=true;modelGroup.add(roomFloor);
        }else{
        // Контур комнаты — 12 рёбер, у каждого свои стены: при «Ближние стены: скрыть» ребро пропадает вместе со стеной.
        cutawayRoom={x0,z0,width:r.width,depth:r.depth};
        for(const e of roomEdges(r.width,r.height,r.depth)){
          const edge=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x0+e.a[0],e.a[1],z0+e.a[2]),new THREE.Vector3(x0+e.b[0],e.b[1],z0+e.b[2])]),new THREE.LineBasicMaterial({color:0x8dabb4,transparent:true,opacity:0.5}));
          modelGroup.add(edge);cutawayParts.push({obj:edge,walls:e.walls});
        }
        let environmentOpeningId:string|undefined;
        function wallBox(wall:string,u:number,y:number,w:number,h:number,depth:number,color:number,opacity:number){
          const horizontal=wall==='back'||wall==='front';
          const mesh=new THREE.Mesh(new THREE.BoxGeometry(horizontal?w:depth,h,horizontal?depth:w),new THREE.MeshStandardMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1}));
          mesh.position.set(horizontal?x0+u:x0+(wall==='left'?-depth/2:r.width+depth/2),y,horizontal?z0+(wall==='back'?-depth/2:r.depth+depth/2):z0+u);mesh.receiveShadow=true;if(environmentOpeningId)mesh.userData.openingId=environmentOpeningId;modelGroup.add(mesh);cutawayParts.push({obj:mesh,walls:[wall as CutawayWall]});return mesh;
        }
        // Отделка стены: позиция каталога (обои/плитка) — текстура в настоящих мм, покраска — цвет. Только показ, в смету не идёт.
        const wallFinish=new Map<string,{mat:THREE.MeshStandardMaterial;unit?:FinishUnit}>();
        for(const [w,v] of Object.entries(r.finish?.walls??{})){
          const m='paint' in v?{mat:new THREE.MeshStandardMaterial({color:new THREE.Color(v.paint),roughness:.95,side:THREE.DoubleSide})}:finishMaterial(v.id);
          if(m){evenWallLight(m.mat);wallFinish.set(w,m);finishParts.push({mat:m.mat,wall:w as CutawayWall});}
        }
        const innerPoint=(wall:string,u:number,y:number)=>wall==='back'?new THREE.Vector3(x0+u,y,z0+.5):wall==='front'?new THREE.Vector3(x0+u,y,z0+r.depth-.5):wall==='left'?new THREE.Vector3(x0+.5,y,z0+u):new THREE.Vector3(x0+r.width-.5,y,z0+u);
        for(const panel of wallPanels(r)){
          const fin=wallFinish.get(panel.wall);
          if(fin&&!r.survey?.surfaces[panel.wall]){
            const u0=panel.u-panel.width/2,u1=panel.u+panel.width/2,y0=panel.y-panel.height/2,y1=panel.y+panel.height/2,pos:number[]=[],uv:number[]=[];
            for(const [u,y] of [[u0,y0],[u1,y0],[u1,y1],[u0,y0],[u1,y1],[u0,y1]]){const p=innerPoint(panel.wall,u,y);pos.push(p.x,p.y,p.z);uv.push(...(fin.unit?wallUv(u,y,fin.unit):[0,0]));}
            const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
            const mesh=new THREE.Mesh(g,fin.mat);mesh.receiveShadow=true;mesh.userData.roomFinish=panel.wall;modelGroup.add(mesh);cutawayParts.push({obj:mesh,walls:[panel.wall]});continue;
          }
          if(!r.survey?.surfaces[panel.wall]){wallBox(panel.wall,panel.u,panel.y,panel.width,panel.height,80,0xd5d5cc,panel.wall==='front'||panel.wall==='right'?0.06:0.25);continue;}
          const vertices:number[]=[];const grid=r.survey.surfaces[panel.wall]!;
          const cuts=(lo:number,hi:number,measured:number[])=>[...new Set([lo,hi,...measured.filter(v=>v>lo&&v<hi),...Array.from({length:5},(_,i)=>lo+(hi-lo)*(i+1)/6)])].sort((a,b)=>a-b);
          const us=cuts(panel.u-panel.width/2,panel.u+panel.width/2,grid.u),vs=cuts(panel.y-panel.height/2,panel.y+panel.height/2,grid.v);
          const uvs:number[]=[];
          for(let j=0;j<vs.length-1;j++)for(let i=0;i<us.length-1;i++){
            const uv=[[us[i],vs[j]],[us[i+1],vs[j]],[us[i+1],vs[j+1]],[us[i],vs[j+1]]],points=uv.map(([u,v])=>surfacePoint(r,panel.wall,u,v));
            for(const n of [0,1,2,0,2,3]){const p=points[n];vertices.push(x0+p.x,p.y,z0+p.z);uvs.push(...(fin?.unit?wallUv(uv[n][0],uv[n][1],fin.unit):[0,0]));}
          }
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));if(fin)g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeVertexNormals();
          const mesh=new THREE.Mesh(g,fin?fin.mat:new THREE.MeshStandardMaterial({color:0xb5c9c1,transparent:true,opacity:panel.wall==='front'||panel.wall==='right'?.08:.35,side:THREE.DoubleSide,depthWrite:false}));if(fin)mesh.userData.roomFinish=panel.wall;modelGroup.add(mesh);cutawayParts.push({obj:mesh,walls:[panel.wall]});
        }
        for(const side of ['floor','ceiling'] as const)if(r.survey?.surfaces[side]){
          const grid=r.survey.surfaces[side]!,vertices:number[]=[];
          for(let j=0;j<grid.v.length-1;j++)for(let i=0;i<grid.u.length-1;i++){
            const points=[[grid.u[i],grid.v[j]],[grid.u[i+1],grid.v[j]],[grid.u[i+1],grid.v[j+1]],[grid.u[i],grid.v[j+1]]].map(([u,v])=>surfacePoint(r,side,u,v));
            for(const n of [0,1,2,0,2,3]){const p=points[n];vertices.push(x0+p.x,p.y,z0+p.z);}
          }
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();modelGroup.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xc4c3ad,transparent:true,opacity:side==='floor'?.35:.08,side:THREE.DoubleSide})));
        }
        for(const o of r.openings||[]){
          environmentOpeningId=o.id;
          const u=o.offset+o.width/2,y=o.sill+o.height/2;
          for(const dx of [-o.width/2+20,o.width/2-20])wallBox(o.wall,u+dx,y,40,o.height,o.frameDepth??85,0xfafaf6,0.95);
          wallBox(o.wall,u,o.sill+o.height-20,o.width,40,o.frameDepth??85,0xfafaf6,0.95);
          if(o.type==='window'){
            wallBox(o.wall,u,o.sill+20,o.width,40,o.frameDepth??85,0xfafaf6,0.95);wallBox(o.wall,u,y,40,o.height,o.frameDepth??85,0xfafaf6,0.95);
            wallBox(o.wall,u,y,o.width-80,o.height-80,4,0x8cbac6,0.2);
          }else wallBox(o.wall,u,y,o.width-80,o.height-40,35,o.color?Number.parseInt(o.color.slice(1),16):0xaa8e6d,0.6);
        }
        environmentOpeningId=undefined;
        for(const o of r.openings||[]){environmentOpeningId=o.id;
          const casing=o.casing??0,thick=o.casingThick??12,color=o.color?Number.parseInt(o.color.slice(1),16):0xf3eee4;
          if(casing){wallBox(o.wall,o.offset-casing/2,o.sill+o.height/2,casing,o.height,thick,color,.9);wallBox(o.wall,o.offset+o.width+casing/2,o.sill+o.height/2,casing,o.height,thick,color,.9);wallBox(o.wall,o.offset+o.width/2,o.sill+o.height+casing/2,o.width+2*casing,casing,thick,color,.9);}
          if(o.windowSill){const w=o.windowSill;const mesh=wallBox(o.wall,w.offset+w.width/2,o.sill-w.thick/2,w.width,w.thick,w.overhang+(o.reveal??0),color,.95);const amount=w.overhang;if(o.wall==='back')mesh.position.z+=amount;if(o.wall==='front')mesh.position.z-=amount;if(o.wall==='left')mesh.position.x+=amount;if(o.wall==='right')mesh.position.x-=amount;}
        }
        environmentOpeningId=undefined;
        for(const o of r.obstacles||[]){if(APPLIANCE_MODEL_TYPES.includes(o.type))continue;const mesh=new THREE.Mesh(new THREE.BoxGeometry(o.width,o.height,o.depth),new THREE.MeshStandardMaterial({color:o.type==='radiator'?0xd9e0e4:0xc7bcae,roughness:.85}));mesh.userData.obstacleId=o.id;mesh.position.set(x0+o.x+o.width/2,o.y+o.height/2,z0+o.z+o.depth/2);mesh.castShadow=true;mesh.receiveShadow=true;modelGroup.add(mesh);const edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:!state.presentation&&state.selectedObstacle===o.id?0x087f94:0x786d62,transparent:true,opacity:!state.presentation&&state.selectedObstacle===o.id?1:.5}));edge.userData.captureGuide=!state.presentation&&state.selectedObstacle===o.id;mesh.add(edge);}
        // Объекты замера на стенах (розетки, батареи, короба, трубы…): боксы или цилиндры на своей стене.
        for(const [fi,f] of (r.fixtures||[]).entries()){
          const spec=FIXTURES[f.type],box=fixtureBox(r,f);
          const recess=spec.recess,d=recess?f.depth:Math.max(2,box.w&&box.d?(f.wall==='back'||f.wall==='front'?box.d:box.w):2);
          const horizontal=f.wall==='back'||f.wall==='front';
          const geo=f.round?new THREE.CylinderGeometry(Math.min(f.width,f.height)/2,Math.min(f.width,f.height)/2,f.horizontal?f.width:f.height,20):new THREE.BoxGeometry(horizontal?f.width:d,f.height,horizontal?d:f.width);
          const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:f.color?Number.parseInt(f.color.slice(1),16):spec.color,roughness:.8,metalness:f.round?.4:0,transparent:!!recess,opacity:recess?.35:1}));
          const cx=horizontal?x0+f.offset+f.width/2:x0+(f.wall==='left'?(recess?-f.depth/2:d/2):r.width-(recess?-f.depth/2:d/2));
          const cz=horizontal?z0+(f.wall==='back'?(recess?-f.depth/2:d/2):r.depth-(recess?-f.depth/2:d/2)):z0+f.offset+f.width/2;
          mesh.position.set(cx+(f.wall==='left'?(f.wallGap??0):f.wall==='right'?-(f.wallGap??0):0),f.fromFloor+f.height/2,cz+(f.wall==='back'?(f.wallGap??0):f.wall==='front'?-(f.wallGap??0):0));
          if(f.round&&f.horizontal)mesh.rotation.z=horizontal?Math.PI/2:0,mesh.rotation.x=horizontal?0:Math.PI/2;
          if(f.round&&!f.horizontal&&!horizontal)mesh.rotation.y=0;
          mesh.userData.fixtureId=f.id;mesh.castShadow=true;mesh.receiveShadow=true;modelGroup.add(mesh);
          // Предмет в комнате (батарея, розетка) остаётся виден; утопленный в стену (ниша, штроба) скрывается вместе со стеной.
          if(recess)cutawayParts.push({obj:mesh,walls:[f.wall as CutawayWall]});
          const edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:state.selectedFixture===f.id?0x087f94:0x6f6a60,transparent:true,opacity:state.selectedFixture===f.id?1:.45}));mesh.add(edge);
          if(!state.presentation)label(fixtureLabel(f,fi),new THREE.Vector3(cx,f.fromFloor+f.height+40,cz),()=>current.current.onFixtureSelect?.(f.id),true,recess?f.wall as CutawayWall:undefined);
        }
        // Размеры помещения и выбранного проёма/объекта прямо в 3D: клик по числу — правка (как у корпуса).
        if(!state.presentation&&state.onRoomDimension&&state.roomDimensions!==false){
          const dim=state.onRoomDimension;
          roomLabel(`${r.width} мм`,new THREE.Vector3(x0+r.width/2,-60,z0+r.depth+80),()=>dim('room','','width',r.width));
          roomLabel(`${r.depth} мм`,new THREE.Vector3(x0+r.width+80,-60,z0+r.depth/2),()=>dim('room','','depth',r.depth));
          roomLabel(`${r.height} мм`,new THREE.Vector3(x0-80,r.height/2,z0+r.depth+40),()=>dim('room','','height',r.height));
          const wallPoint=(wall:string,u:number,y:number,out=60)=>{const horizontal=wall==='back'||wall==='front';return horizontal?new THREE.Vector3(x0+u,y,z0+(wall==='back'?out:r.depth-out)):new THREE.Vector3(x0+(wall==='left'?out:r.width-out),y,z0+u);};
          // Подписи не накрывают объект: ширина — над ним, «от угла / до угла» — по бокам на его высоте, «от пола» — под ним.
          const chain=(kind:'opening'|'fixture',id:string,wall:string,offset:number,width:number,y:number,top:number,extra?:[string,number,string])=>{
            const len=wall==='back'||wall==='front'?r.width:r.depth,rest=len-offset-width;
            // Подписи проёма скрываются со своей стеной; объекта в комнате (батарея, розетка) — остаются, как и он сам.
            const own=kind==='opening'||(kind==='fixture'&&(r.fixtures||[]).some(f=>f.id===id&&FIXTURES[f.type].recess))?wall as CutawayWall:undefined;
            roomLabel(`${Math.round(offset)} от угла`,wallPoint(wall,offset/2,y),()=>dim(kind,id,'offset',offset),true,own);
            roomLabel(`${Math.round(width)} мм`,wallPoint(wall,offset+width/2,top+90,40),()=>dim(kind,id,'width',width),false,own);
            roomLabel(`${Math.round(rest)} до угла`,wallPoint(wall,offset+width+rest/2,y),()=>dim(kind,id,'end',rest),true,own);
            if(extra)roomLabel(extra[0],wallPoint(wall,offset+width/2,extra[1],40),()=>dim(kind,id,extra[2],extra[1]),true,own);
          };
          const o=(r.openings||[]).find(o=>o.id===state.selectedOpening);
          if(o)chain('opening',o.id,o.wall,o.offset,o.width,o.sill+o.height/2,o.sill+o.height,o.type==='window'?[`${o.sill} от пола`,o.sill/2,'sill']:[`высота ${o.height}`,o.sill+o.height/2-120,'height']);
          const fsel=(r.fixtures||[]).find(f=>f.id===state.selectedFixture);
          if(fsel)chain('fixture',fsel.id,fsel.wall,fsel.offset,fsel.width,fsel.fromFloor+fsel.height/2,fsel.fromFloor+fsel.height,[`${fsel.fromFloor} от пола`,Math.max(40,fsel.fromFloor/2),'fromFloor']);
        }
        // Пол: ламинат/плитка — текстура в настоящих мм, длинная сторона доски вдоль ширины или глубины комнаты (roomFinishes.ts).
        const floorFin=r.finish?.floor?finishMaterial(r.finish.floor.id):undefined,floorGeo=new THREE.PlaneGeometry(r.width,r.depth);
        if(floorFin){const pos=floorGeo.getAttribute('position'),uv=floorGeo.getAttribute('uv'),along=r.finish?.floor?.along??defaultAlong(r);
          // плоскость повёрнута на −90° вокруг X: локальный x → x комнаты, локальный y → −z
          for(let i=0;i<pos.count;i++){const [s,t]=floorUv(pos.getX(i)+r.width/2,r.depth/2-pos.getY(i),floorFin.unit,along);uv.setXY(i,s,t);}uv.needsUpdate=true;}
        const roomFloor=new THREE.Mesh(floorGeo,floorFin?floorFin.mat:new THREE.MeshStandardMaterial({color:0xdcd6ca,roughness:0.9}));if(floorFin)roomFloor.userData.roomFinish='floor';roomFloor.rotation.x=-Math.PI/2;roomFloor.position.set(x0+r.width/2,-3,z0+r.depth/2);roomFloor.receiveShadow=true;modelGroup.add(roomFloor);
        }
      }
      releaseFinishMaps();
      const b = state.hideFurniture||state.hiddenModuleIds?.includes(focus.id)||m.corner?undefined:boxes(m).find((b) => b.id === state.selected);
      if (b) {
        const geo = new THREE.BoxGeometry(
          b.width,
          b.top - b.bottom,
          m.depth - 20,
        );
        const highlight = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({
            color: 0x24899b,
            transparent: true,
            opacity: 0.72,
          }),
        );
        geo.dispose();
        highlight.position.set(
          b.x + b.width / 2 - m.width / 2,
          (b.top + b.bottom) / 2+(focus.y??0),
          5,
        );
        highlight.position.applyAxisAngle(new THREE.Vector3(0,1,0),(focus.rotation??0)*Math.PI/180);highlight.rotation.y=(focus.rotation??0)*Math.PI/180;
        modelGroup.add(highlight);
      }
      // Размер блока ящиков: от верхней плоскости дна пенала до верха полки над ящиками — при редактировании ящиков.
      if (b && !state.presentation && !state.exploded) {
        const sec = m.sections.find((s) => s.id === b.id);
        if (sec && sec.drawers > 0 && parts(m).some(p=>p.id===sec.id+':drawer-cap') && (state.selectedPart?.includes(":drawer:") || state.drawerPreview)) {
          const fy = focus.y ?? 0, zz = m.depth / 2 + 30, gx = b.x - m.width / 2 + 40;
          const top = b.bottom + drawerStackHeight(sec) + RULES.panel;
          line([new THREE.Vector3(gx, b.bottom + fy, zz), new THREE.Vector3(gx, top + fy, zz)]);
          for (const yy of [b.bottom, top]) line([new THREE.Vector3(gx - 30, yy + fy, zz), new THREE.Vector3(gx + 30, yy + fy, zz)]);
          label(`${Math.round(top - b.bottom)} мм от дна`, new THREE.Vector3(gx, (b.bottom + top) / 2 + fy, zz + 10), () => current.current.onDrawerStack?.(b.id), true);
        }
      }
      if (state.dimensions&&!state.hideFurniture&&!state.hiddenModuleIds?.includes(focus.id)) {
        const fy=focus.y??0;
        const z = m.depth / 2 + 110,
          x = -m.width / 2 - 150;
        line([
          new THREE.Vector3(-m.width / 2, fy-90, z),
          new THREE.Vector3(m.width / 2, fy-90, z),
        ]);
        for (const dx of [-m.width / 2, m.width / 2])
          line([new THREE.Vector3(dx, fy-55, z), new THREE.Vector3(dx, fy-125, z)]);
        label(`${m.width} мм`, new THREE.Vector3(0, (focus.y??0)-110, z), () =>
          current.current.onDimension("width"),
        );
        labels[labels.length-1].element.dataset.dim="width"; // обновляется во время растяжения
        line([new THREE.Vector3(x, fy, z), new THREE.Vector3(x, m.height+fy, z)]);
        // Макс 29.10: общая высота выбранного видна всегда (и при подписях проёмов) — выше середины, где стоят ручки растяжения и плашки зазоров
        label(
          m.height + " мм",
          new THREE.Vector3(x - 30, m.height * 0.7+(focus.y??0), z),
          () => current.current.onDimension("height"),
        );
        labels[labels.length-1].element.dataset.dim="height"; // обновляется во время растяжения за угол
        // Макс 29.10: модули стопкой (тумба + малый + высокий) — общая высота колонны: своей и соседних слева/справа
        {const all=current.current.arrangement,cols:{x:number;c:ReturnType<typeof columnOf>}[]=[];
          try{const own=columnOf(all,focus.id);if(own.ids.length>1)cols.push({x:x-260,c:own});}catch{/* нет модуля */}
          for(const side of ['left','right'] as const){const g=state.rowGaps?.[side];if(!g?.id)continue;
            try{const c=columnOf(all,g.id);if(c.ids.length>1&&!c.ids.includes(focus.id))cols.push({x:side==='left'?-m.width/2-g.gap-120:m.width/2+g.gap+120,c});}catch{/* сосед убран */}}
          for(const {x:cx,c} of cols){line([new THREE.Vector3(cx,c.bottom,z),new THREE.Vector3(cx,c.top,z)]);for(const yy of [c.bottom,c.top])line([new THREE.Vector3(cx-35,yy,z),new THREE.Vector3(cx+35,yy,z)]);
            label(`колонна ${c.height} мм`,new THREE.Vector3(cx,(c.bottom+c.top)/2,z),undefined);const ce=labels[labels.length-1].element;ce.dataset.dim="column";ce.style.opacity="1";ce.style.color="#1f3a8f";ce.title=`Модули стопкой: ${c.ids.length}, от низа нижнего до верха верхнего`;}}
        label(
          m.depth + " мм",
          new THREE.Vector3(m.width / 2 + 150, fy+100, 0),
          () => current.current.onDimension("depth"),
        );
        labels[labels.length-1].element.dataset.dim="depth";
        if (
          b && state.gapDimensions!==false &&
          m.sections.find((s) => s.id === b.id)!.shelves.length &&
          (!m.doors||state.openDoors||state.transparent) &&
          !state.exploded
        ) {
          // проёмы крайней секции подписываем снаружи корпуса (не поверх полок и соседних подписей), средней — по центру секции
          const gx = gapLabelX(b, m.width, RULES.panel);
          shelfGaps(m, b.id).forEach((g, i) => {
            line([
              new THREE.Vector3(gx, g.bottom+fy, z - 85),
              new THREE.Vector3(gx, g.top+fy, z - 85),
            ]);
            label(
              openingSizeLabel(g.height),
              new THREE.Vector3(gx, (g.top + g.bottom) / 2+(focus.y??0), z - 75),
              () => current.current.onGap(i),
              true,
            );
          });
        }
      }
      // Зазоры до соседа/стены и ручки растяжения у выбранного модуля (запрос Макса 20.10.2026): середина высоты, у фасада.
      if(!state.presentation&&!state.exploded&&!state.hideFurniture&&!state.hiddenModuleIds?.includes(focus.id)&&(state.mode==='move'||state.mode==='select')){
        const fm=focus.module,center=moduleCenter(focus),fy=(focus.y??0)+fm.height/2,front=fm.depth+40;
        const at=(u:number,v:number,y:number)=>{const q=localToRoom(focus,u,v);return new THREE.Vector3(q.x-center.x,y,q.z-center.z);};
        for(const side of ['left','right'] as const){
          const g=state.dimensions?state.rowGaps?.[side]:undefined;
          if(g&&g.gap>0){
            const u0=side==='right'?fm.width+sideExtension(fm,'right'):-sideExtension(fm,'left'),u1=side==='right'?u0+g.gap:u0-g.gap;
            roomLine([at(u0,front,fy),at(u1,front,fy)]);
            for(const u of [u0,u1])roomLine([at(u,front,fy-40),at(u,front,fy+40)]);
            gapPlaque(side,g,at((u0+u1)/2,front+10,fy));
          }
          if(state.mode==='move'&&state.stretchable&&state.onStretch&&!state.lightMode)stretchHandle(side,at(side==='right'?fm.width:0,fm.depth+25,fy));
        }
        // Ручки углов (решение Макса 29.10.2026): спереди — ширина+высота (плоскость фасада), сверху — ширина+глубина (крыша),
        // сбоку — глубина+высота (видимый бок)
        const dims=cornerDims(state.view);
        if(dims&&state.mode==='move'&&state.stretchable&&state.onCorner&&!state.lightMode){
          for(const e1 of ['lo','hi'] as const)for(const e2 of ['lo','hi'] as const)cornerHandle(dims,[e1,e2],cornerAt(focus,dims,[e1,e2]));
        }
      }
      guideGroup=null;drawGuides();
    }
    function fit() {
      fitting=true;needsRender=true;
      const m = current.current.module;
      const aspect = target.clientWidth / Math.max(1, target.clientHeight);
      const state = current.current,
        focus =
          state.arrangement.find((a) => a.id === state.activeId) ||
          state.arrangement[0];
      const items=state.focusActive?[focus]:state.arrangement,room=state.focusActive?undefined:state.room;
      const objects=state.focusActive?[]:(state.appliances??[]), fitted=[...items.map(bounds),...objects.map(o=>({x:o.x,z:o.z,w:o.width,d:o.depth}))];
      const minX=Math.min(...fitted.map(b=>b.x)),maxX=Math.max(...fitted.map(b=>b.x+b.w));
      const minZ=Math.min(...fitted.map(b=>b.z)),maxZ=Math.max(...fitted.map(b=>b.z+b.d));
      const minY=state.focusActive?(focus.y??0):0;
      let height=room?room.height:Math.max(...items.map(a=>a.module.height+(a.y??0)),...objects.map(o=>o.y+o.height))-minY;
      let width=room?room.width:maxX-minX,depth=room?room.depth:maxZ-minZ;
      const center=new THREE.Vector3((room?room.width/2:(minX+maxX)/2)-moduleCenter(focus).x,minY+height/2,(room?room.depth/2:(minZ+maxZ)/2)-moduleCenter(focus).z);
      if(m.corner&&!room&&!state.focusActive){
        modelGroup.updateWorldMatrix(true,true);const visible=new THREE.Box3().setFromObject(modelGroup);
        if(!visible.isEmpty()){const size=visible.getSize(new THREE.Vector3());width=size.x;depth=size.z;height=size.y;visible.getCenter(center);}
      }
      controls.target.copy(center);
      const view = current.current.view;
      const facing=items.reduce((v,a)=>{const r=(a.rotation??0)*Math.PI/180;return {x:v.x+Math.sin(r)*a.module.width,z:v.z+Math.cos(r)*a.module.width};},{x:0,z:0});
      camera=view==='iso'?perspective:orthographic;controls.object=camera;
      const dir =
        view === "front"
          ? new THREE.Vector3(0, 0, 1)
          : view === "side"
            ? new THREE.Vector3(1, 0, 0.001)
            : view === "left"
            ? new THREE.Vector3(-1, 0, 0.001)
            : view === "top"
              ? new THREE.Vector3(0, 1, 0.001)
              : new THREE.Vector3(state.isoDirection?.[0]??(facing.x<-.1?-1:1), state.isoDirection?.75:.55, state.isoDirection?.[1]??(facing.z<-.1?-1.7:1.7)).normalize();
      if(view==="front"||view==="side"||view==="left")dir.applyAxisAngle(new THREE.Vector3(0,1,0),((focus.rotation??0)+(m.corner?45:0))*Math.PI/180);
      const padding=state.presentation?50:state.dimensions?500:180;
      // Fit into the uncovered area, while keeping the canvas full size for orbit/zoom.
      const screenH=Math.max(1,target.clientHeight), top=Math.min(state.presentation?60:112,screenH*.3), bottom=Math.min(state.presentation?75:55,screenH*.18);
      const usableH=Math.max(1,screenH-top-bottom), safeAspect=target.clientWidth/usableH;
      const safeFov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(perspective.fov)/2)*usableH/screenH));
      const dist=frameDistance({x:width+padding,y:height+padding,z:depth+padding},dir,safeAspect,safeFov,1.08);
      let frameH=2*dist*Math.tan(THREE.MathUtils.degToRad(perspective.fov)/2);
      if(camera===orthographic){const h=frameHeight({x:width+padding,y:height+padding,z:depth+padding},dir,safeAspect,1.08)*screenH/usableH;frameH=h;orthographic.left=-h*aspect/2;orthographic.right=h*aspect/2;orthographic.top=h/2;orthographic.bottom=-h/2;orthographic.zoom=1;}else perspective.aspect=aspect;
      const screenUp=new THREE.Vector3(0,1,0).addScaledVector(dir,-dir.y).normalize();
      center.addScaledVector(screenUp,(top-bottom)*frameH/(2*screenH));controls.target.copy(center);
      camera.updateProjectionMatrix();
      camera.up.set(0, 1, 0);
      camera.position.copy(center).addScaledVector(dir, dist);
      controls.update();
      if(current.current.fit===p.fit&&current.current.view===p.view)restoreCamera();
      fitting=false;
      // другой вид — свои вспомогательные линии; начатая линия Q отменяется
      cancelTool();selectedGuide=null;drawGuides();
    }
    let initial = true;
    const observer = new ResizeObserver(() => {
      if (!target.clientWidth || !target.clientHeight) return;
      renderer.setSize(target.clientWidth, target.clientHeight);
      perspective.aspect = target.clientWidth / target.clientHeight;
      const aspect=target.clientWidth/target.clientHeight;
      const halfHeight=(orthographic.top-orthographic.bottom)/2;
      orthographic.left=-halfHeight*aspect;orthographic.right=halfHeight*aspect;
      orthographic.updateProjectionMatrix();perspective.updateProjectionMatrix();
      needsRender=true;
      if (initial || current.current.presentation) {
        fit();
        initial = false;
      }
    });
    observer.observe(target);
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    const badge=document.createElement('div');badge.className='drag-badge';badge.hidden=true;target.appendChild(badge);
    // ── Привязки курсора клавишами (решение Макса 29.10.2026, pointSnap.ts): Alt — точка на ближайшей линии, Ctrl — ближайшее
    // пересечение двух линий; без привязки — галочка «Привязки корпусов» (Shift с 30.10 — отметить/группа). Для линии Q, угла, края «↔» и переноса корпуса в ортогональных видах.
    type PtrLike={clientX:number;clientY:number;altKey:boolean;ctrlKey:boolean;metaKey:boolean;shiftKey:boolean};
    /** Галочка «Привязки корпусов» (App): выключена — без привязки (с 30.10 вместо Shift; Alt/Ctrl работают всегда). */
    const snapOn=()=>current.current.snapping!==false;
    const snapMark=document.createElement('div');snapMark.className='snap-mark';snapMark.hidden=true;target.appendChild(snapMark);
    let lastPtr:{clientX:number;clientY:number}|null=null,ptrMode:SnapMode='snap';
    const r1=(v:number)=>Math.round(v*10)/10;
    /** Допуск привязки к точке, мм: 14 px экрана (без потолка 30 мм — Alt/Ctrl нажаты нарочно). */
    function pointTol(){const mm=camera===orthographic?(orthographic.top-orthographic.bottom)/orthographic.zoom/Math.max(1,target.clientHeight):3;return Math.max(1,POINT_SNAP_PX*mm);}
    /** Линии вида для Alt/Ctrl: вспомогательные, контуры видимых корпусов (кроме тех, что тянутся), кромки деталей выбранного,
     *  стены/пол/потолок — те же, от которых строится линия Q (guides.candidateLines). */
    function snapSegs(exclude:string[]):Seg2[]{
      const s=current.current,look=lookNow();if(!look)return [];
      const mods=s.hideFurniture?[]:s.arrangement.filter(a=>!s.hiddenModuleIds?.includes(a.id)&&!exclude.includes(a.id));
      return toSegments(candidateLines(mods,look,s.activeId,s.guideRoom??s.room,s.presentation?[]:s.guides),look);
    }
    /** Метка пойманной точки: кружок — на линии (Alt), крестик — пересечение (Ctrl). */
    function markAt(hit:PointHit|undefined,look:V3|null,depth:V3){
      if(!hit||!look){if(!snapMark.hidden){snapMark.hidden=true;}return;}
      const p=toScreen(toScene(fromView(hit.p,look,depth)));snapMark.hidden=false;snapMark.dataset.kind=hit.kind;snapMark.dataset.at=hit.p.h+';'+hit.p.v;
      snapMark.style.left=p.x+'px';snapMark.style.top=p.y+'px';
    }
    /** Начало плашки по режиму: «Без привязки · », «Ctrl · пересечение: … · »; обычные привязки — пусто. */
    const modeText=(mode:SnapMode,hit:PointHit|undefined,look:V3|null)=>mode==='snap'?'':(isPointMode(mode)&&!look?'Без привязки':hitText(hit,mode))+' · ';
    type Drag={mid:string;sid:string;pid:string;kind:'module'|'part'|'divider'|'dividerEnd';plane:THREE.Plane;anchor:THREE.Vector3;origin:{x:number;y:number;z:number};point:[number,number];moved:boolean;candidate:{x:number;y:number;z:number};meshes:THREE.Object3D[];delta:number;
      /** Alt/Ctrl (pointSnap.ts): опорный угол корпуса в осях вида и линии для привязки — считаются при первом нажатии. */
      ref?:P2;segs?:Seg2[];
      /** Shift+протяжка: группа, что едет вместе (отмеченные + этот корпус) — пока App не перерисовал отметки. */
      group?:string[]};
    let drag:Drag|null=null;
    /** Группа, что едет с корпусом: при Shift+протяжке — своя (отметка ещё не дошла из App), иначе — отмеченные. */
    const dragGroup=(d:Drag)=>d.group??current.current.groupIds;
    /** Shift+нажатие на корпус (режим «Двигать»): отпустили без движения — отметить корпус (мультивыбор), потянули от 9 px —
     *  перенос отмеченной группы вместе, с привязками (решение Макса 30.10: «Ctrl — привязка к пересечению 2 линий, выделение через Shift»; «Shift при перетягивании — группу вместе»). */
    let markPress:{mid:string;x:number;y:number;pointerId:number}|null=null;
    const targetGeometry=new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),targetMaterial=new THREE.LineBasicMaterial({color:0x4057ee,depthTest:false,transparent:true,opacity:.8});
    const dropTarget=new THREE.LineSegments(targetGeometry,targetMaterial);dropTarget.visible=false;dropTarget.renderOrder=100;scene.add(dropTarget);
    function indicateTarget(hit:THREE.Intersection|undefined){
      needsRender=true;targetMaterial.color.set(0x4057ee);
      if(!hit){dropTarget.visible=false;return '';}
      const state=current.current,a=state.arrangement.find(a=>a.id===hit.object.userData.moduleId),focus=state.arrangement.find(a=>a.id===state.activeId);
      if(!a||!focus){dropTarget.visible=false;return '';}
      const sid=sectionFor(hit),b=boxes(a.module).find(b=>b.id===sid);if(!b)return '';
      const c=a.module.corner,zone=a.module.sections.findIndex(s=>s.id===sid);
      const local=c?(c.level==='upper'?{x:a.module.width/2,z:a.module.depth/2}:zone===0?{x:16+c.bayDepth/2,z:a.module.width-16-b.width/2}:zone===1?{x:a.module.width-16-b.width/2,z:16+c.bayDepth/2}:{x:a.module.width/2,z:a.module.depth/2}):{x:b.x+b.width/2,z:a.module.depth/2};
      const center=moduleCenter(focus),pos=localToRoom(a,local.x,local.z);
      dropTarget.position.set(pos.x-center.x,(a.y??0)+(b.bottom+b.top)/2,pos.z-center.z);
      dropTarget.rotation.y=(a.rotation??0)*Math.PI/180;dropTarget.scale.set(c&&zone===0?c.bayDepth:b.width,b.top-b.bottom,c?(zone===0?b.width:c.bayDepth):a.module.depth);dropTarget.visible=true;
      return 'Корпус '+(state.arrangement.indexOf(a)+1)+' · секция '+(a.module.sections.findIndex(s=>s.id===sid)+1);
    }

    function cast(clientX:number,clientY:number){const r=renderer.domElement.getBoundingClientRect();pointer.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);}
    function hitAt(clientX:number,clientY:number,allowShell=false){cast(clientX,clientY);return ray.intersectObjects(modelGroup.children,true).find(h=>h.object instanceof THREE.Mesh&&h.object.userData.moduleId&&!(drag?.kind==='part'&&drag.moved&&drag.meshes.includes(h.object))&&!(!allowShell&&current.current.transparent&&['body','door'].includes(h.object.userData.role)&&!/:divider(:under|:over)?$/.test(h.object.userData.partId??'')));}
    function sectionFor(hit:THREE.Intersection){const a=current.current.arrangement.find(a=>a.id===hit.object.userData.moduleId)!;const focus=current.current.arrangement.find(a=>a.id===current.current.activeId)!;const center=moduleCenter(focus),xx=roomToLocal(a,hit.point.x+center.x,hit.point.z+center.z).x,yy=hit.point.y-(a.y??0);return hit.object.userData.sectionId||boxes(a.module).find(b=>xx>=b.x&&xx<=b.x+b.width&&yy>=b.bottom&&yy<=b.top)?.id||a.module.sections[0].id;}
    function pointerDown(e:PointerEvent){
      if(e.button!==0||current.current.presentation)return;
      // Shift+щелчок — отметить корпус (решение Макса 30.10; Ctrl+щелчок больше не отмечает — Ctrl только привязка)
      // в «Наполнении» Shift корпуса не отмечает: полки и ящики тянутся как обычно (критик 30.10 п.1)
      if(isMarkClick(e)&&current.current.onToggleModule&&current.current.mode!=='fill'){const picked=hitAt(e.clientX,e.clientY,true);if(picked){e.preventDefault();
        const s=current.current;if(s.mode==='move'&&!s.lightMode&&picked.object.userData.role!=='handle'){markPress={mid:picked.object.userData.moduleId,x:e.clientX,y:e.clientY,pointerId:e.pointerId};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);}
        else s.onToggleModule!(picked.object.userData.moduleId);}return;}
      if(current.current.lightMode&&current.current.onLightPick){const picked=hitAt(e.clientX,e.clientY,true);if(picked?.object.userData.partId){e.preventDefault();const mid=picked.object.userData.moduleId,alts=[...new Set(ray.intersectObjects(modelGroup.children,true).filter(h=>h.object instanceof THREE.Mesh&&h.object.userData.moduleId===mid&&h.object.userData.partId).map(h=>h.object.userData.partId as string))].filter(x=>x!==picked.object.userData.partId);current.current.onLightPick(mid,picked.object.userData.partId,alts);}return;}
      if(current.current.mode==='orbit')return;
      cast(e.clientX,e.clientY);const first=ray.intersectObjects(modelGroup.children,true).find(h=>h.object instanceof THREE.Mesh&&(h.object.userData.obstacleId||h.object.userData.fixtureId||h.object.userData.moduleId));
      if(first?.object.userData.obstacleId){current.current.onObstacleSelect(first.object.userData.obstacleId);return;}
      if(first?.object.userData.fixtureId){current.current.onFixtureSelect?.(first.object.userData.fixtureId);return;}
      // fromMark — перенос из Shift+нажатия: корпус выбран по оболочке и в прозрачном режиме (критик 29.10 п.8), отметки не снимаются
      const fromMark=!!(e as PointerEvent&{fromMark?:boolean}).fromMark,hit=hitAt(e.clientX,e.clientY,fromMark);if(!hit)return;
      if(!fromMark)current.current.onPlainModuleClick?.(String(hit.object.userData.moduleId));
      const state=current.current,a=state.arrangement.find(a=>a.id===hit.object.userData.moduleId)!;
      const sid=sectionFor(hit),pid=hit.object.userData.partId as string;
      // Клик по ручке в любом режиме открывает выбор ручки для этого корпуса.
      if(hit.object.userData.role==='handle'&&state.onHandleClick&&!state.presentation){if(a.id!==state.activeId)state.onModuleSelect(a.id);state.onHandleClick(a.id,pid.includes(':drawer:')?pid.replace(':handle',':facade'):pid.replace(':handle:',':door:'));return;}
      if(state.mode==='select'){if(a.id!==state.activeId)state.onModuleSelect(a.id);state.onPartSelect(sid,pid,a.id);return;}
      const isPart=state.mode==='fill'&&(!a.module.corner||pid.includes(':shelf:')||pid.includes(':drawer:')||pid.endsWith(':rod'))&&(['shelf','drawer','rod','pantograph','flange'].includes(hit.object.userData.role)||(hit.object.userData.role==='handle'&&pid.includes(':drawer:')))&&!pid.includes(':drawer-cap');
      const isDivider=state.mode==='fill'&&!a.module.corner&&pid.endsWith(':divider');
      const isDividerEnd=state.mode==='fill'&&!a.module.corner&&!!state.onMoveDividerEnd&&/:divider:(under|over)$/.test(pid);
      if(state.mode==='fill'&&!isPart&&!isDivider&&!isDividerEnd){if(a.id!==state.activeId)state.onModuleSelect(a.id);else state.onPartSelect(sid,pid);return;}
      const normal=isPart&&a.module.corner?camera.getWorldDirection(new THREE.Vector3()):isPart||isDivider||isDividerEnd||state.view==='front'?new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),(a.rotation??0)*Math.PI/180):sideView(state.view)?camera.getWorldDirection(new THREE.Vector3()):new THREE.Vector3(0,1,0); // сбоку — плоскость экрана: глубина и высота (критик 29.10 п.7)
      const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit.point);
      const anchor=new THREE.Vector3();if(!ray.ray.intersectPlane(plane,anchor))return;
      const meshes:THREE.Object3D[]=[];const prefix=pid.includes(':pantograph:')?sid+':pantograph:':pid.includes(':drawer:')?pid.split(':drawer:')[0]+':drawer:'+pid.split(':drawer:')[1].split(':')[0]+':':pid;
      moduleGroups.get(a.id)?.traverse(o=>{if(o instanceof THREE.Mesh&&(o.userData.partId===pid||o.userData.partId?.startsWith(prefix)||((pid===sid+':rod'||pid.includes(':flange:'))&&(o.userData.partId===sid+':rod'||o.userData.partId?.startsWith(sid+':flange:')))))meshes.push(o);});
      drag={mid:a.id,sid:isDividerEnd?pid.split(':')[0]:sid,pid,kind:isDivider?'divider':isDividerEnd?'dividerEnd':isPart?'part':'module',plane,anchor,origin:{x:a.x,y:a.y??0,z:a.z},point:[e.clientX,e.clientY],moved:false,candidate:{x:a.x,y:a.y??0,z:a.z},meshes,delta:0};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);
    }
    function pointerMove(e:PtrLike){
      lastPtr={clientX:e.clientX,clientY:e.clientY};
      // Shift+нажатие на корпус потянули (от 9 px) — перенос отмеченной группы вместе (решение Макса 30.10): корпус, ещё не
      // отмеченный, отмечается и едет с группой; привязки — как у обычного переноса (Alt/Ctrl — у этого корпуса, группа — тем же ходом)
      if(markPress&&!drag){const cp=markPress;if(!markDragStarts(e.clientX-cp.x,e.clientY-cp.y))return;markPress=null;
        pointerDown({button:0,clientX:cp.x,clientY:cp.y,pointerId:cp.pointerId,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,fromMark:true,preventDefault(){}} as unknown as PointerEvent);
        const md=drag as Drag|null;if(!md){controls.enabled=true;return;}
        // «Двигать всю композицию» включено — едет композиция, отметки и галочку не трогаем (критик 30.10 п.2)
        if(md.kind==='module'&&!current.current.moveAll){const s=current.current,g=s.groupIds??[];md.group=g.includes(md.mid)?g:[...g,md.mid];if(!g.includes(md.mid))s.onToggleModule?.(md.mid);}}
      if(!drag)return;if(!drag.moved&&Math.hypot(e.clientX-drag.point[0],e.clientY-drag.point[1])<4)return;
      needsRender=true;drag.moved=true;cast(e.clientX,e.clientY);const point=new THREE.Vector3();if(!ray.ray.intersectPlane(drag.plane,point))return;point.sub(drag.anchor);badge.hidden=false;
      if(drag.kind==='module'){
        // сбоку высота — только если ход по вертикали главный и > 15 px (дрожание руки не поднимает корпус с пола)
        const lockY=sideView(current.current.view)&&!sideHeightFree(e.clientX-drag.point[0],e.clientY-drag.point[1]);
        const raw={x:drag.origin.x+point.x,y:lockY?drag.origin.y:current.current.view==='front'||sideView(current.current.view)?Math.max(0,drag.origin.y+point.y):drag.origin.y,z:drag.origin.z+point.z};
        const mode=snapMode(e,snapOn()),look=lookNow(),da=current.current.arrangement.find(a=>a.id===drag!.mid);let next:{x:number;y:number;z:number},hit:PointHit|undefined;
        if(isPointMode(mode)&&look&&da){
          // Alt/Ctrl: угол корпуса, ближайший к месту захвата, — на линию / в пересечение (корпуса, что едут вместе, не в счёт)
          const s=current.current,d=drag;
          d.ref??=nearestOutlineCorner(carcassCorners({...da,...d.origin}),look,toView(fromScene(d.anchor),look));
          d.segs??=snapSegs(s.moveAll?s.arrangement.map(a=>a.id):dragGroup(d)?.includes(d.mid)?dragGroup(d)!:[d.mid]);
          const r=snapDelta(mode,d.ref,toView({x:raw.x-d.origin.x,y:raw.y-d.origin.y,z:raw.z-d.origin.z},look),d.segs,pointTol()),dv=viewDelta(r.delta.h,r.delta.v,look);hit=r.hit;
          next=hit?{x:r1(d.origin.x+dv.x),y:Math.max(0,r1(d.origin.y+dv.y)),z:r1(d.origin.z+dv.z)}:{x:Math.round(raw.x),y:Math.round(raw.y),z:Math.round(raw.z)};
        }else if(mode!=='snap')next={x:Math.round(raw.x),y:Math.round(raw.y),z:Math.round(raw.z)}; // галочка «Привязки корпусов» снята (и Alt/Ctrl в 3D) — без привязки
        else{
          next=current.current.snap(drag.mid,raw);
          // края корпуса — к вспомогательным линиям этого вида (Q), ближе обычной привязки
          if(da)next=snapMoveToGuides(da,raw,next,viewGuides(),snapTol());
        }
        // контур: после линий Q, Alt/Ctrl и без привязки — корпус упирается в стену, а не проходит сквозь скос (критик 30.10)
        if(current.current.keepIn)next={...current.current.keepIn(drag.mid,next),y:next.y};
        markAt(hit,look,fromScene(drag.anchor));
        // Horizontal dragging must not snap height to a neighbour or the floor.
        if(current.current.view!=='front'&&!sideView(current.current.view))next.y=drag.origin.y; // сбоку высота своя, как спереди (критик 29.10 п.7)
        else if(lockY&&!(hit&&!hit.free?.v))next.y=drag.origin.y; // сбоку без вертикального хода — высота прежняя (Alt/Ctrl, поймавшие высоту, — по привязке)
        drag.candidate=next;for(const [mid,group] of moduleGroups)if(current.current.moveAll||mid===drag.mid||dragGroup(drag)?.includes(drag.mid)&&dragGroup(drag)!.includes(mid))group.position.copy(group.userData.base).add(new THREE.Vector3(next.x-drag.origin.x,next.y-drag.origin.y,next.z-drag.origin.z));const problem=current.current.moveProblem(drag.mid,next);badge.classList.toggle('invalid',!!problem);badge.textContent=problem||(current.current.moveAll?'Вся композиция · ':dragGroup(drag)?.includes(drag.mid)&&(dragGroup(drag)?.length??0)>1?'Группа · ':'')+modeText(mode,hit,look)+'Положение: '+next.x+' / '+next.y+' / '+next.z+' мм';
      }else if(drag.kind==='divider'){
        const a=current.current.arrangement.find(a=>a.id===drag!.mid)!,angle=(a.rotation??0)*Math.PI/180,dx=Math.round((point.x*Math.cos(angle)-point.z*Math.sin(angle))/5)*5;
        for(const mesh of drag.meshes)mesh.position.x+=dx-drag.delta;drag.delta=dx;
        const b=boxes(a.module),i=b.findIndex(b=>b.id===drag!.sid),problem=current.current.dividerProblem(drag.mid,drag.sid,dx);
        badge.classList.toggle('invalid',!!problem);badge.textContent=problem||`Секции: ${Math.round(b[i-1].width+dx)} / ${Math.round(b[i].width-dx)} мм · отпустите для пересчёта`;
      }else if(drag.kind==='dividerEnd'){
        // конец частичной перегородки: опора-горизонталь едет по высоте, перегородка удлиняется/укорачивается при отпускании
        const dy=Math.round(point.y/5)*5,edge=drag.pid.endsWith(':under')?'under':'over';for(const mesh of drag.meshes)mesh.position.y+=dy-drag.delta;drag.delta=dy;
        const dv=current.current.arrangement.find(a=>a.id===drag!.mid)?.module.sections.find(s=>s.id===drag!.sid)?.divider,problem=current.current.dividerEndProblem?.(drag.mid,drag.sid,edge,dy);
        badge.classList.toggle('invalid',!!problem);badge.textContent=problem||(dv?`Перегородка от ${Math.round(dv.from+(edge==='under'?dy:0))} до ${Math.round(dv.to+(edge==='over'?dy:0))} мм · отпустите`:'Перегородка');
      }else{const dy=Math.round(point.y/5)*5;for(const mesh of drag.meshes)mesh.position.y+=dy-drag.delta;drag.delta=dy;
        const hit=hitAt(e.clientX,e.clientY,true),destination=indicateTarget(hit),toMid=hit?.object.userData.moduleId,toSid=hit?sectionFor(hit):undefined;
        const placed=current.current.arrangement.find(a=>a.id===toMid),to=hit&&placed&&toSid?{mid:placed.id,sid:toSid,y:hit.point.y-(placed.y??0)}:undefined;
        const problem=current.current.partProblem(drag.mid,drag.sid,drag.pid,dy,to);
        badge.classList.toggle('invalid',!!problem);if(problem)targetMaterial.color.set(0xc63838);
        badge.textContent=problem||(destination?destination+' · ':'')+'по высоте '+(dy>0?'+':'')+dy+' мм';
      }
    }
    function resetDrag(){needsRender=true;dropTarget.visible=false;snapMark.hidden=true;if(markPress){markPress=null;controls.enabled=true;}if(!drag)return;if(drag.kind==='module'){for(const group of moduleGroups.values())group.position.copy(group.userData.base);}else for(const mesh of drag.meshes){if(drag.kind==='divider')mesh.position.x-=drag.delta;else mesh.position.y-=drag.delta;}drag=null;badge.hidden=true;badge.classList.remove('invalid');controls.enabled=true;}
    function pointerUp(e:PointerEvent){
      // Shift+щелчок без движения — отметить корпус / снять отметку (мультивыбор, решение Макса 30.10)
      if(markPress&&!drag){const cp=markPress;markPress=null;controls.enabled=true;if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);current.current.onToggleModule?.(cp.mid);return;}
      if(!drag){if(current.current.mode==='orbit')return;return;}
      const d=drag;
      if(d.moved){
        if(d.kind==='module'){
          // группа (Shift+протяжка, отмеченные, вся композиция) — отказ целиком, если хоть один корпус упрётся или выйдет из помещения
          const s=current.current,grouped=s.moveAll||(dragGroup(d)?.includes(d.mid)&&(dragGroup(d)?.length??0)>1),problem=grouped?s.moveProblem(d.mid,d.candidate):undefined;
          if(problem)window.dispatchEvent(new CustomEvent('studio-note',{detail:{title:'Группа не перенесена',text:problem}}));
          else s.onMoveModule(d.mid,d.candidate);
        }
        else if(d.kind==='divider')current.current.onMoveDivider(d.mid,d.sid,d.delta);
        else if(d.kind==='dividerEnd')current.current.onMoveDividerEnd?.(d.mid,d.sid,d.pid.endsWith(':under')?'under':'over',d.delta);
        else{
          const hit=hitAt(e.clientX,e.clientY,true),toMid=hit?.object.userData.moduleId,toSid=hit?sectionFor(hit):undefined;
          if(hit&&toMid&&toSid&&(toMid!==d.mid||toSid!==d.sid)){
            const placed=current.current.arrangement.find(a=>a.id===toMid)!;
            current.current.onTransfer(d.mid,d.sid,d.pid,toMid,toSid,hit.point.y-(placed.y??0));
          }else current.current.onMovePart(d.mid,d.sid,d.pid,d.delta);
        }
      }else{if(d.kind==='part')current.current.onPartSelect(d.sid,d.pid,d.mid);else if(d.mid!==current.current.activeId)current.current.onModuleSelect(d.mid);else current.current.onPartSelect(d.sid,d.pid,d.mid);}
      resetDrag();if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
    }
    // Растяжение мышью за ручку «↔» (запрос Макса 20.10.2026): корпус (и сосед при стыке) масштабируется по ширине на экране,
    // живая плашка «ширина … · зазор …» у курсора, плашка ширины под модулем обновляется; отпустил — одно изменение проекта
    // (одна отмена Ctrl+Z). Камера при тяге не вращается.
    // Сдвиг курсора переводится в мм по экранной проекции оси ширины (px на мм у края модуля), без усиления: на «Спереди» 1 px = мм
    // по масштабу, в 3D — по видимой длине оси (критик 20.10, m8: раньше плоскость фасада под косым углом давала 10 px ≈ 250 мм).
    type Stretch={mid:string;side:'left'|'right';axis:THREE.Vector3;screen:{x:number;y:number;k:number};start:[number,number];raw:number;snap:boolean;moved:boolean;touched:string[];
      handle?:{label:typeof labels[number];base:THREE.Vector3};width?:{label:typeof labels[number];base:THREE.Vector3;text:string};segs?:Seg2[]};
    let stretch:Stretch|null=null;
    /** Экранная проекция точки сцены, px относительно холста. */
    function toScreen(v:THREE.Vector3){const q=v.clone().project(camera);return {x:(q.x+1)/2*target.clientWidth,y:(1-q.y)/2*target.clientHeight,z:q.z};}
    /** Ось ширины модуля на экране у его края: единичное направление и px на 1 мм (0 — ось почти вдоль взгляда). */
    function screenAxis(a:PlacedModule,side:'left'|'right'){
      const center=moduleCenter(current.current.arrangement.find(x=>x.id===current.current.activeId)??a),o=localToRoom(a,0,0),u1=localToRoom(a,1,0);
      const axis=new THREE.Vector3(u1.x-o.x,0,u1.z-o.z).normalize(),fp=localToRoom(a,side==='right'?a.module.width:0,a.module.depth);
      const p0=new THREE.Vector3(fp.x-center.x,(a.y??0)+a.module.height/2,fp.z-center.z),s0=toScreen(p0),s1=toScreen(p0.clone().addScaledVector(axis,100));
      const dx=(s1.x-s0.x)/100,dy=(s1.y-s0.y)/100,k=Math.hypot(dx,dy);
      return {axis,screen:{x:k?dx/k:0,y:k?dy/k:0,k}};
    }
    function startStretch(side:'left'|'right',e:PointerEvent){
      const s=current.current,a=s.arrangement.find(x=>x.id===s.activeId);if(!a||drag)return;
      const {axis,screen}=screenAxis(a,side);if(screen.k<.02)return; // ось ширины вдоль взгляда — тянуть нечем (ручки тогда скрыты)
      const hl=labels.find(l=>l.element.classList.contains('stretch-handle')&&l.element.dataset.side===side),wl=labels.find(l=>l.element.dataset.dim==='width');
      stretch={mid:a.id,side,axis,screen,start:[e.clientX,e.clientY],raw:0,snap:true,moved:false,touched:[],handle:hl?{label:hl,base:hl.position.clone()}:undefined,
        width:wl?{label:wl,base:wl.position.clone(),text:wl.element.textContent??''}:undefined};
      controls.enabled=false;target.classList.add('stretching');for(const o of modelGroup.children)if(o.userData.rowGap)o.visible=false; // зазор во время тяги — в живой плашке
      window.addEventListener('pointermove',stretchMove);window.addEventListener('pointerup',stretchUp);window.addEventListener('pointercancel',endStretch);
    }
    function previewStretch(st:Stretch,plan:Partial<StretchPlan>){
      for(const id of st.touched){const g=moduleGroups.get(id);if(g){g.scale.x=1;g.position.copy(g.userData.base);}}st.touched=[];
      const s=current.current,a=s.arrangement.find(x=>x.id===st.mid),g=moduleGroups.get(st.mid);if(!a||!g||plan.width===undefined)return;
      const dw=plan.width-a.module.width,out=st.side==='right'?1:-1;
      g.scale.x=plan.width/a.module.width;if(st.side==='left')g.position.addScaledVector(st.axis,-dw);st.touched.push(a.id);
      if(st.handle)st.handle.label.position.copy(st.handle.base).addScaledVector(st.axis,out*dw); // ручка едет за краем
      if(st.width){st.width.label.position.copy(st.width.base).addScaledVector(st.axis,out*dw/2);st.width.label.element.textContent=plan.width+' мм';} // плашка ширины под модулем
      const nb=plan.mode==='joint'?plan.neighbor:undefined,n=nb&&s.arrangement.find(x=>x.id===nb.id),ng=n&&moduleGroups.get(n.id);
      if(nb&&n&&ng){ng.scale.x=nb.width/n.module.width;if(st.side==='right')ng.position.addScaledVector(st.axis,n.module.width-nb.width);st.touched.push(n.id);}
    }
    function stretchMove(e:PtrLike){
      const st=stretch;if(!st)return;
      lastPtr={clientX:e.clientX,clientY:e.clientY};
      if(!st.moved&&Math.hypot(e.clientX-st.start[0],e.clientY-st.start[1])<3)return;
      st.moved=true;
      const du=((e.clientX-st.start[0])*st.screen.x+(e.clientY-st.start[1])*st.screen.y)/st.screen.k;
      const mode=snapMode(e,snapOn()),look=lookNow();let hit:PointHit|undefined,cur:V3|null=null;
      st.raw=Math.round((st.side==='right'?du:-du)*10)/10;st.snap=mode==='snap';
      const sa=current.current.arrangement.find(x=>x.id===st.mid);
      if(isPointMode(mode)&&look&&sa){
        // Alt/Ctrl: край ходит вдоль своей оси — до точки на линии / пересечения у курсора (ширина точно, без шага 10 мм)
        const {E,o}=edgeOf(sa,'width',st.side==='right'?'hi':'lo'),o2=toView(o,look),k=Math.hypot(o2.h,o2.v);cur=mouseRoom(e.clientX,e.clientY);
        if(cur&&k>.1){st.segs??=snapSegs([st.mid]);const r=snapAlong(mode,toView({x:E.x+o.x*st.raw,y:E.y,z:E.z+o.z*st.raw},look),{h:o2.h/k,v:o2.v/k},toView(cur,look),st.segs,pointTol());if(r.hit){hit=r.hit;st.raw=r1(st.raw+r.shift/k);}}
      }else if(st.snap){
        // край — к вспомогательной линии (Q) точно, без шага 10 мм
        const sg=viewGuides();
        if(sa&&sg.length){const {E,o}=edgeOf(sa,'width',st.side==='right'?'hi':'lo'),h=snapOut(E,o,st.raw,guidePlanes(sg),snapTol());if(h){st.raw=h.raw;st.snap=false;}}
      }
      markAt(hit,look,cur??{x:0,y:0,z:0});
      const plan=current.current.stretchPlan?.(st.mid,st.side,st.raw,st.snap)??{};
      previewStretch(st,plan);needsRender=true;
      badge.hidden=false;badge.classList.toggle('invalid',!!plan.problem);
      badge.textContent=plan.problem||modeText(mode,hit,look)+`ширина ${plan.width} мм · зазор ${plan.gap??0}`+(plan.filler?` · ${plan.filler} мм — фальш у стены`:'')+(plan.mode==='joint'&&plan.neighbor?` · сосед «${plan.neighbor.name}» ${plan.neighbor.width} мм`:'');
      // живая плашка — у курсора (над ним), а не внизу сцены (критик 20.10, m6)
      const r=target.getBoundingClientRect();
      Object.assign(badge.style,{left:Math.max(8,Math.min(e.clientX-r.left,target.clientWidth-8))+'px',top:Math.max(40,e.clientY-r.top-26)+'px',bottom:'auto',right:'auto',transform:'translate(-50%,-100%)'});
    }
    function endStretch(){
      window.removeEventListener('pointermove',stretchMove);window.removeEventListener('pointerup',stretchUp);window.removeEventListener('pointercancel',endStretch);
      const st=stretch;stretch=null;if(!st)return;snapMark.hidden=true;
      for(const id of st.touched){const g=moduleGroups.get(id);if(g){g.scale.x=1;g.position.copy(g.userData.base);}}
      if(st.handle)st.handle.label.position.copy(st.handle.base);
      if(st.width){st.width.label.position.copy(st.width.base);st.width.label.element.textContent=st.width.text;}
      target.classList.remove('stretching');for(const o of modelGroup.children)if(o.userData.rowGap)o.visible=true;
      badge.hidden=true;badge.classList.remove('invalid');badge.style.cssText='';controls.enabled=true;needsRender=true;
    }
    function stretchUp(){const st=stretch;endStretch();if(st?.moved)current.current.onStretch?.(st.mid,st.side,st.raw,st.snap);}
    // ── Вспомогательные линии и растяжение за угол (решение Макса 29.10.2026) ──────────────────────────────────────────────
    const so=()=>sceneOrigin??{x:0,z:0};
    const toScene=(p:V3)=>new THREE.Vector3(p.x-so().x,p.y,p.z-so().z);
    const fromScene=(v:THREE.Vector3):V3=>({x:v.x+so().x,y:v.y,z:v.z+so().z});
    /** Направление «на камеру» ортогонального вида (оси без дрожания 0,001 из fit), в 3D — null. */
    function lookNow():V3|null{
      if(current.current.view==='iso'||camera!==orthographic)return null;
      const d=camera.getWorldDirection(new THREE.Vector3()).negate();
      for(const k of ['x','y','z'] as const)if(Math.abs(d[k])<0.01)d[k]=0;
      d.normalize();return {x:d.x,y:d.y,z:d.z};
    }
    const viewGuides=()=>current.current.presentation?[]:guidesInView(current.current.guides,lookNow());
    /** Допуск привязки, мм: 10 px экрана, не больше 30 мм (как привязка ручки «↔», STRETCH_SNAP). */
    function snapTol(){const mm=camera===orthographic?(orthographic.top-orthographic.bottom)/orthographic.zoom/Math.max(1,target.clientHeight):3;return Math.min(30,Math.max(2,10*mm));}
    /** typed — размеры, набранные с клавиатуры во время тяги («600;2400», решение Макса 29.10.2026); mouse — последнее положение курсора. */
    type CornerDrag={mid:string;dims:[Dim,Dim];ends:[End,End];out:THREE.Vector3[];plane:THREE.Plane;start:THREE.Vector3;origin:[number,number];moved:boolean;pull?:CornerPull;touched:string[];texts:{el:HTMLElement;text:string}[];handle?:{label:typeof labels[number];base:THREE.Vector3};typed:string;mouse:[number,number];mode:SnapMode;segs?:Seg2[]};
    let corner:CornerDrag|null=null;
    /** Угол корпуса a в координатах сцены: края по dims/ends; ось вне вида — видимая грань (фасад спереди, крыша сверху, бок сбоку). */
    function cornerAt(a:PlacedModule,dims:[Dim,Dim],ends:[End,End]){
      const m=a.module,y0=a.y??0,end=(d:Dim)=>dims[0]===d?ends[0]:dims[1]===d?ends[1]:undefined;
      const u=end('width')?(end('width')==='hi'?m.width:0):current.current.view==='left'?0:m.width;
      const v=end('depth')?(end('depth')==='hi'?m.depth:0):m.depth;
      const y=end('height')?(end('height')==='hi'?y0+m.height:y0):y0+m.height;
      const q=localToRoom(a,u,v);return new THREE.Vector3(q.x-so().x,y,q.z-so().z);
    }
    function startCorner(dims:[Dim,Dim],ends:[End,End],pos:THREE.Vector3,e:PointerEvent){
      const s=current.current,a=s.arrangement.find(x=>x.id===s.activeId);if(!a||drag||stretch||corner||tool)return;
      const out=dims.map((d,i)=>{const v=axisOf(a,d),k=ends[i]==='hi'?1:-1;return new THREE.Vector3(v.x*k,v.y*k,v.z*k);});
      const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),pos);
      cast(e.clientX,e.clientY);const start=new THREE.Vector3();if(!ray.ray.intersectPlane(plane,start))return;
      const texts=labels.filter(l=>l.element.dataset.dim&&dims.includes(l.element.dataset.dim as Dim)).map(l=>({el:l.element as HTMLElement,text:l.element.textContent??''}));
      const hl=labels.find(l=>l.element.classList.contains('corner-handle')&&l.element.dataset.corner===ends.join('-'));
      corner={mid:a.id,dims,ends,out,plane,start,origin:[e.clientX,e.clientY],moved:false,touched:[],texts,handle:hl?{label:hl,base:hl.position.clone()}:undefined,typed:'',mouse:[e.clientX,e.clientY],mode:snapMode(e,snapOn())};
      hl?.element.classList.add('active');
      controls.enabled=false;target.classList.add('stretching','corner-dragging');for(const o of modelGroup.children)if(o.userData.rowGap)o.visible=false;
      window.addEventListener('pointermove',cornerMove);window.addEventListener('pointerup',cornerUp);window.addEventListener('pointercancel',endCorner);
    }
    function resetCornerPreview(c:CornerDrag){for(const id of c.touched){const g=moduleGroups.get(id);if(g){g.scale.set(1,1,1);g.position.copy(g.userData.base);}}c.touched=[];}
    /** Показ итога на сцене: корпуса, что меняются (сам и сосед при стыке), масштабируются и встают на новое место. */
    function previewCorner(c:CornerDrag,plan:CornerPlan){
      resetCornerPreview(c);
      for(const n of plan.preview??[]){
        const cur=current.current.arrangement.find(x=>x.id===n.id),g=moduleGroups.get(n.id);if(!cur||!g)continue;
        const same=Math.abs(cur.x-n.x)<.05&&Math.abs(cur.z-n.z)<.05&&Math.abs((cur.y??0)-(n.y??0))<.05&&cur.module.width===n.module.width&&cur.module.height===n.module.height&&cur.module.depth===n.module.depth;
        if(same)continue;
        const o=localToRoom(n,0,0);g.scale.set(n.module.width/cur.module.width,n.module.height/cur.module.height,n.module.depth/cur.module.depth);g.position.set(o.x-so().x,n.y??0,o.z-so().z);c.touched.push(n.id);
      }
      for(const t of c.texts){const d=t.el.dataset.dim as Dim;t.el.textContent=plan[d]+' мм';}
      const me=plan.preview?.find(x=>x.id===c.mid);if(c.handle)c.handle.label.position.copy(me?cornerAt(me,c.dims,c.ends):c.handle.base); // ручка едет за углом
    }
    function cornerBadge(c:CornerDrag,text:string,invalid:boolean){
      badge.hidden=false;badge.classList.toggle('invalid',invalid);badge.textContent=text;
      const r=target.getBoundingClientRect(),[x,y]=c.mouse;
      Object.assign(badge.style,{left:Math.max(8,Math.min(x-r.left,target.clientWidth-8))+'px',top:Math.max(40,y-r.top-26)+'px',bottom:'auto',right:'auto',transform:'translate(-50%,-100%)'});
    }
    function cornerMove(e:PointerEvent){
      const c=corner;if(!c)return;
      c.mouse=[e.clientX,e.clientY];c.mode=snapMode(e,snapOn());lastPtr={clientX:e.clientX,clientY:e.clientY};
      if(c.typed){cornerTypedShow(c);return;} // набран размер — мышь размер не меняет
      if(!c.moved&&Math.hypot(e.clientX-c.origin[0],e.clientY-c.origin[1])<3)return;
      c.moved=true;cornerByMouse(c);
    }
    function cornerByMouse(c:CornerDrag){
      cast(c.mouse[0],c.mouse[1]);const P=new THREE.Vector3();if(!ray.ray.intersectPlane(c.plane,P))return;P.sub(c.start);
      const pull:CornerPull={mid:c.mid,snap:c.mode==='snap',tol:snapTol(),guides:viewGuides()};
      const look=lookNow(),a=current.current.arrangement.find(x=>x.id===c.mid);let hit:PointHit|undefined;
      if(isPointMode(c.mode)&&look&&a){
        // Alt/Ctrl: сам угол — на точку линии / в пересечение (размеры точно, без шага 10 мм)
        c.segs??=snapSegs([c.mid]);
        const r=snapDelta(c.mode,toView(fromScene(cornerAt(a,c.dims,c.ends)),look),toView({x:P.x,y:P.y,z:P.z},look),c.segs,pointTol());hit=r.hit;
        const dv=viewDelta(r.delta.h,r.delta.v,look);P.set(dv.x,dv.y,dv.z);
      }
      markAt(hit,look,fromScene(c.start));
      c.dims.forEach((d,i)=>{pull[d]={end:c.ends[i],raw:Math.round(P.dot(c.out[i])*10)/10};});
      c.pull=pull;const plan=current.current.cornerPlan?.(pull);if(!plan)return;
      previewCorner(c,plan);needsRender=true;
      cornerBadge(c,plan.problem||modeText(c.mode,hit,look)+c.dims.map(d=>DIM_WORD[d]+' '+plan[d]).join(' × ')+' мм'+(plan.snapped.length?' · по: '+plan.snapped.join(', '):'')+' · цифры «'+c.dims.map(d=>DIM_WORD[d]).join(';')+'» + Enter — точно',!!plan.problem);
    }
    /** Набранный размер: показ итога (корпус на сцене и плашка), противоположный угол на месте. */
    function cornerTypedShow(c:CornerDrag){
      const a=current.current.arrangement.find(x=>x.id===c.mid);if(!a)return;snapMark.hidden=true;
      const head='Размер ('+c.dims.map(d=>DIM_WORD[d]).join(';')+'): '+c.typed+'▏',t=typedCornerPull(a,c.dims,c.ends,c.typed);
      if(t.problem){resetCornerPreview(c);cornerBadge(c,head+' · '+t.problem,true);needsRender=true;return;}
      const plan=t.pull&&current.current.cornerPlan?.(t.pull);
      if(!plan){resetCornerPreview(c);for(const x of c.texts)x.el.textContent=x.text;cornerBadge(c,head+' · Enter — применить, Esc — отмена',false);needsRender=true;return;}
      previewCorner(c,plan);needsRender=true;
      cornerBadge(c,head+' · '+(plan.problem||c.dims.map(d=>DIM_WORD[d]+' '+plan[d]).join(' × ')+' мм · Enter — применить, Esc — отмена'),!!plan.problem);
    }
    /** Цифры, «;», запятая/точка, Backspace, Enter, Esc во время тяги за угол. true — клавиша съедена. */
    function cornerKey(c:CornerDrag,e:KeyboardEvent){
      const k=e.key,part=c.typed.split(';').at(-1)??'';
      if(k==='Escape'){endCorner();return true;}
      if(k==='Enter'||k==='NumpadEnter'){applyTyped(c);return true;}
      if(k==='Backspace')c.typed=c.typed.slice(0,-1);
      else if(/^[0-9]$/.test(k)){if(c.typed.length<15)c.typed+=k;}
      else if(k===';'||e.code==='Semicolon'){if(!c.typed.includes(';'))c.typed+=';';} // русская раскладка: «ж» — та же клавиша
      else if(k===','||k==='.'||e.code==='Comma'||e.code==='Period'||e.code==='NumpadDecimal'){if(!/[.]/.test(part))c.typed+='.';}
      else return false;
      if(c.typed)cornerTypedShow(c);else if(c.moved)cornerByMouse(c);else{resetCornerPreview(c);for(const x of c.texts)x.el.textContent=x.text;badge.hidden=true;needsRender=true;}
      return true;
    }
    /** Enter (или отпустили кнопку) с набранным: применить одной отменой; отказ — причина в плашке (≤ 0) или ошибка панели. */
    function applyTyped(c:CornerDrag){
      const a=current.current.arrangement.find(x=>x.id===c.mid);if(!a){endCorner();return;}
      const t=typedCornerPull(a,c.dims,c.ends,c.typed);
      if(t.problem){cornerTypedShow(c);return;}
      endCorner();if(t.pull)current.current.onCorner?.(t.pull);
    }
    function endCorner(){
      window.removeEventListener('pointermove',cornerMove);window.removeEventListener('pointerup',cornerUp);window.removeEventListener('pointercancel',endCorner);
      const c=corner;corner=null;if(!c)return;snapMark.hidden=true;
      resetCornerPreview(c);for(const t of c.texts)t.el.textContent=t.text;
      if(c.handle){c.handle.label.position.copy(c.handle.base);c.handle.label.element.classList.remove('active');}
      target.classList.remove('stretching','corner-dragging');for(const o of modelGroup.children)if(o.userData.rowGap)o.visible=true;
      badge.hidden=true;badge.classList.remove('invalid');badge.style.cssText='';controls.enabled=true;needsRender=true;
    }
    // отпустили кнопку с набранным размером — применяется набранное (как Enter); иначе — по мыши
    function cornerUp(){
      const c=corner;
      if(c?.typed&&parseCornerTyped(c.typed)){
        applyTyped(c);
        if(corner){const t=badge.textContent??'';endCorner();window.dispatchEvent(new CustomEvent('studio-note',{detail:{title:'Размер не применён',text:t.replace(/^.*?· /,'')}}));}
        return;
      }
      endCorner();if(c?.moved&&c.pull)current.current.onCorner?.(c.pull);
    }
    // Линии: пунктир в своём виде; выбранная — оранжевая. Группа внутри modelGroup (на снимок КП не попадает — captureGuide).
    let guideGroup:THREE.Group|null=null,selectedGuide:string|null=null;
    // общие материалы (геометрия линий — своя; материалы не уничтожаются с группой: группа живёт внутри modelGroup)
    const guideMat=new THREE.LineDashedMaterial({color:0x2f6fdb,dashSize:40,gapSize:24,depthTest:false,depthWrite:false}),guideSelMat=new THREE.LineDashedMaterial({color:0xe8590c,dashSize:60,gapSize:24,depthTest:false,depthWrite:false});guideMat.userData.keep=guideSelMat.userData.keep=true;
    const centerRoom=()=>fromScene(controls.target);
    function drawGuides(){
      if(guideGroup){guideGroup.parent?.remove(guideGroup);guideGroup.traverse(o=>{if(o instanceof THREE.Line)o.geometry.dispose();});}
      guideGroup=new THREE.Group();guideGroup.userData.captureGuide=true;modelGroup.add(guideGroup);needsRender=true;
      const look=lookNow(),list=viewGuides();setGuideCount(list.length);
      if(selectedGuide&&!list.some(g=>g.id===selectedGuide))selectedGuide=null;
      if(!look)return;
      for(const g of list){
        const [a,b]=guideSegment({n:v3(g.n),at:g.at},look,centerRoom()),sel=g.id===selectedGuide;
        const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints([toScene(a),toScene(b)]),sel?guideSelMat:guideMat);
        l.computeLineDistances();l.renderOrder=110;l.userData.guideId=g.id;guideGroup.add(l);
      }
    }
    // Инструмент Q: pick — навести и щёлкнуть линию; place — линия идёт за мышью, цифры — расстояние, Enter/щелчок — поставить.
    const toolMat=new THREE.LineBasicMaterial({color:0xe8590c,depthTest:false,transparent:true}),ghostMat=new THREE.LineDashedMaterial({color:0xe8590c,dashSize:30,gapSize:18,depthTest:false,transparent:true});
    const hoverLine=new THREE.Line(new THREE.BufferGeometry(),toolMat),ghostLine=new THREE.Line(new THREE.BufferGeometry(),ghostMat);
    for(const l of [hoverLine,ghostLine]){l.renderOrder=120;l.visible=false;l.frustumCulled=false;scene.add(l);}
    type Tool={phase:'pick';lines:GuideLine[];hover?:GuideLine}|{phase:'place';look:V3;base:GuideLine;typed:string;at?:number;dist?:number;segs?:Seg2[]};
    let tool:Tool|null=null,lastMouse:[number,number]|null=null;
    function setSegment(l:THREE.Line,a:V3,b:V3,dashed=false){l.geometry.dispose();l.geometry=new THREE.BufferGeometry().setFromPoints([toScene(a),toScene(b)]);if(dashed)l.computeLineDistances();l.visible=true;needsRender=true;}
    function toolBadge(text:string,x?:number,y?:number){
      badge.hidden=false;badge.classList.remove('invalid');badge.textContent=text;
      const r=target.getBoundingClientRect(),[cx,cy]=x!==undefined&&y!==undefined?[x,y]:lastMouse??[r.left+r.width/2,r.top+80];
      Object.assign(badge.style,{left:Math.max(8,Math.min(cx-r.left,target.clientWidth-8))+'px',top:Math.max(40,cy-r.top-22)+'px',bottom:'auto',right:'auto',transform:'translate(-50%,-100%)'});
    }
    function segDist(mx:number,my:number,a:V3,b:V3){
      const A=toScreen(toScene(a)),B=toScreen(toScene(b)),dx=B.x-A.x,dy=B.y-A.y,L=dx*dx+dy*dy;
      const t=L?Math.max(0,Math.min(1,((mx-A.x)*dx+(my-A.y)*dy)/L)):0;return Math.hypot(mx-A.x-t*dx,my-A.y-t*dy);
    }
    function mouseRoom(clientX:number,clientY:number):V3|null{cast(clientX,clientY);const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),controls.target),q=new THREE.Vector3();return ray.ray.intersectPlane(plane,q)?fromScene(q):null;}
    function startTool(){
      const look=lookNow(),s=current.current;if(!look||!s.onGuides)return;
      endCorner();endStretch();resetDrag();selectGuide(null);
      tool={phase:'pick',lines:candidateLines(s.arrangement.filter(a=>!s.hiddenModuleIds?.includes(a.id)&&!s.hideFurniture),look,s.activeId,s.guideRoom??s.room,s.guides)};
      target.classList.add('guide-tool');
      if(lastMouse)toolMove(lastMouse[0],lastMouse[1]);else toolBadge('Q: наведите на линию (край корпуса, деталь, стена, пол) и щёлкните · Esc — отмена');
    }
    function cancelTool(){if(!tool)return;tool=null;snapMark.hidden=true;hoverLine.visible=false;ghostLine.visible=false;badge.hidden=true;badge.style.cssText='';target.classList.remove('guide-tool');needsRender=true;}
    function toolMove(clientX:number,clientY:number){
      const t=tool;if(!t)return;
      const r=target.getBoundingClientRect(),mx=clientX-r.left,my=clientY-r.top;
      if(t.phase==='pick'){
        snapMark.hidden=true;let best:GuideLine|undefined,bd=10;for(const l of t.lines){const d=segDist(mx,my,l.a,l.b);if(d<bd-0.01){bd=d;best=l;}}
        t.hover=best;if(best)setSegment(hoverLine,best.a,best.b);else{hoverLine.visible=false;needsRender=true;}
        toolBadge(best?'Q: '+best.what+' — щёлкните, чтобы строить от неё':'Q: наведите на линию (край корпуса, деталь, стена, пол) и щёлкните · Esc — отмена',clientX,clientY);
        return;
      }
      let m=mouseRoom(clientX,clientY);if(!m)return;
      // Alt/Ctrl: линия проходит через точку на линии / пересечение у курсора (без набранного числа)
      let hit:PointHit|undefined;
      if(isPointMode(ptrMode)&&!t.typed){t.segs??=snapSegs([]);hit=pointSnap(ptrMode,toView(m,t.look),ptrMode==='line'?acrossSegments(t.segs,toView(t.base.n,t.look)):t.segs,pointTol());if(hit)m=fromView(hit.p,t.look,m);}
      markAt(hit,t.look,m);
      const pl=placeGuide(t.base,m,parseTyped(t.typed),!!hit);t.at=pl.at;t.dist=pl.dist;
      const [a,b]=guideSegment({n:t.base.n,at:pl.at},t.look,centerRoom());setSegment(ghostLine,a,b,true);
      toolBadge((isPointMode(ptrMode)&&!t.typed?hitText(hit,ptrMode)+' · ':'')+(t.typed?'Размер: '+t.typed+'▏':'Расстояние '+pl.dist)+' мм · Enter — поставить · Esc — отмена',clientX,clientY);
    }
    function placeNow(){
      const t=tool,s=current.current;if(!t||t.phase!=='place'||t.at===undefined||!s.onGuides)return;
      const list=s.guides??[],dup=list.some(g=>Math.abs(g.at-t.at!)<.05&&Math.abs(v3(g.n).x-t.base.n.x)+Math.abs(v3(g.n).y-t.base.n.y)+Math.abs(v3(g.n).z-t.base.n.z)<.01&&guidesInView([g],t.look).length);
      const at=t.at,look=t.look,n=t.base.n;cancelTool();
      if(!dup)s.onGuides([...list,makeGuide('g'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),look,n,at)]);
    }
    function selectGuide(id:string|null){if(selectedGuide===id)return;selectedGuide=id;drawGuides();if(!id&&!tool&&!drag&&!stretch&&!corner){badge.hidden=true;badge.style.cssText='';}}
    function guideAt(clientX:number,clientY:number){
      const look=lookNow();if(!look)return null;const r=target.getBoundingClientRect(),mx=clientX-r.left,my=clientY-r.top;
      let best:string|null=null,bd=6;for(const g of viewGuides()){const [a,b]=guideSegment({n:v3(g.n),at:g.at},look,centerRoom()),d=segDist(mx,my,a,b);if(d<bd){bd=d;best=g.id;}}
      return best;
    }
    function removeGuides(ids:string[]){const s=current.current;if(!s.onGuides||!ids.length)return;selectGuide(null);s.onGuides((s.guides??[]).filter(g=>!ids.includes(g.id)));}
    /** Щелчки инструмента Q и выбор линии — до обработчиков сцены (фаза захвата на контейнере). */
    function toolDown(e:PointerEvent){
      if(e.button!==0||current.current.presentation)return;
      const t=tool;
      if(t){
        e.preventDefault();e.stopPropagation();ptrMode=snapMode(e,snapOn());toolMove(e.clientX,e.clientY);
        if(t.phase==='pick'){const h=t.hover,look=lookNow();if(!h||!look)return;tool={phase:'place',look,base:h,typed:''};toolMove(e.clientX,e.clientY);}
        else placeNow();
        return;
      }
      if(e.target!==renderer.domElement)return;
      const g=guideAt(e.clientX,e.clientY);
      if(g){e.preventDefault();e.stopPropagation();selectGuide(g);toolBadge('Вспомогательная линия · Delete — убрать · Esc — снять выбор',e.clientX,e.clientY);}
      else if(selectedGuide)selectGuide(null);
    }
    function trackMouse(e:PointerEvent){lastMouse=[e.clientX,e.clientY];ptrMode=snapMode(e,snapOn());if(tool)toolMove(e.clientX,e.clientY);}
    /** Нажали/отпустили Alt, Ctrl, Shift без движения мыши — привязка пересчитывается сразу (тяга, линия Q). */
    function modsKey(e:KeyboardEvent){
      if(!['Alt','Control','Shift','Meta'].includes(e.key)||current.current.presentation)return;
      const m={altKey:e.altKey,ctrlKey:e.ctrlKey,metaKey:e.metaKey,shiftKey:e.shiftKey};ptrMode=snapMode(m,snapOn());
      if(corner){if(corner.moved&&!corner.typed){corner.mode=ptrMode;cornerByMouse(corner);}return;}
      if(stretch){if(stretch.moved&&lastPtr)stretchMove({...lastPtr,...m});return;}
      if(drag){if(drag.moved&&drag.kind==='module'&&lastPtr)pointerMove({...lastPtr,...m});return;}
      if(tool?.phase==='place'&&lastMouse)toolMove(lastMouse[0],lastMouse[1]);
    }
    /** Q, цифры, Enter, Esc, Delete для линий — раньше App (фаза захвата на window; App пропускает defaultPrevented). */
    function guideKey(e:KeyboardEvent){
      const s=current.current;if(s.presentation||editsText(e.target))return;
      // открыто окно (вопрос «Удалить?», фурнитура, подсветка…) — клавиши сцены не действуют (критик 29.10: Q под вопросом начинал линию)
      if(document.querySelector('[aria-modal="true"]'))return;
      // Ctrl+Z/Ctrl+Y посреди тяги (Ctrl зажат ради привязки) — не отменять (критик 29.10 п.6)
      if(historyGuard(e,!!(drag||stretch||corner||markPress))){e.preventDefault();e.stopPropagation();return;}
      // тяга за угол: набор размеров «600;2400», Enter, Esc, Backspace — раньше App и Q
      if(corner){if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&cornerKey(corner,e)){e.preventDefault();e.stopPropagation();}return;}
      if(e.code==='KeyQ'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
        if(!lookNow()||!s.onGuides)return;
        e.preventDefault();if(e.repeat)return;
        if(tool)cancelTool();else startTool();return;
      }
      const t=tool;
      if(t){
        if(e.key==='Escape'){e.preventDefault();cancelTool();return;}
        if(t.phase==='place'){
          if(/^[0-9]$/.test(e.key)||((e.key===','||e.key==='.')&&!/[.,]/.test(t.typed))){e.preventDefault();if(t.typed.length<7)t.typed+=e.key;if(lastMouse)toolMove(lastMouse[0],lastMouse[1]);return;}
          if(e.key==='Backspace'){e.preventDefault();t.typed=t.typed.slice(0,-1);if(lastMouse)toolMove(lastMouse[0],lastMouse[1]);return;}
          if(e.key==='Enter'||e.key==='NumpadEnter'){e.preventDefault();if(lastMouse)toolMove(lastMouse[0],lastMouse[1]);placeNow();return;}
        }
        if(e.key==='Delete'||e.key==='Enter')e.preventDefault();
        return;
      }
      if(selectedGuide){
        if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeGuides([selectedGuide]);return;}
        if(e.key==='Escape'){e.preventDefault();selectGuide(null);}
      }
    }
    function clearGuides(){removeGuides(viewGuides().map(g=>g.id));}
    target.addEventListener('pointerdown',toolDown,true);window.addEventListener('pointermove',trackMouse);window.addEventListener('keydown',guideKey,true);
    // Alt во время тяги (корпуса или края) не уводит фокус в меню браузера Chrome на Windows (критик 20.10, m11)
    // (с 29.10 Alt — привязка к линии: то же и для линии Q)
    // keyup Alt — всегда (кроме полей ввода): Alt отпускают и после того, как отпустили мышь (критик 29.10, блокер)
    function altGuard(e:KeyboardEvent){if(e.key==='Alt'&&(drag||stretch||corner||tool||(e.type==='keyup'&&altKeyupGuard(e))))e.preventDefault();}
    window.addEventListener('keydown',modsKey);window.addEventListener('keyup',modsKey);
    // Ctrl+колесо во время тяги и линии Q не масштабирует страницу браузера (критик 29.10 п.5)
    function ctrlWheel(e:WheelEvent){if(wheelGuard(e,!!(drag||stretch||corner||markPress||tool)))e.preventDefault();}
    window.addEventListener('wheel',ctrlWheel,{passive:false,capture:true});
    function dragOver(e:DragEvent){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';badge.hidden=false;const destination=indicateTarget(hitAt(e.clientX,e.clientY,true));badge.textContent=destination?'Отпустите: '+destination:'Перетащите внутрь корпуса';}
    function drop(e:DragEvent){needsRender=true;e.preventDefault();badge.hidden=true;dropTarget.visible=false;const kind=e.dataTransfer?.getData('application/x-furniture');if(!kind)return;const hit=hitAt(e.clientX,e.clientY,true);if(!hit)return;const placed=current.current.arrangement.find(a=>a.id===hit.object.userData.moduleId)!;current.current.onDropItem(kind,placed.id,sectionFor(hit),hit.point.y-(placed.y??0));}
    // Esc отменяет тягу; событие помечается, чтобы App не снимал выделение тем же нажатием (п.19 волны 22.10)
    function key(e:KeyboardEvent){if(e.key==='Escape'){if(drag||stretch||corner)e.preventDefault();resetDrag();endStretch();endCorner();}altGuard(e);}
    window.addEventListener('keyup',altGuard);
    // Правая кнопка: короткий клик — круговое меню; протяжка — движение камеры (меню не открываем).
    let rightDown:{x:number;y:number}|null=null;
    function rightPointer(e:PointerEvent){if(e.button===2)rightDown={x:e.clientX,y:e.clientY};}
    /** Промах мимо деталей: рамка корпуса на экране (8 углов габарита) и точка клика на плоскости фасада в координатах корпуса. */
    function missTarget(a:PlacedModule,clientX:number,clientY:number,fromLabel=false){
      const s=current.current,focus=s.arrangement.find(x=>x.id===s.activeId)??a,center=moduleCenter(focus),m=a.module,y0=a.y??0;
      const r=renderer.domElement.getBoundingClientRect();
      const world=(u:number,v:number,y:number)=>{const p=localToRoom(a,u,v);return new THREE.Vector3(p.x-center.x,y,p.z-center.z);};
      const corners=[0,m.width].flatMap(u=>[0,m.depth].flatMap(v=>[y0,y0+m.height].map(y=>{const q=world(u,v,y).project(camera);return q.z>1?null:{x:r.left+(q.x+1)/2*r.width,y:r.top+(1-q.y)/2*r.height};})));
      cast(clientX,clientY);
      const plane=new THREE.Plane().setFromCoplanarPoints(world(0,m.depth,y0),world(m.width,m.depth,y0),world(0,m.depth,y0+1000)),hitPoint=new THREE.Vector3();
      const p=ray.ray.intersectPlane(plane,hitPoint);
      const local=p?{x:roomToLocal(a,p.x+center.x,p.z+center.z).x,y:p.y-y0}:null;
      return missMenuTarget(m,screenRect(corners),{x:clientX,y:clientY},local,fromLabel);
    }
    function contextMenu(e:MouseEvent){
      e.preventDefault();if(current.current.presentation)return;
      if(rightDown&&Math.hypot(e.clientX-rightDown.x,e.clientY-rightDown.y)>6){rightDown=null;return;}
      rightDown=null;
      cast(e.clientX,e.clientY);
      const env=ray.intersectObjects(modelGroup.children,true).find(h=>h.object instanceof THREE.Mesh&&(h.object.userData.openingId||h.object.userData.fixtureId||h.object.userData.obstacleId||h.object.userData.moduleId));
      if(env){const d=env.object.userData;if(d.openingId){current.current.onEnvironmentContext?.('opening',d.openingId);return;}if(d.fixtureId){current.current.onEnvironmentContext?.('fixture',d.fixtureId);return;}if(d.obstacleId){current.current.onEnvironmentContext?.('obstacle',d.obstacleId);return;}}
      const hit=hitAt(e.clientX,e.clientY,true);
      // Промах мимо деталей (щель, край, пустой проём) — меню выбранного корпуса, а не тишина (ручной тест 19.10, находки 10–11).
      // Замечание критика 20.10 (п.2): только внутри экранной рамки выбранного корпуса; секция и высота — по точке клика.
      if(!hit){const s=current.current,act=s.arrangement.find(x=>x.id===s.activeId);if(!act||s.hideFurniture)return;const t=missTarget(act,e.clientX,e.clientY,!!(e as MouseEvent&{fromLabel?:boolean}).fromLabel);if(t)s.onContextMenu?.(act.id,t.sid,e.clientX,e.clientY,{localY:t.localY});return;}
      const a=current.current.arrangement.find(a=>a.id===hit.object.userData.moduleId);if(!a)return;
      current.current.onContextMenu?.(a.id,sectionFor(hit),e.clientX,e.clientY,{pid:hit.object.userData.partId as string|undefined,role:hit.object.userData.role as string|undefined,localY:hit.point.y-(a.y??0)});
    }
    // Средняя кнопка (колёсико), правка Макса 29.10: щелчок без протяжки по фасаду — открыть/закрыть эту створку или ящик плавно,
    // по другой детали корпуса — весь корпус (створки и ящики, что открываются вместе с ним). Протяжка — как раньше поворот камеры,
    // прокрутка колеса — масштаб.
    let middleDown:{x:number;y:number;t:number}|null=null;
    function middlePointer(e:PointerEvent){if(e.button===1)middleDown={x:e.clientX,y:e.clientY,t:performance.now()};}
    function middleUp(e:PointerEvent){
      if(e.button!==1||!middleDown)return;const d=middleDown;middleDown=null;
      if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>5||performance.now()-d.t>700)return;
      const hit=hitAt(e.clientX,e.clientY,true);if(!hit)return;
      toggleOpen(String(hit.object.userData.moduleId),hit.object.userData.partId as string|undefined);
    }
    /** Открыть/закрыть: створку, ящик или полотно купе (pid) — плавно; деталь корпуса — всё, что открывается вместе с корпусом. */
    function toggleOpen(mid:string,pid:string|undefined){
      const key=openToggleKey(pid),one=key==='*'?undefined:anims.get(mid+'|'+key);
      if(one){const open=one.target!==1;openOverride.set(mid+'|'+key,open);one.target=open?1:0;needsRender=true;return;}
      const own=[...anims].filter(([k,a])=>k.startsWith(mid+'|')&&a.wide);if(!own.length)return;
      const open=!own.some(([,a])=>a.target===1);openOverride.set(mid+'|*',open);
      for(const [k,a] of own){if(k!==mid+'|*')openOverride.delete(k);a.target=open?1:0;}needsRender=true;
    }
    // сценарий мышью scripts/edit-2910-scenario.ts (только чтение): доли открытия створок и ящиков
    (window as unknown as {__openState?:()=>Record<string,{t:number;target:number}>}).__openState=()=>Object.fromEntries([...anims].map(([k,a])=>[k,{t:Math.round(a.t*1000)/1000,target:a.target}]));
    renderer.domElement.addEventListener('pointerdown',middlePointer,true);
    renderer.domElement.addEventListener('pointerup',middleUp,true);
    renderer.domElement.addEventListener('pointerdown',rightPointer,true);
    renderer.domElement.addEventListener('contextmenu',contextMenu);
    renderer.domElement.addEventListener('pointerdown',pointerDown);
    renderer.domElement.addEventListener('pointermove',pointerMove);
    renderer.domElement.addEventListener('pointerup',pointerUp);
    renderer.domElement.addEventListener('pointercancel',resetDrag);
    function dragLeave(e:DragEvent){if(e.relatedTarget instanceof Node&&target.contains(e.relatedTarget))return;badge.hidden=true;dropTarget.visible=false;needsRender=true;}
    target.addEventListener('dragover',dragOver);target.addEventListener('drop',drop);target.addEventListener('dragleave',dragLeave);window.addEventListener('keydown',key);
    const loss = (e: Event) => {
      e.preventDefault();
      setError(
        "3D-представление остановлено. Сохраните модуль в файл и обновите страницу.",
      );
    };
    renderer.domElement.addEventListener("webglcontextlost", loss);
    rebuild();
    fit();
    api.current = { rebuild, fit, refresh: () => { needsRender = true; }, guides: drawGuides, clearGuides };
    current.current.captureReady((opts) => {
      if(pendingTextures>0)throw Error("Материалы ещё загружаются. Подождите несколько секунд и повторите сохранение изображения.");
      const size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio(),background=scene.background,gridVisible=grid.visible;
      const guides:THREE.Object3D[]=[];modelGroup.traverse(o=>{if(o.userData.captureGuide||o.parent===modelGroup&&(o instanceof THREE.Line||o instanceof THREE.LineSegments))guides.push(o);});const visibility=guides.map(o=>o.visible);
      const aspect=size.x/size.y,width=aspect>=1?2560:Math.round(2560*aspect),height=aspect>=1?Math.round(2560/aspect):2560;
      // КП (opts.frame): мебель во весь кадр, а не вся комната — тот же ракурс, камера ближе; после снимка камера на месте
      const saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:controls.target.clone(),zoom:camera.zoom,frustum:camera===orthographic?[orthographic.left,orthographic.right,orthographic.top,orthographic.bottom]:null};
      // КП (релиз 22.10, m7): изделие как его покупают — створки закрыты, ящики задвинуты, корпус и фасады непрозрачные; на снимке
      // только изделия (корпуса и техника) — стены-призраки, проёмы, препятствия и размеры помещения не попадают; после снимка всё как было
      const restore:(()=>void)[]=[];
      try{
        guides.forEach(o=>o.visible=false);grid.visible=false;scene.background=new THREE.Color(0xf1f0eb);
        if(opts?.frame){
          for(const mv of anims.values())if(mv.t>0){const t=mv.t;mv.set(0);restore.push(()=>mv.set(t));}
          for(const o of modelGroup.children)if(o.visible&&!products.has(o)){o.visible=false;restore.push(()=>{o.visible=true;});}
          modelGroup.traverse(o=>{if(!(o instanceof THREE.Mesh))return;for(const q of (Array.isArray(o.material)?o.material:[o.material]) as THREE.Material[]){
            const st=q.userData.seeThrough;if(typeof st!=='number'||q.opacity!==st||!q.transparent)continue;
            const depthWrite=q.depthWrite;q.transparent=false;q.opacity=1;q.depthWrite=true;restore.push(()=>{q.transparent=true;q.opacity=st;q.depthWrite=depthWrite;});
          }});
          modelGroup.updateWorldMatrix(true,true);const box=new THREE.Box3();
          for(const o of products)if(o.visible)o.traverseVisible(c=>{if(c instanceof THREE.Mesh&&!c.userData.captureGuide)box.expandByObject(c,false);});
          if(!box.isEmpty()){
            const center=box.getCenter(new THREE.Vector3()),dims=box.getSize(new THREE.Vector3()).addScalar(200);
            const dir=camera.position.clone().sub(controls.target).normalize();
            // ракурс как на экране: поворот камеры не меняется (без lookAt — вид сверху не вырождается), камера только сдвигается
            // вдоль взгляда к центру изделий; ближняя плоскость (5 мм) и дальняя (250 м) с запасом охватывают кадр
            if(camera===orthographic){const h=frameHeight({x:dims.x,y:dims.y,z:dims.z},dir,aspect,1.05);orthographic.left=-h*aspect/2;orthographic.right=h*aspect/2;orthographic.top=h/2;orthographic.bottom=-h/2;orthographic.zoom=1;camera.position.copy(center).addScaledVector(dir,Math.max(dims.x,dims.y,dims.z)*2);}
            else{const dist=frameDistance({x:dims.x,y:dims.y,z:dims.z},dir,aspect,perspective.fov,1.05);camera.position.copy(center).addScaledVector(dir,dist);}
            camera.quaternion.copy(saved.quaternion);camera.updateProjectionMatrix();
          }
        }
        renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.render(scene,camera);
        return renderer.domElement.toDataURL('image/png');
      }finally{
        guides.forEach((o,i)=>o.visible=visibility[i]);grid.visible=gridVisible;scene.background=background;
        for(const f of restore.reverse())f();
        if(opts?.frame){camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.zoom=saved.zoom;if(saved.frustum){[orthographic.left,orthographic.right,orthographic.top,orthographic.bottom]=saved.frustum;}controls.target.copy(saved.target);camera.updateProjectionMatrix();controls.update();}
        renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);renderer.render(scene,camera);
      }
    });
    let frame = 0;
    function animate() {
      if (disposed) return;
      controls.update();
      // плавное открывание: доли открытия идут к цели (stepOpen), сцена перерисовывается, пока что-то движется
      {const now=performance.now(),dt=now-lastFrame;lastFrame=now;for(const a of anims.values()){if(a.t===a.target)continue;a.t=stepOpen(a.t,a.target,dt);a.set(a.t);needsRender=true;}}
      if(needsRender){
      needsRender=false;applyCutaway();renderer.render(scene, camera);
      // Подписи размеров не налезают друг на друга: сначала основные размеры, потом проёмы; налезающую сдвигаем
      // вверх/вниз на её высоту, а если места нет — прячем до следующего поворота камеры (аудит вёрстки 06.10.2026).
      const rect=target.getBoundingClientRect();
      const blocked=Array.from(target.parentElement?.querySelectorAll<HTMLElement>('.view-tabs,.interaction-bar,.scene-tools,.section-picker,.orbit-help,.presentation-tools,.rmb-tip,.light-mode-bar,.clear-guides')??[])
        .filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>{const r=e.getBoundingClientRect();return {x:r.left-rect.left+r.width/2,y:r.top-rect.top+r.height/2,w:r.width+12,h:r.height+12};});
      const placed: {x:number;y:number;w:number;h:number}[] = [...blocked];
      // Порядок: ручки растяжения (стоят на боку), плашки зазора (сразу над ручкой), размеры, проёмы.
      const rowGap=(l:typeof labels[number])=>l.element.classList.contains('row-gap');
      const rank=(l:typeof labels[number])=>labelRank({fixed:l.fixed,rowGap:rowGap(l),gap:l.element.classList.contains('gap-dimension'),overall:isOverallDim(l.element.dataset.dim)});
      const ordered = [...labels].sort((a,b)=>rank(a)-rank(b));
      // Ручки прячем, если на экране они ближе 48 px друг к другу (узкий модуль издалека, ось ширины вдоль взгляда) — критик 20.10, m7.
      const isStretchHandle=(l:typeof labels[number])=>l.element.classList.contains('stretch-handle');
      const handles=labels.filter(isStretchHandle);let hideHandles=false,handleRow:number|undefined;
      if(handles.length===2&&!stretch&&!corner){const [p,q]=handles.map(l=>l.position.clone().project(camera));hideHandles=Math.hypot((p.x-q.x)/2*target.clientWidth,(p.y-q.y)/2*target.clientHeight)<48;}
      for (const l of ordered) {
        const v = l.position.clone().project(camera);
        const x = ((v.x + 1) / 2) * target.clientWidth, y0 = ((-v.y + 1) / 2) * target.clientHeight;
        l.element.style.left = x + "px";
        l.element.style.visibility = "";
        if ((l.wall&&cutawayHidden.has(l.wall)) || !(v.z < 1 && v.z > -1 && Math.abs(v.x)<1 && Math.abs(v.y)<1)) { l.element.style.display = "none"; continue; }
        l.element.style.display = "";
        const w = l.element.offsetWidth + 4, h = l.element.offsetHeight + 4;
        if (l.fixed) { if (hideHandles && isStretchHandle(l)) { l.element.style.display = "none"; continue; } l.element.style.top = y0 + "px"; placed.push({ x, y: y0, w, h }); if (isStretchHandle(l)) handleRow = y0; continue; }
        const hits = (y:number) => placed.some(p => Math.abs(p.x - x) < (p.w + w) / 2 && Math.abs(p.y - y) < (p.h + h) / 2);
        const inside = (c:number) => x-w/2>=4 && x+w/2<=target.clientWidth-4 && c-h/2>=4 && c+h/2<=target.clientHeight-4;
        // плашка зазора — над ручкой, не под ней (узкий зазор 20–150 мм: центр зазора у самой ручки) — критик 20.10, B1
        const off = rowGap(l) && handleRow !== undefined ? 21 + h / 2 : 0;
        const cands = off ? [y0 - off, y0 + off, y0 - off - h, y0 + off + h, y0 - off - 2 * h, y0 + off + 2 * h, y0 - off - 3 * h] : [y0, y0 - h, y0 + h, y0 - 2 * h, y0 + 2 * h];
        let y = cands.find(c => inside(c) && !hits(c));
        // зазор не прячем, пока видна ручка: если всё занято — над ручкой поверх (z-index выше размеров)
        if (y === undefined && rowGap(l)) y = cands.find(inside) ?? y0 - off;
        // общие высота и ширина выбранного модуля не прячутся никогда (Макс 29.10: «как быстро понять высоту модуля»)
        if (y === undefined && isOverallDim(l.element.dataset.dim)) y = cands.find(inside) ?? y0;
        if (y === undefined) { l.element.style.top = y0 + "px"; l.element.style.visibility = "hidden"; continue; }
        l.element.style.top = y + "px";
        placed.push({ x, y, w, h });
      }
      }
      frame = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      saveCamera();controls.removeEventListener('end',saveCamera);
      endStretch();endCorner();cancelTool();window.removeEventListener('keyup',altGuard);window.removeEventListener('keydown',modsKey);window.removeEventListener('keyup',modsKey);window.removeEventListener('wheel',ctrlWheel,{capture:true});snapMark.remove();
      target.removeEventListener('pointerdown',toolDown,true);window.removeEventListener('pointermove',trackMouse);window.removeEventListener('keydown',guideKey,true);
      scene.remove(hoverLine,ghostLine);hoverLine.geometry.dispose();ghostLine.geometry.dispose();toolMat.dispose();ghostMat.dispose();guideMat.dispose();guideSelMat.dispose();
      disposed = true;
      current.current.captureReady(undefined);
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.removeEventListener('change',requestRender);renderer.domElement.removeEventListener('mousedown',preventMiddleScroll);controls.dispose();
      disposeGroup(modelGroup);
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      for (const l of labels) l.element.remove();
      window.removeEventListener('keydown',key);renderer.domElement.removeEventListener('contextmenu',contextMenu);renderer.domElement.removeEventListener('pointerdown',rightPointer,true);renderer.domElement.removeEventListener('pointerdown',middlePointer,true);renderer.domElement.removeEventListener('pointerup',middleUp,true);target.removeEventListener('dragover',dragOver);target.removeEventListener('drop',drop);target.removeEventListener('dragleave',dragLeave);targetGeometry.dispose();targetMaterial.dispose();badge.remove();
      sun.shadow.dispose();
      for(const texture of loadedTextures)texture.dispose();loadedTextures.clear();textureLoads.clear();
      handleEnv?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);
  useEffect(
    () => api.current?.rebuild(),
    [
      p.module,
      p.arrangement,
      p.activeId,
      p.room,
      p.appliances,
      p.selectedObstacle,
      p.selectedFixture,
      p.selectedOpening,
      p.groupIds?.join(','),
      p.mode,
      p.transparent,
      p.clearFacades,
      p.hideFacades,
      p.hideFurniture,
      p.hiddenModuleIds?.join(','),
      p.selected,
      p.selectedPart,
      p.texture,
      p.facadeTexture,
      p.openDoors,
      p.exploded,
      p.dimensions,
      p.roomDimensions,
      p.gapDimensions,
      p.rowGaps,
      p.stretchable,
      p.presentation,
      p.view, // ручки углов — свои в каждом виде
      !!p.onCorner,
      p.drawerPreview?.sid,
      p.drawerPreview?.index,
    ],
  );
  // Переключатель «Ближние стены» — только видимость, без пересборки сцены.
  useEffect(() => api.current?.refresh(), [p.cutaway]);
  // Вспомогательные линии изменились (поставили, убрали, Ctrl+Z) — перерисовать без пересборки сцены.
  useEffect(() => api.current?.guides(), [p.guides]);
  useEffect(
    () => api.current?.fit(),
    [
      p.view,
      p.fit,
      p.focusActive,
      p.presentation,

    ],
  );
  useEffect(()=>{const action=p.presentation||p.mode==='orbit'?'Перетаскивание — поворот вида':p.mode==='fill'?'Перетаскивайте полки и ящики по высоте, перегородки по ширине':p.moveAll?'Перетаскивание корпуса перемещает всю композицию':'Перетаскивайте корпуса для расстановки';host.current?.querySelector('canvas')?.setAttribute('aria-label','3D-модель мебели. '+action+'. Колесо — масштаб, зажатое колесо — вращение камеры.');},[p.mode,p.moveAll,p.presentation]);
  return (
    <div className={p.lightMode?"scene light-picking":"scene"} ref={host} data-testid="scene">
      {guideCount>0&&!p.presentation&&p.onGuides&&<button type="button" className="clear-guides" title="Убрать вспомогательные линии этого вида (Ctrl+Z — вернуть)" onClick={()=>api.current?.clearGuides()}>Убрать вспомогательные линии ({guideCount})</button>}
      {error && (
        <div className="scene-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
