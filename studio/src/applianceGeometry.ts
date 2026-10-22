import * as THREE from 'three';
import type {RoomObstacle} from './project';
/** Объекты замера, у которых есть процедурная модель (остальные — коробкой габарита в Scene.tsx). */
export const APPLIANCE_MODEL_TYPES:readonly RoomObstacle['type'][]=['fridge','dishwasher','hood','hob','washer'];
/** Adjustable layout assets. No brand, factory mounting holes or invented article numbers. */
export function applianceModel(o:RoomObstacle,open=false):THREE.Group|undefined {
 if(!APPLIANCE_MODEL_TYPES.includes(o.type))return;
 const g=new THREE.Group(),w=o.width,h=o.height,d=o.depth;
 const steel=new THREE.MeshStandardMaterial({color:0xa6aaad,metalness:.65,roughness:.32});
 const white=new THREE.MeshStandardMaterial({color:0xe7e7e0,roughness:.4});
 const black=new THREE.MeshStandardMaterial({color:0x202427,metalness:.2,roughness:.2});
 const box=(a:number,b:number,c:number,x:number,y:number,z:number,mat:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),mat);mesh.position.set(x,y,z);mesh.userData.obstacleId=o.id;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
 if(o.type==='fridge'){
  box(w,h,d-30,0,0,-15,white);
  const doors=new THREE.Group();doors.position.set(w/2,0,d/2-30);g.add(doors);
  const leaf=(a:THREE.Mesh)=>{g.remove(a);a.position.sub(doors.position);doors.add(a);};
  leaf(box(w-4,h*.32-4,12,0,-h*.34,d/2-24,white));leaf(box(w-4,h*.68-4,12,0,h*.16,d/2-24,white));
  for(const y of [-h*.2,h*.15])leaf(box(10,Math.min(280,h*.2),18,-w*.4,y,d/2-9,steel));
  if(open)doors.rotation.y=Math.PI/2;
 }else if(o.type==='dishwasher'){
  box(w-4,h-10,d-22,0,0,-11,steel);const before=g.children.length;
  box(w-4,h-55,20,0,-22,d/2-10,white);
  box(w-4,45,20,0,h/2-24,d/2-10,steel);box(w*.4,16,8,0,h/2-76,d/2-4,black);
  box(55,15,2,w*.22,h/2-24,d/2-1,black);
  if(open){const leaf=new THREE.Group();leaf.position.set(0,-h/2+10,d/2-20);const moving=g.children.slice(before);for(const a of moving){g.remove(a);a.position.sub(leaf.position);leaf.add(a);}leaf.rotation.x=Math.PI/2;g.add(leaf);}
 }else if(o.type==='washer')washerParts(g,w,h,d,o.id);
 else if(o.type==='hood'){
  box(w,55,d,0,-h/2+27.5,0,steel);box(w*.46,h-55,d*.55,0,27.5,-d*.225,steel);
  box(w*.7,3,d*.68,0,-h/2+1.5,0,black);
 }else{
  box(w,h,d,0,0,0,black);
  for(const x of [-w*.25,w*.25])for(const z of [-d*.25,d*.25]){const mesh=new THREE.Mesh(new THREE.TorusGeometry(Math.min(w,d)*.15,1.5,8,40),steel);mesh.rotation.x=Math.PI/2;mesh.position.set(x,h/2-1.5,z);mesh.userData.obstacleId=o.id;g.add(mesh);}
 }
 return g;
}

/** Стиральная машина с фронтальной загрузкой (объект замера, задача 10 от 22.10): корпус по габариту, панель управления сверху
 *  (лоток порошка, ручка программ, дисплей), люк — хромированное кольцо со стеклом, цоколь. Габарит — как задан в замере
 *  (обычно 600 × 850 × 400–600); центр модели — центр габарита, лицо — +Z. Без марки и заводских размеров. */
