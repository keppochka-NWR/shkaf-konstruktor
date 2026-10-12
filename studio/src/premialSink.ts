import type {Module,Part} from './model';
import type {WorktopCutout} from './kitchen';
export const SINK_SOURCE='https://allpremial.ru/catalog/kukhonnye-moyki-iz-nerzhaveyushchey-stali-3-mm/59143/';
export const SINK_ARTICLE='210245';
// Official envelope and bowl dimensions; radii, wall taper, drain and cutout clearance
// are layout approximations. Never use this as a factory cutting/drilling template.
export function worktopCutErrors(m:Module):string[]{
 const errors:string[]=[],cuts=m.worktop?.cutouts??[];
 for(const [i,c] of cuts.entries()){
  const z=c.z??(m.depth-c.depth)/2;
  if(![c.x,z,c.width,c.depth].every(Number.isFinite)||c.width<=0||c.depth<=0) {errors.push('Столешница: размеры и положение выреза должны быть конечными положительными числами.');continue;}
  if(c.x<50||c.x+c.width>m.width-50||z<40||z+c.depth>m.depth-40)errors.push('Столешница: вырез не ближе 50 мм к торцам и 40 мм к кромкам.');
  for(const b of cuts.slice(0,i)){const bz=b.z??(m.depth-b.depth)/2;if(c.x<b.x+b.width+50&&c.x+c.width+50>b.x&&z<bz+b.depth+50&&z+c.depth+50>bz)errors.push('Столешница: между вырезами оставьте перемычку не менее 50 мм.');}
  if(c.fixture){
   if(c.fixture!==SINK_ARTICLE||c.kind!=='sink')errors.push('Мойка: неизвестный артикул или выбран вырез для варочной панели.');
   if(c.width<556||c.width>580||c.depth<356||c.depth>380)errors.push('PRODIGY 6045: для компоновки нужен вырез 556–580 × 356–380 мм; шаблон производителя проверить перед изготовлением.');
   const cx=c.x+c.width/2,cz=z+c.depth/2-25;
   if(cx-300<0||cx+300>m.width||cz-225<0||cz+225>m.depth)errors.push('PRODIGY 6045: борт мойки выходит за столешницу.');
  }
  if(c.drainDrop!==undefined&&(!c.fixture||!Number.isFinite(c.drainDrop)||c.drainDrop<350||c.drainDrop>650))errors.push('Слив: низ сифона задаётся от верха столешницы, 350–650 мм, только для установленной мойки.');
 }
 return [...new Set(errors)];
}
export function sinkParts(m:Module,c:WorktopCutout,i:number):Part[]{
 if(c.fixture!==SINK_ARTICLE)return [];
 const T=m.worktop!.thickness,cx=c.x+c.width/2,cz=(c.z??(m.depth-c.depth)/2)+c.depth/2;
 const part=(id:string,name:string,size:[number,number,number],position:[number,number,number]):Part=>({id,name,size,position,length:size[0],width:size[2],thickness:size[1],role:'fastener',material:'metal',decor:'',grain:'length',grainAxis:0,edge:[0,0,0,0],external:true});
 const out=[part(`premial-sink:${i}`,`Мойка Premial PRODIGY 6045 · ${SINK_ARTICLE} · компоновочная модель`,[600,223,450],[cx,T-108.5,cz-25])];
 if(c.drainDrop!==undefined){const drop=c.drainDrop;
  out.push(part(`layout-drain:${i}`, 'Выпуск и сифон · условная компоновка Ø40, не заводская модель',[90,drop-220,90],[cx,T-(220+drop)/2,cz]));
 }
 return out;
}
