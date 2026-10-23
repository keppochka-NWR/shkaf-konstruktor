// Проверка формы «Добавить мебель» (w-formerrors, задача Макса 23.10 «ошибки списком»; замер тестера-2, w059: ширина → высота →
// «фасад шире 600» — три цикла «исправил — новый отказ»). Все ошибки сразу, каждая у своего поля, с пределом, «Что сделать» и
// исправлением, если оно однозначное. Тексты ошибок проверки (validate и сборка палитры) не меняются — здесь они разбираются.
import {validate,type Module} from './model';
import {assembleModule,createKupeModule,createKupeWardrobe,createKitchenRow,bodyWidths,type ModuleKind} from './paletteBuild';
import {createCornerModule} from './cornerWardrobe';
import {doorCountOptions} from './paletteDoors';
import {splitAction} from './errorDetails';

export type PaletteField='width'|'height'|'depth'|'doors';
export type PaletteInput={kind:ModuleKind;width:number;height:number;depth:number;/** выбранное (или «авто» — undefined) число дверей */doors?:number;mount?:'free'|'inside';/** корпусов в ряд (ширина — общая) */bodies?:number};
export type PalettePatch=Partial<Pick<PaletteInput,'width'|'height'|'depth'|'doors'|'bodies'>>;
export type PaletteFix={label:string;patch:PalettePatch};
export type PaletteIssue={
  /** Поле формы, к которому относится ошибка (подсветка). */
  field?:PaletteField;
  /** Исходный текст ошибки проверки. */
  text:string;
  /** Что не так: «Ширина 1500 > 1300 мм». */
  problem:string;
  /** Что сделать. */
  action:string;
  /** Кнопки исправления (первая — основная). */
  fixes:PaletteFix[];
  /** Однозначное исправление — входит в «Исправить автоматически». */
  auto?:PalettePatch;
  /** Предел поля (если ошибка — выход за него). */
  limit?:{min?:number;max?:number};
  /** Ошибка видна только после исправления размеров (проверено на исправленных размерах). */
  after?:boolean;
};

/** Распашные корпуса, которые можно разбить на несколько корпусов в ряд. */
export const SPLIT_KINDS:readonly ModuleKind[]=['empty','shelves','wardrobe','drawers'];
const DOOR_KINDS:readonly ModuleKind[]=['empty','wardrobe'];
const LABEL:Record<'width'|'height'|'depth',string>={width:'Ширина',height:'Высота',depth:'Глубина'};
const FIELD:Record<string,'width'|'height'|'depth'>={ширина:'width',высота:'height',глубина:'depth',длина:'width'};
const plural=(n:number,one:string,few:string,many:string)=>{const a=n%10,b=n%100;return a===1&&b!==11?one:a>=2&&a<=4&&(b<10||b>=20)?few:many;};
const norm=(s:string)=>s.replace(/\d+(?:[.,]\d+)?/g,'#');
const fmtN=(n:number)=>String(Math.round(n*10)/10).replace('.',',');

