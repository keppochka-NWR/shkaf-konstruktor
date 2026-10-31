// «Наполнение как у этого» (вопрос Макса 31.10.2026: «как у нас работает редактирование наполнения при выделении нескольких модулей?»).
// Было: группой (Shift+щелчок) правились только фасады и декор; наполнение — только у выбранного. Теперь наполнение выбранного модуля
// (полки, ящики, штанги, пантограф, тремпели, подсветка в секциях, частичные перегородки) переносится на отмеченные модули одной правкой
// (одна отмена Ctrl+Z). Переносится по секциям: число секций то же, ширина секции — в пределах FILL_WIDTH_TOL; высоты полок и штанг —
// доли проёма (как в модели), поэтому при другой высоте корпуса они масштабируются сами; ящики «по правилу» и комод пересчитываются под
// высоту, направляющие — под глубину (самые длинные, что входят), глубина полок — не глубже предела цели. Двери, ручки (и у ящиков: ручка,
// push, «Зазор 30 мм»), петли, материалы и размеры не трогаются; подсветка секции — только если она есть у образца (иначе у цели своя). Не подошло (validate, вырезы на наполнении,
// другой тип модуля) — модуль пропускается с причиной «к N модулям не применено: …». Цена меняется только у изменённых модулей.
import {boxes,drawerConfig,drawersBehindDoors,drawersToRoof,isAutoDrawerLayout,rearClear,shelfMaxDepth,type Module,type Section} from './model';
import {SLIDES,slideMotion,type DrawerConfig} from './hardware';
import {relayoutDrawers,roofColumn} from './drawerModes';
import {cutHost} from './partIds';
import {applyEach,type GroupResult} from './groupFacades';
import type {Project} from './project';

/** Допуск ширины секции образца и цели, мм: шире/уже — наполнение (ящики, штанга) уже «другое», модуль пропускается. */
export const FILL_WIDTH_TOL=100;
/** Поля секции, которые и есть наполнение. Остальное (id, вес, двери, ручки, петли, фасады, «Зазор 30 мм» у ящиков без ручки, ящики вкладные)
 *  остаётся у цели. Ручка и ход (push) каждого ящика — тоже у цели (copyFilling), подсветка — LIGHT_KEYS. */
export const FILL_KEYS=['shelves','drawers','rod','rodAt','rodLower','rodClearance','pantograph','pullouts','drawerConfigs','glassShelves','thickShelves','fixed','shelfDepth','drawerCap','drawerGap','externalDrawers','divider'] as const satisfies readonly (keyof Section)[];
/** Подсветка секции — не наполнение: переносится, только если у секции образца подсветка есть; иначе у цели остаётся своя
 *  (подсветка полок — у полок, которые остались). */
