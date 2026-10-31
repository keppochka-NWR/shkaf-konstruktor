// «Наполнение как у этого» (вопрос Макса 31.10.2026: «как у нас работает редактирование наполнения при выделении нескольких модулей?»).
// Было: группой (Shift+щелчок) правились только фасады и декор; наполнение — только у выбранного. Теперь наполнение выбранного модуля
// (полки, ящики, штанги, пантограф, тремпели, подсветка в секциях, частичные перегородки) переносится на отмеченные модули одной правкой
// (одна отмена Ctrl+Z). Переносится по секциям: число секций то же, ширина секции — в пределах FILL_WIDTH_TOL; высоты полок и штанг —
// доли проёма (как в модели), поэтому при другой высоте корпуса они масштабируются сами; ящики «по правилу» и комод пересчитываются под
// высоту, направляющие — под глубину. Двери, ручки, петли, материалы и размеры не трогаются. Не подошло (validate, вырезы на наполнении,
// другой тип модуля) — модуль пропускается с причиной «к N модулям не применено: …». Цена меняется только у изменённых модулей.
import {boxes,drawersBehindDoors,drawersToRoof,isAutoDrawerLayout,rearClear,type Module,type Section} from './model';
import {compatibleSlideLength} from './hardware';
import {relayoutDrawers,roofColumn} from './drawerModes';
import {cutHost} from './partIds';
import {applyEach,type GroupResult} from './groupFacades';
import type {Project} from './project';

/** Допуск ширины секции образца и цели, мм: шире/уже — наполнение (ящики, штанга) уже «другое», модуль пропускается. */
export const FILL_WIDTH_TOL=100;
/** Поля секции, которые и есть наполнение. Остальное (id, вес, двери, ручки, петли, фасады) остаётся у цели. */
export const FILL_KEYS=['shelves','drawers','rod','rodAt','rodLower','rodClearance','pantograph','pullouts','drawerConfigs','glassShelves','thickShelves','fixed','shelfDepth','drawerCap','drawerGrip','drawerGap','drawerMount','externalDrawers','shelfLight','shelfLights','standLights','topLight','lightSpec','divider'] as const satisfies readonly (keyof Section)[];

/** Модуль без «наполнения студии» (как quickMenuApplies + составные проёмы): причина для сообщения. */
export function fillingKindProblem(m:Module):string|null{
 if(m.kupe)return 'двери купе';if(m.worktop)return 'столешница';if(m.raw)return 'импорт Базиса как есть';
 if(m.kitchen)return 'кухонный модуль — наполнение в его панели';if(m.desk)return 'стол';if(m.corner)return 'угловой шкаф';
 if(m.casework)return 'корпус по проекту Базиса';if(m.sectionLayout)return 'составные проёмы';
 return null;
}
const FILL_PART=/:(shelf|drawer|rod|pantograph|pullout|divider)/;
/** Подходит ли цель для наполнения образца; null — да. */
export function fillingCompat(src:Module,n:Module):string|null{
 const kind=fillingKindProblem(n);if(kind)return kind;
 if(n.sections.length!==src.sections.length)return `другое число секций (${n.sections.length}, у образца ${src.sections.length})`;
 const bs=boxes(src),bt=boxes(n);
 for(let i=0;i<bt.length;i++){const d=Math.round(bt[i].width-bs[i].width);if(Math.abs(d)>FILL_WIDTH_TOL)return `секция ${i+1} ${d>0?'шире':'уже'} на ${Math.abs(d)} мм`;}
 // вырез держится за полку/ящик цели (cutoutBinding.ts) — заменить наполнение значит снять вырез; молча не снимаем
 if(n.cutouts?.some(c=>FILL_PART.test(cutHost(n,c)??c.host)))return 'на полках или ящиках есть вырезы';
 return null;
}
/** Наполнение секций образца → в модуль n (на месте). Строка — почему не встало. */
export function copyFilling(n:Module,src:Module):string|null{
 const bs=boxes(src),bt=boxes(n);
 for(let i=0;i<n.sections.length;i++){
  const t=n.sections[i],s=src.sections[i],hs=bs[i].top-bs[i].bottom,ht=bt[i].top-bt[i].bottom,same=Math.abs(hs-ht)<0.5;
  const rec=t as Record<string,unknown>,from=s as Record<string,unknown>;
  for(const k of FILL_KEYS){delete rec[k];if(from[k]!==undefined)rec[k]=structuredClone(from[k]);}
  // постоянные id полок/ящиков (вырезы) — у нового наполнения свои; вырезов на наполнении цели нет (fillingCompat)
  delete t.shelfIds;delete t.drawerIds;
  // частичная перегородка — мм от низа модуля: при другой высоте — та же доля проёма
  if(t.divider&&!same){const k=ht/hs,lo=bt[i].bottom,b0=bs[i].bottom;t.divider={from:Math.round(lo+(t.divider.from-b0)*k),to:Math.round(lo+(t.divider.to-b0)*k)};}
  if(t.drawers>0){
   // ящики «по правилу» и комод до крыши — заново под высоту цели; заданные вручную — как у образца
   if(!same){if(roofColumn(src,s))t.drawerConfigs=drawersToRoof(n,t);else if(isAutoDrawerLayout(src,s))relayoutDrawers(n,t);}
   if(t.drawerConfigs){const avail=n.depth-rearClear(n)-(drawersBehindDoors(n,t)?44:25);
    for(let j=0;j<t.drawerConfigs.length;j++){const c=t.drawerConfigs[j];if(c.mesh)continue;
     const L=compatibleSlideLength(c.slide,c.length,avail);if(L===undefined)return `нет направляющих под глубину ${n.depth} мм`;
     if(L!==c.length)t.drawerConfigs[j]={...c,length:L};}}
  }
 }
 return null;
}
/** «Наполнение как у этого»: наполнение модуля sourceId — всем отмеченным ids (кроме него), одним изменением проекта. */
export function applyGroupFilling(p:Project,sourceId:string,ids:readonly string[]):GroupResult{
 const src=p.modules.find(a=>a.id===sourceId)?.module;if(!src)throw Error('Выберите модуль-образец.');
 const why=fillingKindProblem(src);if(why)throw Error(`Наполнение образца «${src.name}» не переносится: ${why}.`);
 const targets=ids.filter(id=>id!==sourceId);if(!targets.length)throw Error('Отметьте Shift+щелчком модули, которым нужно такое же наполнение.');
 return applyEach(p,targets,n=>fillingCompat(src,n)??copyFilling(n,src));
}
