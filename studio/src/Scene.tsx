import {frameDistance,frameHeight} from './framing';
import {boardGeometry,aluFrameGeometry,taperGeometry,planTaperGeometry} from './boardGeometry';
import {aluProfile,aluInsert} from './alu';
import {meshById} from './mesh';
import {meshModel} from './meshModels';
// Цвета профиля рамочного фасада для сцены.
const ALU_COLOURS:Record<string,number>={silver:0xc9ccd1,white:0xf2f2f2,black:0x2b2b2b,gold:0xc9a86a,champagne:0xd8c7a3,cognac:0x8a5a2b};
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { handleById, handleColour, handleModelFile } from "./handles";
// Модели ручек (Blender → GLB, scripts/blender_handles.py): кэш по файлу, экземпляры делят геометрию.
const gltfLoader = new GLTFLoader();
const handleModels = new Map<string, Promise<THREE.Group>>();
function loadHandleModel(file: string) {
  let p = handleModels.get(file);
  if (!p) {
    p = new Promise<THREE.Group>((resolve, reject) => gltfLoader.load(`${import.meta.env.BASE_URL}models/handles/${file}`, (g) => resolve(g.scene), undefined, reject));
    handleModels.set(file, p);
  }
  return p;
}
import { boxes, parts, shelfGaps, drawerConfig, drawerStackHeight, RULES, type Module } from "./model";
import { catalog } from "./catalog";
import {localToRoom,roomToLocal,moduleCenter,bounds,type Room,type PlacedModule} from "./project";
import {wallPanels} from './roomGeometry';
import {FIXTURES,fixtureBox,fixtureLabel} from './fixtures';
export type View = "iso" | "front" | "side" | "top";
type Props = {
  captureReady: (fn: (() => string) | undefined) => void;
  module: Module;
  mode:'move'|'fill'|'orbit';
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
  onHandleClick?: (mid: string) => void;
  /** Правая кнопка по корпусу: контекстное меню редактирования (как в B Planner). Координаты — экранные. */
  onContextMenu?: (mid: string, sid: string, x: number, y: number) => void;
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
  presentation?:boolean;
  drawerPreview?:{sid:string;index:number};
};
export function Scene(p: Props) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(p);
  current.current = p;
  const [error, setError] = useState("");
  const api = useRef<{ rebuild: () => void; fit: () => void } | null>(null);
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
    renderer.domElement.setAttribute(
      "aria-label",
      "3D-модель шкафа. Перетаскивание — поворот, колесо — масштаб.",
    );
    renderer.domElement.setAttribute("role", "img");
    target.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),perspective=new THREE.PerspectiveCamera(34,1,5,250000),orthographic=new THREE.OrthographicCamera(-1000,1000,1000,-1000,5,250000);
    let camera:THREE.PerspectiveCamera|THREE.OrthographicCamera=perspective;
    const controls = new OrbitControls<THREE.PerspectiveCamera|THREE.OrthographicCamera>(camera, renderer.domElement);
    let needsRender=true;const requestRender=()=>{needsRender=true;};controls.addEventListener('change',requestRender);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = 350;
    controls.maxDistance = 150000;controls.minZoom=.05;controls.maxZoom=20;
    controls.maxPolarAngle = Math.PI * 0.91;
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
            mat.dispose();
          }
        }
      });
      scene.remove(group);
    }
    const labels: { element: HTMLButtonElement; position: THREE.Vector3 }[] =
      [];
    function label(
      text: string,
      pos: THREE.Vector3,
      action?: () => void,
      small = false,
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
      button.addEventListener("click", () => action?.());
      button.disabled = !action;
      target.appendChild(button);
      labels.push({ element: button, position: pos });
    }

    /** Подпись в координатах комнаты (без поворота активного корпуса). */
    function roomLabel(text:string,pos:THREE.Vector3,action?:()=>void,small=false){
      const button=document.createElement("button");button.type="button";button.className="model-dimension room-dimension"+(small?" gap-dimension":"");button.textContent=text;
      button.setAttribute("aria-label","Размер помещения: "+text);button.title=action?"Нажмите, чтобы изменить размер":text;
      button.addEventListener("pointerdown",e=>e.stopPropagation());button.addEventListener("click",()=>action?.());button.disabled=!action;
      target.appendChild(button);labels.push({element:button,position:pos});
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
    function rebuild() {
      needsRender=true;
      const state = current.current,
        m = state.module;
      grid.visible=!state.presentation;
      scene.background=state.presentation?new THREE.Color(0xf1f0eb):null;
      for (const l of labels) l.element.remove();
      labels.length = 0;
      moduleGroups.clear();
      generation++;pendingTextures=0;
      const gen = generation;
      disposeGroup(modelGroup);
      modelGroup = new THREE.Group();
      scene.add(modelGroup);
      const focus =
        state.arrangement.find((a) => a.id === state.activeId) ||
        state.arrangement[0];
      for (const placed of state.arrangement) {
        const moduleGroup=new THREE.Group();moduleGroups.set(placed.id,moduleGroup);modelGroup.add(moduleGroup);
        const doorPivots=new Map<string,THREE.Group>();
        const m = placed.module,
          active = placed.id === focus.id;
        const origin=localToRoom(placed,0,0),center=moduleCenter(focus);
        moduleGroup.position.set(origin.x-center.x,placed.y??0,origin.z-center.z);moduleGroup.rotation.y=(placed.rotation??0)*Math.PI/180;moduleGroup.userData.base=moduleGroup.position.clone();
        for (const part of parts(m)) {
          const isMetal = part.material === "metal",
            isBack = part.material === "hdf",
            isFacade = part.role === "door" || part.id.endsWith(":facade");
          const wood =
            part.decor.includes("Дуб") || part.decor.includes("Орех");
          const mat = new THREE.MeshStandardMaterial({
            color: isMetal
              ? 0xbecad0
              : isBack
                ? 0xd7d5cc
                : wood
                  ? 0xd2b68d
                  : part.decor === "Графит"
                    ? 0x505653
                    : 0xe6e4dc,
            transparent: (state.transparent && (part.role === "body" || part.role === "door")) || (state.clearFacades && isFacade),
            opacity: state.transparent && (part.role === "body" || part.role === "door") ? 0.16 : state.clearFacades && isFacade ? 0.35 : 1,
            depthWrite: !((state.transparent && (part.role === "body" || part.role === "door")) || (state.clearFacades && isFacade)),
            roughness: isMetal ? 0.24 : 0.73,
            metalness: isMetal ? 0.8 : 0,
            ...(part.role === "light" ? { color: 0xfff1c9, emissive: 0xffd27a, emissiveIntensity: 1.4, metalness: 0, roughness: 0.4 } : {}),
          });
          const texture = catalog.find(
            (c) => c.n === part.decor,
          )?.tex;
          if (texture && !isBack && !isMetal && part.material !== "alu" && part.material !== "glass") {
            pendingTextures++;
            cachedTexture(texture).then(map=>{
              if(disposed||gen!==generation)return;
              mat.map=map;mat.color.set(0xffffff);mat.needsUpdate=true;needsRender=true;
            }).catch(()=>{}).finally(()=>{if(gen===generation)pendingTextures--;});
          }
          const isAlu = part.material === "alu" && !!m.alu;
          const geometry =
            (part.role === "rod" || part.role === "flange" || part.role === "fastener")
              ? new THREE.CylinderGeometry(
                  part.size[1] / 2,
                  part.size[1] / 2,
                  part.size[0],
                  24,
                )
              : isAlu ? aluFrameGeometry(part, aluProfile(m.alu!.profile)?.face ?? 19) : part.taper ? taperGeometry(part) : part.taperZ ? planTaperGeometry(part) : boardGeometry(part);
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
          const isMeshItem = part.id.endsWith(":mesh");
          const isHandle = part.role === "handle";
          if (isMeshItem || isHandle) { mat.transparent = true; mat.opacity = 0; mat.depthWrite = false; }
          const mesh = new THREE.Mesh(geometry, mat);
          if (isHandle) {
            // Ручка: невидимый бокс для выбора + модель из Blender. Модель: X вдоль, Y вверх по фасаду, выступ в −Z → разворот на 180°.
            const handle = handleById(m.handleId), vertical = part.size[1] > part.size[0];
            const holder = new THREE.Group();
            holder.rotation.z = vertical ? Math.PI / 2 : 0;
            holder.position.z = -part.size[2] / 2; // к плоскости фасада
            mesh.add(holder);
            const g = generation;
            pendingTextures++;
            loadHandleModel(handleModelFile(handle)).then((src) => {
              if (disposed || g !== generation) return;
              const model = src.clone(true);
              model.rotation.y = Math.PI; model.scale.setScalar(1000);
              const hm = new THREE.MeshStandardMaterial({ color: handleColour(handle), metalness: 0.85, roughness: 0.32 });
              model.traverse((o) => { o.userData = { partId: part.id, moduleId: placed.id, role: part.role, sectionId: part.sectionId, active, sharedGeometry: true }; if (o instanceof THREE.Mesh) { o.material = hm; o.castShadow = true; } });
              holder.add(model); needsRender = true;
            }).catch(() => { mat.opacity = 1; mat.transparent = false; mat.depthWrite = true; needsRender = true; }).finally(() => { if (g === generation) pendingTextures--; });
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
            const ins = aluInsert(m.alu!.insert), face = aluProfile(m.alu!.profile)?.face ?? 19;
            const glassMat = new THREE.MeshStandardMaterial(ins?.mirror ? { color: ins.id.includes("bronze") ? 0xb8a58c : ins.id.includes("graphite") ? 0x8d949a : 0xd6dee3, metalness: 0.55, roughness: 0.08 } : ins?.id.startsWith("lacobel") ? { color: ins.id.endsWith("black") ? 0x1b1b1b : 0xf4f4f2, metalness: 0.2, roughness: 0.15 } : { color: ins?.id === "satin" ? 0xf1f3f4 : ins?.id.includes("bronze") ? 0x8a6a45 : ins?.id.includes("graphite") ? 0x4a4f55 : 0xdfe8ec, transparent: true, opacity: ins?.id === "satin" ? 0.75 : state.clearFacades ? 0.25 : 0.45, roughness: 0.05, metalness: 0.1, depthWrite: false });
            const glass = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1, part.size[0] - 2 * face + 8), Math.max(1, part.size[1] - 2 * face + 8), 4), glassMat);
            glass.userData = { partId: part.id, moduleId: placed.id, role: part.role, sectionId: part.sectionId, active };
            mesh.add(glass);
          }
          if (part.role === "rod" || part.role === "flange") mesh.rotation.z = Math.PI / 2;
          if (part.role === "fastener") { if (part.size[0] > part.size[1]) mesh.rotation.z = Math.PI / 2; mat.color.set(part.id.startsWith("ecc:") ? 0x8d949a : 0x2f3235); mat.metalness = 0.6; mat.roughness = 0.5; }
          if (part.rotZ) mesh.rotation.z = (part.rotZ * Math.PI) / 180;
          const rotY = part.rotY ? (part.rotY * Math.PI) / 180 : 0;
          if (rotY) mesh.rotation.y = rotY;
          mesh.position.set(
            part.position[0],
            part.position[1],
            part.position[2],
          );
          const preview=state.drawerPreview;
          if(active&&preview&&(state.openDoors||!m.doors)&&part.id.startsWith(preview.sid+':drawer:'+preview.index+':')&&!part.id.includes(':slide:')){
            const section=m.sections.find(s=>s.id===preview.sid);if(section)mesh.position.z+=drawerConfig(m,section,preview.index).length*.8;
          }
          mesh.castShadow = true;
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
          if (part.role === "door" && state.openDoors && part.id !== "slope-filler") {
            // Петлевая ось — на краю фасада; при скосе фронта фасад повёрнут, ось сдвигается вдоль его наклонной линии.
            const pivot = new THREE.Group();
            pivot.position.copy(mesh.position);
            const sign=part.hinge==='right'?-1:1;
            const hingeOff=new THREE.Vector3(sign*part.size[0]/2,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),rotY);
            pivot.position.sub(hingeOff);
            mesh.position.set(sign*part.size[0] / 2, 0, 0);mesh.rotation.y=0;
            pivot.add(mesh);
            pivot.rotation.y = rotY-Math.PI * 0.58*sign;pivot.userData.rotY=rotY;
            doorPivots.set(part.id,pivot);moduleGroup.add(pivot);
          } else if(part.role==='handle' && doorPivots.has(part.id.replace(':handle:',':door:'))){
            const pivot=doorPivots.get(part.id.replace(':handle:',':door:'))!;mesh.position.sub(pivot.position).applyAxisAngle(new THREE.Vector3(0,1,0),-(pivot.userData.rotY as number));mesh.rotation.y=0;pivot.add(mesh);
          } else moduleGroup.add(mesh);
          const selectedPart=active&&!state.presentation?state.selectedPart:undefined;
          const drawerPrefix=selectedPart?.includes(':drawer:')?selectedPart.split(':drawer:')[0]+':drawer:'+selectedPart.split(':drawer:')[1].split(':')[0]+':':undefined;
          const picked=!!selectedPart&&(drawerPrefix?part.id.startsWith(drawerPrefix):part.id===selectedPart);
          if (!isMetal || picked) {
            const edge = new THREE.LineSegments(
              new THREE.EdgesGeometry(geometry),
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
        if(!state.presentation&&state.mode==='move'&&state.groupIds?.includes(placed.id)){
          const box=new THREE.BoxGeometry(m.width+3,m.height+3,m.depth+3);
          const guide=new THREE.LineSegments(new THREE.EdgesGeometry(box),new THREE.LineBasicMaterial({color:0x168976,transparent:true,opacity:.85,depthTest:false}));
          box.dispose();guide.position.set(m.width/2,m.height/2,m.depth/2);guide.userData.captureGuide=true;guide.renderOrder=10;moduleGroup.add(guide);
        }
      }
      if (state.room) {
        const r = state.room,
          x0 = -moduleCenter(focus).x,
          z0 = -moduleCenter(focus).z;
        const geo = new THREE.BoxGeometry(r.width, r.height, r.depth);
        const outline = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({
            color: 0x8dabb4,
            transparent: true,
            opacity: 0.5,
          }),
        );
        geo.dispose();
        outline.position.set(x0 + r.width / 2, r.height / 2, z0 + r.depth / 2);
        modelGroup.add(outline);
        function wallBox(wall:string,u:number,y:number,w:number,h:number,depth:number,color:number,opacity:number){
          const horizontal=wall==='back'||wall==='front';
          const mesh=new THREE.Mesh(new THREE.BoxGeometry(horizontal?w:depth,h,horizontal?depth:w),new THREE.MeshStandardMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1}));
          mesh.position.set(horizontal?x0+u:x0+(wall==='left'?-depth/2:r.width+depth/2),y,horizontal?z0+(wall==='back'?-depth/2:r.depth+depth/2):z0+u);mesh.receiveShadow=true;modelGroup.add(mesh);
        }
        for(const panel of wallPanels(r))wallBox(panel.wall,panel.u,panel.y,panel.width,panel.height,80,0xd5d5cc,panel.wall==='front'||panel.wall==='right'?0.06:0.25);
        for(const o of r.openings||[]){
          const u=o.offset+o.width/2,y=o.sill+o.height/2;
          for(const dx of [-o.width/2+20,o.width/2-20])wallBox(o.wall,u+dx,y,40,o.height,85,0xfafaf6,0.95);
          wallBox(o.wall,u,o.sill+o.height-20,o.width,40,85,0xfafaf6,0.95);
          if(o.type==='window'){
            wallBox(o.wall,u,o.sill+20,o.width,40,85,0xfafaf6,0.95);wallBox(o.wall,u,y,40,o.height,85,0xfafaf6,0.95);
            wallBox(o.wall,u,y,o.width-80,o.height-80,4,0x8cbac6,0.2);
          }else wallBox(o.wall,u,y,o.width-80,o.height-40,35,0xaa8e6d,0.3);
        }
        for(const o of r.obstacles||[]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(o.width,o.height,o.depth),new THREE.MeshStandardMaterial({color:o.type==='radiator'?0xd9e0e4:0xc7bcae,roughness:.85}));mesh.userData.obstacleId=o.id;mesh.position.set(x0+o.x+o.width/2,o.y+o.height/2,z0+o.z+o.depth/2);mesh.castShadow=true;mesh.receiveShadow=true;modelGroup.add(mesh);const edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:!state.presentation&&state.selectedObstacle===o.id?0x087f94:0x786d62,transparent:true,opacity:!state.presentation&&state.selectedObstacle===o.id?1:.5}));edge.userData.captureGuide=!state.presentation&&state.selectedObstacle===o.id;mesh.add(edge);}
        // Объекты замера на стенах (розетки, батареи, короба, трубы…): боксы или цилиндры на своей стене.
        for(const [fi,f] of (r.fixtures||[]).entries()){
          const spec=FIXTURES[f.type],box=fixtureBox(r,f);
          const recess=spec.recess,d=recess?f.depth:Math.max(2,box.w&&box.d?(f.wall==='back'||f.wall==='front'?box.d:box.w):2);
          const horizontal=f.wall==='back'||f.wall==='front';
          const geo=f.round?new THREE.CylinderGeometry(Math.min(f.width,f.height)/2,Math.min(f.width,f.height)/2,f.horizontal?f.width:f.height,20):new THREE.BoxGeometry(horizontal?f.width:d,f.height,horizontal?d:f.width);
          const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:spec.color,roughness:.8,metalness:f.round?.4:0,transparent:recess,opacity:recess?.35:1}));
          const cx=horizontal?x0+f.offset+f.width/2:x0+(f.wall==='left'?(recess?-f.depth/2:d/2):r.width-(recess?-f.depth/2:d/2));
          const cz=horizontal?z0+(f.wall==='back'?(recess?-f.depth/2:d/2):r.depth-(recess?-f.depth/2:d/2)):z0+f.offset+f.width/2;
          mesh.position.set(cx,f.fromFloor+f.height/2,cz);
          if(f.round&&f.horizontal)mesh.rotation.z=horizontal?Math.PI/2:0,mesh.rotation.x=horizontal?0:Math.PI/2;
          if(f.round&&!f.horizontal&&!horizontal)mesh.rotation.y=0;
          mesh.userData.fixtureId=f.id;mesh.castShadow=true;mesh.receiveShadow=true;modelGroup.add(mesh);
          const edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:state.selectedFixture===f.id?0x087f94:0x6f6a60,transparent:true,opacity:state.selectedFixture===f.id?1:.45}));mesh.add(edge);
          if(!state.presentation)label(fixtureLabel(f,fi),new THREE.Vector3(cx,f.fromFloor+f.height+40,cz),()=>current.current.onFixtureSelect?.(f.id),true);
        }
        // Размеры помещения и выбранного проёма/объекта прямо в 3D: клик по числу — правка (как у корпуса).
        if(!state.presentation&&state.onRoomDimension){
          const dim=state.onRoomDimension;
          roomLabel(`${r.width} мм`,new THREE.Vector3(x0+r.width/2,-60,z0+r.depth+80),()=>dim('room','','width',r.width));
          roomLabel(`${r.depth} мм`,new THREE.Vector3(x0+r.width+80,-60,z0+r.depth/2),()=>dim('room','','depth',r.depth));
          roomLabel(`${r.height} мм`,new THREE.Vector3(x0-80,r.height/2,z0+r.depth+40),()=>dim('room','','height',r.height));
          const wallPoint=(wall:string,u:number,y:number,out=60)=>{const horizontal=wall==='back'||wall==='front';return horizontal?new THREE.Vector3(x0+u,y,z0+(wall==='back'?out:r.depth-out)):new THREE.Vector3(x0+(wall==='left'?out:r.width-out),y,z0+u);};
          // Подписи не накрывают объект: ширина — над ним, «от угла / до угла» — по бокам на его высоте, «от пола» — под ним.
          const chain=(kind:'opening'|'fixture',id:string,wall:string,offset:number,width:number,y:number,top:number,extra?:[string,number,string])=>{
            const len=wall==='back'||wall==='front'?r.width:r.depth,rest=len-offset-width;
            roomLabel(`${Math.round(offset)} от угла`,wallPoint(wall,offset/2,y),()=>dim(kind,id,'offset',offset),true);
            roomLabel(`${Math.round(width)} мм`,wallPoint(wall,offset+width/2,top+90,40),()=>dim(kind,id,'width',width));
            roomLabel(`${Math.round(rest)} до угла`,wallPoint(wall,offset+width+rest/2,y),()=>dim(kind,id,'end',rest),true);
            if(extra)roomLabel(extra[0],wallPoint(wall,offset+width/2,extra[1],40),()=>dim(kind,id,extra[2],extra[1]),true);
          };
          const o=(r.openings||[]).find(o=>o.id===state.selectedOpening);
          if(o)chain('opening',o.id,o.wall,o.offset,o.width,o.sill+o.height/2,o.sill+o.height,o.type==='window'?[`${o.sill} от пола`,o.sill/2,'sill']:[`высота ${o.height}`,o.sill+o.height/2-120,'height']);
          const fsel=(r.fixtures||[]).find(f=>f.id===state.selectedFixture);
          if(fsel)chain('fixture',fsel.id,fsel.wall,fsel.offset,fsel.width,fsel.fromFloor+fsel.height/2,fsel.fromFloor+fsel.height,[`${fsel.fromFloor} от пола`,Math.max(40,fsel.fromFloor/2),'fromFloor']);
        }
        const roomFloor=new THREE.Mesh(new THREE.PlaneGeometry(r.width,r.depth),new THREE.MeshStandardMaterial({color:0xdcd6ca,roughness:0.9}));roomFloor.rotation.x=-Math.PI/2;roomFloor.position.set(x0+r.width/2,-3,z0+r.depth/2);roomFloor.receiveShadow=true;modelGroup.add(roomFloor);
      }
      const b = boxes(m).find((b) => b.id === state.selected);
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
        if (sec && sec.drawers > 0 && (state.selectedPart?.includes(":drawer:") || state.drawerPreview)) {
          const fy = focus.y ?? 0, zz = m.depth / 2 + 30, gx = b.x - m.width / 2 + 40;
          const top = b.bottom + drawerStackHeight(sec) + RULES.panel;
          line([new THREE.Vector3(gx, b.bottom + fy, zz), new THREE.Vector3(gx, top + fy, zz)]);
          for (const yy of [b.bottom, top]) line([new THREE.Vector3(gx - 30, yy + fy, zz), new THREE.Vector3(gx + 30, yy + fy, zz)]);
          label(`${Math.round(top - b.bottom)} мм от дна`, new THREE.Vector3(gx, (b.bottom + top) / 2 + fy, zz + 10), () => current.current.onDrawerStack?.(b.id), true);
        }
      }
      if (state.dimensions) {
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
          b &&
          m.sections.find((s) => s.id === b.id)!.shelves.length &&
          (!m.doors||state.openDoors||state.transparent) &&
          !state.exploded
        ) {
          shelfGaps(m, b.id).forEach((g, i) => {
            const gx = b.x + b.width / 2 - m.width / 2;
            line([
              new THREE.Vector3(gx, g.bottom+fy, z - 85),
              new THREE.Vector3(gx, g.top+fy, z - 85),
            ]);
            label(
              String(g.height),
              new THREE.Vector3(gx, (g.top + g.bottom) / 2+(focus.y??0), z - 75),
              () => current.current.onGap(i),
              true,
            );
          });
        }
      }
    }
    function fit() {
      needsRender=true;
      const m = current.current.module;
      const aspect = target.clientWidth / Math.max(1, target.clientHeight);
      const state = current.current,
        focus =
          state.arrangement.find((a) => a.id === state.activeId) ||
          state.arrangement[0];
      const items=state.focusActive?[focus]:state.arrangement,room=state.focusActive?undefined:state.room;
      const minX=Math.min(...items.map(a=>bounds(a).x)),maxX=Math.max(...items.map(a=>bounds(a).x+bounds(a).w));
      const minZ=Math.min(...items.map(a=>bounds(a).z)),maxZ=Math.max(...items.map(a=>bounds(a).z+bounds(a).d));
      const minY=state.focusActive?(focus.y??0):0;
      const height=room?room.height:Math.max(...items.map(a=>a.module.height+(a.y??0)))-minY;
      const width=room?room.width:maxX-minX,depth=room?room.depth:maxZ-minZ;
      const center=new THREE.Vector3((room?room.width/2:(minX+maxX)/2)-moduleCenter(focus).x,minY+height/2,(room?room.depth/2:(minZ+maxZ)/2)-moduleCenter(focus).z);
      controls.target.copy(center);
      const view = current.current.view;
      camera=view==='iso'?perspective:orthographic;controls.object=camera;
      const dir =
        view === "front"
          ? new THREE.Vector3(0, 0, 1)
          : view === "side"
            ? new THREE.Vector3(1, 0, 0.001)
            : view === "top"
              ? new THREE.Vector3(0, 1, 0.001)
              : new THREE.Vector3(1, 0.55, 1.7).normalize();
      if(view==="front"||view==="side")dir.applyAxisAngle(new THREE.Vector3(0,1,0),(focus.rotation??0)*Math.PI/180);
      const padding=state.presentation?50:state.dimensions?500:180;
      const dist=frameDistance({x:width+padding,y:height+padding,z:depth+padding},dir,aspect,perspective.fov,1.08);
      if(camera===orthographic){const h=frameHeight({x:width+padding,y:height+padding,z:depth+padding},dir,aspect,1.08);orthographic.left=-h*aspect/2;orthographic.right=h*aspect/2;orthographic.top=h/2;orthographic.bottom=-h/2;orthographic.zoom=1;}else perspective.aspect=aspect;
      camera.updateProjectionMatrix();
      camera.up.set(0, 1, 0);
      camera.position.copy(center).addScaledVector(dir, dist);
      controls.update();
    }
    let initial = true;
    const observer = new ResizeObserver(() => {
      if (!target.clientWidth || !target.clientHeight) return;
      renderer.setSize(target.clientWidth, target.clientHeight);
      perspective.aspect = target.clientWidth / target.clientHeight;
      camera.updateProjectionMatrix();
      fit();
      if (initial) {
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
      const center=moduleCenter(focus),pos=localToRoom(a,b.x+b.width/2,a.module.depth/2);
      dropTarget.position.set(pos.x-center.x,(a.y??0)+(b.bottom+b.top)/2,pos.z-center.z);
      dropTarget.rotation.y=(a.rotation??0)*Math.PI/180;dropTarget.scale.set(b.width,b.top-b.bottom,a.module.depth);dropTarget.visible=true;
      return 'Корпус '+(state.arrangement.indexOf(a)+1)+' · секция '+(a.module.sections.findIndex(s=>s.id===sid)+1);
    }

    function cast(clientX:number,clientY:number){const r=renderer.domElement.getBoundingClientRect();pointer.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);}
    function hitAt(clientX:number,clientY:number,allowShell=false){cast(clientX,clientY);return ray.intersectObjects(modelGroup.children,true).find(h=>h.object instanceof THREE.Mesh&&h.object.userData.moduleId&&!(drag?.kind==='part'&&drag.moved&&drag.meshes.includes(h.object))&&!(!allowShell&&current.current.transparent&&['body','door'].includes(h.object.userData.role)&&!h.object.userData.partId?.endsWith(':divider')));}
    function sectionFor(hit:THREE.Intersection){const a=current.current.arrangement.find(a=>a.id===hit.object.userData.moduleId)!;const focus=current.current.arrangement.find(a=>a.id===current.current.activeId)!;const center=moduleCenter(focus),xx=roomToLocal(a,hit.point.x+center.x,hit.point.z+center.z).x;return hit.object.userData.sectionId||boxes(a.module).find(b=>xx>=b.x&&xx<=b.x+b.width)?.id||a.module.sections[0].id;}
    function pointerDown(e:PointerEvent){
      if(e.button!==0||current.current.mode==='orbit')return;
      cast(e.clientX,e.clientY);const first=ray.intersectObjects(modelGroup.children,true).find(h=>h.object instanceof THREE.Mesh&&(h.object.userData.obstacleId||h.object.userData.fixtureId||h.object.userData.moduleId));
      if(first?.object.userData.obstacleId){current.current.onObstacleSelect(first.object.userData.obstacleId);return;}
      if(first?.object.userData.fixtureId){current.current.onFixtureSelect?.(first.object.userData.fixtureId);return;}
      const hit=hitAt(e.clientX,e.clientY);if(!hit)return;
      const state=current.current,a=state.arrangement.find(a=>a.id===hit.object.userData.moduleId)!;
      const sid=sectionFor(hit),pid=hit.object.userData.partId as string;
      // Клик по ручке в любом режиме открывает выбор ручки для этого корпуса.
      if(hit.object.userData.role==='handle'&&state.onHandleClick&&!state.presentation){if(a.id!==state.activeId)state.onModuleSelect(a.id);state.onHandleClick(a.id);return;}
      const isPart=state.mode==='fill'&&(['shelf','drawer','rod','pantograph','flange'].includes(hit.object.userData.role)||(hit.object.userData.role==='handle'&&pid.includes(':drawer:')))&&!pid.includes(':drawer-cap');
      const isDivider=state.mode==='fill'&&pid.endsWith(':divider');
      if(state.mode==='fill'&&!isPart&&!isDivider){if(a.id!==state.activeId)state.onModuleSelect(a.id);else state.onPartSelect(sid,pid);return;}
      const normal=isPart||isDivider||state.view==='front'?new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),(a.rotation??0)*Math.PI/180):new THREE.Vector3(0,1,0);
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
    function contextMenu(e:MouseEvent){
      e.preventDefault();if(current.current.presentation)return;
      const hit=hitAt(e.clientX,e.clientY,true);if(!hit)return;
      const a=current.current.arrangement.find(a=>a.id===hit.object.userData.moduleId);if(!a)return;
      current.current.onContextMenu?.(a.id,sectionFor(hit),e.clientX,e.clientY);
    }
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
    api.current = { rebuild, fit };
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
      needsRender=false;renderer.render(scene, camera);
      for (const l of labels) {
        const v = l.position.clone().project(camera);
        l.element.style.left = ((v.x + 1) / 2) * target.clientWidth + "px";
        l.element.style.top = ((-v.y + 1) / 2) * target.clientHeight + "px";
        l.element.style.display = v.z < 1 && v.z > -1 ? "" : "none";
      }
      }
      frame = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      disposed = true;
      current.current.captureReady(undefined);
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.removeEventListener('change',requestRender);controls.dispose();
      disposeGroup(modelGroup);
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      for (const l of labels) l.element.remove();
      window.removeEventListener('keydown',key);renderer.domElement.removeEventListener('contextmenu',contextMenu);target.removeEventListener('dragover',dragOver);target.removeEventListener('drop',drop);target.removeEventListener('dragleave',dragLeave);targetGeometry.dispose();targetMaterial.dispose();badge.remove();
      sun.shadow.dispose();
      for(const texture of loadedTextures)texture.dispose();loadedTextures.clear();textureLoads.clear();
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
      p.selectedObstacle,
      p.selectedFixture,
      p.selectedOpening,
      p.groupIds?.join(','),
      p.mode,
      p.transparent,
      p.clearFacades,
      p.selected,
      p.selectedPart,
      p.texture,
      p.facadeTexture,
      p.openDoors,
      p.exploded,
      p.dimensions,
      p.presentation,
      p.drawerPreview?.sid,
      p.drawerPreview?.index,
    ],
  );
  useEffect(
    () => api.current?.fit(),
    [
      p.view,
      p.fit,
      p.focusActive,
      p.activeId,
      p.room,
      p.selectedObstacle,
      p.arrangement.length,
      p.module.width,
      p.module.height,
      p.module.depth,
      p.arrangement.find(a=>a.id===p.activeId)?.rotation,
    ],
  );
  useEffect(()=>{const action=p.presentation||p.mode==='orbit'?'Перетаскивание — поворот вида':p.mode==='fill'?'Перетаскивайте полки и ящики по высоте, перегородки по ширине':p.moveAll?'Перетаскивание корпуса перемещает всю композицию':'Перетаскивайте корпуса для расстановки';host.current?.querySelector('canvas')?.setAttribute('aria-label','3D-модель мебели. '+action+'. Колесо — масштаб.');},[p.mode,p.moveAll,p.presentation]);
  return (
    <div className="scene" ref={host} data-testid="scene">
      {error && (
        <div className="scene-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}