export const LIGHT_KEYS=['shelfLight','shelfLights','standLights','topLight','lightSpec'] as const satisfies readonly (keyof Section)[];
const hasLights=(s:Section)=>!!s.shelfLight||!!s.shelfLights?.length||!!s.standLights?.length||!!s.topLight;
/** Ручка и ход ящика — настройки ручек цели, не наполнение образца. */
const DRAWER_GRIP_KEYS=['handleId','handle','operation'] as const satisfies readonly (keyof DrawerConfig)[];

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
 // ящики цели до переноса (с правилом по умолчанию): у новых ящиков — ручка и ход цели (свой ящик того же номера, последний ящик секции,
 // первый ящик модуля); id ручки не задан — ручка ящиков модуля (drawerHandleId/handleId).
 const was=n.sections.map(t=>Array.from({length:t.drawers},(_,j)=>structuredClone(drawerConfig(n,t,j))));
 const own=was.flat()[0];
 for(let i=0;i<n.sections.length;i++){
  const t=n.sections[i],s=src.sections[i],hs=bs[i].top-bs[i].bottom,ht=bt[i].top-bt[i].bottom,same=Math.abs(hs-ht)<0.5;
  const rec=t as Record<string,unknown>,from=s as Record<string,unknown>;
  for(const k of FILL_KEYS)put(rec,k,from[k]);
  if(hasLights(s))for(const k of LIGHT_KEYS)put(rec,k,from[k]);
  else keepOwnLights(t);
  // постоянные id полок/ящиков (вырезы) — у нового наполнения свои; вырезов на наполнении цели нет (fillingCompat)
  delete t.shelfIds;delete t.drawerIds;
  // глубина полок образца глубже, чем позволяет цель, — по пределу цели (а не пропуск модуля)
  if(t.shelfDepth!==undefined)t.shelfDepth=Math.min(t.shelfDepth,shelfMaxDepth(n));
  // частичная перегородка — мм от низа модуля: при другой высоте — та же доля проёма
  if(t.divider&&!same){const k=ht/hs,lo=bt[i].bottom,b0=bs[i].bottom;t.divider={from:Math.round(lo+(t.divider.from-b0)*k),to:Math.round(lo+(t.divider.to-b0)*k)};}
  if(t.drawers>0){
   // ящики «по правилу» и комод до крыши — заново под высоту цели; заданные вручную — как у образца
   if(!same){if(roofColumn(src,s))t.drawerConfigs=drawersToRoof(n,t);else if(isAutoDrawerLayout(src,s))relayoutDrawers(n,t);}
   const avail=n.depth-rearClear(n)-(drawersBehindDoors(n,t)?44:25),availSrc=src.depth-rearClear(src)-(drawersBehindDoors(src,s)?44:25);
   const cur=t.drawerConfigs,list=Array.from({length:t.drawers},(_,j)=>structuredClone(drawerConfig(n,t,j))),before=JSON.stringify(list);
   for(let j=0;j<list.length;j++){const c=list[j];if(c.mesh)continue;
    // направляющие — под глубину цели, как при ручной правке (самые длинные, что входят); глубина та же — длина образца
    const fit=[...SLIDES[c.slide].lengths].reverse().filter(l=>l<=avail);if(!fit.length)return `нет направляющих под глубину ${n.depth} мм`;
    if(!(Math.abs(avail-availSrc)<0.5&&fit.includes(c.length as never)))c.length=fit[0];
    const g=was[i][j]??was[i].at(-1)??own,motion=slideMotion(c);
    for(const k of DRAWER_GRIP_KEYS)if(k!=='operation')put(c as Record<string,unknown>,k,g?.[k]);
    // ход: как у ящиков цели; ящиков у цели нет — по открыванию цели (push у фасадов — push, иначе с ручкой: push образца → с доводчиком)
    const push=n.doorOpen==='push',want=g?slideMotion(g):(motion==='push')===push?motion:push?'push':'soft-close';
    if(want!==motion&&!(want==='simple'&&c.slide!=='ball'))c.operation=want;
   }
   if(cur||JSON.stringify(list)!==before)t.drawerConfigs=[...list,...(cur??[]).slice(list.length)];
  }
 }
 return null;
}
/** Поле k = v (undefined — удалить). То же значение — не трогаем: порядок ключей цели тот же, «уже так» (applyEach сравнивает JSON). */
function put(rec:Record<string,unknown>,k:string,v:unknown){
 if(JSON.stringify(rec[k])===JSON.stringify(v))return;
 if(v===undefined)delete rec[k];else rec[k]=structuredClone(v);
}
/** Подсветка цели остаётся (у образца в секции подсветки нет): подсветка полок — только у полок, что есть после переноса. */
function keepOwnLights(t:Section){
 if(t.shelfLights){const kept=t.shelfLights.filter(j=>j<t.shelves.length);if(kept.length)t.shelfLights=kept;else delete t.shelfLights;}
 if(t.lightSpec){for(const k of Object.keys(t.lightSpec)){const sh=/^shelf:(\d+)$/.exec(k);if(sh&&!t.shelfLight&&!t.shelfLights?.includes(Number(sh[1])))delete t.lightSpec[k];}
  if(!Object.keys(t.lightSpec).length)delete t.lightSpec;}
}
/** «Наполнение как у этого»: наполнение модуля sourceId — всем отмеченным ids (кроме него), одним изменением проекта. */
export function applyGroupFilling(p:Project,sourceId:string,ids:readonly string[]):GroupResult{
 const src=p.modules.find(a=>a.id===sourceId)?.module;if(!src)throw Error('Выберите модуль-образец.');
 const why=fillingKindProblem(src);if(why)throw Error(`Наполнение образца «${src.name}» не переносится: ${why}.`);
 const targets=ids.filter(id=>id!==sourceId);if(!targets.length)throw Error('Отметьте Shift+щелчком модули, которым нужно такое же наполнение.');
 return applyEach(p,targets,n=>fillingCompat(src,n)??copyFilling(n,src));
}
