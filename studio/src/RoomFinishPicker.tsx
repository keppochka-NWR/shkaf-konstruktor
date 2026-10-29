// Отделка помещения на этапе «Помещение» (список Макса 29.10.2026): ламинат или плитка на пол, обои, плитка или покраска на
// стены — по ассортименту Лемана ПРО (roomFinishes.ts). Только показ клиенту: в детали, смету и цены не входит.
import {useEffect,useMemo,useRef,useState} from 'react';
import {ExternalLink,X} from 'lucide-react';
import type {Room} from './project';
import {FINISHES,FINISH_KIND_NAMES,FINISH_WALLS,FINISH_WALL_NAMES,PAINTS,defaultAlong,finishById,finishFits,finishSize,setWallFinish,withFinish,type FinishItem,type FinishKind,type FinishWall,type WallFinish} from './roomFinishes';
import {drawFinish} from './finishTextures';
import './room-finishes.css';

const swatches=new Map<string,string>();
/** Образец 48×48: квадрат из начала раппорта (несколько досок/плиток или кусок обоев). */
function swatchUrl(f:FinishItem){
  let url=swatches.get(f.id);if(url!==undefined)return url;
  try{const {canvas}=drawFinish(f,320),side=Math.min(canvas.width,canvas.height),c=document.createElement('canvas');c.width=c.height=48;c.getContext('2d')?.drawImage(canvas,0,0,side,side,0,0,48,48);url=c.toDataURL();}catch{url='';}
  swatches.set(f.id,url);return url;
}
function Swatch({f,paint}:{f?:FinishItem;paint?:string}){
  // образец рисуется после первого кадра (60+ позиций не тормозят открытие списка); смена позиции — свой образец
  const [drawn,setDrawn]=useState<{id:string;url:string}>();
  const url=f?(drawn?.id===f.id?drawn.url:swatches.get(f.id)):undefined;
  useEffect(()=>{if(f&&url===undefined){const t=setTimeout(()=>setDrawn({id:f.id,url:swatchUrl(f)}),0);return ()=>clearTimeout(t);}},[f,url]);
  return <span className="finish-swatch" aria-hidden="true" style={paint?{background:paint}:url?{backgroundImage:`url(${url})`}:{background:f?.tone[0]}}/>;
}
const norm=(s:string)=>s.toLowerCase().replace(/ё/g,'е');
function Item({f,active,onPick}:{f:FinishItem;active:boolean;onPick:()=>void}){
  return <div className={'finish-item'+(active?' active':'')}>
    <button aria-pressed={active} onClick={onPick} title={f.colour}><Swatch f={f}/><span className="finish-text"><b>{f.name}</b><small>Арт. {f.article} · {finishSize(f)}</small></span></button>
    <a href={f.url} target="_blank" rel="noopener noreferrer" aria-label={'Открыть на Лемана Про: '+f.name} title="Открыть на Лемана Про"><ExternalLink size={14}/></a>
  </div>;
}
function Current({label,f,paint,onClear}:{label:string;f?:FinishItem;paint?:string;onClear?:()=>void}){
  return <div className="finish-current" data-testid="finish-current">
    <Swatch f={f} paint={paint}/>
    <span className="finish-text"><small>{label}</small>{f?<><b>{f.name}</b><small>Арт. {f.article} · {finishSize(f)} · {f.colour}</small><a href={f.url} target="_blank" rel="noopener noreferrer">Открыть на Лемана Про</a></>:paint?<b>Покраска {PAINTS.find(p=>p.color===paint)?.name?.toLowerCase()??paint}</b>:<b>Без отделки</b>}</span>
    {onClear&&(f||paint)&&<button className="finish-clear" aria-label={'Убрать отделку: '+label} title="Убрать отделку" onClick={onClear}><X size={14}/></button>}
  </div>;
}

