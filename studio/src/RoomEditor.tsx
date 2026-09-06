import {useEffect,useRef} from 'react';
import {Plus,Trash2} from 'lucide-react';
import {id} from './model';
import type {Room,Opening} from './project';
type Props={room:Room;selected?:string;onSelect:(id:string)=>void;onChange:(room:Room)=>boolean};
const names={back:'Задняя стена',left:'Левая стена',right:'Правая стена',front:'Передняя стена'};
export function RoomEditor({room,onChange,selected,onSelect}:Props){
  const cards=useRef(new Map<string,HTMLDivElement>());
  useEffect(()=>{if(selected)cards.current.get(selected)?.scrollIntoView({block:'nearest'});},[selected]);
  function patch(o:Opening,change:Partial<Opening>){return onChange({...room,openings:(room.openings||[]).map(a=>a.id===o.id?{...a,...change}:a)});}
  function add(type:Opening['type']){
    const width=Math.min(type==='window'?1200:900,room.width),height=Math.min(type==='window'?1400:2100,room.height),sill=type==='window'?Math.min(900,room.height-height):0;
    const existing=room.openings||[];let wall:Opening['wall']='back',offset=0;
    for(const candidate of ['back','left','right','front'] as const){
      const length=candidate==='back'||candidate==='front'?room.width:room.depth;
      const spots=[0,...existing.filter(o=>o.wall===candidate).map(o=>o.offset+o.width+100)];
      const fit=spots.find(x=>x+width<=length&&!existing.some(o=>o.wall===candidate&&x<o.offset+o.width&&x+width>o.offset));
      if(fit!==undefined){wall=candidate;offset=fit;break;}
    }
    const opening={id:id(),type,wall,offset,width,height,sill};if(onChange({...room,openings:[...existing,opening]}))onSelect(opening.id);
  }
  return <div className="room-openings"><h3>Окна и двери</h3><div className="room-add"><button onClick={()=>add('window')}><Plus size={14}/> Окно</button><button onClick={()=>add('door')}><Plus size={14}/> Дверь</button></div>
    {(room.openings||[]).map((o,i)=><div className={"opening-card"+(selected===o.id?" selected":"")} key={o.id} ref={node=>{if(node)cards.current.set(o.id,node);else cards.current.delete(o.id);}} onFocus={()=>onSelect(o.id)}><header><button className="opening-title" aria-pressed={selected===o.id} onClick={()=>onSelect(o.id)}>{o.type==='window'?'Окно':'Дверь'} {i+1}</button><button aria-label={'Удалить проём '+(i+1)} onClick={()=>onChange({...room,openings:room.openings?.filter(a=>a.id!==o.id)})}><Trash2 size={14}/></button></header><select aria-label={'Стена проёма '+(i+1)} value={o.wall} onChange={e=>patch(o,{wall:e.target.value as Opening['wall']})}>{Object.entries(names).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select>
    {(['offset','width','height',...(o.type==='window'?['sill']:[])] as const).map(k=><label key={k}>{({offset:'От начала стены',width:'Ширина',height:'Высота',sill:'Подоконник от пола'} as Record<string,string>)[k]}<input key={String(o[k as keyof Opening])} type="number" aria-label={((({offset:'Отступ',width:'Ширина',height:'Высота',sill:'Подоконник'} as Record<string,string>)[k])+' проёма '+(i+1))} defaultValue={Number(o[k as keyof Opening])} onBlur={e=>{if(!patch(o,{[k]:Number(e.target.value)}))e.target.value=String(o[k as keyof Opening]);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span>мм</span></label>)}</div>)}
    <p className="field-note">Отступ отсчитывается слева направо на задней и передней стене, от задней стены — на боковых.</p></div>;
}
