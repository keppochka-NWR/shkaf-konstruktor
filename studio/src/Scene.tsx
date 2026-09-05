import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { boxes, parts, shelfGaps, type Module } from "./model";
import { catalog } from "./catalog";
import type { Room, PlacedModule } from "./project";
import {wallPanels} from './roomGeometry';
export type View = "iso" | "front" | "side" | "top";
type Props = {
  captureReady: (fn: (() => string) | undefined) => void;
  module: Module;
  mode:'move'|'fill'|'orbit';
  snap:(id:string,p:{x:number;y:number;z:number})=>{x:number;y:number;z:number};
  onMoveModule:(id:string,p:{x:number;y:number;z:number})=>boolean;
  onMovePart:(mid:string,sid:string,pid:string,y:number)=>boolean;
  onDropItem:(kind:string,mid:string,sid:string,y:number)=>boolean;
  onTransfer:(mid:string,sid:string,pid:string,toMid:string,toSid:string,y:number)=>boolean;
  arrangement: PlacedModule[];
  activeId: string;
  room?: Room;
  transparent: boolean;
  onModuleSelect: (id: string) => void;
  onDimension: (key: "width" | "height" | "depth") => void;
  onGap: (index: number) => void;
  onPartSelect: (sid: string, pid: string) => void;
  selected: string;
  onSelect: (id: string) => void;
  texture?: string;
  facadeTexture?: string;
  view: View;
  fit: number;
  openDoors: boolean;
  exploded: boolean;
  dimensions: boolean;
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
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(34, 1, 5, 250000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = 350;
    controls.maxDistance = 150000;
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
            if ("map" in mat && (mat as THREE.MeshStandardMaterial).map)
              (mat as THREE.MeshStandardMaterial).map?.dispose();
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
      modelGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color: 0x71919d, depthTest: false }),
        ),
      );
    }
    function rebuild() {
      const state = current.current,
        m = state.module;
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
        const dx = placed.x + m.width / 2 - focus.x - state.module.width / 2;
        const dz = placed.z + m.depth / 2 - focus.z - state.module.depth / 2;
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
            loader.load(
              texture,
              (map) => {
                if (disposed || gen !== generation) {
                  map.dispose();
                  return;
                }
                map.colorSpace = THREE.SRGBColorSpace;
                map.anisotropy = Math.min(
                  8,
                  renderer.capabilities.getMaxAnisotropy(),
                );
                mat.map = map;
                mat.color.set(0xffffff);
                mat.needsUpdate = true;
              },
              undefined,
              () => {},
            );
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
            part.position[0] - m.width / 2 + dx,
            part.position[1]+(placed.y??0),
            part.position[2] - m.depth / 2 + dz,
          );
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
            mesh.position.x *= 1.3;
            mesh.position.y =
              (mesh.position.y - m.height / 2) * 1.18 + m.height / 2;
            mesh.position.z *= 1.6;
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
          if (!isMetal) {
            const edge = new THREE.LineSegments(
              new THREE.EdgesGeometry(geometry),
              new THREE.LineBasicMaterial({
                color: 0x4a4b40,
                transparent: true,
                opacity: 0.16,
              }),
            );
            mesh.add(edge);
          }
        }
      }
      if (state.room) {
        const r = state.room,
          x0 = -focus.x - m.width / 2,
          z0 = -focus.z - m.depth / 2;
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
      const m = current.current.module;
      const aspect = target.clientWidth / Math.max(1, target.clientHeight);
      const state = current.current,
        focus =
          state.arrangement.find((a) => a.id === state.activeId) ||
          state.arrangement[0];
      const minX = Math.min(...state.arrangement.map((a) => a.x)),
        maxX = Math.max(...state.arrangement.map((a) => a.x + a.module.width));
      const minZ = Math.min(...state.arrangement.map((a) => a.z)),
        maxZ = Math.max(...state.arrangement.map((a) => a.z + a.module.depth));
      const height = state.room
        ? state.room.height + 380
        : Math.max(...state.arrangement.map((a) => a.module.height+(a.y??0))) + 380;
      const width = state.room
        ? state.room.width + state.room.depth
        : maxX - minX + maxZ - minZ + 650;
      const dist =
        (Math.max(height, width / aspect) /
          (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
        1.1;
      const center = new THREE.Vector3(
        (state.room ? state.room.width / 2 : (minX + maxX) / 2) -
          focus.x -
          m.width / 2,
        height / 2 - 240,
        (state.room ? state.room.depth / 2 : (minZ + maxZ) / 2) -
          focus.z -
          m.depth / 2,
      );
      controls.target.copy(center);
      const view = current.current.view;
      const dir =
        view === "front"
          ? new THREE.Vector3(0, 0, 1)
          : view === "side"
            ? new THREE.Vector3(1, 0, 0.001)
            : view === "top"
              ? new THREE.Vector3(0, 1, 0.001)
              : new THREE.Vector3(1, 0.55, 1.7).normalize();
      camera.up.set(0, 1, 0);
      camera.position.copy(center).addScaledVector(dir, dist);
      controls.update();
    }
    let initial = true;
    const observer = new ResizeObserver(() => {
      if (!target.clientWidth || !target.clientHeight) return;
      renderer.setSize(target.clientWidth, target.clientHeight);
      camera.aspect = target.clientWidth / target.clientHeight;
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
    type Drag={mid:string;sid:string;pid:string;kind:'module'|'part';plane:THREE.Plane;anchor:THREE.Vector3;origin:{x:number;y:number;z:number};point:[number,number];moved:boolean;candidate:{x:number;y:number;z:number};meshes:THREE.Object3D[];delta:number};
    let drag:Drag|null=null;
    function cast(clientX:number,clientY:number){const r=renderer.domElement.getBoundingClientRect();pointer.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);}
    function hitAt(clientX:number,clientY:number,allowShell=false){cast(clientX,clientY);return ray.intersectObjects(modelGroup.children,true).find(h=>h.object instanceof THREE.Mesh&&h.object.userData.moduleId&&!(!allowShell&&current.current.transparent&&['body','door'].includes(h.object.userData.role)));}
    function sectionFor(hit:THREE.Intersection){const a=current.current.arrangement.find(a=>a.id===hit.object.userData.moduleId)!;const focus=current.current.arrangement.find(a=>a.id===current.current.activeId)!;const xx=hit.point.x+focus.x+focus.module.width/2-a.x;return hit.object.userData.sectionId||boxes(a.module).find(b=>xx>=b.x&&xx<=b.x+b.width)?.id||a.module.sections[0].id;}
    function pointerDown(e:PointerEvent){
      if(e.button!==0||current.current.mode==='orbit')return;
      const hit=hitAt(e.clientX,e.clientY);if(!hit)return;
      const state=current.current,a=state.arrangement.find(a=>a.id===hit.object.userData.moduleId)!;
      const sid=sectionFor(hit),pid=hit.object.userData.partId as string;
      const isPart=state.mode==='fill'&&['shelf','drawer','rod','pantograph','flange'].includes(hit.object.userData.role)&&!pid.includes(':drawer-cap');
      const plane=new THREE.Plane(isPart||state.view==='front'?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0),isPart||state.view==='front'?-hit.point.z:-hit.point.y);
      const anchor=new THREE.Vector3();if(!ray.ray.intersectPlane(plane,anchor))return;
      const meshes:THREE.Object3D[]=[];const prefix=pid.includes(':pantograph:')?sid+':pantograph:':pid.includes(':drawer:')?pid.split(':drawer:')[0]+':drawer:'+pid.split(':drawer:')[1].split(':')[0]+':':pid;
      moduleGroups.get(a.id)?.traverse(o=>{if(o instanceof THREE.Mesh&&(o.userData.partId===pid||o.userData.partId?.startsWith(prefix)||((pid===sid+':rod'||pid.includes(':flange:'))&&(o.userData.partId===sid+':rod'||o.userData.partId?.startsWith(sid+':flange:')))))meshes.push(o);});
      drag={mid:a.id,sid,pid,kind:isPart?'part':'module',plane,anchor,origin:{x:a.x,y:a.y??0,z:a.z},point:[e.clientX,e.clientY],moved:false,candidate:{x:a.x,y:a.y??0,z:a.z},meshes,delta:0};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);
    }
    function pointerMove(e:PointerEvent){
      if(!drag)return;if(!drag.moved&&Math.hypot(e.clientX-drag.point[0],e.clientY-drag.point[1])<4)return;
      drag.moved=true;cast(e.clientX,e.clientY);const point=new THREE.Vector3();if(!ray.ray.intersectPlane(drag.plane,point))return;point.sub(drag.anchor);badge.hidden=false;
      if(drag.kind==='module'){
        const next=current.current.snap(drag.mid,{x:drag.origin.x+point.x,y:current.current.view==='front'?Math.max(0,drag.origin.y+point.y):drag.origin.y,z:current.current.view==='front'?drag.origin.z:drag.origin.z+point.z});
        drag.candidate=next;moduleGroups.get(drag.mid)?.position.set(next.x-drag.origin.x,next.y-drag.origin.y,next.z-drag.origin.z);badge.textContent='Положение: '+next.x+' / '+next.y+' / '+next.z+' мм';
      }else{const dy=Math.round(point.y/5)*5;for(const mesh of drag.meshes)mesh.position.y+=dy-drag.delta;drag.delta=dy;badge.textContent='Перемещение: '+(dy>0?'+':'')+dy+' мм';}
    }
    function resetDrag(){if(!drag)return;if(drag.kind==='module')moduleGroups.get(drag.mid)?.position.set(0,0,0);else for(const mesh of drag.meshes)mesh.position.y-=drag.delta;drag=null;badge.hidden=true;controls.enabled=true;}
    function pointerUp(e:PointerEvent){
      if(!drag){if(current.current.mode==='orbit')return;return;}
      const d=drag;
      if(d.moved){
        if(d.kind==='module')current.current.onMoveModule(d.mid,d.candidate);
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
    function dragOver(e:DragEvent){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';badge.hidden=false;badge.textContent='Отпустите внутри нужного корпуса';}
    function drop(e:DragEvent){e.preventDefault();badge.hidden=true;const kind=e.dataTransfer?.getData('application/x-furniture');if(!kind)return;const hit=hitAt(e.clientX,e.clientY,true);if(!hit)return;const placed=current.current.arrangement.find(a=>a.id===hit.object.userData.moduleId)!;current.current.onDropItem(kind,placed.id,sectionFor(hit),hit.point.y-(placed.y??0));}
    function key(e:KeyboardEvent){if(e.key==='Escape')resetDrag();}
    renderer.domElement.addEventListener('pointerdown',pointerDown);
    renderer.domElement.addEventListener('pointermove',pointerMove);
    renderer.domElement.addEventListener('pointerup',pointerUp);
    renderer.domElement.addEventListener('pointercancel',resetDrag);
    target.addEventListener('dragover',dragOver);target.addEventListener('drop',drop);target.addEventListener('dragleave',()=>badge.hidden=true);window.addEventListener('keydown',key);
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
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    });
    let frame = 0;
    function animate() {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      for (const l of labels) {
        const v = l.position.clone().project(camera);
        l.element.style.left = ((v.x + 1) / 2) * target.clientWidth + "px";
        l.element.style.top = ((-v.y + 1) / 2) * target.clientHeight + "px";
        l.element.style.display = v.z < 1 && v.z > -1 ? "" : "none";
      }
      frame = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      disposed = true;
      current.current.captureReady(undefined);
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeGroup(modelGroup);
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      for (const l of labels) l.element.remove();
      window.removeEventListener('keydown',key);target.removeEventListener('dragover',dragOver);target.removeEventListener('drop',drop);badge.remove();
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
      p.transparent,
      p.selected,
      p.texture,
      p.facadeTexture,
      p.openDoors,
      p.exploded,
      p.dimensions,
    ],
  );
  useEffect(
    () => api.current?.fit(),
    [
      p.view,
      p.fit,
      p.activeId,
      p.room,
      p.arrangement.length,
      p.module.width,
      p.module.height,
      p.module.depth,
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



