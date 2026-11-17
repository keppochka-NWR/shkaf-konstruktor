import {sinkByArticle} from './sinkCatalog';
import type {Module,Part} from './model';
import type {WorktopCutout} from './kitchen';
export const SINK_SOURCE='https://allpremial.ru/catalog/kukhonnye-moyki-iz-nerzhaveyushchey-stali-3-mm/59143/';
export const SINK_ARTICLE='210245';
// Official envelope and bowl dimensions; radii, wall taper, drain and cutout clearance
// are layout approximations; 3 mm body walls and cutout limits below are estimates. Never use this as a factory cutting/drilling template.
export function worktopCutErrors(m:Module):string[]{
 const errors:string[]=[],cuts=m.worktop?.cutouts??[];
 for(const [i,c] of cuts.entries()){
  const z=c.z??(m.depth-c.depth)/2;
  if(![c.x,z,c.width,c.depth].every(Number.isFinite)||c.width<=0||c.depth<=0) {errors.push('Столешница: размеры и положение выреза должны быть конечными положительными числами.');continue;}
  const end=c.fixture?20:50;
  if(c.x<end||c.x+c.width>m.width-end||z<40||z+c.depth>m.depth-40)errors.push(`Столешница: вырез не ближе ${end} мм к торцам и 40 мм к кромкам. Для изготовления сверить шаблон изделия.`);
  for(const b of cuts.slice(0,i)){const bz=b.z??(m.depth-b.depth)/2;if(c.x<b.x+b.width+50&&c.x+c.width+50>b.x&&z<bz+b.depth+50&&z+c.depth+50>bz)errors.push('Столешница: между вырезами оставьте перемычку не менее 50 мм.');}
  if(c.fixture){
   const item=sinkByArticle(c.fixture);
   if(!item||c.kind!=='sink')errors.push('Мойка: неизвестный артикул или выбран вырез для варочной панели.');
   else {
    if(c.width<item.cutWidth-4||c.width>item.cutWidth+20||c.depth<item.cutDepth-4||c.depth>item.cutDepth+20)errors.push(item.name+': вырез вне компоновочного диапазона; сверить заводской шаблон.');
    const cx=c.x+c.width/2,cz=z+c.depth/2-item.offsetZ;
    if(cx-item.width/2<0||cx+item.width/2>m.width||cz-item.depth/2<0||cz+item.depth/2>m.depth)errors.push(item.name+': борт мойки выходит за столешницу.');
   }
  }
  if(c.drainDrop!==undefined&&(!c.fixture||!Number.isFinite(c.drainDrop)||c.drainDrop<350||c.drainDrop>650))errors.push('Слив: низ сифона задаётся от верха столешницы, 350–650 мм, только для установленной мойки.');
  if((c.tap||c.plumbing)&&!c.fixture)errors.push('Смеситель и подводки требуют установленную мойку.');
  if(c.plumbing&&c.drainDrop===undefined)errors.push('Для подключения слива включите сифон.');
 }
 return [...new Set(errors)];
}
export function sinkParts(m:Module,c:WorktopCutout,i:number):Part[]{
 const item=sinkByArticle(c.fixture);if(!item)return [];
 const H=item.bowlHeight,BW=item.bowlWidth,BD=item.bowlDepth,W=item.width,D=item.depth,O=item.offsetZ;
 const T=m.worktop!.thickness,cx=c.x+c.width/2,cz=(c.z??(m.depth-c.depth)/2)+c.depth/2;
 const part=(id:string,name:string,size:[number,number,number],position:[number,number,number]):Part=>({id,name,size,position,length:size[0],width:size[2],thickness:size[1],role:'fastener',material:'metal',decor:'',grain:'length',grainAxis:0,edge:[0,0,0,0],external:true});
 const out=[part(`premial-sink:${i}`,`${item.name} · ${item.article} · компоновочная модель`,[W,H+3,D],[cx,T+(3-H)/2,cz-O])];
 if(c.drainDrop!==undefined){const drop=c.drainDrop;
  out.push(part(`layout-drain:${i}`, 'Выпуск и сифон · условная компоновка Ø40, не заводская модель',[90,drop-H,90],[cx,T-(H+drop)/2,cz]));
 }
 if(c.tap)out.push(part(`layout-tap:${i}`,'Смеситель · типовой, компоновочный',[50,320,210],[cx,T+160,cz-O-D/2+37.5]));
 if(c.plumbing&&c.drainDrop!==undefined){
  out.push(part(`layout-waste:${i}`,'Канализация Ø40 · компоновочная трасса до задней кромки',[40,40,cz],[cx,T-c.drainDrop+50,cz/2]));
  for(const [j,x] of [-60,60].entries())out.push(part(`layout-water:${i}:${j}`,'Подводка воды · компоновочная трасса',[72,300,Math.max(20,cz-O-D/2+37.5)],[cx+x/2,T-150,Math.max(20,cz-O-D/2+37.5)/2]));
 }
 out[0].collide=[{size:[BW+6,H,BD+6],position:[cx,T-H/2,cz]},{size:[W,3,D],position:[cx,T+1.5,cz-O]}];
 for(const p of out.filter(p=>p.id.startsWith('layout-water:'))){const x=p.id.endsWith(':1')?60:-60,z=Math.max(20,cz-O-D/2+37.5);p.collide=[...Array.from({length:20},(_,j)=>({size:[15,15,12] as [number,number,number],position:[cx+x*(j+.5)/20,T-15*(j+.5),z] as [number,number,number]})),{size:[12,12,z],position:[cx+x,T-300,z/2]}];}
 return out;
}
