import {useState,useMemo,useRef,useEffect} from 'react';
import {Scene,type View} from './Scene';
import {parts} from './model';
import {VOTAN_DEFAULT,VOTAN_NOTES,parseVotan,votanProject,type VotanParameters} from './votan';
import './votan.css';

const KEY='studio-votan-approval-v1';
function load(){try{const s=localStorage.getItem(KEY);return s?parseVotan(JSON.parse(s)):VOTAN_DEFAULT;}catch{return VOTAN_DEFAULT;}}
function save(name:string,content:string,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const fields:[keyof VotanParameters,string,number,number][]=[['lowerHeight','Нижние модули',1900,2300],['upperHeight','Антресоли',300,600],['outerDepth','Внешняя глубина',550,650],['leftLength','Левая группа вдоль',1700,2300],['leftWidth','Левая группа поперёк',1700,2300],['rightWidth','Проходной модуль B1',1700,2300],['rightLength','Правая группа вдоль',1700,2300],['groupGap','Расстояние между группами',400,1600],['floorGap','Зазор от пола',10,15],['drawerFace','Три нижних фасада',280,350],['upperDrawerFace','Верхний фасад',100,160],['drawerGap','Зазор для захвата',20,40],['pantsWidth','Проём брючницы в чистоте',550,750],['pantsHeight','Высота брючницы',600,1300],['shelfCount','Полок над четырьмя ящиками',0,4]];
export default function VotanStudio(){
  const [history,setHistory]=useState<VotanParameters[]>(()=>[load()]),[cursor,setCursor]=useState(0);
  const p=history[cursor],project=useMemo(()=>votanProject(p),[p]);
  useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(p));}catch{/* Download remains available when local storage is full. */}},[p]);
  const [group,setGroup]=useState('all'),[active,setActive]=useState('B2'),[view,setView]=useState<View>('iso'),[open,setOpen]=useState(false),[transparent,setTransparent]=useState(false),[fit,setFit]=useState(0),[error,setError]=useState(''),[notes,setNotes]=useState(false),[preview,setPreview]=useState(false);
  const file=useRef<HTMLInputElement>(null),capture=useRef<(()=>string)|undefined>(undefined);
  const arrangement=project.modules.filter(a=>group==='all'||a.id.startsWith(group));
  const placed=arrangement.find(a=>a.id===active)??arrangement[0],m=placed.module;
  const count=project.modules.reduce((n,a)=>n+parts(a.module).length,0);
  function commit(next:VotanParameters){try{const q=parseVotan(next);localStorage.setItem(KEY,JSON.stringify(q));setHistory(h=>[...h.slice(0,cursor+1),q]);setCursor(cursor+1);setError('');}catch(e){setError((e as Error).message);}}
  function change(k:keyof VotanParameters,v:unknown){commit({...p,[k]:v});}
  function browse(g:string){setGroup(g);setFit(n=>n+1);setPreview(false);}
  const no=()=>false,noop=()=>{},reason=()=> 'Размеры и наполнение этого заказа меняются в панели параметров.';
  return <div className="votan-app">
    <header className="votan-head"><div><a href="./">← Студия шкафов</a><h1>Шкаф Вотан</h1><p>Модель для согласования · до замера</p></div><div className="votan-actions">
      <button disabled={!cursor} onClick={()=>{setCursor(cursor-1);setError('');}}>Отменить</button><button disabled={cursor===history.length-1} onClick={()=>setCursor(cursor+1)}>Повторить</button>
      <button onClick={()=>file.current?.click()}>Открыть параметры</button><button onClick={()=>save('votan-parameters.json',JSON.stringify(p,null,2))}>Скачать параметры</button>
      <button onClick={()=>{const data=capture.current?.();if(data){const a=document.createElement('a');a.href=data;a.download=`votan-${group}-${view}.png`;a.click();}}}>Снимок PNG</button>
      <button onClick={()=>setNotes(!notes)} aria-expanded={notes}>Вводные и допущения</button>
    </div></header>
    <input hidden type="file" accept=".json" ref={file} onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>100000)throw Error('Файл параметров слишком большой.');commit(parseVotan(JSON.parse(await f.text())));}catch(err){setError((err as Error).message);}}}/>
    {error&&<p className="votan-error" role="alert">{error}</p>}
    <main className="votan-layout">
      <aside className="votan-panel"><h2>Параметры заказа</h2><label>Стекло<select aria-label="Стекло заказа" value={p.glass} onChange={e=>change('glass',e.target.value)}><option value="moru-bronze">Мору бронза</option><option value="satin-bronze">Сатин бронза</option></select></label>
        <label className="votan-check"><input type="checkbox" checked={p.light} onChange={e=>change('light',e.target.checked)}/>Подсветка в крышах</label>
        {fields.map(([k,label,min,max])=><label key={k}>{label}<span><input aria-label={label} type="number" key={k+String(p[k])} defaultValue={Number(p[k])} min={min} max={max} step={1} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} onBlur={e=>{if(Number(e.target.value)!==p[k])change(k,Number(e.target.value));}}/><small>{k==='shelfCount'?'шт':'мм'}</small></span></label>)}
        <p className="votan-small">Фальши 32 мм. Направляющие Blum скрытые. Петли Premial. Цены и присадка требуют спецификации.</p>
        <button onClick={()=>commit(VOTAN_DEFAULT)}>Вернуть исходные параметры</button>
      </aside>
      <section className="votan-canvas"><nav aria-label="Вид заказа">{[['all','Обе группы'],['A','Левая группа'],['B','Правая группа']].map(([k,t])=><button aria-pressed={group===k} key={k} onClick={()=>browse(k)}>{t}</button>)}<span/>{(['iso','front','side','top'] as View[]).map(v=><button key={v} aria-pressed={v===view} onClick={()=>setView(v)}>{{iso:'3D',front:'Спереди',side:'Сбоку',top:'Сверху'}[v]}</button>)}</nav>
        <div className="votan-scene"><Scene isoDirection={group==="A"?[1,-1.7]:[-1,1.7]} arrangement={arrangement} module={m} activeId={placed.id} mode="orbit" moveAll={false} snap={(_,q)=>q} onMoveModule={no} moveProblem={reason} onMoveDivider={no} dividerProblem={reason} partProblem={reason} onMovePart={no} onDropItem={no} onTransfer={no} captureReady={fn=>{capture.current=fn;}} onObstacleSelect={noop} onModuleSelect={id=>{setActive(id);setPreview(false);}} transparent={transparent} onDimension={noop} onGap={noop} onPartSelect={noop} selected={m.sections[0].id} onSelect={noop} view={view} fit={fit} openDoors={open} exploded={false} dimensions={false} presentation={false} drawerPreview={preview&&['hanging','drawers'].includes(m.casework!.kind)?{sid:m.sections[0].id,index:0}:undefined}/></div>
        <div className="votan-views"><label><input type="checkbox" checked={open} onChange={e=>setOpen(e.target.checked)}/>Открыть фасады</label><label><input type="checkbox" checked={transparent} onChange={e=>setTransparent(e.target.checked)}/>Прозрачный корпус</label><button onClick={()=>setFit(n=>n+1)}>Вписать</button><button disabled={!['hanging','drawers'].includes(m.casework!.kind)} onClick={()=>{setOpen(true);setPreview(!preview);}}>{preview?'Задвинуть':'Выдвинуть'} нижний ящик</button></div>
        <div className="votan-modules" aria-label="Модули заказа">{arrangement.map(a=><button aria-pressed={a.id===placed.id} key={a.id} onClick={()=>{setActive(a.id);setPreview(false);}}>{a.module.name}</button>)}</div>
        <p className="votan-caption">{m.name} · {m.width} × {m.height} × {m.depth} мм по корпусу. Всего {project.modules.length} модулей, {count} элементов. Вращение — мышью, масштаб — колесом.</p>
      </section>
    </main>
    {notes&&<section className="votan-notes"><h2>Что показано и что ещё согласовать</h2><ol>{VOTAN_NOTES.map(t=><li key={t}>{t}</li>)}</ol><p>Подсветка: реле клиента → блок питания → световая линия. Управление пьезовыключателем и датчиком движения выполняет клиент. Монтаж шкафов без опор и плинтусов.</p><button onClick={()=>save('votan-inputs.txt',VOTAN_NOTES.join('\n\n'),'text/plain;charset=utf-8')}>Скачать пояснения</button></section>}
    <footer className="votan-foot">Предварительная компоновка. Видимые механизмы — условные габариты. Смета, присадка, опоры длинных штанг и траектории петель не утверждены.</footer>
  </div>;
}