function washerParts(g:THREE.Group,w:number,h:number,d:number,id:string){
 const white=new THREE.MeshStandardMaterial({color:0xf2f2ee,roughness:.35});
 const grey=new THREE.MeshStandardMaterial({color:0xd5d7d8,roughness:.45});
 const chrome=new THREE.MeshStandardMaterial({color:0xc4c9cd,metalness:.75,roughness:.25});
 const dark=new THREE.MeshStandardMaterial({color:0x1d2226,metalness:.2,roughness:.2});
 const glass=new THREE.MeshStandardMaterial({color:0x3d5560,metalness:.3,roughness:.08,transparent:true,opacity:.72});
 const add=(m:THREE.Mesh,x:number,y:number,z:number)=>{m.position.set(x,y,z);m.userData.obstacleId=id;m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
 const box=(a:number,b:number,c:number,x:number,y:number,z:number,mat:THREE.Material)=>add(new THREE.Mesh(new THREE.BoxGeometry(a,b,c),mat),x,y,z);
 // лицо корпуса на 40 мм глубже габарита: люк, ручка и регулятор выступают вперёд, но не за габарит замера
 const panel=Math.min(110,h*.13),plinth=Math.min(60,h*.07),face=d/2-40;
 box(w,h-plinth,d-40,0,plinth/2,-20,white);                        // корпус
 box(w-20,plinth,d-60,0,-h/2+plinth/2,-30,grey);                    // цоколь (утоплен)
 box(w-4,panel-4,8,0,h/2-panel/2,face-4,white);                     // панель управления
 box(w*.3,panel*.55,10,-w/2+w*.17,h/2-panel/2,face-2,grey);         // лоток порошка
 box(w*.18,panel*.3,2,w*.06,h/2-panel/2,face+1,dark);               // дисплей
 const knob=add(new THREE.Mesh(new THREE.CylinderGeometry(Math.min(28,panel*.3),Math.min(28,panel*.3),14,32),chrome),w*.32,h/2-panel/2,face+7);knob.rotation.x=Math.PI/2;
 for(const x of [w*.16,w*.21])box(10,10,4,x,h/2-panel/2-panel*.22,face+2,grey);   // кнопки
 // люк: центр в средней части фронта, диаметр — до 0,75 ширины и не выше просвета между панелью и цоколем
 const free=h-panel-plinth,r=Math.min(w*.375,free*.42),cy=-h/2+plinth+free/2;
 add(new THREE.Mesh(new THREE.TorusGeometry(r,Math.min(18,Math.max(10,r*.1)),16,64),chrome),0,cy,face+18);
 add(new THREE.Mesh(new THREE.CircleGeometry(r*.92,48),glass),0,cy,face+24);
 const inner=add(new THREE.Mesh(new THREE.CylinderGeometry(r*.78,r*.7,40,48,1,true),dark),0,cy,face-14);inner.rotation.x=Math.PI/2;
 box(16,r*.6,14,r+8,cy,face+26,chrome);                             // ручка люка
}

/** Встраиваемая СВЧ в нишу пенала (K1, 22.10): процедурная, по образцу духовки — корпус в нише, стальная рамка лица во всю ширину 594,
 *  чёрная стеклянная дверца с окном, панель управления справа. size — габарит детали [ширина лица, высота лица, глубина с лицом];
 *  центр модели — центр габарита, лицо — +Z. Дверь распашная на боку — в сцене всегда закрыта (K3). */
export function microwaveModel(size:readonly number[]):THREE.Group {
 const [w,h,d]=size,g=new THREE.Group(),fascia=20;
 const steel=new THREE.MeshStandardMaterial({color:0xa4a8ac,metalness:.75,roughness:.32});
 const black=new THREE.MeshStandardMaterial({color:0x141719,metalness:.25,roughness:.22});
 const glass=new THREE.MeshStandardMaterial({color:0x243035,metalness:.5,roughness:.12});
 const box=(a:number,b:number,c:number,x:number,y:number,z:number,mat:THREE.Material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
 box(w-40,h-14,d-fascia,0,-2,-fascia/2,steel);                      // корпус в нише
 box(w,h,fascia,0,0,d/2-fascia/2,steel);                            // рамка лица
 const doorW=w*.74,panelW=w-doorW-12;
 box(doorW,h-16,6,-w/2+6+doorW/2,0,d/2+3,black);                    // дверца
 box(doorW*.7,(h-16)*.62,2,-w/2+6+doorW*.42,0,d/2+7,glass);         // окно
 box(panelW,h-16,4,w/2-6-panelW/2,0,d/2+2,black);                   // панель управления
 box(panelW*.6,22,1,w/2-6-panelW/2,h*.25,d/2+4.5,glass);            // дисплей
 const knob=new THREE.Mesh(new THREE.CylinderGeometry(18,18,14,32),steel);knob.rotation.x=Math.PI/2;knob.position.set(w/2-6-panelW/2,-h*.08,d/2+11);g.add(knob);
 box(14,h*.55,16,-w/2+6+doorW-14,0,d/2+14,steel);                   // ручка у свободного края дверцы
 return g;
}

/** Встраиваемый холодильник в нишу пенала (K2, 22.10): белый корпус по габариту ниши, две двери (морозильная снизу), уплотнители,
 *  петли справа. Фасады мебели висят на его дверях (фасад без петель, hingeless) — в сцене техника всегда закрыта (K3).
 *  size — габарит [ширина, высота, глубина]; центр модели — центр габарита, лицо — +Z. */
export function builtInFridgeModel(size:readonly number[]):THREE.Group {
 const [w,h,d]=size,g=new THREE.Group();
 const white=new THREE.MeshStandardMaterial({color:0xeeeeea,roughness:.42});
 const grey=new THREE.MeshStandardMaterial({color:0xb9bdbf,roughness:.6});
 const steel=new THREE.MeshStandardMaterial({color:0xa6aaad,metalness:.65,roughness:.32});
 const box=(a:number,b:number,c:number,x:number,y:number,z:number,mat:THREE.Material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
 const door=40,low=Math.round(h*.4);
 box(w,h,d-door,0,0,-door/2,white);                                 // корпус
 box(w-4,low-6,door-6,0,-h/2+low/2,d/2-door/2+3,white);             // морозильная камера
 box(w-4,h-low-6,door-6,0,-h/2+low+(h-low)/2,d/2-door/2+3,white);   // холодильная камера
 box(w-2,4,door-2,0,-h/2+low,d/2-door/2,grey);                      // шов дверей
 for(const y of [-h/2+20,-h/2+low,h/2-20])box(14,30,20,w/2-7,y,d/2-door/2,steel);   // петли
 return g;
}
