import {useState} from 'react';
import {Box,Rows3,Shirt,Archive,PanelTop,Columns2,SquareSplitHorizontal,CookingPot,PanelBottom,PanelTopOpen,RectangleHorizontal} from 'lucide-react';
import {initialModule,section,deskModule,distribute,validate,id,type Module} from './model';
import {createCornerModule} from './cornerWardrobe';
import {DEFAULT_KUPE,KUPE_DEPTH} from './kupe';
import {KITCHEN,kitchenBase,kitchenWall,kitchenWorktop,kitchenRowWidths} from './kitchen';
import type {PlacedModule} from './project';
export type ModuleKind='empty'|'shelves'|'wardrobe'|'drawers'|'desk'|'corner'|'kupe'|'kupe-wardrobe'|'kitchen-row'|'kitchen-base'|'kitchen-wall'|'worktop';
const choices=[{id:'empty',label:'Пустой шкаф',icon:Box},{id:'shelves',label:'Стеллаж',icon:Rows3},{id:'wardrobe',label:'Для одежды',icon:Shirt},{id:'drawers',label:'Комод',icon:Archive},{id:'corner',label:'Угловой шкаф',icon:Box},{id:'desk',label:'Стол',icon:PanelTop},{id:'kupe-wardrobe',label:'Шкаф-купе',icon:Columns2},{id:'kitchen-row',label:'Кухня прямая',icon:CookingPot},{id:'kitchen-base',label:'Нижний кухонный',icon:PanelBottom},{id:'kitchen-wall',label:'Навесной кухонный',icon:PanelTopOpen},{id:'worktop',label:'Столешница',icon:RectangleHorizontal},{id:'kupe',label:'Двери купе',icon:SquareSplitHorizontal}] as const;
const SIZES:Partial<Record<ModuleKind,[number,number,number]>>={'kitchen-row':[3000,KITCHEN.baseHeight,KITCHEN.baseDepth],'kitchen-base':[600,KITCHEN.baseHeight,KITCHEN.baseDepth],'kitchen-wall':[600,KITCHEN.wallHeight,KITCHEN.wallDepth],worktop:[2400,KITCHEN.worktopThickness,KITCHEN.worktopDepth],corner:[1050,2000,450],desk:[1200,750,600],drawers:[600,850,550],kupe:[1600,2400,KUPE_DEPTH],'kupe-wardrobe':[1800,2400,600]};
/** Двери купе: проём W×H, глубина зоны направляющих 100 мм. */
export function createKupeModule(width:number,height:number,source:Module):Module{
  const m:Module={...initialModule(),name:'Двери купе',width,height,depth:KUPE_DEPTH,decor:source.decor,facadeDecor:source.facadeDecor,doors:false,plinthHeight:0,sections:[section()],kupe:structuredClone(DEFAULT_KUPE)};
  const error=validate(m)[0];if(error)throw Error(error);
  return m;
}
/** Шкаф-купе: корпуса без распашных дверей (каждый не шире 1300) и двери купе перед ними на всю ширину. */
export function createKupeWardrobe(width:number,height:number,depth:number,source:Module):PlacedModule[]{
  if(depth<350+KUPE_DEPTH)throw Error(`Глубина шкафа-купе от ${350+KUPE_DEPTH} мм: ${KUPE_DEPTH} мм занимают направляющие.`);
  const n=Math.max(1,Math.ceil(width/1200)),bw=Math.floor(width/n),bodyDepth=depth-KUPE_DEPTH,out:PlacedModule[]=[];
  for(let i=0;i<n;i++){
    const m:Module={...initialModule(),name:'Корпус шкафа-купе',width:i<n-1?bw:width-bw*(n-1),height,depth:bodyDepth,decor:source.decor,facadeDecor:source.facadeDecor,doors:false,sections:[section()]};
    const s=m.sections[0];if(i%2===0){s.rod=true;s.shelves=distribute(m,s,1);}else s.shelves=distribute(m,s,5);
    const error=validate(m)[0];if(error)throw Error(error);
    out.push({id:id(),x:30+i*bw,y:0,z:30,rotation:0,module:m});
  }
  out.push({id:id(),x:30,y:0,z:30+bodyDepth,rotation:0,module:createKupeModule(width,height,source)});
  return out;
}
/** Прямая кухня по длине стены: нижние корпуса на ножках, столешница на всю длину (длиннее 4100 — двумя частями), навесные над ней на регламентный зазор. */
export function createKitchenRow(length:number,source:Module):PlacedModule[]{
  if(length<600||length>6000)throw Error('Прямая кухня: длина стены 600–6000 мм.');
  const look=(m:Module)=>({...m,decor:source.decor,facadeDecor:source.facadeDecor}),out:PlacedModule[]=[],z=3;let x=0;
  const widths=kitchenRowWidths(length);
  for(const w of widths){const b=look(kitchenBase(initialModule(),w.width,w.kind)),e=validate(b)[0];if(e)throw Error(b.name+': '+e);out.push({id:id(),x,y:0,z,rotation:0,module:b});
    const top=look(kitchenWall(initialModule(),w.width));out.push({id:id(),x,y:KITCHEN.baseHeight+KITCHEN.worktopThickness+KITCHEN.wallGap,z:0,rotation:0,module:top});x+=w.width;}
  const pieces=length>4100?[Math.round(length/2),length-Math.round(length/2)]:[length];let wx=0;
  for(const p of pieces){out.push({id:id(),x:wx,y:KITCHEN.baseHeight,z:0,rotation:0,module:look(kitchenWorktop(initialModule(),p))});wx+=p;}
  return out;
}
export function createModule(kind:ModuleKind,width:number,height:number,depth:number,source:Module):Module {
  if(kind==='kitchen-base')return {...kitchenBase(initialModule(),width),height,depth,decor:source.decor,facadeDecor:source.facadeDecor};
  if(kind==='kitchen-wall')return {...kitchenWall(initialModule(),width),height,depth,decor:source.decor,facadeDecor:source.facadeDecor};
  if(kind==='worktop')return {...kitchenWorktop(initialModule(),width),depth,decor:source.decor};
  if(kind==='corner')return createCornerModule(width,height,depth,source);
  if(kind==='kupe')return createKupeModule(width,height,source);
  let m:Module={...initialModule(),name:choices.find(c=>c.id===kind)!.label,width,height,depth,decor:source.decor,facadeDecor:source.facadeDecor,sections:[section()]};
  if(kind==='desk')m={...deskModule(m),width,height,depth};
  else {
    const s=m.sections[0];
    if(kind==='shelves'){m.doors=false;s.shelves=distribute(m,s,4);}
    if(kind==='wardrobe'){s.rod=true;s.shelves=distribute(m,s,1);}
    if(kind==='drawers'){m.doors=false;s.drawers=3;}
  }
  const error=validate(m)[0];if(error)throw Error(error);
  return m;
}
export function ModulePalette({source,onAdd,onAddGroup}:{source:Module;onAdd:(module:Module)=>boolean;onAddGroup:(group:PlacedModule[])=>boolean}) {
  const [kind,setKind]=useState<ModuleKind>('empty'),[width,setWidth]=useState(600),[height,setHeight]=useState(2000),[depth,setDepth]=useState(550),[error,setError]=useState('');
  const note=kind==='corner'?'Пятиугольный корпус с диагональными дверями и двумя боковыми блоками. Стороны угла одинаковые. Антресоль добавляется отдельно.'
    :kind==='kupe'?'Размеры проёма. Ставьте перед корпусами или в нишу между стенами. Глубина направляющих 100 мм. Цена — по калькулятору купе.'
    :kind==='kupe-wardrobe'?'Корпуса без распашных дверей и двери купе на всю ширину. Глубина — общая, 100 мм из неё занимают направляющие.'
    :kind==='kitchen-row'?'Ширина — длина стены. Нижние корпуса на ножках (ящики, мойка, распашные), столешница во всю длину, навесные над ней на регламентный зазор.'
    :kind==='kitchen-base'?'Нижний кухонный: на ножках с цокольной планкой, вместо крыши царги под столешницу.'
    :kind==='kitchen-wall'?'Навесной кухонный: на навесах. Поставьте его на нужную высоту в сцене.'
    :kind==='worktop'?'Столешница — отдельным объектом. Ставьте сверху на нижние корпуса.'
    :'Размеры в мм. Создаётся отдельный корпус.';
  return <details className="module-palette" open><summary>Добавить мебель</summary>
    <div className="module-kinds">{choices.map(c=><button key={c.id} type="button" aria-pressed={kind===c.id} onClick={()=>{setKind(c.id);const sz=SIZES[c.id]??[600,2000,550];setWidth(sz[0]);setHeight(sz[1]);setDepth(sz[2]);setError('');}}><c.icon size={23}/><span>{c.label}</span></button>)}</div>
    <div className="module-sizes">{[{label:kind==='corner'?'Сторона угла':kind==='kupe'?'Ширина проёма':'Ширина',value:width,set:setWidth},{label:kind==='kupe'?'Высота проёма':'Высота',value:height,set:setHeight},...(kind==='kupe'?[]:[{label:kind==='corner'?'Глубина боковины':'Глубина',value:depth,set:setDepth}])].map(f=><label key={f.label}>{f.label}<input aria-label={`${f.label} новой мебели`} type="number" value={f.value} onChange={e=>f.set(Number(e.target.value))}/></label>)}</div>
    <small>{note}</small>
    {error&&<p role="alert">{error}</p>}
    <button className="primary full" onClick={()=>{try{const ok=kind==='kupe-wardrobe'?onAddGroup(createKupeWardrobe(width,height,depth,source)):kind==='kitchen-row'?onAddGroup(createKitchenRow(width,source)):onAdd(createModule(kind,width,height,depth,source));if(ok)setError('');}catch(e){setError((e as Error).message);}}}>Добавить в комнату</button>
  </details>;
}
