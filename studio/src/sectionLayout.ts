import type {Module,SectionBox} from './model';

/** Binary partition tree. Distances are clear openings from left / bottom. */
export type SectionLayout={section:string}|{id:string;axis:'x'|'y';at:number;first:SectionLayout;second:SectionLayout};
export type LayoutPanel={id:string;axis:'x'|'y';x:number;bottom:number;width:number;height:number};
export function resolveLayout(m:Module){
  const leaves:SectionBox[]=[],panels:LayoutPanel[]=[],seen=new Set<string>();
  const t=16,bottom=(m.feet?.height??m.plinthHeight??80)+(m.bottomType==='none'?0:t),top=m.height-(m.topType==='none'?0:t);
  function walk(n:SectionLayout,x:number,y:number,w:number,h:number,depth:number){
    if(!n||typeof n!=='object'||depth>8)throw Error('Некорректная схема проёмов.');
    if('section' in n){if(typeof n.section!=='string'||seen.has(n.section))throw Error('Проём секции повторяется.');seen.add(n.section);leaves.push({id:n.section,x,width:w,bottom:y,top:y+h});return;}
    if(!['x','y'].includes(n.axis)||typeof n.id!=='string'||seen.has(n.id)||!Number.isFinite(n.at))throw Error('Проверьте разделитель проёмов.');
    seen.add(n.id);const extent=n.axis==='x'?w:h,min=n.axis==='x'?160:60;
    if(n.at<min||extent-n.at-t<min)throw Error('Разделитель оставляет слишком узкий проём.');
    if(n.axis==='x'){
      panels.push({id:n.id,axis:'x',x:x+n.at,bottom:y,width:t,height:h});
      walk(n.first,x,y,n.at,h,depth+1);walk(n.second,x+n.at+t,y,w-n.at-t,h,depth+1);
    }else{
      panels.push({id:n.id,axis:'y',x,bottom:y+n.at,width:w,height:t});
      walk(n.first,x,y,w,n.at,depth+1);walk(n.second,x,y+n.at+t,w,h-n.at-t,depth+1);
    }
  }
  walk(m.sectionLayout!,t,bottom,m.width-2*t,top-bottom,0);
  if(leaves.length!==m.sections.length||m.sections.some(s=>!leaves.some(b=>b.id===s.id)))throw Error('Секции и схема проёмов не совпадают.');
  return {boxes:m.sections.map(s=>leaves.find(b=>b.id===s.id)!),panels};
}
export function layoutFromColumns(m:Module):SectionLayout{
  const total=m.sections.reduce((v,s)=>v+s.weight,0),clear=m.width-16*(m.sections.length+1);
  const build=(i:number):SectionLayout=>i===m.sections.length-1?{section:m.sections[i].id}:{id:'split-'+m.sections[i].id,axis:'x',at:Math.round(clear*m.sections[i].weight/total*10)/10,first:{section:m.sections[i].id},second:build(i+1)};
  return build(0);
}
export function splitOpening(m:Module,sid:string,axis:'x'|'y',at:number,newId:string){
  if(m.sections.length>=4)throw Error('В корпусе доступны четыре самостоятельных проёма.');
  m.sectionLayout??=layoutFromColumns(m);
  function replace(n:SectionLayout):SectionLayout{return 'section' in n?(n.section===sid?{id:'split-'+newId,axis,at,first:n,second:{section:newId}}:n):{...n,first:replace(n.first),second:replace(n.second)};}
  m.sectionLayout=replace(m.sectionLayout);
  m.sections.push({id:newId,weight:1,shelves:[],drawers:0,rod:false});
  resolveLayout(m);
}
export function layoutSplits(root:SectionLayout):Exclude<SectionLayout,{section:string}>[]{return 'section'in root?[]:[root,...layoutSplits(root.first),...layoutSplits(root.second)];}
export function setPartition(m:Module,id:string,at:number){
  const before=resolveLayout(m).boxes;
  layoutSplits(m.sectionLayout!).find(n=>n.id===id)!.at=at;
  const after=resolveLayout(m).boxes;
  // Keep usable millimetres above each opening's floor instead of scaling shelf gaps.
  for(const s of m.sections){const a=before.find(b=>b.id===s.id)!,b=after.find(b=>b.id===s.id)!,ratio=(a.top-a.bottom)/(b.top-b.bottom);s.shelves=s.shelves.map(f=>f*ratio);if(s.rodAt!==undefined)s.rodAt*=ratio;}
}
export function resizeOpening(m:Module,sid:string,width:number){
  const current=resolveLayout(m).boxes.find(b=>b.id===sid)!;
  let candidate:{node:Exclude<SectionLayout,{section:string}>;sign:number}|undefined;
  function contains(n:SectionLayout):boolean{return 'section'in n?n.section===sid:contains(n.first)||contains(n.second);}
  function walk(n:SectionLayout){if('section'in n)return;const left=contains(n.first);if(n.axis==='x')candidate={node:n,sign:left?1:-1};walk(left?n.first:n.second);}
  walk(m.sectionLayout!);if(!candidate)throw Error('У проёма нет вертикального разделителя. Измените ширину корпуса.');
  candidate.node.at+=(width-current.width)*candidate.sign;resolveLayout(m);
}
export function rekeySections(m:Module,nextId:()=>string){
  const map=new Map<string,string>();m.sections.forEach(s=>{const old=s.id;s.id=nextId();map.set(old,s.id);});
  function walk(n:SectionLayout):void{if('section'in n)n.section=map.get(n.section)!;else{n.id=nextId();walk(n.first);walk(n.second);}}
  if(m.sectionLayout)walk(m.sectionLayout);
}
export function removeOpening(m:Module,sid:string){
  function remove(n:SectionLayout):SectionLayout{if('section'in n)return n;if('section'in n.first&&n.first.section===sid)return n.second;if('section'in n.second&&n.second.section===sid)return n.first;return {...n,first:remove(n.first),second:remove(n.second)};}
  m.sectionLayout=remove(m.sectionLayout!);m.sections=m.sections.filter(s=>s.id!==sid);resolveLayout(m);
}
export function mirrorOpenings(m:Module){
  function walk(n:SectionLayout,w:number,h:number):SectionLayout{if('section'in n)return n;if(n.axis==='x')return {...n,at:w-16-n.at,first:walk(n.second,w-16-n.at,h),second:walk(n.first,n.at,h)};return {...n,first:walk(n.first,w,n.at),second:walk(n.second,w,h-16-n.at)};}
  const base=m.feet?.height??m.plinthHeight??80;m.sectionLayout=walk(m.sectionLayout!,m.width-32,m.height-base-32);
}
