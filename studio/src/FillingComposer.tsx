import {useState} from 'react';
import {SLIDES, type DrawerConfig} from './hardware';
import {RULES, boxes, drawerConfig, drawerStackHeight, shelfInsertionHeight, type Module} from './model';
import {insertItem} from './operations';
import type {Project} from './project';

/** One transaction: a failed batch never leaves a partially changed project. */
export function addFillingBatch(project:Project,mid:string,sid:string,kind:'shelf'|'drawer',count:number,drawer?:DrawerConfig):Project {
  if(!Number.isInteger(count)||count<1||count>10)throw Error('Укажите количество от 1 до 10.');
  let next=project;
  for(let i=0;i<count;i++) {
    const m=next.modules.find(a=>a.id===mid)?.module,s=m?.sections.find(a=>a.id===sid);
    if(!m||!s)throw Error('Выберите корпус и секцию.');
    const b=boxes(m).find(a=>a.id===sid)!;
    const y=kind==='shelf'?shelfInsertionHeight(m,sid):b.bottom+drawerStackHeight(s);
    next=insertItem(next,kind,mid,sid,y,drawer);
  }
  return next;
}

export function addFittedDrawers(project:Project,mid:string,sid:string,count:number,config:DrawerConfig):Project {
 try{return addFillingBatch(project,mid,sid,'drawer',count,config);}catch(original){
  if(config.mesh||config.facadeH!==undefined)throw original;
  for(let height=Math.floor(config.height)-1;height>=68;height--){
   try{return addFillingBatch(project,mid,sid,'drawer',count,{...config,height});}catch{}
  }
  throw original;
 }
}

export function FillingComposer({module,sid,kind,onApply,onCancel}:{module:Module;sid:string;kind:'shelf'|'drawer';onApply:(count:number,drawer?:DrawerConfig,fit?:boolean)=>boolean;onCancel:()=>void}) {
  const s=module.sections.find(s=>s.id===sid)!;
  const [count,setCount]=useState(1);
  const [fit,setFit]=useState(true);
  const [config,setConfig]=useState<DrawerConfig>(()=>drawerConfig(module,s,s.drawers));
  return <form className="filling-composer" aria-label="Добавление наполнения" onSubmit={e=>{e.preventDefault();onApply(count,kind==='drawer'?config:undefined,fit);}}>
    <strong>{kind==='shelf'?'Добавить полки':'Добавить ящики'}</strong>
    <p>{module.name} · секция {module.sections.indexOf(s)+1}. Уже установленное наполнение сохранится.</p>
    <label>Количество<input autoFocus required type="number" aria-label="Количество новых элементов" min={1} max={kind==='drawer'?RULES.maxDrawers-s.drawers:RULES.maxShelves-s.shelves.length} value={count} onChange={e=>setCount(Number(e.target.value))}/></label>
    {kind==='drawer'&&<>
      <label><input type="checkbox" checked={fit} onChange={e=>setFit(e.target.checked)}/> Уменьшить высоту новых ящиков, если не помещаются</label>
      <p>Существующие ящики не меняются. Полка над ящиками и минимальная высота короба сохраняются.</p>
      <label>Направляющие<select value={config.slide} onChange={e=>{const slide=e.target.value as DrawerConfig['slide'];setConfig({...config,slide,length:SLIDES[slide].lengths.includes(config.length as never)?config.length:SLIDES[slide].lengths[0]});}}>{Object.entries(SLIDES).map(([id,v])=><option key={id} value={id}>{v.label}</option>)}</select></label>
      <label>Длина направляющих, мм<select value={config.length} onChange={e=>setConfig({...config,length:Number(e.target.value)})}>{SLIDES[config.slide].lengths.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      <label>Высота короба, мм<input required type="number" min={68} max={400} value={config.height} onChange={e=>setConfig({...config,height:Number(e.target.value)})}/></label>
    </>}
    <div className="composer-actions"><button className="primary" type="submit">Добавить {count}</button><button type="button" className="outline" onClick={onCancel}>Отмена</button></div>
  </form>;
}
