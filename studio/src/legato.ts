import {boxes, rearClear, type Module, type Section, type Part} from './model';
import {LEGATO_CATALOG, type LegatoProduct} from './legatoCatalog';
import {partCollisions} from './collisions';

export type ShoeShelf = {id:string; article:string; y:number; mount:'horizontal'|'inclined'};
export const LEGATO_SOURCE='https://premial-furniture.ru/product/setchataya-polka-obuvnica-legato/';
export const LEGATO_INSTALL='https://premial-furniture.ru/wp-content/uploads/2017/instrukciya.pdf';
export const INCLINED:Record<number,{h:number;d:number}>={230:{h:160,d:230},300:{h:165,d:290},400:{h:215,d:375},500:{h:265,d:460}};
export const legatoByArticle=(article:string)=>LEGATO_CATALOG.find(p=>p.article===article);
export const legatoShelves=()=>LEGATO_CATALOG.filter(p=>p.kind==='shelf');
export function legatoBlock(m:Module):string {
  return m.kitchen||m.raw||m.corner||m.kupe||m.worktop||m.metalFrame||m.casework||m.desk||m.skew||m.radius||m.mansard||m.slope||m.sectionLayout||m.sections.some(s=>s.divider)
    ? 'Сетки ЛЕГАТО доступны в прямом шкафу с полными боковинами и перегородками.' : '';
}
export function parseShoeShelves(value:unknown):ShoeShelf[]{
  if(!Array.isArray(value)||value.length>30)throw Error('Неверный список обувных сеток ЛЕГАТО.');
  const ids=new Set<string>();
  return value.map(v=>{
    if(!v||typeof v.id!=='string'||!v.id||ids.has(v.id)||typeof v.article!=='string'||legatoByArticle(v.article)?.kind!=='shelf'||!Number.isFinite(v.y)||!['horizontal','inclined'].includes(v.mount))throw Error('Неверные параметры обувной сетки ЛЕГАТО.');
    ids.add(v.id);return {id:v.id,article:v.article,y:v.y,mount:v.mount};
  });
}
export function legatoLayout(m:Module,s:Section,q:ShoeShelf){
  const item=legatoByArticle(q.article),b=boxes(m).find(b=>b.id===s.id);
  if(!item||item.kind!=='shelf'||!b)return null;
  const incline=q.mount==='inclined'?INCLINED[item.depth]:undefined;
  if(q.mount==='inclined'&&!incline)return null;
  // Page 6: L-60 <= cut <= L-20. Page 9: nearest lower multiple of 25.
  const w=Math.floor((b.width-(incline?2:20))/25)*25;
  const h=incline?.h??38,d=incline?.d??item.depth;
  return {item,b,w,h,d,x:b.x+b.width/2,z:rearClear(m)+d/2+2,y:q.y+h/2};
}
export function legatoParts(m:Module):Part[]{
  if(legatoBlock(m))return [];
  return m.sections.flatMap(s=>(s.shoeShelves??[]).flatMap(q=>{
    const a=legatoLayout(m,s,q);if(!a||a.w<=0||!Number.isFinite(q.y))return [];
    return [{id:`legato:${s.id}:${q.id}`,name:`Сетка обувная Premial ЛЕГАТО ${q.article} · ${a.w} × ${a.item.depth} мм · ${q.mount==='inclined'?'наклонная':'горизонтальная'}`,sectionId:s.id,
      size:[a.w,a.h,a.d],position:[a.x,a.y,a.z],length:a.w,width:a.item.depth,thickness:2.3,material:'metal',decor:a.item.color,role:'shelf',grain:'length',grainAxis:0,edge:[0,0,0,0],external:true,
      legato:{article:q.article,mount:q.mount}} as Part];
  }));
}
export function legatoErrors(m:Module):string[]{
  if(!m.sections.some(s=>s.shoeShelves?.length))return [];
  const block=legatoBlock(m);if(block)return [block];
  const errors:string[]=[];
  for(const s of m.sections){
    try{parseShoeShelves(s.shoeShelves??[]);}catch(e){errors.push((e as Error).message);continue;}
    for(const q of s.shoeShelves??[]){
      const a=legatoLayout(m,s,q);
      if(!a){errors.push('ЛЕГАТО: для выбранной глубины нет монтажной схемы наклонной установки.');continue;}
      if(a.w<25||a.w>3000)errors.push('ЛЕГАТО: длина сетки должна быть от 25 до 3000 мм.');
      if(q.y<a.b.bottom||q.y+a.h>a.b.top)errors.push('ЛЕГАТО: сетка выходит за высоту секции.');
      if(a.z+a.d/2>m.depth-(m.doors?20:2))errors.push('ЛЕГАТО: недостаточно глубины до фасада.');
      if(m.backType==='board'&&m.backFrom!==undefined&&q.y<m.backFrom)errors.push('ЛЕГАТО: задние крепления ниже задней стенки ЛДСП.');
    }
  }
  return [...new Set(errors)];
}
export function legatoCollisionErrors(m:Module,all:Part[]):string[]{
  if(!all.some(p=>p.legato))return [];
  return partCollisions(all,m).filter(c=>c.a.startsWith('legato:')||c.b.startsWith('legato:')).map(c=>`ЛЕГАТО: пересечение «${c.names[0]}» и «${c.names[1]}».`);
}
export function nextLegato(m:Module,s:Section,article='180097'):ShoeShelf{
  const b=boxes(m).find(b=>b.id===s.id)!;
  return {id:crypto.randomUUID(),article,y:Math.round(b.bottom+150+(s.shoeShelves?.length??0)*220),mount:'horizontal'};
}
export type LegatoLine={id:string;label:string;quantity:number;unit:string;price:number;source:string};
/** Whole 3 m blanks, shared across the project by article, first-fit decreasing. No fractional retail blanks. */
export function legatoPriceLines(modules:Module[]):LegatoLine[]{
  const cuts=new Map<string,number[]>(),counts=new Map<string,number>();
  const add=(p:LegatoProduct|undefined,n:number)=>{if(p)counts.set(p.article,(counts.get(p.article)??0)+n);};
  for(const m of modules)for(const s of m.sections)for(const q of s.shoeShelves??[]){
    const a=legatoLayout(m,s,q);if(!a||a.w<=0||a.w>3000)continue;
    const list=cuts.get(a.item.article)??[];list.push(a.w);cuts.set(a.item.article,list);
    const accessory=(kind:string)=>LEGATO_CATALOG.find(p=>p.kind===kind&&p.color===(a.item.color==='chrome'?'gray':a.item.color));
    add(accessory(q.mount==='inclined'?'bracket':'pocket'),2);
    add(accessory('clip'),Math.max(2,Math.ceil(a.w/(q.mount==='inclined'?245:280))+1));
    add(accessory('cap'),8); // Four cut longitudinal rods per end, installation pages 6/9.
  }
  for(const [art,lengths] of cuts){const bins:number[]=[];for(const len of lengths.sort((a,b)=>b-a)){const i=bins.findIndex(free=>free>=len);if(i<0)bins.push(3000-len);else bins[i]-=len;}counts.set(art,bins.length);}
  return [...counts].map(([art,quantity])=>{const p=legatoByArticle(art)!;return {id:'legato:'+art,label:`Premial ЛЕГАТО · ${p.name} · арт. ${art}`,quantity,unit:'шт',price:p.price,source:`Розничная цена allpremial.ru, ${p.checked}; ${p.source}${p.kind==='shelf'?'; заготовка 3000 мм, остаток включён в стоимость':''}`};});
}
