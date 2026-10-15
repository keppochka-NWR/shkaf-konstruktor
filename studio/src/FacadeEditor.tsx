import {useState} from 'react';
import {vernissageSizes} from './model';
import type {Project} from './project';
import {catalog} from './catalog';
import {ALU_PROFILES,ALU_INSERTS,aluProfile} from './alu';
import {VernissagePicker} from './VernissagePicker';
import {applyFacadeAppearance,changeFacadeKind,facadeKind,type FacadeKind} from './facadeAppearance';

/** Local draft: close cancels, Apply commits one undoable project command. */
export function FacadeEditor({project,moduleId,selectedIds=[],commit,close}:{project:Project;moduleId:string;selectedIds?:string[];commit:(p:Project)=>boolean;close:()=>void}){
 const source=project.modules.find(a=>a.id===moduleId)!.module;
 const [draft,setDraft]=useState(()=>structuredClone(source)),[scope,setScope]=useState<'module'|'group'|'all'>(()=>selectedIds.includes(moduleId)?'group':'module'),[error,setError]=useState('');
 const kind=facadeKind(draft);
 const apply=()=>{try{const next=applyFacadeAppearance(project,moduleId,draft,scope==='group'?selectedIds:scope==='all');if(commit(next))close();else setError('Изменение не принято. Проверьте ограничения проекта; исходные фасады сохранены.');}catch(e){setError((e as Error).message);}};
 return <div className="facade-editor">
  <p><b>{source.name}</b></p>
  <p className="field-note">Оформление всех дверей и фасадов ящиков этого корпуса. Отдельный рисунок для одной створки здесь не задаётся. Изменения сохранятся после «Применить».</p>
  <label className="hardware-field">Основа фасадов<select aria-label="Основа фасадов" value={kind} onChange={e=>{setDraft(changeFacadeKind(draft,e.target.value as FacadeKind));setError('');}}>
   <option value="ldsp">ЛДСП</option><option value="vernissage">МДФ Вернисаж — плёнка или краска, фрезеровки</option><option value="alu">Алюминиевая рамка со вставкой</option><option value="external">Другой заказной материал — цена уточняется</option>
  </select></label>
  {draft.vernissage&&<VernissagePicker value={draft.vernissage} sizes={vernissageSizes(draft)} onChange={v=>{setDraft({...draft,vernissage:v,facadeT:v.thickness});setError('');}}/>}
  {kind==='ldsp'&&<label className="hardware-field">Декор ЛДСП<select aria-label="Декор фасадов ЛДСП" value={draft.facadeDecor} onChange={e=>setDraft({...draft,facadeDecor:e.target.value,drawerFacadeDecor:undefined})}>
   {!catalog.some(c=>c.n===draft.facadeDecor)&&<option value={draft.facadeDecor}>{draft.facadeDecor}</option>}{catalog.map(c=><option key={c.n} value={c.n}>{c.n}</option>)}
  </select></label>}
  {draft.alu&&<>
   <label className="hardware-field">Профиль<select aria-label="Профиль рамки" value={draft.alu.profile} onChange={e=>{const p=aluProfile(e.target.value)!;setDraft({...draft,alu:{...draft.alu!,profile:p.id,color:p.colors.some(c=>c.id===draft.alu!.color)?draft.alu!.color:p.colors[0].id}});}}>{ALU_PROFILES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
   <label className="hardware-field">Цвет профиля<select aria-label="Цвет профиля" value={draft.alu.color} onChange={e=>setDraft({...draft,alu:{...draft.alu!,color:e.target.value}})}>{aluProfile(draft.alu.profile)!.colors.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
   <label className="hardware-field">Вставка<select aria-label="Вставка рамки" value={draft.alu.insert} onChange={e=>setDraft({...draft,alu:{...draft.alu!,insert:e.target.value}})}>{ALU_INSERTS.map(i=><option key={i.id} value={i.id}>{i.label}</option>)}</select></label>
  </>}
  {kind==='external'&&<p className="field-note">Для другого поставщика требуется отдельная цена. Выберите Вернисаж, чтобы задать плёнку или краску и фрезеровку из каталога с прайсом.</p>}
  <label className="hardware-field">Область применения<select aria-label="Область применения фасадов" value={scope} onChange={e=>setScope(e.target.value as typeof scope)}><option value="module">Фасады корпуса: {source.name}</option><option value="group" disabled={!selectedIds.length}>Выделенные модули ({selectedIds.length})</option><option value="all">Фасады всех редактируемых модулей</option></select></label>
  {scope!=='module'&&<p className="field-note">Корпуса без фасадов, импорт Базиса, двери купе и столешницы пропускаются. Размеры и наполнение сохраняются.</p>}
  {error&&<p role="alert" className="field-note">{error}</p>}
  <div style={{display:'flex',gap:12,position:'sticky',bottom:0,background:'var(--surface, white)',padding:'12px 0'}}><button className="primary" onClick={apply}>{scope==='all'?'Применить ко всем модулям':scope==='group'?'Применить к выделенным ('+selectedIds.length+')':'Применить к корпусу'}</button><button className="outline" onClick={close}>Отмена</button></div>
 </div>;
}
