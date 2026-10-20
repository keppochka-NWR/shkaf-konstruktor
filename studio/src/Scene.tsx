import {dishwasherServiceModel} from './dishwasherServices';
import {applianceModel} from './applianceGeometry';
import {surfacePoint} from './roomSurvey';
import {hiddenWalls,roomEdges,edgeVisible,readCutaway,type CutawayWall} from './roomCutaway';
import {facadeHandleId} from './model';
import {frameDistance,frameHeight} from './framing';
import {worktopGeometry,boardGeometry,aluFrameGeometry,taperGeometry,planTaperGeometry,planContourGeometry,golaSideGeometry,faceContourGeometry,rearNotchSideGeometry,topNotchGeometry} from './boardGeometry';
import {aluProfile,aluInsert,aluFill,aluFillLookId} from './alu';
import {facadeGeometry} from './vernissageGeometry';
import {vernissageLayout,vernissageColor,vernissageGlossy,vernissageTexture} from './facadesVernissage';
import {meshById} from './mesh';
import {meshModel} from './meshModels';
import {procModel,faceAt,fastenerAxis,fastenerGeometry,hingeFallbackModel} from './hardwareModels';
// Цвета профиля рамочного фасада для сцены.
const ALU_COLOURS:Record<string,number>={silver:0xc9ccd1,white:0xf2f2f2,black:0x2b2b2b,gold:0xc9a86a,champagne:0xd8c7a3,cognac:0x8a5a2b};
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
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
// Теперь — три попытки с паузой, отказ убирается из кэша (следующая пересборка сцены пробует снова) и пишется в консоль с адресом.
function loadHandleModel(file: string) {
  let p = handleModels.get(file);
  if (!p) {
    const url = `${import.meta.env.BASE_URL}models/${file.includes("/") ? file : "handles/" + file}`;
    const q: Promise<THREE.Group> = new Promise<THREE.Group>((resolve, reject) => {
      const attempt = (left: number) => gltfLoader.load(url, (g) => resolve(g.scene), undefined, (e) => left > 1 ? setTimeout(() => attempt(left - 1), 500) : reject(e));
      attempt(3);
    });
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
import {localToRoom,roomToLocal,moduleCenter,bounds,type Room,type PlacedModule} from "./project";
import {wallPanels} from './roomGeometry';
import {FIXTURES,fixtureBox,fixtureLabel} from './fixtures';
import {rodCylinder} from './rawModule';
import {gapLabelX,openingSizeLabel} from './clientLabels';
import {missMenuTarget,screenRect} from './missMenu';
export type View = "iso" | "front" | "side" | "top";
type Props = {
  hiddenModuleIds?:string[];
  viewKey?:string;
  isoDirection?: [number, number];
  captureReady: (fn: (() => string) | undefined) => void;
  module: Module;
  mode:'move'|'fill'|'orbit'|'select';
  hideFacades?:boolean;
  hideFurniture?:boolean;
  moveAll:boolean;
  groupIds?:string[];
  snap:(id:string,p:{x:number;y:number;z:number})=>{x:number;y:number;z:number};
  onMoveModule:(id:string,p:{x:number;y:number;z:number})=>boolean;
  moveProblem:(id:string,p:{x:number;y:number;z:number})=>string|undefined;
  onMoveDivider:(mid:string,sid:string,delta:number)=>boolean;
  dividerProblem:(mid:string,sid:string,delta:number)=>string|undefined;
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
  onLightPick?:(mid:string,pid:string)=>void;
};
export function Scene(p: Props) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(p);
  current.current = p;
  const [error, setError] = useState("");
  const api = useRef<{ rebuild: () => void; fit: () => void; refresh: () => void } | null>(null);
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
      if(!result){result=new Promise<THREE.Texture>((resolve,reject)=>loader.load(url,map=>{map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(disposed)map.dispose();else loadedTextures.add(map);resolve(map);},undefined,reject));textureLoads.set(url,result);}
      return result;
    }
    let generation = 0,pendingTextures=0;
    // Для снимков проверки: скрипт ждёт, пока догрузятся текстуры и модели фурнитуры (window.__pending() === 0).
    (window as unknown as {__pending?:()=>number}).__pending=()=>pendingTextures;    function disposeGroup(group: THREE.Group) {
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
            mat.dispose();
          }
        }
      });
      scene.remove(group);
    }
    const labels: { element: HTMLButtonElement; position: THREE.Vector3; wall?: CutawayWall }[] =
      [];
    // Ближние стены: что принадлежит какой стене; видимость меняется по камере без пересборки сцены.
    const cutawayParts:{obj:THREE.Object3D;walls:CutawayWall[]}[]=[];
    let cutawayRoom:{x0:number;z0:number;width:number;depth:number}|undefined,cutawayHidden=new Set<CutawayWall>(),cutawayKey='';
    function applyCutaway(){
      const r=cutawayRoom,on=current.current.cutaway??readCutaway();
      const hidden=r?hiddenWalls(r,{x:camera.position.x-r.x0,z:camera.position.z-r.z0},on):new Set<CutawayWall>();
      const key=[...hidden].join(',');if(key===cutawayKey)return;
      cutawayKey=key;cutawayHidden=hidden;
      for(const p of cutawayParts)p.obj.visible=edgeVisible(p.walls,hidden);
    }
    function label(
      text: string,
      pos: THREE.Vector3,
      action?: () => void,
      small = false,
      wall?: CutawayWall,
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
    function roomLabel(text:string,pos:THREE.Vector3,action?:()=>void,small=false,wall?:CutawayWall){
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
    let sceneOrigin: {x:number;z:number}|undefined;
    function rebuild() {
      needsRender=true;
      const state = current.current,
        m = state.module;
      grid.visible=!state.presentation;
      scene.background=state.presentation?new THREE.Color(0xf1f0eb):null;
      for (const l of labels) l.element.remove();
      labels.length = 0;
      cutawayParts.length=0;cutawayRoom=undefined;cutawayKey='\u0000';
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
        const moduleGroup=new THREE.Group();moduleGroups.set(placed.id,moduleGroup);modelGroup.add(moduleGroup);
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
            ...(part.role === "light" && !part.id.startsWith("groove:") ? { color: 0xfff1c9, emissive: 0xffd27a, emissiveIntensity: 1.4, metalness: 0, roughness: 0.4 } : {}),
          });
          const texture = catalog.find(
            (c) => c.n === part.decor,
          )?.tex;
          const vTex = part.vernissage && m.vernissage && !part.rotZ ? vernissageTexture(m.vernissage) : null;
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
          const vern = part.vernissage && m.vernissage && !part.rotZ ? m.vernissage : undefined;
          // Цилиндр-заглушка только для деталей без модели: модель из Blender (part.model) — дочерний объект меша и унаследовала бы его поворот.
          // процедурная модель фурнитуры без сетки (hardwareModels.ts): профиль Gola, штанга, направляющая, эксцентрик, шкант, толкатель —
          // невидимый бокс детали для выбора + модель внутри; бокс не поворачивается (у модели свои оси)
          const proc = procModel(part, { open:state.openDoors, left: part.position[0] < m.width / 2, headSign: (() => {
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
              : isAlu ? aluFrameGeometry(part, aluProfile(m.alu!.profile)?.face ?? 19) : part.planHoles?.length ? worktopGeometry(part) : part.planContour ? planContourGeometry(part) : part.golaCuts?.length ? golaSideGeometry(part) : part.rearNotch ? rearNotchSideGeometry(part) : part.topNotches ? topNotchGeometry(part) : part.faceContour ? faceContourGeometry(part) : part.taper ? taperGeometry(part) : part.taperZ ? planTaperGeometry(part) : boardGeometry(part);
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
            mat.color.set(part.look.color); mat.metalness = part.look.metalness ?? 0; mat.roughness = part.look.roughness ?? 0.6;
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
              const holder = new THREE.Group();
              if (model.mirror) inst.scale.x = -1;
              holder.add(inst);
              const [w, x, y, z] = model.quat ?? [1, 0, 0, 0];
              holder.quaternion.set(x, y, z, w);
              const o = model.origin ?? part.position;
              holder.position.set(o[0] - part.position[0], o[1] - part.position[1], o[2] - part.position[2]);
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
          // ящики кухни Axis PRO: «открыть» выдвигает короб с фасадом на 3/4 длины (направляющие остаются)
          if(active&&state.openDoors&&part.id.startsWith('kd:')&&!part.id.includes(':slide:')&&!part.id.includes(':screw:run')&&!part.id.includes(':screw:fx3')){const kd=m.kdrawers?.[Number(part.id.split(':')[1])];if(kd){const travel=(kd.box?kd.box.len:(kd.len??500))*.9;mesh.position.x+=Math.sin(rotY)*travel;mesh.position.z+=Math.cos(rotY)*travel;}}
          if(active&&preview&&(state.openDoors||!m.doors)&&part.id.startsWith(preview.sid+':drawer:'+preview.index+':')&&!part.id.includes(':slide:')){
            const section=m.sections.find(s=>s.id===preview.sid);if(section){const travel=drawerConfig(m,section,preview.index).length*.8;mesh.position.x+=Math.sin(rotY)*travel;mesh.position.z+=Math.cos(rotY)*travel;}
          }
          // направляющая с процедурной моделью: сама деталь стоит в корпусе, подвижные звенья выезжают вместе с ящиком (на тот же ход)
          if(proc&&part.id.includes(':slide:')&&active){
            let travel=0;
            if(state.openDoors&&part.id.startsWith('kd:')){const kd=m.kdrawers?.[Number(part.id.split(':')[1])];if(kd)travel=(kd.box?kd.box.len:(kd.len??500))*.9;}
            else if(preview&&(state.openDoors||!m.doors)&&part.id.startsWith(preview.sid+':drawer:'+preview.index+':')){const section=m.sections.find(s=>s.id===preview.sid);if(section)travel=drawerConfig(m,section,preview.index).length*.8;}
            if(travel)proc.traverse(o=>{if(o.userData.slide==='run')o.position.z+=travel;else if(o.userData.slide==='mid')o.position.z+=travel/2;});
          }
          // у фурнитуры из Базиса тень даёт сама сетка; прозрачный габарит-заглушка тени не отбрасывает
          mesh.castShadow = !part.model?.native;
          mesh.receiveShadow = true;
          mesh.userData = {
            sectionId: part.sectionId,
            partId: part.id,
            moduleId: placed.id,
            active,
            role: part.role,
          };
          if (state.exploded && active) {
            mesh.position.x = (mesh.position.x-m.width/2)*1.3+m.width/2;
            mesh.position.y =
              (mesh.position.y - m.height / 2) * 1.18 + m.height / 2;
            mesh.position.z = (mesh.position.z-m.depth/2)*1.6+m.depth/2;
          }
          if (part.openShift !== undefined) {
            // Купе: «открыть фасады» — переднее полотно отъезжает за заднее, как в жизни.
            if (state.openDoors) mesh.position.x += part.openShift;
            moduleGroup.add(mesh);
          } else if (part.role === "door" && state.openDoors && part.id !== "slope-filler") {
            // Петлевая ось — на краю фасада; при скосе фронта фасад повёрнут, ось сдвигается вдоль его наклонной линии.
            const pivot = new THREE.Group();
            pivot.position.copy(mesh.position);
            const sign=part.hinge==='right'?-1:1,horizontal=part.hinge==='top'||part.hinge==='bottom',verticalOffset=part.hinge==='bottom'?part.size[1]/2:-part.size[1]/2;
            const hingeOff=new THREE.Vector3(horizontal?0:sign*part.size[0]/2,horizontal?verticalOffset:0,0).applyAxisAngle(new THREE.Vector3(0,1,0),rotY);
            pivot.position.sub(hingeOff);
            mesh.position.set(horizontal?0:sign*part.size[0]/2,horizontal?verticalOffset:0,0);mesh.rotation.y=0;
            pivot.add(mesh);
            pivot.rotation.y=rotY;if(horizontal)pivot.rotation.x=part.hinge==='bottom'?Math.PI/2:-Math.PI/2;else pivot.rotation.y-=Math.PI*.58*sign;pivot.userData.rotY=rotY;
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
      for(const o of state.appliances??[]){const appliance=applianceModel(o,state.openDoors);if(!appliance)continue;appliance.position.set(o.x+o.width/2-moduleCenter(focus).x,o.y+o.height/2,o.z+o.depth/2-moduleCenter(focus).z);modelGroup.add(appliance);if(o.sinkModuleId){const hoses=dishwasherServiceModel(o,state.arrangement);hoses.position.set(-moduleCenter(focus).x,0,-moduleCenter(focus).z);modelGroup.add(hoses);}}
      if (state.room) {
        const r = state.room,
          x0 = -moduleCenter(focus).x,
          z0 = -moduleCenter(focus).z;
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
        for(const panel of wallPanels(r)){
          if(!r.survey?.surfaces[panel.wall]){wallBox(panel.wall,panel.u,panel.y,panel.width,panel.height,80,0xd5d5cc,panel.wall==='front'||panel.wall==='right'?0.06:0.25);continue;}
          const vertices:number[]=[];const grid=r.survey.surfaces[panel.wall]!;
          const cuts=(lo:number,hi:number,measured:number[])=>[...new Set([lo,hi,...measured.filter(v=>v>lo&&v<hi),...Array.from({length:5},(_,i)=>lo+(hi-lo)*(i+1)/6)])].sort((a,b)=>a-b);
          const us=cuts(panel.u-panel.width/2,panel.u+panel.width/2,grid.u),vs=cuts(panel.y-panel.height/2,panel.y+panel.height/2,grid.v);
          for(let j=0;j<vs.length-1;j++)for(let i=0;i<us.length-1;i++){
            const points=[[us[i],vs[j]],[us[i+1],vs[j]],[us[i+1],vs[j+1]],[us[i],vs[j+1]]].map(([u,v])=>surfacePoint(r,panel.wall,u,v));
            for(const n of [0,1,2,0,2,3]){const p=points[n];vertices.push(x0+p.x,p.y,z0+p.z);}
          }
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
          const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xb5c9c1,transparent:true,opacity:panel.wall==='front'||panel.wall==='right'?.08:.35,side:THREE.DoubleSide,depthWrite:false}));modelGroup.add(mesh);cutawayParts.push({obj:mesh,walls:[panel.wall]});
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
        for(const o of r.obstacles||[]){if(['fridge','dishwasher','hood','hob'].includes(o.type))continue;const mesh=new THREE.Mesh(new THREE.BoxGeometry(o.width,o.height,o.depth),new THREE.MeshStandardMaterial({color:o.type==='radiator'?0xd9e0e4:0xc7bcae,roughness:.85}));mesh.userData.obstacleId=o.id;mesh.position.set(x0+o.x+o.width/2,o.y+o.height/2,z0+o.z+o.depth/2);mesh.castShadow=true;mesh.receiveShadow=true;modelGroup.add(mesh);const edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:!state.presentation&&state.selectedObstacle===o.id?0x087f94:0x786d62,transparent:true,opacity:!state.presentation&&state.selectedObstacle===o.id?1:.5}));edge.userData.captureGuide=!state.presentation&&state.selectedObstacle===o.id;mesh.add(edge);}
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
        const roomFloor=new THREE.Mesh(new THREE.PlaneGeometry(r.width,r.depth),new THREE.MeshStandardMaterial({color:0xdcd6ca,roughness:0.9}));roomFloor.rotation.x=-Math.PI/2;roomFloor.position.set(x0+r.width/2,-3,z0+r.depth/2);roomFloor.receiveShadow=true;modelGroup.add(roomFloor);
      }
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
        line([new THREE.Vector3(x, fy, z), new THREE.Vector3(x, m.height+fy, z)]);
        label(
          m.height + " мм",
          new THREE.Vector3(x - 30, m.height / 2+(focus.y??0), z),
          () => current.current.onDimension("height"),
        );
        label(
          m.depth + " мм",
          new THREE.Vector3(m.width / 2 + 150, fy+100, 0),
          () => current.current.onDimension("depth"),
        );
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
            : view === "top"
              ? new THREE.Vector3(0, 1, 0.001)
              : new THREE.Vector3(state.isoDirection?.[0]??(facing.x<-.1?-1:1), state.isoDirection?.75:.55, state.isoDirection?.[1]??(facing.z<-.1?-1.7:1.7)).normalize();
      if(view==="front"||view==="side")dir.applyAxisAngle(new THREE.Vector3(0,1,0),((focus.rotation??0)+(m.corner?45:0))*Math.PI/180);
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
    type Drag={mid:string;sid:string;pid:string;kind:'module'|'part'|'divider';plane:THREE.Plane;anchor:THREE.Vector3;origin:{x:number;y:number;z:number};point:[number,number];moved:boolean;candidate:{x:number;y:number;z:number};meshes:THREE.Object3D[];delta:number};
    let drag:Drag|null=null;
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
    function hitAt(clientX:number,clientY:number,allowShell=false){cast(clientX,clientY);return ray.intersectObjects(modelGroup.children,true).find(h=>h.object instanceof THREE.Mesh&&h.object.userData.moduleId&&!(drag?.kind==='part'&&drag.moved&&drag.meshes.includes(h.object))&&!(!allowShell&&current.current.transparent&&['body','door'].includes(h.object.userData.role)&&!h.object.userData.partId?.endsWith(':divider')));}
    function sectionFor(hit:THREE.Intersection){const a=current.current.arrangement.find(a=>a.id===hit.object.userData.moduleId)!;const focus=current.current.arrangement.find(a=>a.id===current.current.activeId)!;const center=moduleCenter(focus),xx=roomToLocal(a,hit.point.x+center.x,hit.point.z+center.z).x,yy=hit.point.y-(a.y??0);return hit.object.userData.sectionId||boxes(a.module).find(b=>xx>=b.x&&xx<=b.x+b.width&&yy>=b.bottom&&yy<=b.top)?.id||a.module.sections[0].id;}
    function pointerDown(e:PointerEvent){
      if(e.button!==0||current.current.presentation)return;
      if((e.ctrlKey||e.metaKey)&&current.current.onToggleModule){const picked=hitAt(e.clientX,e.clientY,true);if(picked){e.preventDefault();current.current.onToggleModule(picked.object.userData.moduleId);}return;}
      if(current.current.lightMode&&current.current.onLightPick){const picked=hitAt(e.clientX,e.clientY,true);if(picked?.object.userData.partId){e.preventDefault();current.current.onLightPick(picked.object.userData.moduleId,picked.object.userData.partId);}return;}
      if(current.current.mode==='orbit')return;
      cast(e.clientX,e.clientY);const first=ray.intersectObjects(modelGroup.children,true).find(h=>h.object instanceof THREE.Mesh&&(h.object.userData.obstacleId||h.object.userData.fixtureId||h.object.userData.moduleId));
      if(first?.object.userData.obstacleId){current.current.onObstacleSelect(first.object.userData.obstacleId);return;}
      if(first?.object.userData.fixtureId){current.current.onFixtureSelect?.(first.object.userData.fixtureId);return;}
      const hit=hitAt(e.clientX,e.clientY);if(!hit)return;
      const state=current.current,a=state.arrangement.find(a=>a.id===hit.object.userData.moduleId)!;
      const sid=sectionFor(hit),pid=hit.object.userData.partId as string;
      // Клик по ручке в любом режиме открывает выбор ручки для этого корпуса.
      if(hit.object.userData.role==='handle'&&state.onHandleClick&&!state.presentation){if(a.id!==state.activeId)state.onModuleSelect(a.id);state.onHandleClick(a.id,pid.includes(':drawer:')?pid.replace(':handle',':facade'):pid.replace(':handle:',':door:'));return;}
      if(state.mode==='select'){if(a.id!==state.activeId)state.onModuleSelect(a.id);state.onPartSelect(sid,pid,a.id);return;}
      const isPart=state.mode==='fill'&&(!a.module.corner||pid.includes(':shelf:')||pid.includes(':drawer:')||pid.endsWith(':rod'))&&(['shelf','drawer','rod','pantograph','flange'].includes(hit.object.userData.role)||(hit.object.userData.role==='handle'&&pid.includes(':drawer:')))&&!pid.includes(':drawer-cap');
      const isDivider=state.mode==='fill'&&!a.module.corner&&pid.endsWith(':divider');
      if(state.mode==='fill'&&!isPart&&!isDivider){if(a.id!==state.activeId)state.onModuleSelect(a.id);else state.onPartSelect(sid,pid);return;}
      const normal=isPart&&a.module.corner?camera.getWorldDirection(new THREE.Vector3()):isPart||isDivider||state.view==='front'?new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),(a.rotation??0)*Math.PI/180):new THREE.Vector3(0,1,0);
      const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit.point);
      const anchor=new THREE.Vector3();if(!ray.ray.intersectPlane(plane,anchor))return;
      const meshes:THREE.Object3D[]=[];const prefix=pid.includes(':pantograph:')?sid+':pantograph:':pid.includes(':drawer:')?pid.split(':drawer:')[0]+':drawer:'+pid.split(':drawer:')[1].split(':')[0]+':':pid;
      moduleGroups.get(a.id)?.traverse(o=>{if(o instanceof THREE.Mesh&&(o.userData.partId===pid||o.userData.partId?.startsWith(prefix)||((pid===sid+':rod'||pid.includes(':flange:'))&&(o.userData.partId===sid+':rod'||o.userData.partId?.startsWith(sid+':flange:')))))meshes.push(o);});
      drag={mid:a.id,sid,pid,kind:isDivider?'divider':isPart?'part':'module',plane,anchor,origin:{x:a.x,y:a.y??0,z:a.z},point:[e.clientX,e.clientY],moved:false,candidate:{x:a.x,y:a.y??0,z:a.z},meshes,delta:0};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);
    }
    function pointerMove(e:PointerEvent){
      if(!drag)return;if(!drag.moved&&Math.hypot(e.clientX-drag.point[0],e.clientY-drag.point[1])<4)return;
      needsRender=true;drag.moved=true;cast(e.clientX,e.clientY);const point=new THREE.Vector3();if(!ray.ray.intersectPlane(drag.plane,point))return;point.sub(drag.anchor);badge.hidden=false;
      if(drag.kind==='module'){
        const raw={x:drag.origin.x+point.x,y:current.current.view==='front'?Math.max(0,drag.origin.y+point.y):drag.origin.y,z:drag.origin.z+point.z};
        const next=e.altKey?{x:Math.round(raw.x),y:Math.round(raw.y),z:Math.round(raw.z)}:current.current.snap(drag.mid,raw);
        // Horizontal dragging must not snap height to a neighbour or the floor.
        if(current.current.view!=='front')next.y=drag.origin.y;
        drag.candidate=next;for(const [mid,group] of moduleGroups)if(current.current.moveAll||mid===drag.mid||current.current.groupIds?.includes(drag.mid)&&current.current.groupIds.includes(mid))group.position.copy(group.userData.base).add(new THREE.Vector3(next.x-drag.origin.x,next.y-drag.origin.y,next.z-drag.origin.z));const problem=current.current.moveProblem(drag.mid,next);badge.classList.toggle('invalid',!!problem);badge.textContent=problem||(current.current.moveAll?'Вся композиция · ':current.current.groupIds?.includes(drag.mid)?'Группа · ':'')+(e.altKey?'Без привязки · ':'')+'Положение: '+next.x+' / '+next.y+' / '+next.z+' мм';
      }else if(drag.kind==='divider'){
        const a=current.current.arrangement.find(a=>a.id===drag!.mid)!,angle=(a.rotation??0)*Math.PI/180,dx=Math.round((point.x*Math.cos(angle)-point.z*Math.sin(angle))/5)*5;
        for(const mesh of drag.meshes)mesh.position.x+=dx-drag.delta;drag.delta=dx;
        const b=boxes(a.module),i=b.findIndex(b=>b.id===drag!.sid),problem=current.current.dividerProblem(drag.mid,drag.sid,dx);
        badge.classList.toggle('invalid',!!problem);badge.textContent=problem||`Секции: ${Math.round(b[i-1].width+dx)} / ${Math.round(b[i].width-dx)} мм · отпустите для пересчёта`;
      }else{const dy=Math.round(point.y/5)*5;for(const mesh of drag.meshes)mesh.position.y+=dy-drag.delta;drag.delta=dy;
        const hit=hitAt(e.clientX,e.clientY,true),destination=indicateTarget(hit),toMid=hit?.object.userData.moduleId,toSid=hit?sectionFor(hit):undefined;
        const placed=current.current.arrangement.find(a=>a.id===toMid),to=hit&&placed&&toSid?{mid:placed.id,sid:toSid,y:hit.point.y-(placed.y??0)}:undefined;
        const problem=current.current.partProblem(drag.mid,drag.sid,drag.pid,dy,to);
        badge.classList.toggle('invalid',!!problem);if(problem)targetMaterial.color.set(0xc63838);
        badge.textContent=problem||(destination?destination+' · ':'')+'по высоте '+(dy>0?'+':'')+dy+' мм';
      }
    }
    function resetDrag(){needsRender=true;dropTarget.visible=false;if(!drag)return;if(drag.kind==='module'){for(const group of moduleGroups.values())group.position.copy(group.userData.base);}else for(const mesh of drag.meshes){if(drag.kind==='divider')mesh.position.x-=drag.delta;else mesh.position.y-=drag.delta;}drag=null;badge.hidden=true;badge.classList.remove('invalid');controls.enabled=true;}
    function pointerUp(e:PointerEvent){
      if(!drag){if(current.current.mode==='orbit')return;return;}
      const d=drag;
      if(d.moved){
        if(d.kind==='module')current.current.onMoveModule(d.mid,d.candidate);
        else if(d.kind==='divider')current.current.onMoveDivider(d.mid,d.sid,d.delta);
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
    function dragOver(e:DragEvent){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';badge.hidden=false;const destination=indicateTarget(hitAt(e.clientX,e.clientY,true));badge.textContent=destination?'Отпустите: '+destination:'Перетащите внутрь корпуса';}
    function drop(e:DragEvent){needsRender=true;e.preventDefault();badge.hidden=true;dropTarget.visible=false;const kind=e.dataTransfer?.getData('application/x-furniture');if(!kind)return;const hit=hitAt(e.clientX,e.clientY,true);if(!hit)return;const placed=current.current.arrangement.find(a=>a.id===hit.object.userData.moduleId)!;current.current.onDropItem(kind,placed.id,sectionFor(hit),hit.point.y-(placed.y??0));}
    function key(e:KeyboardEvent){if(e.key==='Escape')resetDrag();}
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
    api.current = { rebuild, fit, refresh: () => { needsRender = true; } };
    current.current.captureReady(() => {
      if(pendingTextures>0)throw Error("Материалы ещё загружаются. Подождите несколько секунд и повторите сохранение изображения.");
      const size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio(),background=scene.background,gridVisible=grid.visible;
      const guides:THREE.Object3D[]=[];modelGroup.traverse(o=>{if(o.userData.captureGuide||o.parent===modelGroup&&(o instanceof THREE.Line||o instanceof THREE.LineSegments))guides.push(o);});const visibility=guides.map(o=>o.visible);
      const aspect=size.x/size.y,width=aspect>=1?2560:Math.round(2560*aspect),height=aspect>=1?Math.round(2560/aspect):2560;
      try{
        guides.forEach(o=>o.visible=false);grid.visible=false;scene.background=new THREE.Color(0xf1f0eb);
        renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.render(scene,camera);
        return renderer.domElement.toDataURL('image/png');
      }finally{
        guides.forEach((o,i)=>o.visible=visibility[i]);grid.visible=gridVisible;scene.background=background;
        renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);renderer.render(scene,camera);
      }
    });
    let frame = 0;
    function animate() {
      if (disposed) return;
      controls.update();
      if(needsRender){
      needsRender=false;applyCutaway();renderer.render(scene, camera);
      // Подписи размеров не налезают друг на друга: сначала основные размеры, потом проёмы; налезающую сдвигаем
      // вверх/вниз на её высоту, а если места нет — прячем до следующего поворота камеры (аудит вёрстки 06.10.2026).
      const rect=target.getBoundingClientRect();
      const blocked=Array.from(target.parentElement?.querySelectorAll<HTMLElement>('.view-tabs,.interaction-bar,.scene-tools,.section-picker,.orbit-help,.presentation-tools,.rmb-tip,.light-mode-bar')??[])
        .filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>{const r=e.getBoundingClientRect();return {x:r.left-rect.left+r.width/2,y:r.top-rect.top+r.height/2,w:r.width+12,h:r.height+12};});
      const placed: {x:number;y:number;w:number;h:number}[] = [...blocked];
      const ordered = [...labels].sort((a,b)=>Number(a.element.classList.contains('gap-dimension'))-Number(b.element.classList.contains('gap-dimension')));
      for (const l of ordered) {
        const v = l.position.clone().project(camera);
        const x = ((v.x + 1) / 2) * target.clientWidth, y0 = ((-v.y + 1) / 2) * target.clientHeight;
        l.element.style.left = x + "px";
        l.element.style.visibility = "";
        if ((l.wall&&cutawayHidden.has(l.wall)) || !(v.z < 1 && v.z > -1 && Math.abs(v.x)<1 && Math.abs(v.y)<1)) { l.element.style.display = "none"; continue; }
        l.element.style.display = "";
        const w = l.element.offsetWidth + 4, h = l.element.offsetHeight + 4;
        const hits = (y:number) => placed.some(p => Math.abs(p.x - x) < (p.w + w) / 2 && Math.abs(p.y - y) < (p.h + h) / 2);
        const y = [y0, y0 - h, y0 + h, y0 - 2 * h, y0 + 2 * h].find(c => x-w/2>=4 && x+w/2<=target.clientWidth-4 && c-h/2>=4 && c+h/2<=target.clientHeight-4 && !hits(c));
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
      window.removeEventListener('keydown',key);renderer.domElement.removeEventListener('contextmenu',contextMenu);renderer.domElement.removeEventListener('pointerdown',rightPointer,true);target.removeEventListener('dragover',dragOver);target.removeEventListener('drop',drop);target.removeEventListener('dragleave',dragLeave);targetGeometry.dispose();targetMaterial.dispose();badge.remove();
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
      p.presentation,
      p.drawerPreview?.sid,
      p.drawerPreview?.index,
    ],
  );
  // Переключатель «Ближние стены» — только видимость, без пересборки сцены.
  useEffect(() => api.current?.refresh(), [p.cutaway]);
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
      {error && (
        <div className="scene-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
