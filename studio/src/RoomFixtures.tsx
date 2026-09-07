import {useEffect,useRef,useState} from 'react';
import {Plus,Trash2,Upload,Download} from 'lucide-react';
import {id} from './model';
import type {Room} from './project';
import {FIXTURES,FIXTURE_GROUPS,WALL_NAMES,newFixture,wallLength,fixtureLabel,type Fixture,type FixtureType,type Wall} from './fixtures';
import {exportBazisConfig,importBazisConfig} from './bazisRoom';
import {saveFile} from './exports';
type Props={room:Room;selected?:string;onSelect:(id:string)=>void;onChange:(room:Room)=>boolean;roomName?:string;onImport:(result:{room:Room;name:string;notes:string[]})=>void};
/** Объекты замера на стенах — состав как у скрипта Базиса «Замер помещения»; импорт и экспорт его Config.xml. */
export function RoomFixtures({room,selected,onSelect,onChange,roomName,onImport}:Props){
  const cards=useRef(new Map<string,HTMLDivElement>()),file=useRef<HTMLInputElement>(null);
  const [type,setType]=useState<FixtureType>('socket'),[wall,setWall]=useState<Wall>('back'),[message,setMessage]=useState('');
  useEffect(()=>{if(selected)cards.current.get(selected)?.scrollIntoView({block:'nearest'});},[selected]);
  const list=room.fixtures||[];
  function patch(f:Fixture,change:Partial<Fixture>){return onChange({...room,fixtures:list.map(a=>a.id===f.id?{...a,...change}:a)});}
  function add(){const f=newFixture(room,type,wall,id());if(onChange({...room,fixtures:[...list,f]}))onSelect(f.id);}
  const num=(f:Fixture,key:'offset'|'fromFloor'|'width'|'height'|'depth',label:string,i:number)=><label key={key}>{label}<input type="number" aria-label={label+' объекта '+(i+1)} key={f[key]} defaultValue={f[key]} onBlur={e=>{if(!patch(f,{[key]:Number(e.target.value)}))e.target.value=String(f[key]);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span>мм</span></label>;
  return <div className="room-openings"><h3>Объекты на стенах</h3>
    <p className="field-note">Состав как в скрипте Базиса «Замер помещения»: розетки, щиток, батарея с трубами, короба, плинтусы, ниши, фартук, лючок, водонагреватель, газовый счётчик. Отступ — вдоль стены как у проёмов; выступ — от стены в комнату. Мебель, которая их закрывает, отмечается в замечаниях.</p>
    <div className="bazis-exchange"><button className="outline" onClick={()=>file.current?.click()}><Upload size={14}/> Импорт Config.xml Базиса</button><button className="outline" disabled={!list.length&&!(room.openings||[]).length} onClick={()=>saveFile((roomName||'Помещение')+' · Config.xml',exportBazisConfig(room,roomName||'ПОМЕЩЕНИЕ'),'application/xml;charset=utf-8')}><Download size={14}/> Экспорт для скрипта Базиса</button>
      <input ref={file} hidden type="file" accept=".xml" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{const text=await f.text();const result=importBazisConfig(text);onImport(result);setMessage(`Замер «${result.name||'без названия'}» загружен: ${result.room.width} × ${result.room.depth} × ${result.room.height}, проёмов ${(result.room.openings||[]).length}, объектов ${(result.room.fixtures||[]).length}.${result.notes.length?' '+result.notes.join(' '):''}`);}catch(err){setMessage('Не удалось прочитать Config.xml: '+(err as Error).message);}}}/></div>
    {message&&<p className="field-note" role="status">{message}</p>}
    <p className="field-note">Config.xml лежит рядом со скриптом («Documents\Bazis Mebelshik\…\Scripts\Замер помещения») и хранит последний заполненный замер. Экспорт создаёт такой же файл: положите его в папку скрипта и запустите «Замер помещения» в Базисе.</p>
    <div className="room-add fixture-add"><select aria-label="Тип объекта" value={type} onChange={e=>setType(e.target.value as FixtureType)}>{FIXTURE_GROUPS.map(g=><optgroup key={g} label={g}>{(Object.keys(FIXTURES) as FixtureType[]).filter(k=>FIXTURES[k].group===g).map(k=><option key={k} value={k}>{FIXTURES[k].label}</option>)}</optgroup>)}</select><select aria-label="Стена объекта" value={wall} onChange={e=>setWall(e.target.value as Wall)}>{(Object.keys(WALL_NAMES) as Wall[]).map(w=><option key={w} value={w}>{WALL_NAMES[w]}</option>)}</select><button disabled={list.length>=60} onClick={add}><Plus size={14}/> Добавить</button></div>
    {list.map((f,i)=>{const spec=FIXTURES[f.type];return <div className={'opening-card'+(selected===f.id?' selected':'')} key={f.id} ref={node=>{if(node)cards.current.set(f.id,node);else cards.current.delete(f.id);}} onFocus={()=>onSelect(f.id)}>
      <header><button className="opening-title" aria-pressed={selected===f.id} onClick={()=>onSelect(f.id)}>{fixtureLabel(f,i)}</button><button aria-label={'Удалить объект '+(i+1)} onClick={()=>onChange({...room,fixtures:list.filter(a=>a.id!==f.id)})}><Trash2 size={14}/></button></header>
      <select aria-label={'Стена объекта '+(i+1)} value={f.wall} onChange={e=>{const w=e.target.value as Wall;const len=wallLength(room,w);patch(f,{wall:w,offset:Math.min(f.offset,Math.max(0,len-f.width)),width:Math.min(f.width,len)});}}>{(Object.keys(WALL_NAMES) as Wall[]).map(w=><option key={w} value={w}>{WALL_NAMES[w]}</option>)}</select>
      <input aria-label={'Название объекта '+(i+1)} key={f.name??''} defaultValue={f.name??''} placeholder={spec.label} maxLength={80} onBlur={e=>{const v=e.target.value.trim();if(!patch(f,v?{name:v}:{name:undefined}))e.target.value=f.name??'';}}/>
      {num(f,'offset','От начала стены',i)}{num(f,'fromFloor','От пола',i)}{num(f,'width',f.round&&!f.horizontal?'Диаметр':'Ширина вдоль стены',i)}{num(f,'height',f.round&&f.horizontal?'Диаметр':'Высота',i)}{num(f,'depth',spec.recess?'Глубина ниши':'Выступ от стены',i)}
      {f.type==='vent'&&<label className="hardware-field"><span><input type="checkbox" checked={!!f.round} onChange={e=>patch(f,{round:e.target.checked||undefined})}/> Круглая</span></label>}
      {f.type==='vent'&&<label className="hardware-field"><span><input type="checkbox" checked={!!f.grille} onChange={e=>patch(f,{grille:e.target.checked||undefined})}/> Решётка</span></label>}
      {f.type==='pipe'&&<label className="hardware-field"><span><input type="checkbox" checked={!!f.horizontal} onChange={e=>patch(f,{horizontal:e.target.checked||undefined})}/> Горизонтальная вдоль стены</span></label>}
      {spec.access&&<p className="field-note">Нужен доступ: мебель не должна закрывать.</p>}
    </div>;})}
  </div>;
}
