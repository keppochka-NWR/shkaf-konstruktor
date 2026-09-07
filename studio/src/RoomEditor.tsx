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
  return <div className="room-openings"><h3>Стены</h3><label className="hardware-field">Толщина стен<input type="number" aria-label="Толщина стен" key={room.walls?.thickness??120} defaultValue={room.walls?.thickness??120} onBlur={e=>{const v=Number(e.target.value);if(!onChange({...room,walls:{...room.walls,thickness:v}}))e.target.value=String(room.walls?.thickness??120);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>
    {(['angleLeft','angleRight'] as const).map(k=><label key={k} className="hardware-field">{k==='angleLeft'?'Угол задняя–левая стена':'Угол задняя–правая стена'}<input type="number" aria-label={k==='angleLeft'?'Угол между задней и левой стеной':'Угол между задней и правой стеной'} key={room.walls?.[k]??90} defaultValue={room.walls?.[k]??90} onBlur={e=>{const v=Number(e.target.value);if(!onChange({...room,walls:{thickness:room.walls?.thickness??120,...room.walls,[k]:v}}))e.target.value=String(room.walls?.[k]??90);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>)}
    {room.walls&&((room.walls.angleLeft??90)!==90||(room.walls.angleRight??90)!==90)&&<p className="field-note">Углы не 90°: в студии комната остаётся прямоугольной, косые стены учитывайте фальшами; в Базис угол передаётся как есть.</p>}
    <h3>Потолок</h3><label className="hardware-field">Тип потолка<select aria-label="Тип потолка" value={room.ceiling??'stationary'} onChange={e=>onChange({...room,ceiling:e.target.value as Room['ceiling']})}><option value="stationary">Стационарный · зазор 30 мм</option><option value="stretch">Натяжной · зазор 20 мм</option></select></label><p className="field-note">По регламенту: до стационарного потолка 30 мм, до натяжного 20 мм. Натяжной потолок крепится к коробу над мебелью, короб не доходит до основного потолка 30–40 мм.</p>
    <h3>Окна и двери</h3><div className="room-add"><button onClick={()=>add('window')}><Plus size={14}/> Окно</button><button onClick={()=>add('door')}><Plus size={14}/> Дверь</button></div>
    {(room.openings||[]).map((o,i)=><div className={"opening-card"+(selected===o.id?" selected":"")} key={o.id} ref={node=>{if(node)cards.current.set(o.id,node);else cards.current.delete(o.id);}} onFocus={()=>onSelect(o.id)}><header><button className="opening-title" aria-pressed={selected===o.id} onClick={()=>onSelect(o.id)}>{o.type==='window'?'Окно':'Дверь'} {i+1}</button><button aria-label={'Удалить проём '+(i+1)} onClick={()=>onChange({...room,openings:room.openings?.filter(a=>a.id!==o.id)})}><Trash2 size={14}/></button></header><select aria-label={'Стена проёма '+(i+1)} value={o.wall} onChange={e=>patch(o,{wall:e.target.value as Opening['wall']})}>{Object.entries(names).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select>
    {(['offset','width','height',...(o.type==='window'?['sill']:[])] as const).map(k=><label key={k}>{({offset:'От начала стены',width:'Ширина',height:'Высота',sill:'Подоконник от пола'} as Record<string,string>)[k]}<input key={String(o[k as keyof Opening])} type="number" aria-label={((({offset:'Отступ',width:'Ширина',height:'Высота',sill:'Подоконник'} as Record<string,string>)[k])+' проёма '+(i+1))} defaultValue={Number(o[k as keyof Opening])} onBlur={e=>{if(!patch(o,{[k]:Number(e.target.value)}))e.target.value=String(o[k as keyof Opening]);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span>мм</span></label>)}
    {o.type==='door'&&<>
      <label>Наличник, ширина<input type="number" aria-label={'Наличник проёма '+(i+1)} key={'c'+(o.casing??0)} defaultValue={o.casing??0} onBlur={e=>{const v=Number(e.target.value);if(!patch(o,v>0?{casing:v,casingThick:o.casingThick??12}:{casing:undefined,casingThick:undefined}))e.target.value=String(o.casing??0);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span>мм</span></label>
      <select aria-label={'Открывание двери '+(i+1)} value={o.hinge??''} onChange={e=>patch(o,{hinge:(e.target.value||undefined) as Opening['hinge']})}><option value="">Полотно не задано</option><option value="left">Открывание левое</option><option value="right">Открывание правое</option></select>
    </>}
    {o.type==='window'&&<>
      <label>Откос, глубина<input type="number" aria-label={'Откос проёма '+(i+1)} key={'r'+(o.reveal??0)} defaultValue={o.reveal??0} onBlur={e=>{const v=Number(e.target.value);if(!patch(o,v>0?{reveal:v}:{reveal:undefined}))e.target.value=String(o.reveal??0);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span>мм</span></label>
      <label className="hardware-field"><span><input type="checkbox" aria-label={'Подоконник проёма '+(i+1)} checked={!!o.windowSill} onChange={e=>patch(o,{windowSill:e.target.checked?{width:o.width+100,thick:40,overhang:65,offset:Math.max(0,o.offset-50)}:undefined})}/> Подоконник</span></label>
      {o.windowSill&&(['width','thick','overhang','offset'] as const).map(k=><label key={k}>{{width:'Подоконник: ширина',thick:'Подоконник: толщина',overhang:'Подоконник: вылет в комнату',offset:'Подоконник: от начала стены'}[k]}<input type="number" aria-label={'Подоконник '+k+' проёма '+(i+1)} key={k+o.windowSill![k]} defaultValue={o.windowSill![k]} onBlur={e=>{if(!patch(o,{windowSill:{...o.windowSill!,[k]:Number(e.target.value)}}))e.target.value=String(o.windowSill![k]);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span>мм</span></label>)}
    </>}
    {(()=>{const length=o.wall==='back'||o.wall==='front'?room.width:room.depth,distance=length-o.offset-o.width;return <label>До конца стены<input key={'end:'+distance} type="number" min={0} max={length-o.width} aria-label={'До конца стены проёма '+(i+1)} defaultValue={distance} onBlur={e=>{const value=e.target.value.trim()?Number(e.target.value):NaN;if(!Number.isFinite(value)||!patch(o,{offset:length-o.width-value}))e.target.value=String(distance);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span>мм</span></label>;})()}
    </div>)}
    <p className="field-note">Отступ отсчитывается слева направо на задней и передней стене, от задней стены — на боковых. «До конца стены» задаёт расстояние от противоположного угла и перемещает проём, сохраняя его размер.</p></div>;
}
