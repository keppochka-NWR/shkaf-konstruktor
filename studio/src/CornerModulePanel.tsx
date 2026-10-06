import {useEffect,useState} from 'react';
import type {Module,Section} from './model';
import {cornerBoxes,cornerDrawer,cornerOffsets} from './cornerWardrobe';
import type {Room} from './project';

function Numeric({label,value,min,max,change}:{label:string;value:number;min:number;max:number;change:(v:number)=>boolean}){
 const [draft,setDraft]=useState(String(Math.round(value))),[error,setError]=useState('');
 useEffect(()=>{setDraft(String(Math.round(value)));setError('');},[value]);
 function apply(){const n=Number(draft);if(!draft.trim()||!Number.isFinite(n)||n<min||n>max){setError(`Допустимо ${min}–${max} мм`);setDraft(String(Math.round(value)));return;}setError('');if(n!==value&&!change(n))setDraft(String(Math.round(value)));}
 return <label className="number-field"><span>{label}</span><div><input aria-label={label} type="number" min={min} max={max} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={apply} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){setDraft(String(Math.round(value)));}}}/><small>мм</small></div>{error&&<small role="alert">{error}</small>}</label>;
}
export function distributeCornerShelves(m:Module,s:Section,count:number){
 const b=cornerBoxes(m).find(b=>b.id===s.id)!,span=b.top-b.bottom;
 const cap=s.drawers?Math.max(...cornerOffsets(m,s).map((y,j)=>y+cornerDrawer(m,s,j).height+40))+16:0;
 s.shelves=Array.from({length:count},(_,k)=>(cap+(span-cap)*(k+1)/(count+1))/span);
}
export function CornerModulePanel({module:m,stage,selected,update,select,material,addUpper,position,room,rotation,rotate,move,preview}:{
 module:Module;stage:string;selected:string;update:(m:Module)=>boolean;select:(sid:string)=>void;
 material:(target:'decor'|'facadeDecor'|'drawerFacadeDecor')=>void;addUpper:()=>void;
 position:{x:number;y:number;z:number;w:number;d:number;h:number};room:Room;rotation:0|90|180|270;
 rotate:(r:0|90|180|270)=>boolean;move:(axis:'x'|'y'|'z',v:number)=>void;
 preview:(sid:string,j:number|null,pid:string)=>void;
}){
 const c=m.corner!,upper=c.level==='upper',index=Math.max(0,m.sections.findIndex(s=>s.id===selected)),s=m.sections[index],b=cornerBoxes(m)[index],span=b.top-b.bottom;
 const labels=upper?['Антресоль']:['Левый блок','Правый блок','Центр'];
 const change=(fn:(n:Module)=>void)=>{const n=structuredClone(m);fn(n);return update(n);};
 const changeSection=(fn:(s:Section,n:Module)=>void)=>change(n=>fn(n.sections[index],n));
 return <div className="corner-properties">
  <div className="property-section"><h2>{upper?'Угловая антресоль':'Пятиугольный угловой шкаф'}</h2><p className="field-note">Корпус в общей комнате. Перемещайте и поворачивайте его вместе с остальной мебелью. В наполнении выберите блок ниже или нажмите на деталь.</p></div>
  <details className="property-section" open={stage==='bodies'} key={'geometry-'+stage}><summary>Корпус и положение</summary>
   <label className="hardware-field">Название<input aria-label="Название углового модуля" key={m.name} defaultValue={m.name} maxLength={80} onBlur={e=>{if(e.target.value.trim())change(n=>n.name=e.target.value.trim());}}/></label>
   <Numeric label="Сторона угла" value={m.width} min={950} max={1400} change={v=>change(n=>{n.width=v;n.depth=v;})}/>
   <Numeric label="Высота углового корпуса" value={m.height} min={upper?300:1400} max={2200} change={v=>change(n=>{n.height=v;})}/>
   <Numeric label="Глубина боковин угла" value={c.sideDepth} min={400} max={650} change={v=>change(n=>{n.corner!.sideDepth=v;})}/>
   {!upper&&<><Numeric label="Ширина боковых блоков" value={c.bayWidth} min={300} max={400} change={v=>change(n=>{n.corner!.bayWidth=v;})}/><Numeric label="Глубина наполнения угла" value={c.bayDepth} min={300} max={450} change={v=>change(n=>{n.corner!.bayDepth=v;})}/><Numeric label="Верхний проём углового корпуса" value={c.middleClear} min={200} max={450} change={v=>change(n=>{n.corner!.middleClear=v;})}/><label className="hardware-field"><span><input type="checkbox" checked={!c.sharedTop} onChange={e=>change(n=>{n.corner!.sharedTop=!e.target.checked;})}/> Собственная крыша корпуса</span></label><p className="field-note">Отключайте крышу только когда дно антресоли закрывает корпус сверху.</p><button className="outline full" onClick={addUpper}>Добавить угловую антресоль сверху</button></>}
   <label className="hardware-field">Поворот корпуса<select aria-label="Поворот углового корпуса" value={rotation} onChange={e=>rotate(Number(e.target.value) as typeof rotation)}>{[0,90,180,270].map(r=><option key={r} value={r}>{r}°</option>)}</select></label>
   {(['x','z','y'] as const).map(axis=><Numeric key={axis} label={{x:'От левой стены',z:'От задней стены',y:'От пола'}[axis]} value={position[axis]} min={0} max={{x:room.width-position.w,z:room.depth-position.d,y:room.height-position.h}[axis]} change={v=>{move(axis,v);return true;}}/>)}
  </details>
  <details className="property-section" open={stage==='filling'} key={'fill-'+stage}><summary>Наполнение угла</summary>
   <div className="segmented">{m.sections.map((sec,i)=><button type="button" key={sec.id} aria-pressed={s.id===sec.id} onClick={()=>select(sec.id)}>{labels[i]}</button>)}</div>
   <p className="field-note">{labels[index]} · ширина в свету {Math.round(b.width)} мм · высота {Math.round(span)} мм</p>
   <label className="hardware-field">Количество полок<select aria-label="Количество полок угловой секции" value={s.shelves.length} onChange={e=>changeSection((sec,n)=>distributeCornerShelves(n,sec,Number(e.target.value)))}>{Array.from({length:7},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label>
   {s.shelves.map((f,j)=><div key={j}><Numeric label={`Угловая полка ${j+1} от дна отделения`} value={f*span} min={24} max={Math.floor(span-24)} change={v=>changeSection(sec=>sec.shelves[j]=v/span)}/><button className="text-action" onClick={()=>preview(s.id,null,s.id+':shelf:'+j)}>Выбрать полку {j+1} в модели</button></div>)}
   {!!s.shelves.length&&<button className="text-action" onClick={()=>changeSection((sec,n)=>distributeCornerShelves(n,sec,sec.shelves.length))}>Равномерно расставить полки</button>}
   {!upper&&index<2&&<><label className="hardware-field">Количество ящиков<select aria-label="Количество ящиков угловой секции" value={s.drawers} onChange={e=>changeSection((sec,n)=>{const count=Number(e.target.value);sec.drawerConfigs=Array.from({length:count},(_,j)=>({...cornerDrawer(n,sec,j)}));sec.drawers=count;distributeCornerShelves(n,sec,sec.shelves.length);})}>{Array.from({length:6},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label><p className="field-note">Полка над ящиками добавляется автоматически. Левый и правый блоки выдвигаются навстречу: открывайте их по очереди.</p>
    {Array.from({length:s.drawers},(_,j)=>{const cfg=cornerDrawer(m,s,j);const patch=(values:Partial<typeof cfg>)=>changeSection((sec,n)=>{sec.drawerConfigs=Array.from({length:sec.drawers},(_,k)=>({...cornerDrawer(n,sec,k)}));sec.drawerConfigs[j]={...sec.drawerConfigs[j],...values};});return <details key={j} className="corner-drawer"><summary>Ящик {j+1} · {cfg.height} мм · {cfg.slide==='ball'?'шариковые':'скрытый монтаж'}</summary><Numeric label={`Высота углового ящика ${j+1}`} value={cfg.height} min={140} max={230} change={v=>patch({height:v})}/><Numeric label={`Ящик ${j+1} от дна отделения`} value={cornerOffsets(m,s)[j]} min={0} max={Math.floor(span-cfg.height-80)} change={v=>patch({y:v})}/><label className="hardware-field">Направляющие<select aria-label={`Направляющие углового ящика ${j+1}`} value={cfg.slide} onChange={e=>patch({slide:e.target.value as 'ball'|'gtv0fpo'})}><option value="ball">GTV шариковые</option><option value="gtv0fpo">GTV 0FPO скрытого монтажа</option></select></label><label className="hardware-field">Длина направляющей<select aria-label={`Длина направляющей углового ящика ${j+1}`} value={cfg.length} onChange={e=>patch({length:Number(e.target.value)})}>{[250,300,350,400].map(n=><option key={n} value={n}>{n} мм</option>)}</select></label><label><input type="checkbox" checked={!cfg.noFacade} onChange={e=>patch({noFacade:!e.target.checked})}/> Фасад ящика</label><button className="outline full" onClick={()=>preview(s.id,j,s.id+':drawer:'+j+':bottom')}>Выдвинуть ящик {j+1}</button></details>;})}
   </>}
   {!upper&&index===2&&<><label className="hardware-field"><span><input type="checkbox" checked={s.rod} onChange={e=>changeSection(sec=>sec.rod=e.target.checked)}/> Штанга в центре</span></label>{s.rod&&<Numeric label="Штанга от дна центрального отделения" value={(s.rodAt??(span-70)/span)*span} min={100} max={Math.floor(span-30)} change={v=>changeSection(sec=>sec.rodAt=v/span)}/>}</>}
   <button className="text-action danger" onClick={()=>changeSection(sec=>{sec.drawers=0;sec.drawerConfigs=[];sec.shelves=[];sec.rod=false;delete sec.rodAt;})}>Очистить выбранный блок</button>
  </details>
  <details className="property-section" open={stage==='facades'} key={'finish-'+stage}><summary>Материалы и фасады</summary>
   <button className="text-action" onClick={()=>material('decor')}>Корпус: {m.decor}</button><button className="text-action" onClick={()=>material('facadeDecor')}>Фасады: {m.facadeDecor}</button><button className="text-action" onClick={()=>material('drawerFacadeDecor')}>Фасады ящиков: {m.drawerFacadeDecor??m.facadeDecor}</button>
   <label className="hardware-field">Задняя стенка<select aria-label="Задняя стенка углового модуля" value={m.backType??'nailed'} onChange={e=>change(n=>{n.backType=e.target.value as 'nailed'|'none';})}><option value="nailed">Накладной ХДФ 3 мм</option><option value="none">Без задней стенки</option></select></label>
   <label className="hardware-field"><span><input type="checkbox" aria-label="Диагональные двери" checked={m.doors} onChange={e=>change(n=>n.doors=e.target.checked)}/> Две диагональные распашные двери</span></label>
   {!!m.sections.at(-1)?.removedDoors?.length&&<button className="outline" onClick={()=>change(n=>{delete n.sections.at(-1)!.removedDoors;n.doors=true;})}>Восстановить удалённые двери</button>}
   <p className="field-note">Конкретные петли для диагональных дверей и присадку проверяет технолог. Показ открывания — геометрическое приближение.</p>
  </details>
 </div>;
}