/** Все ошибки сборки мебели палитры при этих значениях — без исключения на первой ошибке. */
export function paletteErrors(inp:PaletteInput,source:Module):string[]{
  const out:string[]=[];
  try{
    if(inp.kind==='kupe-wardrobe')createKupeWardrobe(inp.width,inp.height,inp.depth,source,inp.doors,inp.mount??'free',out);
    else if(inp.kind==='kitchen-row')createKitchenRow(inp.width,source,inp.height,inp.depth,out);
    else if(inp.kind==='kupe')createKupeModule(inp.width,inp.height,source,inp.doors,out);
    else if(inp.kind==='corner')createCornerModule(inp.width,inp.height,inp.depth,source);
    else{
      const widths=SPLIT_KINDS.includes(inp.kind)?bodyWidths(inp.width,inp.bodies??1):[inp.width];
      for(const w of [...new Set(widths)])out.push(...validate(assembleModule(inp.kind,w,inp.height,inp.depth,source,inp.doors)));
    }
  }catch(e){out.push((e as Error).message);}
  return [...new Set(out)];
}
type Range={field:'width'|'height'|'depth';min?:number;max?:number};
/** Предел поля из текста ошибки: «Ширина: допустимо от 250 до 1300 мм.», «ширина проёма 400–6000 мм», «длина стены 600–6000 мм»… */
function rangesOf(text:string,inp:PaletteInput):Range[]{
  let r=text.match(/(Ширина|Высота|Глубина)(?: стола)?: допустимо от (\d+(?:\.\d+)?) до (\d+(?:\.\d+)?) мм/);
  if(r)return [{field:FIELD[r[1].toLowerCase()],min:+r[2],max:+r[3]}];
  r=text.match(/высота \d+ мм вне пределов системы «[^»]+» \((\d+)–(\d+)\)/);
  if(r)return [{field:'height',min:+r[1],max:+r[2]}];
  r=text.match(/(ширина|высота|глубина|длина)[^.;:\d]*?(\d+)–(\d+) мм/i);
  if(r)return [{field:FIELD[r[1].toLowerCase()],min:+r[2],max:+r[3]}];
  r=text.match(/Глубина шкафа-купе от (\d+) мм/);
  if(r)return [{field:'depth',min:+r[1]}];
  // угловой (cornerErrors): одна строка на обе стороны и высоту — разносим по полям
  if(/^Угловой корпус: стороны/.test(text))return [{field:'width',min:950,max:1400},{field:'height',min:1400,max:2200}];
  if(inp.kind==='corner'&&/^Параметры наполнения углового шкафа вне диапазона/.test(text))return [{field:'depth',min:400,max:650}];
  return [];
}
/** Значение поля, которое проверяется: у ряда корпусов — ширина одного корпуса. */
function valueOf(inp:PaletteInput,f:'width'|'height'|'depth'){
  if(f!=='width'||!SPLIT_KINDS.includes(inp.kind))return inp[f];
  const ws=bodyWidths(inp.width,inp.bodies??1);return Math.max(...ws);
}
function rangeIssue(inp:PaletteInput,text:string,g:Range):PaletteIssue|null{
  const f=g.field,v=valueOf(inp,f),label=LABEL[f],bodies=Math.max(1,Math.round(inp.bodies??1));
  if(g.max!==undefined&&v>g.max){
    const limit={min:g.min,max:g.max};
    if(f==='width'&&SPLIT_KINDS.includes(inp.kind)){
      const n=Math.ceil(inp.width/g.max),ws=bodyWidths(inp.width,n),each=ws[0]===ws[n-1]?`по ${ws[0]}`:ws.join(' + ');
      const what=bodies>1?`Ширина корпуса ${v} > ${g.max} мм (всего ${inp.width}, корпусов ${bodies})`:`Ширина ${v} > ${g.max} мм`;
      if(g.min===undefined||Math.min(...ws)>=g.min){
        const split={label:`${n} ${plural(n,'корпус','корпуса','корпусов')} ${each} мм`,patch:{bodies:n}};
        return {field:f,text,problem:what,action:`Разделите на ${n} ${plural(n,'корпус','корпуса','корпусов')} ${each} мм (встанут вплотную в ряд) или уменьшите ширину до ${g.max}.`,fixes:[split,{label:`Ширина ${g.max}`,patch:{width:g.max,bodies:1}}],auto:split.patch,limit};
      }
    }
    const tail=f==='height'&&SPLIT_KINDS.includes(inp.kind)?' Выше — отдельным корпусом-антресолью сверху.':'';
    const fix={label:`${label} ${g.max}`,patch:f==='width'?{width:g.max,bodies:1}:{[f]:g.max}};
    return {field:f,text,problem:`${label} ${fmtN(v)} > ${g.max} мм`,action:`Максимум ${g.max} мм.${tail}`,fixes:[fix],auto:fix.patch,limit};
  }
  if(g.min!==undefined&&v<g.min){
    const fix={label:`${label} ${g.min}`,patch:f==='width'&&bodies>1?{width:g.min*bodies}:{[f]:g.min}};
    return {field:f,text,problem:`${label} ${fmtN(v)} < ${g.min} мм`,action:`Минимум ${g.min} мм.`,fixes:[fix],auto:fix.patch,limit:{min:g.min,max:g.max}};
  }
  return null;
}
/** Фасад шире предела: наименьшее допустимое число дверей (секции под двери) — «4 двери · 2 секции». */
function doorFix(inp:PaletteInput,source:Module):PaletteFix|null{
  if(inp.kind==='kupe'||inp.kind==='kupe-wardrobe'){
    const n=[1,2,3,4,5,6,7].find(c=>{try{createKupeModule(inp.width,inp.height,source,c);return true;}catch{return false;}});
    return n?{label:`${n} ${plural(n,'дверь','двери','дверей')} купе`,patch:{doors:n}}:null;
  }
  if(!DOOR_KINDS.includes(inp.kind))return null;
  try{
    const w=Math.max(...bodyWidths(inp.width,inp.bodies??1)),base=assembleModule(inp.kind,w,inp.height,inp.depth,source);
    // наименьшее допустимое число дверей; чётное (по 2 створки в секции, как «4 · секций 2») — если есть
    const opts=doorCountOptions(base).filter(c=>inp.doors===undefined||c>inp.doors),n=opts.find(c=>c%2===0)??opts[0];if(!n)return null;
    const k=Math.ceil(n/2);return {label:`${n} ${plural(n,'дверь','двери','дверей')} · ${k} ${plural(k,'секция','секции','секций')}`,patch:{doors:n}};
  }catch{return null;}
}
function fieldOf(text:string,inp:PaletteInput):PaletteField|undefined{
  if(/Фасад|фасад|створ|двер|полотн/.test(text))return DOOR_KINDS.includes(inp.kind)||inp.kind==='kupe'||inp.kind==='kupe-wardrobe'?'doors':'width';
  if(/глубин|направляющ/i.test(text))return inp.kind==='kupe'?undefined:'depth';
  if(/высот|ящик|полк|штанг/i.test(text))return 'height';
  if(/ширин/i.test(text))return 'width';
  return undefined;
}
function otherIssue(inp:PaletteInput,text:string,source:Module):PaletteIssue{
  const sp=splitAction(text.replace(/^[^:]{1,60}: (?=Секция|[А-ЯЁ])/,m=>/^(Ширина|Высота|Глубина|Секция)/.test(m)?m:''));
  const action=/Ctrl\+Z/.test(sp.action)?'Измените размеры или выберите другой вид мебели.':sp.action;
  const wide=text.match(/Фасад шире (\d+) мм/);
  if(wide){const fix=doorFix(inp,source);if(fix)return {field:'doors',text,problem:sp.problem,action:`Разделите на секции: ${fix.label} — каждая створка не шире ${wide[1]} мм.`,fixes:[fix],auto:fix.patch};}
  if(/^Двери купе: ширина полотна/.test(text)){const fix=doorFix(inp,source);if(fix)return {field:'doors',text,problem:sp.problem,action:`Выберите ${fix.label} — полотно встанет в пределы системы.`,fixes:[fix],auto:fix.patch};}
  return {field:fieldOf(text,inp),text,problem:sp.problem,action,fixes:[]};
}
function issuesAt(inp:PaletteInput,source:Module):PaletteIssue[]{
  const out:PaletteIssue[]=[],seen=new Set<string>();
  for(const text of paletteErrors(inp,source)){
    const ranges=rangesOf(text,inp),hits=ranges.map(g=>rangeIssue(inp,text,g)).filter((x):x is PaletteIssue=>!!x);
    // предел поля не нарушен (у ряда корпусов — другой корпус) — не ошибка этого ввода
    if(ranges.length&&!hits.length&&/допустимо от/.test(text))continue;
    // одна строка на поле и на однотипную ошибку («Ящик 1…», «Ящик 2…» — одной строкой)
    for(const x of hits.length?hits:[otherIssue(inp,text,source)]){const key=(x.field??'')+'|'+(x.limit?'range':norm(x.problem));if(seen.has(key))continue;seen.add(key);out.push(x);}
  }
  return out;
}
/** Все ошибки формы сразу. Если размеры вне пределов — ещё и то, что проявится после их исправления (на исправленных размерах). */
export function paletteIssues(inp:PaletteInput,source:Module):PaletteIssue[]{
  const first=issuesAt(inp,source),ranges=first.filter(x=>x.limit&&x.auto);
  if(!ranges.length)return first;
  const fixed={...inp};for(const x of ranges)Object.assign(fixed,x.auto);
  const size=`${fixed.width}${(fixed.bodies??1)>1?` (${fixed.bodies} ${plural(fixed.bodies!,'корпус','корпуса','корпусов')})`:''} × ${fixed.height}${fixed.kind==='kupe'?'':` × ${fixed.depth}`}`;
  const next=issuesAt(fixed,source).filter(x=>!x.limit);
  // та же ошибка есть и сейчас, но исправление видно только на исправленных размерах (число дверей купе) — берём его
  const now=first.map(y=>{if(y.fixes.length)return y;const z=next.find(x=>x.fixes.length&&norm(x.problem)===norm(y.problem));return z?{...y,action:z.action,fixes:z.fixes,auto:z.auto}:y;});
  const later=next.filter(x=>!first.some(y=>norm(y.problem)===norm(x.problem))).map(x=>({...x,after:true,problem:`При ${size}: ${x.problem.replace(/^./,c=>c.toLowerCase())}`}));
  return [...now,...later];
}
/** «Исправить автоматически»: однозначные исправления, пока они есть (размеры → двери). */
export function paletteAutoFix(inp:PaletteInput,source:Module):{patch:PalettePatch;input:PaletteInput;left:PaletteIssue[]}{
  let cur={...inp};const patch:PalettePatch={};
  for(let i=0;i<4;i++){
    const fix=paletteIssues(cur,source).filter(x=>x.auto);if(!fix.length)break;
    for(const x of fix){Object.assign(patch,x.auto);cur={...cur,...x.auto};}
  }
  return {patch,input:cur,left:paletteIssues(cur,source)};
}
/** Причины отказа поля «Габариты» в панели модуля (п.3) сверх предела самого поля: что ещё не выполняется при этом значении
 *  (тексты проверки как есть, без строк пределов габаритов — предел поле пишет само). */
export function fieldReasons(m:Module,key:'width'|'height'|'depth',value:number):string[]{
  if(!Number.isFinite(value))return [];
  let all:string[]=[];
  try{all=validate({...m,[key]:value},{all:true});}catch{try{all=validate({...m,[key]:value});}catch{all=[];}}
  return all.filter(e=>!/^(Ширина|Высота|Глубина)(?: стола)?: допустимо от/.test(e));
}
