// Подробные ошибки (п.4 волны 22.10): к какому корпусу, секции и детали относится каждая ошибка проекта и что сделать.
// Тексты ошибок validate()/projectErrors() не меняются — здесь они только разбираются: «Имя корпуса: Секция N: …»,
// ««А» пересекается с «Б»…», «… «Имя детали» …».
import {parts,validate,type Part} from './model';
import type {Project,PlacedModule} from './project';

export type ErrorDetail={
  /** Исходный текст ошибки, как его вернула проверка. */
  text:string;
  /** Что не так — текст без названия корпуса и номера секции. */
  problem:string;
  /** Что сделать. */
  action:string;
  moduleId?:string;
  moduleName?:string;
  sectionId?:string;
  sectionNo?:number;
  partId?:string;
  partName?:string;
};

/** Подсказки «что сделать» для ошибок, в тексте которых действия нет. */
const ACTIONS:[RegExp,string][]=[
  [/створок/,'Выберите одну или две створки в настройках фасадов секции.'],
  [/за границы помещения/,'Сдвиньте корпус внутрь комнаты или исправьте размеры комнаты.'],
  [/направляющая слишком длинная/,'Выберите направляющие короче или увеличьте глубину корпуса.'],
  [/ящики пересекаются/,'Нажмите «Собрать ящики от дна» или раздвиньте ящики по высоте.'],
  [/фасад|Фасад/,'Измените размер корпуса или секции либо разделите фасад.'],
  [/полк/,'Измените положение или число полок.'],
  [/ящик/,'Измените число или высоту ящиков.'],
];
const GENERIC='Верните прежнее значение или измените его так, чтобы правило выполнялось. Ctrl+Z не нужен: изменение не применено.';

function splitAction(rest:string):{problem:string;action:string}{
  const cut=rest.search(/\.\s+[А-ЯЁA-Z«]/);
  if(cut>0)return {problem:rest.slice(0,cut+1),action:rest.slice(cut+1).trim()};
  return {problem:rest,action:ACTIONS.find(([re])=>re.test(rest))?.[1]??GENERIC};
}
function moduleByName(p:Project,name:string,rest:string):PlacedModule|undefined{
  const same=p.modules.filter(a=>a.module.name===name);
  if(same.length<2)return same[0];
  // одинаковые имена: тот корпус, чья проверка даёт эту ошибку (иначе — последний, его обычно и меняли)
  return same.find(a=>{try{return validate(a.module).includes(rest);}catch{return false;}})??same.at(-1);
}
function partFor(a:PlacedModule,rest:string,sectionId?:string):Part|undefined{
  let ps:Part[];try{ps=parts(a.module);}catch{return undefined;}
  const quoted=[...rest.matchAll(/«([^»]+)»/g)].map(x=>x[1]);
  for(const q of quoted){const hit=ps.find(p=>p.name===q);if(hit)return hit;}
  const wide=rest.match(/Фасад шире (\d+)/);
  if(wide)return ps.find(p=>p.role==='door'&&p.width>Number(wide[1])&&(!sectionId||p.sectionId===sectionId));
  const low=rest.match(/Распашной фасад ниже (\d+)/);
  if(low)return ps.find(p=>p.role==='door'&&p.length<Number(low[1])&&(!sectionId||p.sectionId===sectionId));
  return undefined;
}
/** Порядок в плашке: сначала ошибки самого корпуса (секции, детали), затем выход за стены, пересечения — последними (обычно следствие). */
function rank(text:string){return /пересекается с/.test(text)?2:/за границы помещения/.test(text)?1:0;}
/** Разбор ошибок проверки проекта p (того варианта, который не применился). */
export function explainErrors(p:Project,errors:string[]):ErrorDetail[]{
  return errors.map((text,i)=>({text,i})).sort((x,y)=>rank(x.text)-rank(y.text)||x.i-y.i).map(({text})=>{
    const d:ErrorDetail={text,problem:text,action:''};
    let a:PlacedModule|undefined,rest=text;
    const clash=text.match(/^«(.+)» пересекается с «(.+)»/);
    if(clash){a=[...p.modules].reverse().find(x=>x.module.name===clash[1]);rest=text;}
    else{
      // имя корпуса — самое длинное из имён, с которых начинается текст (в имени может быть «:»)
      const names=[...new Set(p.modules.map(x=>x.module.name))].filter(n=>text.startsWith(n+': ')).sort((x,y)=>y.length-x.length);
      if(names[0]){rest=text.slice(names[0].length+2);a=moduleByName(p,names[0],rest);}
    }
    if(a){d.moduleId=a.id;d.moduleName=a.module.name;}
    const sec=rest.match(/^Секция (\d+): /);
    if(sec){rest=rest.slice(sec[0].length);d.sectionNo=Number(sec[1]);d.sectionId=a?.module.sections[d.sectionNo-1]?.id;}
    if(a){const part=partFor(a,rest,d.sectionId);if(part){d.partId=part.id;d.partName=part.name;if(!d.sectionId&&part.sectionId){d.sectionId=part.sectionId;d.sectionNo=a.module.sections.findIndex(s=>s.id===part.sectionId)+1||undefined;}}}
    const {problem,action}=splitAction(rest);
    d.problem=problem.replace(/^./,c=>c.toUpperCase());d.action=action;
    return d;
  });
}
/** Где ошибка — коротко для плашки: «Шкаф 2 · секция 1 · Фасад». */
export function errorPlace(d:ErrorDetail){return [d.moduleName,d.sectionNo?'секция '+d.sectionNo:'',d.partName].filter(Boolean).join(' · ');}
