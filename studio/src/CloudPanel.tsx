import {saveFile} from './exports';
import {backupProject,projectContent} from './projectStorage';
import {useEffect,useState,useRef} from 'react';
import {parseProject,type Project} from './project';
import {LIBRARY_KEY,inspectStoredLibrary,parseLibraryFile,writeStoredLibrary} from './moduleLibraryFile';
type User={email:string;role:'manager'|'admin'};
type Revision={revision:number;name:string;updated:number};
type Entry={id:string;name:string;email:string;revision:number;updated:number;archived:number};
async function api(path:string,body?:unknown){const r=await fetch('/api/studio'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','x-studio-request':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});let data;try{data=await r.json();}catch{throw Error('Сервер кабинета недоступен. Запустите студию с сервером.');}if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:'Проверьте введённые данные.');return data;}
export function CloudPanel({project,update}:{project:Project;update:(p:Project)=>boolean}){
  const mounted=useRef(false),latest=useRef(project),listRequest=useRef(0),pending=useRef(0);
  latest.current=project;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;listRequest.current++;};},[]);
  function canApply(){if(!mounted.current)return false;if(latest.current!==project){setMessage('Рабочий проект изменился во время запроса. Он оставлен без изменений; проверьте сохранённый вариант в списке.');return false;}return true;}
  const [user,setUser]=useState<User|null>(null),[mode,setMode]=useState(''),[ready,setReady]=useState(false),[email,setEmail]=useState('manager@example.test'),[code,setCode]=useState(''),[sent,setSent]=useState(false),[items,setItems]=useState<Entry[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[all,setAll]=useState(false),[archived,setArchived]=useState(false),[name,setName]=useState(project.cloud?.name||project.modules[0].module.name),[message,setMessage]=useState('');
  const [query,setQuery]=useState(''),[sort,setSort]=useState('recent');
  const words=query.toLocaleLowerCase('ru').trim().split(/\s+/).filter(Boolean);
  const visibleItems=items.filter(item=>words.every(word=>(item.name+' '+item.email).toLocaleLowerCase('ru').includes(word))).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'ru')||b.updated-a.updated:b.updated-a.updated||a.name.localeCompare(b.name,'ru'));
  const [snapshot,setSnapshot]=useState<{id:string;revision:number;content:string;name:string}|null>(null);
  const [snapshotError,setSnapshotError]=useState('');
  useEffect(()=>{let live=true;setSnapshot(null);setSnapshotError('');if(user&&project.cloud){const id=project.cloud.id;api('/projects/'+id).then(r=>{if(live)setSnapshot({id,revision:r.revision,content:projectContent(r.data),name:r.name});}).catch(()=>{if(live)setSnapshotError('Не удалось сверить рабочий проект с сервером.');});}return()=>{live=false;};},[user,project.cloud?.id,project.cloud?.revision]);
  const syncStatus=!project.cloud?'Этот рабочий проект ещё не связан с сохранением в кабинете.':snapshotError||(!snapshot?'Проверяю сохранение на сервере…':snapshot.revision!==project.cloud.revision?'На сервере появилась другая версия. Сохраните свою копию, чтобы сохранить оба варианта.':snapshot.content===projectContent(project)&&snapshot.name===name.trim()?'Рабочий проект совпадает с серверной версией '+snapshot.revision+'.':'Есть изменения, которые ещё не сохранены на сервере.');
  const [history,setHistory]=useState<{item:Entry;items:Revision[]}|null>(null);
  const reload=async()=>{const request=++listRequest.current;const r=await api('/projects?all='+all+'&archived='+archived);if(mounted.current&&request===listRequest.current)setItems(r.items);};
  async function run(fn:()=>Promise<void>){pending.current++;setBusy(true);setError('');setMessage('');try{await fn();}catch(e){if(mounted.current)setError((e as Error).message);}finally{pending.current--;if(mounted.current)setBusy(pending.current>0);}}
  useEffect(()=>{let live=true;(async()=>{try{const s=await api('/status');if(!live)return;setMode(s.mode);setReady(s.ready);if(s.mode!=='local-demo')setEmail('');try{const u=await api('/me');if(live)setUser(u);}catch{}}catch(e){if(live)setError((e as Error).message);}})();return()=>{live=false;};},[]);
  useEffect(()=>{if(user)run(reload);},[user,all,archived]);
  async function requestCode(){const r=await api('/auth/code',{email});if(r.demoCode)setUser(await api('/auth/verify',{email,code:r.demoCode}));else setSent(true);}
  async function save(copy:boolean){
    const link=!copy&&project.cloud?.owner===user?.email?project.cloud:undefined,id=link?.id||crypto.randomUUID();
    const r=await api('/projects',{id,name:name.trim()||'Проект',revision:link?.revision||0,data:project});
    if(!mounted.current)return;
    if(canApply()){
      const linked=update({...project,cloud:{id,revision:r.revision,owner:user!.email,name:name.trim()||'Проект'}});
      setMessage(linked?'Проект сохранён на сервере. Версия '+r.revision+'.':'Версия '+r.revision+' сохранена на сервере, но рабочий проект не удалось связать с ней. Откройте сохранённый вариант из списка после проверки текущих правок.');
    }
    try{await reload();}catch{if(mounted.current)setError('Не удалось обновить список проектов. Запись на сервере уже выполнена; повторно откройте кабинет для проверки.');}
  }
  async function load(item:Entry){const r=await api('/projects/'+item.id),p=parseProject(r.data);p.cloud={id:item.id,revision:r.revision,owner:r.email,name:r.name};if(!canApply())return;backupProject(project);if(update(p)){setName(r.name);setItems(previous=>previous.map(entry=>entry.id===item.id?{...entry,name:r.name,revision:r.revision,email:r.email,updated:r.updated}:entry));setMessage('Открыт проект «'+r.name+'».');}}
  async function downloadSaved(item:Entry){
    const r=await api('/projects/'+item.id),p=parseProject(r.data);
    p.cloud={id:item.id,revision:r.revision,owner:r.email,name:r.name};
    if(!mounted.current)return;
    const filename=(r.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim()||'Проект')+'.project.json';
    saveFile(filename,JSON.stringify(p,null,2),'application/json');
    setMessage('Файл серверной версии '+r.revision+' передан браузеру для скачивания. Рабочий проект не изменён.');
  }
  const [libraryInfo,setLibraryInfo]=useState('');
  useEffect(()=>{let live=true;if(!user){setLibraryInfo('');return;}api('/library').then(r=>{if(live)setLibraryInfo(r.items.length?`На сервере ${r.items.length} шаблонов · ${new Date(r.updated*1000).toLocaleString('ru-RU')}`:'На сервере шаблонов пока нет.');}).catch(()=>{if(live)setLibraryInfo('');});return()=>{live=false;};},[user]);
  async function uploadLibrary(){
    const stored=inspectStoredLibrary(localStorage.getItem(LIBRARY_KEY));
    if(stored.problem)throw Error(stored.problem);
    if(!stored.items.length)throw Error('В этом браузере нет сохранённых шаблонов. Сохраните корпус или группу в «Моя библиотека модулей».');
    const r=await api('/library',{items:stored.items.map(({name,module,group})=>({name,module,...(group?{group}:{})}))});
    if(mounted.current){setLibraryInfo(`На сервере ${r.count} шаблонов · ${new Date(r.updated*1000).toLocaleString('ru-RU')}`);setMessage('Библиотека отправлена в кабинет: '+r.count+' шаблонов.');}
  }
  async function downloadLibrary(){
    const r=await api('/library');
    if(!r.items.length)throw Error('В кабинете нет шаблонов. Сначала отправьте библиотеку из браузера, где она есть.');
    const items=parseLibraryFile({format:'module-library',version:2,items:r.items});
    const current=localStorage.getItem(LIBRARY_KEY);
    if(current){const backup=LIBRARY_KEY+'-backup-'+crypto.randomUUID();localStorage.setItem(backup,current);}
    writeStoredLibrary(localStorage,current,items);
    if(mounted.current)setMessage('Загружено шаблонов: '+items.length+'. Прежняя библиотека этого браузера сохранена резервной копией.');
  }
  async function openRevision(item:Entry,revision:number){
    const r=await api('/projects/'+item.id+'/revisions/'+revision),p=parseProject(r.data);
    p.cloud={id:item.id,revision:r.currentRevision,owner:r.email,name:r.name};
    if(!canApply())return;backupProject(project);if(update(p)){setName(r.name);setMessage('Открыта версия '+revision+'. На сервере ничего не изменилось. Сохраните проект, чтобы записать этот вариант новой версией.');}
  }
  return <div className="cloud-panel"><p className="field-note">{mode==='local-demo'?'Сейчас кабинет работает на этом компьютере. Демо-профили общие; письма не отправляются. Это ещё не размещение в облаке.':'Проекты сотрудников хранятся на сервере. Менеджер видит свои проекты, администратор — все.'}</p>{error&&<p role="alert" className="cloud-error">{error}</p>}{message&&<p role="status" className="cloud-success">{message}</p>}
  {!user?<div className="cloud-login">{!ready&&mode&&<p>Для входа настройте серверную почту и список сотрудников.</p>}<label className="hardware-field">{mode==='local-demo'?'Проверочный профиль':'Рабочая почта'}{mode==='local-demo'?<select aria-label="Профиль кабинета" value={email} onChange={e=>setEmail(e.target.value)}><option value="manager@example.test">Менеджер</option><option value="manager2@example.test">Другой менеджер</option><option value="admin@example.test">Администратор</option></select>:<input aria-label="Почта кабинета" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>}</label><button className="primary" disabled={busy||!ready} onClick={()=>run(requestCode)}>{mode==='local-demo'?'Войти в локальный кабинет':'Получить код'}</button>{sent&&<><label className="hardware-field">Код из письма<input aria-label="Код входа" value={code} onChange={e=>setCode(e.target.value)} maxLength={6}/></label><button className="primary" disabled={busy} onClick={()=>run(async()=>setUser(await api('/auth/verify',{email,code})))}>Войти</button></>}</div>:<>
    <div className="cloud-user"><span>{user.role==='admin'?'Администратор':'Менеджер'} · {user.email}</span><button disabled={busy} onClick={()=>run(async()=>{await api('/logout',{});setUser(null);setItems([]);setAll(false);setHistory(null);})}>Выйти</button></div>
    <p className="cloud-sync" role="status">{syncStatus}</p><p className="field-note">При открытии другого проекта или версии текущий вариант остаётся резервной копией в этом браузере. Восстановление: «Новый проект / восстановить».</p>
    <div className="cloud-save"><label className="hardware-field">Название проекта<input aria-label="Название сохраняемого проекта" value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></label><button className="primary" disabled={busy} onClick={()=>run(()=>save(false))}>Сохранить проект</button><button className="outline" disabled={busy} onClick={()=>run(()=>save(true))}>Сохранить копию</button></div>
    <section className="cloud-library"><div className="cloud-user"><strong>Мои шаблоны в кабинете</strong><span>{libraryInfo}</span></div><p className="field-note">Библиотека модулей и групп из этого браузера («Моя библиотека модулей») хранится в кабинете и доступна с любого компьютера после входа.</p><div className="cloud-save"><button className="outline" disabled={busy} onClick={()=>run(uploadLibrary)}>Отправить библиотеку в кабинет</button><button className="outline" disabled={busy} onClick={()=>run(downloadLibrary)}>Загрузить из кабинета в этот браузер</button></div></section>
    <div className="cloud-filters">{user.role==='admin'&&<label><input disabled={busy} type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/>Все сотрудники</label>}<label><input disabled={busy} type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>Архив</label></div>
    <div className="cloud-search"><label className="hardware-field">Найти проект<input type="search" aria-label="Поиск проектов" placeholder="Название или сотрудник" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="hardware-field">Порядок<select aria-label="Сортировка проектов" value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Сначала последние</option><option value="name">По названию</option></select></label></div><p className="field-note" role="status">Показано {visibleItems.length} из {items.length}{archived?' · архив':''}</p>
    {history&&<section className="cloud-history"><div className="cloud-user"><strong>История: {history.item.name}</strong><button onClick={()=>setHistory(null)}>Закрыть историю</button></div><p className="field-note">Последние 100 сохранений. Открытие версии меняет рабочий проект; прежние сохранения остаются на сервере.</p>{history.items.map(r=><div className="cloud-revision" key={r.revision}><span><strong>Версия {r.revision}</strong><small>{r.name} · {new Date(r.updated*1000).toLocaleString('ru-RU')}</small></span><button className="outline" disabled={busy} onClick={()=>run(()=>openRevision(history.item,r.revision))}>Открыть версию {r.revision}</button></div>)}</section>}
    {!items.length&&<p className="field-note">Здесь пока нет проектов.</p>}{!!items.length&&!visibleItems.length&&<p className="field-note">Ничего не найдено. Измените запрос или <button className="text-action" onClick={()=>setQuery('')}>Сбросить поиск</button></p>}{visibleItems.map(item=><article className="cloud-project" key={item.id}><div><strong>{item.name}</strong><small>{item.email} · версия {item.revision} · {new Date(item.updated*1000).toLocaleString('ru-RU')}</small></div><button className="outline" disabled={busy} onClick={()=>run(()=>load(item))}>Открыть проект</button><button className="outline" disabled={busy} aria-label={'Скачать сохранённый проект: '+item.name} onClick={()=>run(()=>downloadSaved(item))}>Скачать файл</button><button className="outline" disabled={busy} onClick={()=>run(async()=>{const r=await api('/projects/'+item.id+'/revisions');setHistory({item,items:r.items});})}>История</button>{item.email===user.email&&<button className="text-action" disabled={busy} onClick={()=>run(async()=>{await api('/projects/'+item.id+'/archive?archived='+!archived,{});await reload();})}>{archived?'Восстановить':'В архив'}</button>}</article>)}
  </>}</div>;
}