export function RoomFinishes({room,onChange}:{room:Room;onChange:(room:Room)=>boolean}){
  const [surface,setSurface]=useState<'floor'|'wall'>('floor');
  const [wall,setWall]=useState<FinishWall|'all'>('all');
  const [kind,setKind]=useState<FinishKind|'all'>('all');
  const [query,setQuery]=useState('');
  const list=useRef<HTMLDivElement>(null);
  const kinds:FinishKind[]=surface==='floor'?['laminate','tile']:['wallpaper','tile'];
  const items=useMemo(()=>{const q=norm(query.trim());return FINISHES.filter(f=>finishFits(f,surface)&&(kind==='all'||f.kind===kind)&&(!q||q.split(/\s+/).every(w=>norm([f.name,f.brand,f.collection??'',f.article,f.colour,FINISH_KIND_NAMES[f.kind]].join(' ')).includes(w))));},[surface,kind,query]);
  const walls=wall==='all'?FINISH_WALLS:[wall];
  const wallValues=walls.map(w=>room.finish?.walls?.[w]),same=wallValues.every(v=>JSON.stringify(v)===JSON.stringify(wallValues[0])),wallValue=same?wallValues[0]:undefined;
  const wallItem=wallValue&&'id' in wallValue?finishById(wallValue.id):undefined,wallPaint=wallValue&&'paint' in wallValue?wallValue.paint:undefined;
  const floor=room.finish?.floor,floorItem=finishById(floor?.id);
  const setWalls=(v:WallFinish|undefined)=>onChange(setWallFinish(room,walls,v));
  // Свой цвет (критик 29.10 п.2): пока менеджер ведёт по палитре — только образец в панели (React onChange = событие input),
  // в проект — одним шагом, когда палитру закрыли (нативное change): без сохранения, шага «Назад» и пересборки сцены на каждый сдвиг.
  const [preview,setPreview]=useState<string>(),picker=useRef<HTMLInputElement>(null),commitPaint=useRef<(c:string)=>void>(()=>{});
  commitPaint.current=c=>{setPreview(undefined);if(c!==wallPaint)setWalls({paint:c});};
  useEffect(()=>{const el=picker.current;if(!el)return;const done=()=>commitPaint.current(el.value);el.addEventListener('change',done);return ()=>el.removeEventListener('change',done);},[surface]);
  const pickFloor=(f:FinishItem)=>onChange(withFinish(room,{...room.finish,floor:{id:f.id,along:floor?.along??defaultAlong(room)}}));
  const switchSurface=(s:'floor'|'wall')=>{setSurface(s);setKind('all');list.current?.scrollTo?.({top:0});};
  return <div className="room-finishes" data-testid="room-finishes">
    <h3>Отделка: пол и стены</h3>
    <p className="finish-note" role="note">Только для показа клиенту — в детали и смету не входит. Ассортимент Лемана ПРО; цвет и рисунок в 3D условные, точный вид и наличие — по ссылке.</p>
    <div className="finish-tabs" role="tablist" aria-label="Поверхность">
      <button role="tab" aria-selected={surface==='floor'} onClick={()=>switchSurface('floor')}>Пол</button>
      <button role="tab" aria-selected={surface==='wall'} onClick={()=>switchSurface('wall')}>Стены</button>
    </div>
    {surface==='floor'?<>
      <Current label="Пол" f={floorItem} onClear={()=>onChange(withFinish(room,{...room.finish,floor:undefined}))}/>
      {floorItem&&<label className="hardware-field">Укладка: длинная сторона вдоль<select aria-label="Направление укладки" value={floor?.along??defaultAlong(room)} onChange={e=>onChange(withFinish(room,{...room.finish,floor:{id:floorItem.id,along:e.target.value as 'width'|'depth'}}))}><option value="width">ширины комнаты ({room.width} мм)</option><option value="depth">глубины комнаты ({room.depth} мм)</option></select></label>}
    </>:<>
      <label className="hardware-field">Стена<select aria-label="Стена для отделки" value={wall} onChange={e=>{setPreview(undefined);setWall(e.target.value as FinishWall|'all');}}><option value="all">Все стены</option>{FINISH_WALLS.map(w=><option key={w} value={w}>{FINISH_WALL_NAMES[w]}{room.finish?.walls?.[w]?' ✓':''}</option>)}</select></label>
      {same?<Current label={wall==='all'?'Все стены':FINISH_WALL_NAMES[wall]+' стена'} f={preview?undefined:wallItem} paint={preview??wallPaint} onClear={()=>setWalls(undefined)}/>:<div className="finish-current"><span className="finish-text"><small>Все стены</small><b>Отделка разная</b><small>Выберите ниже — ляжет на все стены, или выберите одну стену.</small></span><button className="finish-clear" aria-label="Убрать отделку: Все стены" title="Убрать отделку со всех стен" onClick={()=>setWalls(undefined)}><X size={14}/></button></div>}
      <div className="finish-paints" aria-label="Покраска">
        <span>Покраска</span>
        {PAINTS.map(p=><button key={p.color} className={'finish-paint'+(wallPaint===p.color?' active':'')} aria-pressed={wallPaint===p.color} aria-label={'Покраска: '+p.name} title={p.name} style={{background:p.color}} onClick={()=>{setPreview(undefined);setWalls({paint:p.color});}}/>)}
        <label className="finish-paint custom" title="Другой цвет" style={preview?{background:preview}:undefined}><input ref={picker} type="color" aria-label="Другой цвет покраски" value={preview??wallPaint??'#f4f3ef'} onChange={e=>{/* change React тоже присылает после закрытия палитры — это уже записано */if(e.nativeEvent.type!=='change')setPreview(e.target.value);}}/></label>
      </div>
    </>}
    <input className="finish-search" type="search" aria-label="Поиск отделки" placeholder="Поиск: дуб, серый, артикул…" value={query} onChange={e=>setQuery(e.target.value)}/>
    <div className="finish-kinds" role="group" aria-label="Группа отделки">
      {(['all',...kinds] as const).map(k=><button key={k} aria-pressed={kind===k} onClick={()=>setKind(k)}>{k==='all'?'Все':FINISH_KIND_NAMES[k]}</button>)}
    </div>
    <div className="finish-list" ref={list} data-testid="finish-list">
      {kinds.filter(k=>kind==='all'||kind===k).map(k=>{const group=items.filter(f=>f.kind===k);return group.length?<section key={k}><h4>{FINISH_KIND_NAMES[k]} · {group.length}</h4>{group.map(f=><Item key={f.id} f={f} active={surface==='floor'?floor?.id===f.id:wallItem?.id===f.id} onPick={()=>surface==='floor'?pickFloor(f):setWalls({id:f.id})}/>)}</section>:null;})}
      {!items.length&&<p className="finish-empty">Ничего не найдено.</p>}
    </div>
  </div>;
}
