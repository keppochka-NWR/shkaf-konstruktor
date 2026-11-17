import {facadePanels,facadePanel} from './facadePanels';
import {setPanelFacade} from './panelFacadeSelection';
import {useEffect,useState} from 'react';
import {vernissageSizes,aluDrawersAvailable} from './model';
import type {Project} from './project';
import {catalog} from './catalog';
import {FACADE_KIND_LABEL,decorLabel,decorTitle} from './clientLabels';
import {AluPicker,AluDrawersCheck} from './AluPicker';
import {VernissagePicker} from './VernissagePicker';
import {applyFacadeAppearance,changeFacadeKind,facadeKind,type FacadeKind} from './facadeAppearance';

/** Local draft: close cancels, Apply commits one undoable project command. */
export function FacadeEditor({project,moduleId,selectedIds=[],commit,close,onPreview,target='all'}:{project:Project;moduleId:string;selectedIds?:string[];target?:'all'|'facadeDecor'|'drawerFacadeDecor';commit:(p:Project)=>boolean;close:()=>void;onPreview:(preview:{base:Project;next:Project}|null)=>void}){
 const source=project.modules.find(a=>a.id===moduleId)!.module;
 const [draft,setDraft]=useState(()=>structuredClone(source)),[scope,setScope]=useState<'module'|'group'|'all'>(()=>selectedIds.includes(moduleId)?'group':'module'),[error,setError]=useState('');
 const selectedKey=selectedIds.join('|');
 const [panelBrand,setPanelBrand]=useState<string>(()=>facadePanel(target==='drawerFacadeDecor'?source.drawerFacadeDecor??source.facadeDecor:source.facadeDecor)?.brand??'');
 const [query,setQuery]=useState('');
 const pickDecor=(decor:string)=>{try{const n=structuredClone(draft);setPanelFacade(n,target==='drawerFacadeDecor'?'drawerFacadeDecor':'facadeDecor',decor);if(target==='all'){delete n.drawerFacadeDecor;delete n.drawerFacadeT;}setDraft(n);setError('');}catch(e){setError((e as Error).message);}};
 useEffect(()=>{
  try {const next=applyFacadeAppearance(project,moduleId,draft,scope==='group'?selectedIds:scope==='all',scope==='group'||target!=='all');onPreview({base:project,next});setError('');}
  catch(e){onPreview(null);setError((e as Error).message);}
  return ()=>onPreview(null);
 },[draft,scope,project,moduleId,selectedKey,onPreview]);
 const kind=facadeKind(draft);
 const apply=()=>{try{const next=applyFacadeAppearance(project,moduleId,draft,scope==='group'?selectedIds:scope==='all',scope==='group'||target!=='all');if(commit(next))close();else setError('Изменение не принято. Проверьте ограничения проекта; исходные фасады сохранены.');}catch(e){setError((e as Error).message);}};
 return <div className="facade-editor">
  <p><b>{source.name}</b></p>
  <p className="field-note">{target==='drawerFacadeDecor'?'Декор меняется у фасадов ящиков. Смена основы (МДФ / рамка / плита) относится ко всем фасадам корпуса. ':target==='facadeDecor'?'Декор меняется у дверей; ящики без отдельного декора наследуют его. ':''}Оформление всех дверей и фасадов ящиков этого корпуса. Отдельный рисунок для одной створки здесь не задаётся. В сцене — предварительный просмотр. Изменения сохранятся после «Применить».</p>
  <label className="hardware-field">Основа фасадов<select aria-label="Основа фасадов" value={kind==='ldsp'&&panelBrand?panelBrand:kind} onChange={e=>{const b=e.target.value;setPanelBrand(b==='AGT'||b==='Eterno'?b:'');setDraft(changeFacadeKind(draft,(b==='AGT'||b==='Eterno'?'ldsp':b) as FacadeKind));setError('');}}>
   <option value="ldsp">ЛДСП Lamarty</option><option value="AGT">Панели AGT</option><option value="Eterno">Панели Eterno</option><option value="vernissage">{FACADE_KIND_LABEL.vernissage}</option><option value="alu">{FACADE_KIND_LABEL.alu}</option><option value="external">{FACADE_KIND_LABEL.external}</option>
  </select></label>
  {draft.vernissage&&<VernissagePicker value={draft.vernissage} sizes={vernissageSizes(draft)} onChange={v=>{setDraft({...draft,vernissage:v,facadeT:v.thickness});setError('');}}/>}
  {kind==='ldsp'&&!panelBrand&&<label className="hardware-field">Декор ЛДСП<select aria-label="Декор фасадов ЛДСП" value={target==='drawerFacadeDecor'?draft.drawerFacadeDecor??draft.facadeDecor:draft.facadeDecor} onChange={e=>pickDecor(e.target.value)}>
   {!catalog.some(c=>c.n===draft.facadeDecor)&&<option value={draft.facadeDecor}>{decorLabel(draft.facadeDecor)}</option>}{catalog.map(c=><option key={c.n} value={c.n} title={decorTitle(c.n)}>{decorLabel(c.n)}</option>)}
  </select></label>}
  {kind==='ldsp'&&panelBrand&&<><input type="search" aria-label="Поиск панели фасада" placeholder="Артикул или название декора" value={query} onChange={e=>setQuery(e.target.value)}/><p className="field-note">{panelBrand==='AGT'?'45 000':'55 000'} ₽ за использованный лист: панель и раскрой. Размеры и наличие уточняются по артикулу.</p><div className="decor-grid">{facadePanels.filter(p=>p.brand===panelBrand&&p.n.toLowerCase().includes(query.toLowerCase())).map(p=><button key={p.n} type="button" disabled={!p.sheet||!p.thickness} aria-pressed={(target==='drawerFacadeDecor'?draft.drawerFacadeDecor??draft.facadeDecor:draft.facadeDecor)===p.n} onClick={()=>pickDecor(p.n)} title={!p.sheet?'Размеры в источнике требуют подтверждения':p.n}><span style={{backgroundImage:p.tex?`url("${p.tex}")`:undefined,backgroundColor:'#e6e2d9'}}/>{p.n}<small>{!p.sheet?'Размеры уточняются':p.sheet[1]+' × '+p.sheet[0]+' × '+p.thickness+' мм'}{!p.tex?' · образец не загружен':''}</small></button>)}</div></>}
  {draft.alu&&<>
   <AluPicker value={draft.alu} onChange={v=>setDraft({...draft,alu:v})}/>
   {aluDrawersAvailable(draft)&&<AluDrawersCheck checked={!!draft.aluDrawers} onChange={v=>{const n={...draft};if(v)n.aluDrawers=true;else delete n.aluDrawers;setDraft(n);}}/>}
  </>}
  {kind==='external'&&<p className="field-note">Для другого поставщика требуется отдельная цена. Выберите Вернисаж, чтобы задать плёнку или краску и фрезеровку из каталога с прайсом.</p>}
  <label className="hardware-field">Область применения<select aria-label="Область применения фасадов" value={scope} onChange={e=>setScope(e.target.value as typeof scope)}><option value="module">Фасады корпуса: {source.name}</option><option value="group" disabled={!selectedIds.length}>Выделенные модули ({selectedIds.length})</option><option value="all">Фасады всех редактируемых модулей</option></select></label>
  {scope==='group'&&<p className="field-note">Выделенным модулям переносится только то, что вы изменили здесь; их остальные настройки фасадов сохраняются. Поле за полем — раздел «Фасады выделенных модулей» справа.</p>}{scope!=='module'&&<p className="field-note">Корпуса без фасадов, импорт Базиса, двери купе и столешницы пропускаются. Размеры и наполнение сохраняются.</p>}
  {error&&<p role="alert" className="field-note">{error}</p>}
  <div style={{display:'flex',gap:12,position:'sticky',bottom:0,background:'var(--surface, white)',padding:'12px 0'}}><button className="primary" onClick={apply}>{scope==='all'?'Применить ко всем модулям':scope==='group'?'Применить к выделенным ('+selectedIds.length+')':'Применить к корпусу'}</button><button className="outline" onClick={close}>Отмена</button></div>
 </div>;
}
