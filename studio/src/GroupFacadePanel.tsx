// «Фасады выделенных модулей» (решение Макса 29.10.2026): отмеченные Shift+щелчком корпуса правятся разом. Меняется только то поле,
// которое правит менеджер; у корпусов с разными значениями поле показывает «— разные —». Корпуса, к которым поле не относится,
// пропускаются с сообщением «к N модулям не применено: причина». Каждая правка — одно изменение проекта (одна отмена Ctrl+Z).
import {useState} from 'react';
import type {Project} from './project';
import {catalog} from './catalog';
import {decorLabel,decorTitle} from './clientLabels';
import {HANDLES} from './handles';
import {HINGE_BRANDS,type HingeBrand} from './hardware';
import {HANDLE_POS_LABEL,vernissageSizes,type HandlePos} from './model';
import {VernissagePicker} from './VernissagePicker';
import {AluPicker} from './AluPicker';
import type {VernissageFacade} from './facadesVernissage';
import type {AluFacade} from './alu';
import {applyGroupFacade,applyGroupPatch,changedKeys,groupFacadeValue,groupPatchMixed,groupValueLabel,skippedNote,GROUP_FIELDS,KIND_LABEL,OPEN_LABEL,type GroupFacadeField,type GroupResult} from './groupFacades';

const MIXED='__mixed';
const PATCH_LABEL:Record<string,string>={milling:'фрезеровка',cover:'покрытие',film:'плёнка',enamelColor:'цвет эмали',thickness:'толщина',open:'открывание',patina:'патина',twoSided:'покраска с двух сторон',lacquer:'лак',profile:'профиль',color:'цвет профиля',insert:'наполнение'};
const say=(title:string,text:string)=>window.dispatchEvent(new CustomEvent('studio-note',{detail:{title,text}}));

export function GroupFacadePanel({project,ids,commit}:{project:Project;ids:string[];commit:(p:Project)=>boolean}){
 const [note,setNote]=useState<{ok:boolean;text:string}|null>(null);
 const names=ids.map(id=>project.modules.find(a=>a.id===id)?.module.name).filter(Boolean) as string[];
 function run(make:()=>GroupResult,label:string){
  try{
   const r=make();
   if(!r.changed.length&&!r.skipped.length){setNote({ok:true,text:label+' — у всех отмеченных уже так.'});return;}
   if(r.changed.length&&!commit(r.project)){setNote({ok:false,text:'Изменение не принято: проверьте сообщение студии. Фасады не изменены.'});return;}
   const skipped=skippedNote(r.skipped),text=`${label} — применено к ${r.changed.length} из ${ids.length}.`+(skipped?' '+skipped:'');
   setNote({ok:true,text});if(skipped)say('Фасады выделенных',text);
  }catch(e){setNote({ok:false,text:(e as Error).message});}
 }
 const field=(f:GroupFacadeField,options:[string,string][],title?:(v:string)=>string|undefined)=>{
  const s=groupFacadeValue(project,ids,f);if(!s.applicable)return null;
  const label=GROUP_FIELDS[f].label,value=s.value===null?MIXED:s.value;
  return <label className="hardware-field" key={f} data-group-field={f}>
   <span>{label}{s.applicable<s.total&&<small className="group-count"> · {s.applicable} из {s.total}</small>}</span>
   <select aria-label={'Группа: '+label} value={value} onChange={e=>{const v=e.target.value;if(v===MIXED||v.startsWith('*'))return;run(()=>applyGroupFacade(project,ids,f,v),label+': '+groupValueLabel(f,v));}}>
    {s.value===null&&<option value={MIXED} disabled>— разные —</option>}
    {s.value?.startsWith('*')&&<option value={s.value} disabled>{groupValueLabel(f,s.value)}</option>}
    {!options.some(([v])=>v===s.value)&&s.value!==null&&!s.value.startsWith('*')&&<option value={s.value}>{groupValueLabel(f,s.value)}</option>}
    {options.map(([v,l])=><option key={v} value={v} title={title?.(v)}>{l}</option>)}
   </select>
  </label>;
 };
 const decorOptions:[string,string][]=catalog.map(c=>[c.n,decorLabel(c.n)]);
 const handleOptions:[string,string][]=[...HANDLES].sort((a,b)=>a.vendor.localeCompare(b.vendor)||a.len-b.len||a.price-b.price).map(h=>[h.id,`${h.label} · ${h.len} мм${h.vendor==='lemana'?' · Лемана':''}`]);
 const vern=groupPatchMixed(project,ids,'vernissage'),alu=groupPatchMixed(project,ids,'alu');
 const vernModule=project.modules.find(a=>ids.includes(a.id)&&a.module.vernissage)?.module;
 const mixedNote=(keys:string[])=>keys.length?' · разные: '+keys.map(k=>PATCH_LABEL[k]??k).join(', '):'';
 return <details className="property-section group-facades" open data-testid="group-facades">
  <summary><strong>Фасады выделенных модулей · {ids.length}</strong></summary>
  <p className="field-note">Отмечены: {names.join(', ')}. Изменённое поле применяется ко всем отмеченным сразу, остальные настройки не меняются; «— разные —» — у модулей сейчас разные значения. Одна отмена Ctrl+Z возвращает всех. Отметить — Shift+щелчок по модулю в сцене или в списке слева.</p>
  {field('kind',(['ldsp','vernissage','alu'] as const).map(k=>[k,KIND_LABEL[k]]))}
  {vern.count>0&&vern.base&&<div className="group-patch" data-group-field="vernissage"><p className="field-note">МДФ Вернисаж · {vern.count} мод.{mixedNote(vern.mixed)}. Меняется только то, что вы выберете.</p>
   <VernissagePicker value={vern.base as unknown as VernissageFacade} sizes={vernModule?vernissageSizes(vernModule):undefined} onChange={v=>run(()=>applyGroupPatch(project,ids,'vernissage',changedKeys(vern.base!,v as unknown as Record<string,unknown>)),'МДФ Вернисаж')}/></div>}
  {alu.count>0&&alu.base&&<div className="group-patch" data-group-field="alu"><p className="field-note">Алюминиевая рамка · {alu.count} мод.{mixedNote(alu.mixed)}.</p>
   <AluPicker value={alu.base as unknown as AluFacade} onChange={v=>run(()=>applyGroupPatch(project,ids,'alu',changedKeys(alu.base!,v as unknown as Record<string,unknown>)),'Алюминиевая рамка')}/></div>}
  {field('facadeDecor',decorOptions,decorTitle)}
  {field('drawerFacadeDecor',[['','Как у распашных фасадов'],...decorOptions],decorTitle)}
  {field('handle',handleOptions)}
  {field('drawerHandle',handleOptions)}
  {field('handlePos',(['rule','topCorner','topCenter','bottomCorner','bottomCenter'] as HandlePos[]).map(p=>[p,HANDLE_POS_LABEL[p]]))}
  {field('doorOpen',Object.entries(OPEN_LABEL))}
  {field('hingeBrand',(Object.keys(HINGE_BRANDS) as HingeBrand[]).map(k=>[k,`${HINGE_BRANDS[k].label} · ${HINGE_BRANDS[k].note}`]))}
  {field('hingeAngle',[['','Стандарт 110°'],['165','155–165° · дверь к соседней']])}
  {field('hingeSide',[['left','Слева'],['right','Справа']])}
  {note&&<p role={note.ok?'status':'alert'} className="field-note group-note" data-testid="group-facades-note">{note.text}</p>}
 </details>;
}
