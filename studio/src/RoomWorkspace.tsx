import {EmptyRoomView} from './EmptyRoomView';
import {RoomTools} from './RoomTools';
import { useRef, useState, useMemo, useEffect } from 'react';
import App from './App';
import { CURRENT_PROJECT } from './projectStorage';
import { newProject, type Project } from './project';
import { saveFile } from './exports';
import { activeRoom, addRoom, migrateRoomDocument, parseRoomDocument, persistRoomDocument, removeRoom, renameRoom, selectRoom, updateRoom, ROOM_DOCUMENT_KEY, ROOM_DOCUMENT_BACKUP, type RoomDocument } from './roomDocument';
import './room-workspace.css';

/** Opt-in P1 workspace. Only the selected room is mounted in the legacy editor. */
export function RoomWorkspace({workspaceKey=''}:{workspaceKey?:string}={}) {
  const store=useMemo(()=>({getItem:(key:string)=>localStorage.getItem(key.startsWith(ROOM_DOCUMENT_KEY)?key+(workspaceKey?':'+workspaceKey:''):key),setItem:(key:string,value:string)=>localStorage.setItem(key.startsWith(ROOM_DOCUMENT_KEY)?key+(workspaceKey?':'+workspaceKey:''):key,value)}),[workspaceKey]);
  const writer=useRef(false),[writerMessage,setWriterMessage]=useState('Проверка доступа к записи…');
  useEffect(()=>{let release:()=>void=()=>{},cancelled=false;const controller=new AbortController();
    if(!navigator.locks){setWriterMessage('Браузер не поддерживает защиту одновременной записи. Откройте в Chrome или Edge.');return;}
    setWriterMessage('Ожидается доступ к записи. Если документ открыт в другой вкладке, закройте её.');
    void navigator.locks.request(ROOM_DOCUMENT_KEY+':writer:'+workspaceKey,{signal:controller.signal},async()=>{if(cancelled)return;writer.current=true;setWriterMessage('');await new Promise<void>(resolve=>{release=resolve;});if(!cancelled)writer.current=false;}).catch(e=>{if(!cancelled)setWriterMessage('Не удалось получить доступ к записи: '+e.message);});
    return()=>{cancelled=true;writer.current=false;controller.abort();release();};
  },[workspaceKey]);
  const [startup] = useState(() => {
    try {
      const raw = store.getItem(ROOM_DOCUMENT_KEY);
      const legacy = localStorage.getItem(CURRENT_PROJECT+(workspaceKey?':'+workspaceKey:''));
      return { document: raw ? parseRoomDocument(JSON.parse(raw)) : migrateRoomDocument(legacy ? JSON.parse(legacy) : undefined), raw, error: '' };
    } catch (e) { return { document: null, raw: null, error: String(e instanceof Error ? e.message : e) }; }
  });
  const [document, setDocument] = useState<RoomDocument | null>(startup.document);
  const current = useRef(document), expected = useRef(startup.raw);
  const [error, setError] = useState(startup.error), [saved, setSaved] = useState(startup.raw ? 'Сохранено в этом браузере' : 'Новая копия · ещё не сохранена');
  const [epoch, setEpoch] = useState(0), [confirmDelete, setConfirmDelete] = useState(false);
  const undo = useRef<RoomDocument[]>([]), redo = useRef<RoomDocument[]>([]);
  const upload = useRef<HTMLInputElement>(null), importSequence = useRef(0);
  function commit(candidate: RoomDocument, track = true, remount = false): boolean {
    try {
      if(!writer.current)throw Error('Документ редактируется в другой вкладке либо защита записи ещё не готова.');
      const result = persistRoomDocument(store, candidate, expected.current);
      if (track && current.current) { undo.current = [...undo.current, current.current].slice(-60); redo.current = []; }
      expected.current = result.serialized;
      current.current = result.document; setDocument(result.document);
      setSaved('Сохранено в этом браузере'); setError(''); setConfirmDelete(false);
      if (remount) setEpoch(v => v + 1);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setSaved('Изменение не сохранено и не применено'); return false; }
  }
  function run(action: (d: RoomDocument) => RoomDocument, remount = false) {
    if (!current.current) return;
    try { commit(action(current.current), true, remount); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  function history(back: boolean) {
    const from = back ? undo : redo, to = back ? redo : undo;
    const candidate = from.current.at(-1), old = current.current;
    if (candidate && old && commit(candidate, false, true)) { from.current.pop(); to.current.push(old); }
  }
  useEffect(()=>{
    if(!document||activeRoom(document).project.modules.length)return;
    const key=(e:KeyboardEvent)=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable="true"]')))return;
      if(e.key.toLowerCase()==='z'){e.preventDefault();history(!e.shiftKey);}else if(e.key.toLowerCase()==='y'){e.preventDefault();history(false);}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[document]);
  function restoreBackup() {
    try {
      if(!writer.current)throw Error('Документ редактируется в другой вкладке.');
      const raw = store.getItem(ROOM_DOCUMENT_BACKUP);
      if (!raw) throw Error('Предыдущая копия отсутствует.');
      const candidate = parseRoomDocument(JSON.parse(raw));
      // Preserve unreadable original before recovery. Never silently overwrite it.
      const original = store.getItem(ROOM_DOCUMENT_KEY);
      let nowValid = false;
      if(original!==null){try{parseRoomDocument(JSON.parse(original));nowValid=true;}catch{/* recovery only for an unreadable primary */}}
      if(nowValid)throw Error('В другой вкладке уже восстановлен документ. Перезагрузите страницу.');
      if (original !== null) store.setItem(ROOM_DOCUMENT_KEY + ':damaged:' + crypto.randomUUID(), original);
      // A corrupt document cannot provide a revision. Restore a validated copy atomically.
      store.setItem(ROOM_DOCUMENT_KEY, JSON.stringify(candidate));
      expected.current = JSON.stringify(candidate); current.current = candidate; setDocument(candidate); setError('');
      setSaved('Восстановлена предыдущая копия'); setEpoch(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  if (!document) return <main className="rooms-empty"><h1>Документ комнат не удалось открыть</h1><p role="alert">{error}</p><p>Исходная запись сохранена. Автозамена примером отключена.</p><button onClick={restoreBackup}>Восстановить предыдущую копию</button></main>;
  const room = activeRoom(document);
  const bar = <section className="rooms-bar" aria-label="Комнаты заказа">
    <div className="rooms-top"><strong>Комнаты заказа</strong><span role="status">{saved}</span><span>Мебель, расчёт и документы редактора — только выбранная комната</span></div>
    {writerMessage&&<p role="status">{writerMessage}</p>}
    <div className="rooms-controls">
      <label>Комната<select aria-label="Активная комната" value={room.id} onChange={e => run(d => selectRoom(d, e.target.value))}>{document.rooms.map(r => <option value={r.id} key={r.id}>{r.title}</option>)}</select></label>
      <input aria-label="Название комнаты" key={room.id + room.title} defaultValue={room.title} maxLength={60} onKeyDown={e => { if(e.key === 'Enter') e.currentTarget.blur(); if(e.key === 'Escape'){ e.currentTarget.value=room.title; e.currentTarget.blur(); } }} onBlur={e => { if(e.target.value!==room.title)run(d => renameRoom(d,room.id,e.target.value)); }} />
      <button onClick={() => run(d => addRoom(d, `Комната ${d.rooms.length + 1}`))}>Добавить комнату</button>
      <button onClick={() => run(d => addRoom(d, `${room.title.slice(0,50)} · копия`, room.id))}>Копировать комнату</button>
      <button disabled={document.rooms.length === 1} onClick={() => setConfirmDelete(true)}>Удалить комнату</button>
      <button disabled={!undo.current.length} onClick={() => history(true)}>Отменить изменение заказа</button>
      <button disabled={!redo.current.length} onClick={() => history(false)}>Повторить изменение заказа</button>
      <button onClick={() => commit(current.current!,false)}>Сохранить комнаты</button>
      <button onClick={() => saveFile('ГардерЁб комнаты.json',JSON.stringify(current.current,null,2),'application/json')}>Скачать все комнаты</button>
      <button onClick={() => upload.current?.click()}>Открыть документ комнат</button>
    </div>
    {confirmDelete && <div role="alert">Удалить «{room.title}» вместе с её мебелью? <button onClick={() => run(d => removeRoom(d,room.id))}>Подтвердить удаление комнаты</button><button onClick={() => setConfirmDelete(false)}>Оставить комнату</button></div>}
    <RoomTools document={document} update={d=>{if(d.revision!==current.current?.revision){setError('Документ уже изменился. Повторите действие с текущей версией.');return false;}return commit(d,true,true);}}/>
    {error && <p role="alert">{error}</p>}
    <input hidden ref={upload} type="file" accept=".json" onChange={async e => {
      const file=e.target.files?.[0];e.target.value='';if(!file)return;
      const sequence=++importSequence.current,before=current.current;
      try {
        if(file.size>20_000_000)throw Error('Документ больше 20 МБ.');
        const raw=JSON.parse(await file.text());
        if(sequence!==importSequence.current)return;
        if(current.current!==before)throw Error('Заказ изменился во время чтения. Повторите открытие файла.');
        const candidate=raw?.format==='garderyob-rooms'?parseRoomDocument(raw):migrateRoomDocument(raw);
        commit(candidate,true,true);
      } catch(e){setError(e instanceof Error?e.message:String(e));}
    }}/>
  </section>;
  if (!room.project.modules.length) return <EmptyRoomView title={room.title} bar={bar} viewKey={workspaceKey+':'+room.id} project={room.project} onAdd={()=>run(d=>updateRoom(d,room.id,{...room.project,modules:newProject().modules}))} onDownload={()=>saveFile('ГардерЁб комнаты.json',JSON.stringify(current.current,null,2),'application/json')} update={p=>{try{return commit(updateRoom(current.current!,room.id,p));}catch(e){setError((e as Error).message);return false;}}}/>;
  return <App onEmptyProject={p=>{try{return commit(updateRoom(current.current!,room.id,p));}catch(e){setError((e as Error).message);return false;}}} key={room.id} viewKey={workspaceKey+':'+room.id} externalVersion={epoch} initialProject={room.project} clientBar={bar} saveManagedProject={(p:Project) => {
    try { return commit(updateRoom(current.current!,room.id,p)); } catch(e){setError(e instanceof Error?e.message:String(e));return false;}
  }}/>;
}
