import {frameDistance,frameHeight} from './framing';
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { boxes, parts, shelfGaps, drawerConfig, type Module } from "./model";
import { catalog } from "./catalog";
import {localToRoom,roomToLocal,moduleCenter,bounds,type Room,type PlacedModule} from "./project";
import {wallPanels} from './roomGeometry';
export type View = "iso" | "front" | "side" | "top";
type Props = {
  captureReady: (fn: (() => string) | undefined) => void;
  module: Module;
  mode:'move'|'fill'|'orbit';
  moveAll:boolean;
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
  transparent: boolean;
  onModuleSelect: (id: string) => void;
  onDimension: (key: "width" | "height" | "depth") => void;
  onGap: (index: number) => void;
  onPartSelect: (sid: string, pid: string) => void;
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
    let generation = 0;
    function disposeGroup(group: THREE.Group) {
      group.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Line ||
          o instanceof THREE.Sprite
        ) {
          o.geometry?.dispose();
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
      generation++;
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
            isBack = part.material === "hdf";
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
            transparent: state.transparent && (part.role === "body" || part.role === "door"),
            opacity: state.transparent && (part.role === "body" || part.role === "door") ? 0.16 : 1,
            depthWrite: !(state.transparent && (part.role === "body" || part.role === "door")),
            roughness: isMetal ? 0.24 : 0.73,
            metalness: isMetal ? 0.8 : 0,
          });
          const texture = catalog.find(
            (c) => c.n === part.decor,
          )?.tex;
          if (texture && !isBack && !isMetal) {
            cachedTexture(texture).then(map=>{
              if(disposed||gen!==generation)return;
              mat.map=map;mat.color.set(0xffffff);mat.needsUpdate=true;needsRender=true;
            }).catch(()=>{});
          }
          const geometry =
            (part.role === "rod" || part.role === "flange")
              ? new THREE.CylinderGeometry(
                  part.size[1] / 2,
                  part.size[1] / 2,
                  part.size[0],
                  24,
                )
              : new THREE.BoxGeometry(...part.size);
          const mesh = new THREE.Mesh(geometry, mat);
          if (part.role === "rod" || part.role === "flange") mesh.rotation.z = Math.PI / 2;
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
          if (part.role === "door" && state.openDoors) {
            const pivot = new THREE.Group();
            pivot.position.copy(mesh.position);
            const sign=part.hinge==='right'?-1:1;
            pivot.position.x -= sign*part.size[0] / 2;
            mesh.position.set(sign*part.size[0] / 2, 0, 0);
            pivot.add(mesh);
            pivot.rotation.y = -Math.PI * 0.58*sign;
            doorPivots.set(part.id,pivot);moduleGroup.add(pivot);
          } else if(part.role==='handle' && doorPivots.has(part.id.replace(':handle:',':door:'))){
            const pivot=doorPivots.get(part.id.replace(':handle:',':door:'))!;mesh.position.sub(pivot.position);pivot.add(mesh);
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
            mesh.add(edge);
          }
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
        for(const o of r.obstacles||[]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(o.width,o.height,o.depth),new THREE.MeshStandardMaterial({color:o.type==='radiator'?0xd9e0e4:0xc7bcae,roughness:.85}));mesh.userData.obstacleId=o.id;mesh.position.set(x0+o.x+o.width/2,o.y+o.height/2,z0+o.z+o.depth/2);mesh.castShadow=true;mesh.receiveShadow=true;modelGroup.add(mesh);const edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:!state.presentation&&state.selectedObstacle===o.id?0x087f94:0x786d62,transparent:true,opacity:!state.presentation&&state.selectedObstacle===o.id?1:.5}));mesh.add(edge);}
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
      cast(e.clientX,e.clientY);const first=ray.intersectObjects(modelGroup.children,true).find(h=>h.object instanceof THREE.Mesh&&(h.object.userData.obstacleId||h.object.userData.moduleId));
      if(first?.object.userData.obstacleId){current.current.onObstacleSelect(first.object.userData.obstacleId);return;}
      const hit=hitAt(e.clientX,e.clientY);if(!hit)return;
      const state=current.current,a=state.arrangement.find(a=>a.id===hit.object.userData.moduleId)!;
      const sid=sectionFor(hit),pid=hit.object.userData.partId as string;
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
        drag.candidate=next;for(const [mid,group] of moduleGroups)if(current.current.moveAll||mid===drag.mid)group.position.copy(group.userData.base).add(new THREE.Vector3(next.x-drag.origin.x,next.y-drag.origin.y,next.z-drag.origin.z));const problem=current.current.moveProblem(drag.mid,next);badge.classList.toggle('invalid',!!problem);badge.textContent=problem||(current.current.moveAll?'Вся композиция · ':'')+(e.altKey?'Без привязки · ':'')+'Положение: '+next.x+' / '+next.y+' / '+next.z+' мм';
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
      }else{if(d.mid!==current.current.activeId)current.current.onModuleSelect(d.mid);else current.current.onPartSelect(d.sid,d.pid);}
      resetDrag();if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
    }
    function dragOver(e:DragEvent){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';badge.hidden=false;const destination=indicateTarget(hitAt(e.clientX,e.clientY,true));badge.textContent=destination?'Отпустите: '+destination:'Перетащите внутрь корпуса';}
    function drop(e:DragEvent){needsRender=true;e.preventDefault();badge.hidden=true;dropTarget.visible=false;const kind=e.dataTransfer?.getData('application/x-furniture');if(!kind)return;const hit=hitAt(e.clientX,e.clientY,true);if(!hit)return;const placed=current.current.arrangement.find(a=>a.id===hit.object.userData.moduleId)!;current.current.onDropItem(kind,placed.id,sectionFor(hit),hit.point.y-(placed.y??0));}
    function key(e:KeyboardEvent){if(e.key==='Escape')resetDrag();}
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
      const size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio(),background=scene.background,gridVisible=grid.visible;
      const guides=modelGroup.children.filter(o=>o instanceof THREE.Line||o instanceof THREE.LineSegments),visibility=guides.map(o=>o.visible);
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
      window.removeEventListener('keydown',key);target.removeEventListener('dragover',dragOver);target.removeEventListener('drop',drop);target.removeEventListener('dragleave',dragLeave);targetGeometry.dispose();targetMaterial.dispose();badge.remove();
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
      p.transparent,
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





