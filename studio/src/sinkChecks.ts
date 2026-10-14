import {fixtureBox} from './fixtures';
import {parts} from './model';
import {localToRoom,overlap,type Project,type PlacedModule} from './project';
import {sinkParts} from './premialSink';
import type {RoomWarning} from './roomWarnings';
// Conservative installation-envelope checks, not curved-surface or plumbing certification.
export function sinkChecks(p:Project):RoomWarning[]{
 const out:RoomWarning[]=[];
 const box=(a:PlacedModule,pos:number[],size:number[])=>{const q=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>localToRoom(a,pos[0]+u*size[0]/2,pos[2]+v*size[2]/2));const xs=q.map(v=>v.x),zs=q.map(v=>v.z);return {x:Math.min(...xs),z:Math.min(...zs),w:Math.max(...xs)-Math.min(...xs),d:Math.max(...zs)-Math.min(...zs),y:(a.y??0)+pos[1]-size[1]/2,h:size[1]};};
 for(const a of p.modules)for(const [i,c] of (a.module.worktop?.cutouts??[]).entries()){
  if(!c.fixture)continue;
  const warn=(message:string)=>out.push({moduleId:a.id,kind:'sink-fit',message});
  for(const original of sinkParts(a.module,c,i))for(const part of (original.id.startsWith('layout-water:')&&original.collide?original.collide.map(c=>({...original,...c})): [original])){
   // The rim sits on the slab. Only the bowl envelope below it occupies a cabinet.
   const size=part.id.startsWith('premial-sink:')?[556,220,356]:part.size;
   const pos=part.id.startsWith('premial-sink:')?[part.position[0],a.module.worktop!.thickness-110,part.position[2]+25]:part.position;
   const envelope=box(a,pos,size);
   if(envelope.y<0)warn('Мойка/сифон ниже пола: поднимите столешницу или сократите опускание сифона.');
   for(const b of p.modules){if(a.id===b.id)continue;
    const hits=parts(b.module).filter(q=>q.material==='board'||q.role==='door'||q.role==='drawer').filter(q=>overlap(envelope,box(b,q.position,q.size)));
    if(hits.length)warn(`Зона ${part.id.startsWith('layout-drain:')?'сифона':'чаши мойки'} пересекает «${b.module.name}»: ${[...new Set(hits.map(q=>q.name))].slice(0,3).join(', ')}. Освободите место или сдвиньте вырез.`);
   }
   for(const f of p.room.fixtures??[]){
    const fb=fixtureBox(p.room,f),water=part.id.startsWith('layout-water:'),waste=part.id.startsWith('layout-waste:');
    const cx=c.x+c.width/2;
    const end=localToRoom(a,cx+(water?(part.id.endsWith(':1')?60:-60):0),0);
    const ey=(a.y??0)+a.module.worktop!.thickness-(water?300:(c.drainDrop??420)-50);
    const terminal=(water||waste)&&f.type==='pipe'&&f.height<=80&&f.width<=80&&end.x>=fb.x-2&&end.x<=fb.x+fb.w+2&&end.z>=fb.z-2&&end.z<=fb.z+fb.d+2&&ey>=fb.y&&ey<=fb.y+fb.h;
    if(!terminal&&overlap(envelope,fb))warn(`Зона мойки/сифона пересекает объект или коммуникацию «${f.name||f.type}». Проверьте монтажный габарит.`);
   }
   for(const o of p.room.obstacles??[])if(overlap(envelope,{x:o.x,y:o.y,z:o.z,w:o.width,h:o.height,d:o.depth}))warn(`Мойка/сифон пересекает объект замера «${o.name}».`);
  }
  if(c.drainDrop!==undefined&&!c.plumbing)warn('Сифон показан условно. Подключение к канализации и перелив ещё не проложены — проверьте их отдельно.');
 }
 return out;
}
