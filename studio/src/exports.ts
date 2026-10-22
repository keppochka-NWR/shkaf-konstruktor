import { holes } from "./drilling";
import {roomWarnings} from './roomWarnings';
import {cutting,cutCSV,cuttingHTML,sheetPolygon,type Point} from './cornerCutting';
import {nicheSize,nicheMinimum} from './measurement';
import {SLIDES,drawerHasHandle} from './hardware';
import {meshById} from './mesh';
import {handleById} from './handles';
import {aluLabel,aluProfile,aluInsertSize} from './alu';
import { grooveText, parts, RULES, boxes, drawerConfig, drawerOffsets, plinth, cornerStrip, drawerBoxHeight, drawerGripOn, type Part } from "./model";
import { bounds, projectErrors, type Project } from "./project";
import {packRectangles} from './packing';
import {edgeLength} from './edges';
import {catalog} from './catalog';
import {guillotinePack,type GuillotineCut,type GuillotineResult,type Offcut} from './guillotine';
import {describeModule,plainFeatures} from './quoteDescribe';
import {moduleThumbSVG,decorFallbackColor} from './quoteThumb';
import {vernissageColor} from './facadesVernissage';
import type {Module} from './model';
import {hasSeller,type SellerInfo} from './sellerInfo';
import {count,DETAILS} from './ru';
import {pendingTotalLabel} from './pendingPrices';
/** Деталь без направления текстуры: ЛХДФ или однотонный декор без картинки в каталоге — на карте можно класть поперёк. */
export function grainFree(d:Pick<Detail,'material'|'decor'>){return d.material==='hdf'||!catalog.find(c=>c.n===d.decor)?.tex;}
export type Detail = Part & { moduleName: string; moduleId: string; code: string };
export type Placement = {
  detail: Detail;
  x: number;
  y: number;
  w: number;
  h: number;
  cutContour?:Point[];
  /** гильотина: деталь положена поперёк листа (w — её длина) */
  rotated?:boolean;
};
export type Sheet = {
  decor: string;
  material: string;
  thickness: number;
  width: number;
  height: number;
  items: Placement[];
  /** Только у карт движка «гильотина как в Базисе»: резы по стадиям, обрезки, число стадий, пропил и обрезка края. */
  guillotine?: {cuts:GuillotineCut[];offcuts:Offcut[];stages:number;kerf:number;trim:number};
};
export function findSheetDetails(sheets:Sheet[],query:string){
 const q=query.trim().toLocaleLowerCase('ru-RU'),words=q.split(/\s+/).filter(Boolean);if(!q)return [];
 return sheets.flatMap((s,sheet)=>s.items.filter(a=>{const text=[a.detail.code,a.detail.name,a.detail.moduleName,a.detail.decor,a.h,a.w,a.detail.thickness].join(' ').toLocaleLowerCase('ru-RU');return words.every(w=>text.includes(w));}).map(a=>({a,sheet}))).sort((a,b)=>Number(b.a.detail.code===q)-Number(a.a.detail.code===q)||a.a.detail.code.localeCompare(b.a.detail.code,'ru',{numeric:true}));
}
export function details(p: Project): Detail[] {
  return p.modules.flatMap((m, i) =>
    parts(m.module)
      .filter((p) => p.material !== "metal" && p.material !== "alu" && p.material !== "glass" && !p.external)
      .map((d, j) => ({
        ...d,
        moduleName: m.module.name,
        moduleId: m.id,
        code: `${i + 1}.${j + 1}`,
      })),
  );
}
/** Conservative guillotine preview. Grain locked to sheet long side; no mirroring or rotation. */
export function nestGuillotine(p: Project, gap = 10): Sheet[] {
  const err = projectErrors(p);
  if (err.length) throw Error(err[0]);
  if (!Number.isFinite(gap) || gap < 0 || gap > 30)
    throw Error("Неверный промежуток между деталями.");
  type Free = { x: number; y: number; w: number; h: number };
  const result: (Sheet & { free: Free[] })[] = [];
  for (const d of details(p).sort(
    (a, b) => b.length * b.width - a.length * a.width,
  )) {
    const width = d.material === "hdf" ? RULES.hdfH : RULES.sheetH,
      height = d.material === "hdf" ? RULES.hdfW : RULES.sheetW;
    const key = d.material === "hdf" ? "ЛХДФ" : d.decor;
    if (d.width > width - 20 || d.length > height - 20)
      throw Error(`Деталь ${d.code} не помещается в лист.`);
    let best:
      { s: (typeof result)[number]; i: number; score: number } | undefined;
    for (const s of result.filter(
      (s) =>
        s.decor === key &&
        s.material === d.material &&
        s.thickness === d.thickness,
    ))
      s.free.forEach((f, i) => {
        if (f.w >= d.width && f.h >= d.length) {
          const score = f.w * f.h - d.width * d.length;
          if (!best || score < best.score) best = { s, i, score };
        }
      });
    if (!best) {
      const s = {
        decor: key,
        material: d.material,
        thickness: d.thickness,
        width,
        height,
        items: [],
        free: [{ x: 10, y: 10, w: width - 20, h: height - 20 }],
      };
      result.push(s);
      best = { s, i: 0, score: 0 };
    }
    const { s, i } = best,
      f = s.free.splice(i, 1)[0];
    s.items.push({ detail: d, x: f.x, y: f.y, w: d.width, h: d.length });
    // Non-overlapping free rectangles, with processing gap reserved.
    const rw = f.w - d.width - gap,
      bh = f.h - d.length - gap;
    if (rw > 0)
      s.free.push({ x: f.x + d.width + gap, y: f.y, w: rw, h: d.length });
    if (bh > 0) s.free.push({ x: f.x, y: f.y + d.length + gap, w: f.w, h: bh });
  }
  return result.map(({ free, ...s }) => s);
}
/** Движок раскроя проекта: флаг calculation.cuttingEngine; угловые (фигурные) корпуса пока всегда кроятся прежним движком. */
export function cuttingEngine(p:Project):'classic'|'guillotine'{return p.calculation?.cuttingEngine==='guillotine'&&!p.modules.some(a=>a.module.corner)?'guillotine':'classic';}
/** Параметры движка «гильотина как в Базисе» для студии: пропил и обрезка — из настроек Базиса цеха (Saw=4.4, Undercut 12).
 *  narrowBlank — узкие детали кроятся заготовкой 59 мм и подрезаются (ValueDetailsJoining=59, «ПОДРЕЗАТЬ» на картах Базиса).
 *  minTrim — до какой обрезки можно уменьшить край, если деталь длиннее 2726 (модель допускает 2730 при поле 10; Базис в части заказов резал с обрезкой 10/9/8). */
export const GUILLOTINE_RULES={kerf:4.4,trim:12,minTrim:10,maxStages:5,iterations:8,narrowBlank:59,
  /** аварийный предел на группу в браузере; обычные проекты укладываются в десятки мс и результат детерминирован */ timeLimitMs:1500};
export type NestPlan={sheets:Sheet[];unplaced:{detail:Detail;reason:string}[];engine:'classic'|'guillotine'};
/** Раскрой с подробностями: карты + детали, которые не помещаются в лист (только у гильотины — старый движок в этом случае падает). */
export function nestPlan(p:Project):NestPlan{
  if(cuttingEngine(p)==='classic')return {sheets:nest(p),unplaced:[],engine:'classic'};
  const err=projectErrors(p);if(err.length)throw Error(err[0]);
  const groups=new Map<string,Detail[]>();
  for(const d of details(p)){const key=JSON.stringify([d.material,d.material==='hdf'?'ЛХДФ':d.decor,d.thickness]);groups.set(key,[...(groups.get(key)||[]),d]);}
  const sheets:Sheet[]=[],unplaced:NestPlan['unplaced']=[];
  for(const ds of groups.values()){
    const first=ds[0],decor=first.material==='hdf'?'ЛХДФ':first.decor,width=first.material==='hdf'?RULES.hdfH:RULES.sheetH,height=first.material==='hdf'?RULES.hdfW:RULES.sheetW;
    const byId=new Map(ds.map(d=>[d.code,d])),nb=GUILLOTINE_RULES.narrowBlank;
    const parts=ds.map(d=>({id:d.code,w:Math.max(d.width,nb),h:Math.max(d.length,nb),rot:grainFree(d)}));
    // обрезка 12; если деталь иначе не помещается — меньше, но не ниже minTrim
    const need=Math.min(...parts.map(a=>Math.max(Math.min((width-a.w)/2,(height-a.h)/2),a.rot?Math.min((width-a.h)/2,(height-a.w)/2):-Infinity)));
    const trim=Math.max(GUILLOTINE_RULES.minTrim,Math.min(GUILLOTINE_RULES.trim,Math.floor(need*2)/2));
    const r=cachedGuillotine(parts,width,height,trim);
    for(const s of r.sheets)sheets.push({decor,material:first.material,thickness:first.thickness,width,height,items:s.items.map(a=>({detail:byId.get(a.id)!,x:a.x,y:a.y,w:a.w,h:a.h,...(a.rotated?{rotated:true}:{})})),guillotine:{cuts:s.cuts,offcuts:s.offcuts,stages:s.stages,kerf:r.kerf,trim:r.trim}});
    for(const u of r.unplaced)unplaced.push({detail:byId.get(u.id)!,reason:u.reason});
  }
  return {sheets,unplaced,engine:'guillotine'};
}
// Кеш раскроя по группе: nest() зовут смета, док, вкладка карт и бирки на одном и том же проекте.
const guillotineCache=new Map<string,GuillotineResult>();
function cachedGuillotine(parts:{id:string;w:number;h:number;rot:boolean}[],width:number,height:number,trim:number){
  const key=JSON.stringify([width,height,trim,GUILLOTINE_RULES,parts.map(a=>[a.id,a.w,a.h,a.rot?1:0])]);
  let r=guillotineCache.get(key);
  if(!r){r=guillotinePack(parts,width,height,{...GUILLOTINE_RULES,trim});guillotineCache.set(key,r);if(guillotineCache.size>40)guillotineCache.delete(guillotineCache.keys().next().value!);}
  else{guillotineCache.delete(key);guillotineCache.set(key,r);}
  return r;
}
/** Compare six fixed-grain nestings against the previous guaranteed baseline. */
export function nest(p:Project,gap=10):Sheet[]{
  if(cuttingEngine(p)==='guillotine'){
    if(!Number.isFinite(gap)||gap<0||gap>30)throw Error("Неверный промежуток между деталями.");
    return nestPlan(p).sheets;
  }
  if(p.modules.some(a=>a.module.corner)){
    if(gap!==10)throw Error('Фигурный раскрой: промежуток 10 мм.');
    const result=cutting(p),byKey=new Map(details(p).map(d=>[d.moduleId+'/'+d.id,d]));
    return result.sheets.map(s=>({decor:s.decor,material:s.material==='ХДФ'?'hdf':'board',thickness:s.thickness,width:s.width,height:s.height,items:s.items.map(a=>({detail:byKey.get(a.id)!,x:a.x,y:a.y,w:a.w,h:a.h,cutContour:sheetPolygon(a)}))}));
  }
  const baseline=nestGuillotine(p,gap),all=details(p),groups=new Map<string,Detail[]>();
  for(const d of all){const key=JSON.stringify([d.material,d.material==='hdf'?'ЛХДФ':d.decor,d.thickness]);groups.set(key,[...(groups.get(key)||[]),d]);}
  const result:Sheet[]=[];
  for(const ds of groups.values()){
    const first=ds[0],decor=first.material==='hdf'?'ЛХДФ':first.decor,width=first.material==='hdf'?RULES.hdfH:RULES.sheetH,height=first.material==='hdf'?RULES.hdfW:RULES.sheetW;
    let best=baseline.filter(s=>s.material===first.material&&s.decor===decor&&s.thickness===first.thickness);
    const byId=new Map(ds.map(d=>[d.code,d]));
    const footprint=(s:Sheet[])=>Math.max(...s.at(-1)!.items.map(p=>p.y+p.h));
    for(const order of ['area','height','width'] as const)for(const fit of ['short','area'] as const){
      const packed=packRectangles(ds.map(d=>({id:d.code,w:d.width,h:d.length,rot:grainFree(d)})),width-20,height-20,gap,order,fit);
      if(packed.length>best.length)continue;
      const candidate:Sheet[]=packed.map(items=>({decor,material:first.material,thickness:first.thickness,width,height,items:items.map(a=>({detail:byId.get(a.id)!,x:a.x+10,y:a.y+10,w:a.w,h:a.h}))}));
      if(candidate.length<best.length||footprint(candidate)<footprint(best))best=candidate;
    }
    result.push(...best);
  }
  return result;
}
export const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function saveFile(
  name: string,
  text: string,
  type = "text/html;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
/** Пазы детали для деталировки: паз под ЛХДФ (если задник в паз) и пазы под подсветку — тот же текст, что на бирке. */
export function detailGrooves(p: Project, moduleId: string, partId: string) {
  const m = p.modules.find((a) => a.id === moduleId)?.module;
  if (!m) return "";
  const back = m.backType === "groove" && ["left", "right", "top", "bottom"].includes(partId) ? `паз ${m.grooveWidth ?? 4}×${m.grooveDepth ?? 8} под ЛХДФ, отступ ${m.grooveInset ?? 16}` : "";
  return [back, grooveText(m, partId)].filter(Boolean).join("; ");
}
export function detailCSV(p: Project) {
  if(p.modules.some(a=>a.module.corner))return cutCSV(cutting(p));
  const rows = [
    [
      "Код",
      "Модуль",
      "Деталь",
      "Материал",
      "Длина",
      "Ширина",
      "Толщина",
      "Кромка 1 · торец ширины",
      "Кромка 2 · торец ширины",
      "Кромка 3 · торец длины",
      "Кромка 4 · торец длины",
      "Пазование",
    ],
    ...details(p).map((d) => [
      d.code,
      d.moduleName,
      d.name,
      d.material === "hdf" ? "ЛХДФ" : d.decor,
      d.length,
      d.width,
      d.thickness,
      ...d.edge,
      detailGrooves(p, d.moduleId, d.id),
    ]),
  ];
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map(
            (v) =>
              '"' +
              (typeof v === "string" && /^[=+@\-\t\r]/.test(v)
                ? "'" + v
                : String(v)
              ).replace(/"/g, '""') +
              '"',
          )
          .join(";"),
      )
      .join("\r\n")
  );
}
export function sheetSVG(s: Sheet,highlight="") {
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.width} ${s.height}"><rect width="${s.width}" height="${s.height}" fill="#f1ede3" stroke="#90a7ac" stroke-width="5"/>${s.items.map(p=>{
  const fill=p.detail.code===highlight?'#ffd77e':'#d7e9e8',stroke=p.detail.code===highlight?'#a56300':'#4a8e98';
  const shape=p.cutContour?`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#efede5" stroke="#aab3b2" stroke-dasharray="12 8"/><polygon points="${p.cutContour.map(v=>v.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`:`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
  return `<g><title>${esc(p.detail.name+' · '+p.detail.moduleName)}</title>${shape}<text x="${p.x+p.w/2}" y="${p.y+p.h/2}" text-anchor="middle" dominant-baseline="central" font-size="${Math.min(p.w,p.h)<100?26:42}" font-family="Arial" fill="#234754">${esc(p.detail.code)}</text></g>`;
 }).join('')}${s.guillotine?s.guillotine.offcuts.filter(o=>o.business).map(o=>`<g><title>${esc('Деловой обрезок '+Math.round(o.h)+' × '+Math.round(o.w))}</title><rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="#e4dccb" stroke="#b9a986" stroke-width="2" stroke-dasharray="14 10"/>${o.large?`<text x="${o.x+o.w/2}" y="${o.y+o.h/2}" text-anchor="middle" dominant-baseline="central" font-size="34" font-family="Arial" fill="#8a7a58">${Math.round(o.h)}×${Math.round(o.w)}</text>`:''}</g>`).join(''):''}</svg>`;
}

const style =
  "body{font:14px Arial;color:#23404c;max-width:1000px;margin:40px auto;padding:20px}h1{font-size:32px}h2{margin-top:32px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #d5dfe3}small{color:#637c85}svg{width:300px;max-height:480px}section{break-inside:avoid;margin:30px 0}.sum{font-size:24px;font-weight:bold}.note{white-space:pre-wrap}button{padding:12px 22px;background:#187f91;color:white;border:0;border-radius:6px}@page{size:A4;margin:12mm}@media print{button{display:none}body{margin:0;padding:0;max-width:none;font-size:11px}h1{font-size:24px}h2,h3{break-after:avoid}p{orphans:3;widows:3}section{break-inside:auto}th,td{padding:5px}tr{break-inside:avoid}thead{display:table-header-group}}";
function htmlDocument(title: string, body: string) {
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title><style>${style}</style><body><button onclick="window.print()">Печать / Сохранить PDF</button>${body}</body></html>`;
}
/** Пометка к размеру детали на гильотинной карте: повёрнута поперёк листа и/или кроится узкой заготовкой с подрезкой. */
function blankNote(a:Placement){
  const [along,across]=a.rotated?[a.w,a.h]:[a.h,a.w];
  const blank=Math.abs(along-a.detail.length)>0.01||Math.abs(across-a.detail.width)>0.01;
  return (a.rotated?' (повёрнута)':'')+(blank?` (заготовка ${along} × ${across}, подрезать)`:'');
}
/** Пояснение к картам движка «гильотина как в Базисе» (для HTML-карт и вкладки раскроя). */
export function guillotineNote(){return `Раскрой под форматную пилу (сквозные резы, как в Базисе): ЛДСП Lamarty 2750 × 1830 мм, ЛХДФ 2800 × 2070 мм; пропил ${String(GUILLOTINE_RULES.kerf).replace('.',',')} мм, обрезка края ${GUILLOTINE_RULES.trim} мм (до ${GUILLOTINE_RULES.minTrim} мм, если деталь иначе не помещается); каждый рез сквозной, не более ${GUILLOTINE_RULES.maxStages} стадий: первая — продольные полосы во всю длину листа. Текстура вдоль длинной стороны листа; ЛХДФ и однотонные декоры без рисунка можно поворачивать. Детали уже ${GUILLOTINE_RULES.narrowBlank} мм кроятся заготовкой ${GUILLOTINE_RULES.narrowBlank} мм и подрезаются.`;}
export function nestingHTML(p: Project) {
  if(p.modules.some(a=>a.module.corner))return cuttingHTML(cutting(p),[
    'Раскрой всех прямых и угловых корпусов текущего проекта, разделённый по материалу и толщине.',
    'Фигурные детали размещены по габариту заготовки; показан контур после вычета кромки. Обрезки внутри заготовки повторно не используются.',
    'Петли диагональных фасадов и присадку направляющих необходимо проверить по выбранным артикулам.'
  ],'Ё Конструктор · раскрой проекта');
  const plan=nestPlan(p);
  if(plan.engine==='guillotine')return htmlDocument('Карты листов',`<style>@media print{.nest-sheet{break-before:page;margin:0}.nest-sheet:first-of-type{break-before:auto}.nest-sheet h2{margin:10px 0;font-size:16px}.nest-sheet svg{display:block;width:auto;height:105mm;max-width:100%}.nest-sheet table{font-size:10px}.nest-sheet th,.nest-sheet td{padding:3px}}</style><h1>Карты листов · под форматную пилу</h1><p>${esc(guillotineNote())}</p><p>Предварительная укладка габаритов деталей. Припуски, инструмент, присадка и режимы станка требуют проверки; карты не являются управляющей программой.</p>${plan.unplaced.length?`<h2>Не помещаются в лист — сращивать или заказать отдельно</h2><ul>${plan.unplaced.map(u=>`<li><b>${esc(u.detail.code)}</b> ${esc(u.detail.moduleName)} / ${esc(u.detail.name)}: ${esc(u.reason)}</li>`).join('')}</ul>`:''}${plan.sheets.map((s,i)=>{const g=s.guillotine!,used=s.items.reduce((n,a)=>n+a.w*a.h,0),offcuts=g.offcuts.filter(o=>o.business).sort((a,b)=>b.w*b.h-a.w*a.h);return `<section class="nest-sheet"><h2>Лист ${i+1} · ${esc(s.decor)} · ${s.thickness} мм</h2>${sheetSVG(s)}<p>${s.height} × ${s.width} мм · ${count(s.items.length,DETAILS)} · КИМ ${Math.round(used/(s.width*s.height)*1000)/10} % · стадий резов ${g.stages} · резов ${g.cuts.length}${g.trim!==GUILLOTINE_RULES.trim?` · обрезка края ${g.trim} мм`:''}</p>${offcuts.length?`<p>Деловые обрезки: ${offcuts.slice(0,6).map(o=>`${Math.round(o.h)} × ${Math.round(o.w)}${o.large?' (крупный)':''}`).join(', ')}${offcuts.length>6?` и ещё ${offcuts.length-6}`:''}.</p>`:''}<table><thead><tr><th>Код · лист ${i+1}</th><th>Модуль / деталь</th><th>Размер</th></tr></thead><tbody>${s.items.map(a=>`<tr><td>${a.detail.code}</td><td>${esc(a.detail.moduleName)} / ${esc(a.detail.name)}</td><td>${a.detail.length} × ${a.detail.width}${blankNote(a)}</td></tr>`).join('')}</tbody></table></section>`;}).join('')}`);
  return htmlDocument(
    "Карты листов",
    `<style>@media print{.nest-sheet{break-before:page;margin:0}.nest-sheet:first-of-type{break-before:auto}.nest-sheet h2{margin:10px 0;font-size:16px}.nest-sheet svg{display:block;width:auto;height:105mm;max-width:100%}.nest-sheet table{font-size:10px}.nest-sheet th,.nest-sheet td{padding:3px}}</style><h1>Карты листов · для технолога</h1><p>ЛДСП Lamarty 2750 × 1830 мм. Поле обрезки 10 мм; промежуток 10 мм. Направление текстуры вдоль длинной стороны листа; ЛХДФ и однотонные декоры без рисунка укладываются в любом направлении.</p><p>Предварительная укладка габаритов деталей. Припуски, инструмент, присадка и режимы станка требуют проверки; карты не являются управляющей программой.</p>${plan.sheets
      .map(
        (s, i) =>
          `<section class="nest-sheet"><h2>Лист ${i + 1} · ${esc(s.decor)} · ${s.thickness} мм</h2>${sheetSVG(s)}<p>${s.height} × ${s.width} мм · ${count(s.items.length,DETAILS)}</p><table><thead><tr><th>Код · лист ${i+1}</th><th>Модуль / деталь</th><th>Размер</th></tr></thead><tbody>${s.items.map((a) => `<tr><td>${a.detail.code}</td><td>${esc(a.detail.moduleName)} / ${esc(a.detail.name)}</td><td>${a.h} × ${a.w}</td></tr>`).join("")}</tbody></table></section>`,
      )
      .join("")}`,
  );
}
/** Часть сметы, нужная КП для разбивки цены (estimate() из pricing.ts; передаётся снаружи, чтобы не было цикла импортов). */
export type QuoteCost = { retail: number | null; model: "markup" | "sheet"; split: { material: number; hardware: number; kupe?: number }; pending?: readonly unknown[]; notice?: string | null };
export type QuoteSplit = { material: number; hardware: number; kupe: number };
/** Разбивка цены КП «материалы / фурнитура / двери купе» (решения Макса 06.10 и 16.10.2026): только когда цена КП = расчётной цене модели
 *  «себестоимость × коэффициент». Округление итога до 100 ₽ относится к материалам: материалы = итог − фурнитура − двери купе,
 *  поэтому сумма граф = итогу. Двери купе (розница калькулятора купе) — своей графой, не в материалах и не в фурнитуре.
 *  Цена изменена вручную (скидка) или модель «цена за лист» (фурнитура внутри листа) — разбивки нет, печатается только итог. */
export function quoteBreakdown(price: string, cost?: QuoteCost | null): QuoteSplit | null {
  const n = Number(price);
  if (!cost || cost.model !== "markup" || cost.retail === null || !price.trim() || !Number.isFinite(n) || n !== cost.retail) return null;
  const kupe = Math.max(0, Math.min(cost.split.kupe ?? 0, cost.retail));
  const hardware = Math.max(0, Math.min(cost.split.hardware, cost.retail - kupe));
  const material = cost.retail - hardware - kupe;
  // меньше двух ненулевых граф — разбивка без смысла, только итог
  if ([material, hardware, kupe].filter((v) => v > 0).length < 2) return null;
  return { material, hardware, kupe };
}
/** Графы разбивки для вывода (КП, панель, CSV): «Двери купе» — только если они есть в проекте. */
export function splitRows(s: QuoteSplit): [string, number][] {
  return [["Материалы", s.material], ["Фурнитура", s.hardware], ...(s.kupe ? [["Двери купе", s.kupe] as [string, number]] : [])];
}/** Таблица модулей для клиента: описание по типу модуля (quoteDescribe.ts), без нулевых позиций и служебных слов. */
export function clientModulesTable(p: Project) {
  return `<table><thead><tr><th>№</th><th>Изделие</th><th>Размеры, мм</th><th>Материалы</th><th>Наполнение</th></tr></thead><tbody>${p.modules.map((a, i) => {
    const d = describeModule(a.module);
    return `<tr><td>${i + 1}</td><td><b>${esc(d.kind)}</b>${d.kind !== a.module.name ? `<br><small>${esc(a.module.name)}</small>` : ""}</td><td>${esc(d.size)}</td><td>${d.materials.map(esc).join("<br>")}</td><td>${d.filling.length ? d.filling.map(esc).join("<br>") : "—"}</td></tr>`;
  }).join("")}</tbody></table>`;
}
const clientStyle = `<style>.seller{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #23404c;padding-bottom:10px;margin-bottom:6px}.seller b{font-size:18px}.seller p{margin:0;white-space:pre-wrap;text-align:right}.split{width:auto;min-width:320px;margin-top:16px}.split td{padding:6px 12px}.split td:last-child{text-align:right}.split tr:last-child td{font-weight:bold;font-size:18px;border-top:2px solid #23404c}@media print{.seller b{font-size:15px}img{max-height:95mm!important}}</style>`;
function sellerBlock(seller?: SellerInfo) {
  return hasSeller(seller) ? `<header class="seller"><b>${esc(seller!.name.trim())}</b><p>${esc(seller!.contacts.trim())}</p></header>` : "";
}
/** Цена КП включает позиции после финального расчёта — отметка менеджера (offer.pendingIncluded). */
export const PENDING_INCLUDED_NOTE = "Цена включает позиции после финального расчёта конструктором (цена согласована менеджером)";
/** Стили КП (менеджеры 22.10.2026, п. 9): карточки изделий с миниатюрой, образцы материалов, «входит / не входит», печать A4. */
const quoteStyle = `<style>.q-head p{margin:4px 0 0;color:#637c85}.q-hero{margin:18px 0 8px;border:1px solid #d5dfe3;border-radius:8px;overflow:hidden;background:#f6f4ef}.q-hero img{display:block;width:100%;max-height:520px;object-fit:contain}
.q-legend{color:#637c85;font-size:12px;margin:2px 0 10px}.q-item{display:grid;grid-template-columns:150px 1fr;gap:18px;padding:14px 0;border-top:1px solid #d5dfe3;break-inside:avoid}.q-thumb{display:flex;align-items:center;justify-content:center;background:#f6f4ef;border-radius:6px;padding:8px;min-height:120px}.q-thumb svg{width:100%;height:auto;max-height:170px}
.q-title{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.q-title b{font-size:17px}.q-price{font-size:17px;font-weight:bold;white-space:nowrap}.q-size{color:#23404c;margin:2px 0 6px}.q-body small{color:#637c85}.q-body ul{margin:6px 0 0;padding-left:18px}.q-body li{margin:2px 0}
.q-mats{list-style:none;padding-left:0!important}.q-mats li{display:flex;align-items:center;gap:8px}.sw{flex:none;display:inline-block;width:22px;height:22px;border-radius:4px;border:1px solid #b9c6cb;background-size:cover;background-position:center}
.q-terms{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px;break-inside:avoid}.q-terms div{border:1px solid #d5dfe3;border-radius:8px;padding:10px 14px}.q-terms h3{margin:0 0 6px;font-size:15px}.q-terms ul{margin:0;padding-left:18px}.q-total-items{font-size:13px;color:#637c85}
@media print{.q-hero img{max-height:105mm}.q-item{grid-template-columns:34mm 1fr;gap:5mm;padding:3mm 0}.q-thumb{min-height:0;padding:2mm}.q-thumb svg{max-height:45mm}.q-title b,.q-price{font-size:13px}.sw{width:5mm;height:5mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}.q-thumb,.q-hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}.q-terms{gap:5mm}}</style>`;
/** Образцы материалов для КП: декор → картинка текстуры (data URL) и средний цвет (decorSwatches.ts, браузер). */
export type QuoteSwatches = Record<string, { img: string; color: string }>;
/** Декор строки материала describeModule (для образца цвета): корпус, фасады, фасады ящиков; Вернисаж — его цвет; рамка ALU — без образца. */
function materialSwatch(m: Module, line: string, sw: QuoteSwatches): string {
  let decor = "", color = "";
  if (line.startsWith("Корпус:")) decor = m.decor;
  else if (line.startsWith("Фасады ящиков:")) { if (m.vernissage) color = "#" + vernissageColor(m.vernissage).toString(16).padStart(6, "0"); else if (!line.includes("алюминиевая")) decor = m.drawerFacadeDecor ?? m.facadeDecor; }
  else if (line.startsWith("Фасады:")) { if (m.vernissage) color = "#" + vernissageColor(m.vernissage).toString(16).padStart(6, "0"); else if (!m.alu) decor = m.facadeDecor; else color = "#a7b0b5"; }
  if (!decor && !color) return "";
  const s = decor ? sw[decor] : undefined;
  return `<span class="sw" style="${s ? `background-image:url('${s.img}');background-color:${s.color}` : `background-color:${color || decorFallbackColor(decor)}`}" title="${esc(decor || "цвет фасадов")}"></span>`;
}
/** Карточка изделия КП: миниатюра, тип и размеры, наполнение и «как открывается» простыми словами, материалы с образцом, цена изделия. */
function quoteItemHTML(a: Project["modules"][number], i: number, price: number | null, sw: QuoteSwatches) {
  const m = a.module, d = describeModule(m), rub = (v: number) => v.toLocaleString("ru-RU") + " ₽";
  const thumb = moduleThumbSVG(m, (decor) => sw[decor]?.color ?? decorFallbackColor(decor));
  const inside = [...d.filling, ...plainFeatures(m)];
  return `<article class="q-item"><div class="q-thumb">${thumb}</div><div class="q-body"><div class="q-title"><b>${i + 1}. ${esc(d.kind)}</b>${price !== null ? `<span class="q-price">${rub(price)}</span>` : ""}</div>${d.kind !== m.name ? `<small>${esc(m.name)}</small>` : ""}<div class="q-size">${esc(d.size)} мм</div>${inside.length ? `<ul>${inside.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<ul class="q-mats">${d.materials.map((x) => `<li>${materialSwatch(m, x, sw)}${esc(x)}</li>`).join("")}</ul></div></article>`;
}
export function quoteHTML(
  p: Project,
  customer: string,
  price: string,
  notes: string,
  image?: string,
  opts: { seller?: SellerInfo; cost?: QuoteCost | null; /** цены изделий (itemPrices.modulePrices), сумма = цене КП */ items?: number[] | null; swatches?: QuoteSwatches } = {},
) {
  const n = Number(price), priced = price.trim() !== "" && Number.isFinite(n) && n >= 0, rub = (v: number) => v.toLocaleString("ru-RU") + " ₽";
  const split = priced ? quoteBreakdown(price, opts.cost) : null;
  const sum = !priced ? `<p class="sum">Стоимость: после согласования</p>` : split
    ? `<table class="split"><tbody>${splitRows(split).map(([k, v]) => `<tr><td>${k}</td><td>${rub(v)}</td></tr>`).join("")}<tr><td>Итого</td><td>${rub(n)}</td></tr></tbody></table>`
    : `<p class="sum">Стоимость: ${rub(n)}</p>`;
  // цена по каждому изделию (переключатель offer.itemPrices, по умолчанию да): только когда доли сходятся с ценой КП до рубля
  const items = priced && p.offer?.itemPrices !== false && opts.items && opts.items.length === p.modules.length && opts.items.reduce((s, v) => s + v, 0) === n ? opts.items : null;
  const sw = opts.swatches ?? {};
  const kupe = p.modules.some((a) => a.module.kupe);
  // позиции кухни без счёта (pendingPrices.ts): итог — по известным позициям, рядом явная строка с их числом
  // — по статусу комплектации (ревью R6), не по равенству цены КП итогу: скидка или округление цены её не убирают.
  // Закрыть позиции ручной ценой — только явной отметкой менеджера (offer.pendingIncluded).
  const pendingN = opts.cost?.pending?.length ?? 0;
  const pendingNote = !pendingN ? "" : p.offer?.pendingIncluded ? `<p class="note">${esc(PENDING_INCLUDED_NOTE)}</p>` : `<p class="note">${pendingTotalLabel(pendingN)}</p>`;
  // публичная сборка: расчёт менеджера, который она не может повторить (ревью R1/R2) — явная строка
  const noticeNote = opts.cost?.notice ? `<p class="note">${esc(opts.cost.notice)}</p>` : "";
  // «входит / не входит» — по текущим текстам КП и сметы («без доставки и монтажа», «неописанный крепёж не включён»), без цен
  const included = ["изготовление изделий по размерам и комплектации из этого предложения", "материалы корпуса и фасадов, кромка, фурнитура и наполнение, перечисленные выше", ...(kupe ? ["двери купе с профилем и наполнением"] : [])];
  const excluded = ["доставка", "монтаж (сборка и установка)", "крепёж и материалы, не описанные в предложении", ...(pendingN && !p.offer?.pendingIncluded ? [pendingTotalLabel(pendingN).replace(/^П/, "п")] : [])];
  return htmlDocument(
    "Коммерческое предложение",
    `${clientStyle}${quoteStyle}${sellerBlock(opts.seller)}<header class="q-head"><h1>Коммерческое предложение</h1><p>${esc(customer.trim() || "Проект мебели")} · ${new Date().toLocaleDateString("ru-RU")}</p></header>${image ? `<figure class="q-hero"><img src="${image}" alt="Вид проекта"/></figure>` : ""}<h2>Состав заказа</h2><p class="q-legend">Размеры изделий: ширина × высота × глубина, мм.${items ? " Цена изделия — его доля в общей стоимости заказа." : ""}</p>${p.modules.map((a, i) => quoteItemHTML(a, i, items ? items[i] : null, sw)).join("")}<h2>Стоимость</h2>${sum}${pendingNote}${noticeNote}${notes.trim() ? `<p class="note">${esc(notes)}</p>` : ""}<section class="q-terms"><div><h3>Входит в стоимость</h3><ul>${included.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div><div><h3>Не входит</h3><ul>${excluded.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></section><p><small>Эскиз и комплектация для согласования. Цена предварительная, без доставки и монтажа. Размеры уточняются после замера.</small></p>`,
  );
}
/** Спецификация для клиента: те же изделия и материалы, что в КП, без цены, координат и производственных данных. */
export function clientSpecificationHTML(p: Project, customer: string, seller?: SellerInfo) {
  return htmlDocument("Спецификация", `${clientStyle}${sellerBlock(seller)}<h1>Спецификация</h1><p>${esc(customer.trim() || "Проект мебели")} · ${new Date().toLocaleDateString("ru-RU")}</p>${clientModulesTable(p)}<small>Состав изделий для согласования. Размеры уточняются после замера.</small>`);
}

/** Номер заказа для производственных документов (бирки, карты, комплект технологу): номер замера проекта; пусто — его нужно
 *  спросить при выдаче. В клиентских документах (КП, спецификация) номер заказа и «Заказ не указан» не печатаются. */
export function orderNumber(p:Project){return p.measurement?.number?.trim()??'';}
/** T3 (18.10.2026): производственные выгрузки — карты, деталировка CSV, ведомость, чертежи, бирки, комплект ZIP — одинаково требуют номер заказа. */
export const ORDER_REQUIRED='Укажите номер заказа — без него производственные документы не выгружаются.';
/** Сохраняет производственный документ только при заданном номере заказа; без номера файл не формируется (false). */
export function saveProductionFile(p:Project,name:string,text:()=>string,type?:string):boolean{
  if(!orderNumber(p))return false;
  saveFile(name,text(),type);return true;
}
export function labelOrder(p:Project){const number=p.measurement?.number.trim();return number?'Замер '+number:p.offer?.customer.trim()||p.cloud?.name?.trim()||'Заказ не указан';}
export const EDGE_LEGEND='1–2: торцы по ширине · 3–4: по длине';
export function labelEdges(d:Pick<Detail,'edge'>){return 'Кромка 1–4: '+d.edge.map(v=>v===0?'—':String(v).replace('.',',')).join(' / ')+' мм';}
export function labelDetails(p:Project){
  const sheets=nest(p),location=new Map(sheets.flatMap((s,i)=>s.items.map(a=>[a.detail.code,i+1] as const)));
  // 0 — деталь вне карт (гильотина: длиннее листа, сращивать)
  return details(p).map(d=>({...d,sheet:location.get(d.code)??0}));
}
/** Бирка по производственному шаблону цеха «Birka Лёха.brx» (Базис, FastReport): 120 × 75 мм на Xprinter XP-365B, одна деталь на этикетку.
 *  Поля: № заказа, материал, наименование (модуль), поз. (код), № детали (обозначение), пазование, паз, торец (отверстия),
 *  длина × ширина крупно; по четырём сторонам — кромка: обозначение и линия (тонкая < 0,8, толстая ≥ 0,8). */
export type LabelData={order:string;material:string;module:string;code:string;name:string;groove:string;notches:string;endHoles:string;length:number;width:number;edges:{L1:number;L2:number;W1:number;W2:number};/** Длины кромки по контуру (мм) у фигурной детали (вырезы Gola): на бирке рядом с толщиной. */edgeLens?:{L1:number;L2:number;W1:number;W2:number}};
/** Декор из каталога Lamarty (явные цены сметы — все в каталоге): бирка «ЛДСП … (Lamarty)», иначе «Плита …» — как строка листа в смете. */
export const lamartyDecor=(decor:string)=>catalog.some(c=>c.n===decor);
export function labelMaterial(d:Pick<Part,'material'|'decor'|'thickness'>):string{
  if(d.material==='hdf')return 'ЛХДФ '+d.thickness+' мм';
  return lamartyDecor(d.decor)?'ЛДСП '+d.decor+' '+d.thickness+' мм (Lamarty)':'Плита '+d.decor+' '+d.thickness+' мм';
}
export function labelData(p:Project):LabelData[]{
  const order=labelOrder(p);
  return p.modules.flatMap((a,i)=>{
    const m=a.module,all=parts(m);
    const drill=holes(m,all);
    return all.filter(d=>d.material!=='metal'&&d.material!=='alu'&&d.material!=='glass'&&!d.external).map((d,j)=>{
      const thin=d.size.indexOf(Math.min(...d.size)),endHoles=drill.filter(h=>h.part===d.id&&Math.abs(h.dir[thin])<0.5).length;
      const grooved=m.backType==='groove'&&['left','right','top','bottom'].includes(d.id);
      // Кромка: 1–2 — торцы по ширине (короткие, слева/справа на бирке), 3–4 — по длине (сверху/снизу).
      // материал — как в смете: ЛХДФ без декора корпуса; декор вне каталога Lamarty (МДФ IDM, «Ясень Бронхольм» из Базиса) — «Плита», не «Lamarty»
      return {order,material:labelMaterial(d),module:(i+1)+'. '+m.name,code:`${i+1}.${j+1}`,name:d.name,
        groove:grooved?`паз ${m.grooveWidth??4}×${m.grooveDepth??8} под ЛХДФ, отступ ${m.grooveInset??16}`:'—',notches:grooveText(m,d.id)||'—', // «Пазование» — паз под ЛХДФ, «Паз» — пазы под подсветку (каждая строка влезает в бирку)
        endHoles:endHoles?`${endHoles} отв.`:'—',
        length:Math.round(d.length),width:Math.round(d.width),edges:{W1:d.edge[0],W2:d.edge[1],L1:d.edge[2],L2:d.edge[3]},...(d.edgeLen?{edgeLens:{W1:edgeLength(d,0),W2:edgeLength(d,1),L1:edgeLength(d,2),L2:edgeLength(d,3)}}:{})};
    });
  });
}
export function labelsHTML(p:Project){
  const data=labelData(p),stamp=new Date().toLocaleString('ru-RU');
  const edgeBox=(v:number,cls:string,len?:number)=>v>0?`<div class="edge ${cls} ${v>=0.8?'thick':'thin'}">${String(v).replace('.',',')}${len!==undefined?' · '+String(Math.round(len*10)/10).replace('.',',')+' мм':''}</div>`:'';
  const f=(v:string)=>esc(v);
  return htmlDocument('Бирки деталей',`<style>
  @page{size:120mm 75mm;margin:0}
  .label-heading{margin:10mm}
  .birka{position:relative;box-sizing:border-box;width:120mm;height:75mm;margin:0 auto 4mm;background:#fff;border:1px dashed #c6ccd1;color:#000;font:10pt Arial,sans-serif;overflow:hidden;break-after:page;break-inside:avoid}
  .birka .frame{position:absolute;left:11mm;top:11mm;width:98mm;height:53mm;border:0.3mm solid #000;box-sizing:border-box}
  .birka .row{position:absolute;left:12mm;height:5mm;line-height:5mm;white-space:nowrap;overflow:hidden}
  .birka .row b{font-weight:bold}
  .birka .size{position:absolute;top:56mm;left:11mm;width:98mm;text-align:center;font:bold 16pt Arial,sans-serif;line-height:7mm}
  .birka .size small{font-weight:normal;font-size:12pt;margin:0 3mm}
  .birka .edge{position:absolute;text-align:center;font-size:10pt;line-height:5mm;box-sizing:border-box}
  .birka .edge.L1{left:42mm;top:1mm;width:36mm;height:5mm;border-bottom:0.3mm solid #000}
  .birka .edge.L2{left:42mm;top:69mm;width:36mm;height:5mm;border-top:0.3mm solid #000}
  .birka .edge.W1{left:1mm;top:19.5mm;width:5mm;height:36mm;border-right:0.3mm solid #000;writing-mode:vertical-rl;transform:rotate(180deg)}
  .birka .edge.W2{left:114mm;top:19.5mm;width:5mm;height:36mm;border-left:0.3mm solid #000;writing-mode:vertical-rl}
  .birka .edge.thick{border-width:1.2mm}
  @media print{body{margin:0;padding:0;max-width:none}.label-heading{display:none}.birka{margin:0;border:0}.birka:last-child{break-after:auto}}
  </style><div class="label-heading"><h1>Бирки деталей · шаблон цеха 120 × 75</h1><p>Одна деталь на этикетку, принтер Xprinter XP-365B (лента 120 × 75 мм), масштаб 100%, без полей и колонтитулов браузера. ${count(data.length,DETAILS)}. Сформировано ${esc(stamp)}.</p><p>Кромка по сторонам бирки: цифра — толщина, тонкая линия до 0,8 мм, толстая — 2 мм. Длина детали — по горизонтали бирки, вдоль текстуры. Коды деталей совпадают с картами листов и деталировкой текущего проекта.</p></div>${data.map(d=>`<article class="birka">${edgeBox(d.edges.L1,'L1',d.edgeLens?.L1)}${edgeBox(d.edges.L2,'L2',d.edgeLens?.L2)}${edgeBox(d.edges.W1,'W1',d.edgeLens?.W1)}${edgeBox(d.edges.W2,'W2',d.edgeLens?.W2)}<div class="frame"></div>
<div class="row" style="top:12mm;width:96mm">№ заказа &nbsp;<b>${f(d.order)}</b></div>
<div class="row" style="top:17mm;width:96mm">${f(d.material)}</div>
<div class="row" style="top:23mm;width:96mm">${f(d.module)}</div>
<div class="row" style="top:28mm;width:96mm">Поз. &nbsp;<b>${f(d.code)}</b></div>
<div class="row" style="top:33mm;width:96mm">№ детали &nbsp;<b>${f(d.name)}</b></div>
<div class="row" style="top:39mm;width:96mm">Пазование: &nbsp;<b>${f(d.groove)}</b></div>
<div class="row" style="top:45mm;width:96mm">Паз: &nbsp;<b>${f(d.notches)}</b></div>
<div class="row" style="top:51mm;width:96mm">Торец: &nbsp;<b>${f(d.endHoles)}</b></div>
<div class="size">${d.length}<small>x</small>${d.width}</div></article>`).join('')}`);
}
function sectionAssemblyHTML(sectionParts:Part[],bottom:number){
  const mm=(n:number)=>Math.round(n*10)/10;
  const doors=sectionParts.filter(d=>d.role==='door'),fillers=sectionParts.filter(d=>d.id.includes(':filler:'));
  const rod=sectionParts.find(d=>d.role==='rod'),cap=sectionParts.find(d=>d.id.endsWith(':drawer-cap'));
  return `<p>Створки: ${doors.length?doors.map((d,i)=>`${i+1} — ${mm(d.length)} × ${mm(d.width)}, петли ${d.hinge==='top'?'сверху (подъёмный; механизм и присадка требуют подбора)':d.hinge==='right'?'справа':'слева'}`).join('; '):'нет'}. Стороны указаны при взгляде на корпус спереди.</p>${fillers.length?`<p>Фальши в зоне ящиков: ${fillers.map(d=>`${d.id.includes(':filler:right')?'справа':'слева'} — ${mm(d.length)} × ${mm(d.width)} × ${d.thickness}${/:filler:\w+:[ab]:/.test(d.id)?' (склейка 32 мм)':''}`).join('; ')}.</p>`:''}${cap?`<p>Полка над ящиками: низ от дна проёма ${mm(cap.position[1]-cap.size[1]/2-bottom)}, верх ${mm(cap.position[1]+cap.size[1]/2-bottom)}.</p>`:''}${rod?`<p>${rod.id.includes(':pantograph:')?'Штанга пантографа':'Штанга D25'}: ось от дна проёма ${mm(rod.position[1]-bottom)}, от низа корпуса ${mm(rod.position[1])}. Положение по глубине от задней плоскости корпуса: ${mm(rod.position[2])}. Для согласования, не координаты присадки.</p>`:''}`;
}
/** Одинаковые предупреждения печатаются один раз (аудит магазина: дубли в ведомости и комплекте). */
export function uniqueWarnings<T extends {message:string}>(list:T[]):T[]{const seen=new Set<string>();return list.filter(w=>!seen.has(w.message)&&!!seen.add(w.message));}
export function specificationHTML(p:Project){
  const warnings=uniqueWarnings(roomWarnings(p));
  const wall={back:'Задняя',front:'Передняя',left:'Левая',right:'Правая'};
  return htmlDocument('Ведомость проекта',`<style>@media print{.spec-module{break-inside:avoid}}</style><h1>Ведомость проекта</h1><p>${esc(p.offer?.customer||'Проект мебели')} · ${new Date().toLocaleString('ru-RU')}</p><p>Комплектация для согласования и проверки технологом. Все размеры в миллиметрах. Это не карта присадки и не управляющая программа.</p><h2>Замер</h2><p>Номер: ${esc(p.measurement?.number||"—")} · дата: ${esc(p.measurement?.date||"—")}</p><p class="note">${esc(p.measurement?.notes||"")}</p>${p.measurement?.niche?`<p>Ниша: минимальные ${nicheMinimum(p.measurement.niche,'width')} × ${nicheMinimum(p.measurement.niche,'height')} × ${nicheMinimum(p.measurement.niche,'depth')}, отклонение ${p.measurement.niche.deviation}. Предельные габариты мебели после вычетов СТП: ${nicheSize(p.measurement.niche,p.room.ceiling).width} × ${nicheSize(p.measurement.niche,p.room.ceiling).height} × ${nicheSize(p.measurement.niche,p.room.ceiling).depth}.</p>`:""}<h2>Помещение</h2><p>Ширина ${p.room.width} × глубина ${p.room.depth} × высота ${p.room.height}.</p><table><thead><tr><th>Проём</th><th>Стена</th><th>Отступ</th><th>Ш × В</th><th>От пола</th></tr></thead><tbody>${(p.room.openings||[]).map((o,i)=>`<tr><td>${i+1}. ${o.type==='window'?'Окно':'Дверь'}</td><td>${wall[o.wall]}</td><td>${o.offset}</td><td>${o.width} × ${o.height}</td><td>${o.sill}</td></tr>`).join('')}</tbody></table>${(p.room.obstacles||[]).length?`<h2>Объекты замера</h2><table><thead><tr><th>Объект</th><th>Ш × Г × В</th><th>Слева</th><th>Сзади</th><th>От пола</th></tr></thead><tbody>${p.room.obstacles!.map((o,i)=>`<tr><td>П${i+1}. ${esc(o.name)}</td><td>${o.width} × ${o.depth} × ${o.height}</td><td>${o.x}</td><td>${o.z}</td><td>${o.y}</td></tr>`).join('')}</tbody></table>`:''}${p.modules.map((a,i)=>{const m=a.module,moduleParts=parts(m);
  // двери купе и столешница — не корпус: без «корпус ЛДСП16», цоколя, задника и секций (аудит магазина 15.10)
  if(m.kupe||m.worktop){const d=describeModule(m);return `<section class="spec-module"><h2>${i+1}. ${esc(m.name)}</h2><p><b>${esc(d.size)}</b> · ${esc(d.kind)}</p><p>${[...d.materials,...d.filling].map(esc).join('; ')}.</p><p>Положение: X ${a.x}, Z ${a.z}, от пола ${a.y??0}; поворот ${a.rotation??0}°.</p></section>`;}
  return `<section class="spec-module"><h2>${i+1}. ${esc(m.name)}</h2><p><b>${m.width} × ${m.height} × ${m.depth}</b> · корпус ${esc(m.decor)} · ЛДСП16</p>${(()=>{const tall=moduleParts.filter(d=>d.role==='door'&&d.length>RULES.straightenerH&&d.width>RULES.straightenerW).length;const fillers=(['left','right'] as const).map(s=>{const w=m.wallFiller?.[s];return m.cornerFiller===s?(cornerStrip(m)?`угловая фальш-планка из фасада ${RULES.fillerStrip}×16 ${s==='left'?'слева':'справа'} вровень с фасадами, на эксцентриках, зазор 3 к фасаду`:`угловая планка 100×16 торцом ${s==='left'?'слева':'справа'}, выступ 40 вперёд`):w?`планка ${w.width}×16 торцом к стене ${s==='left'?'слева':'справа'}, зазор 5`:'';}).filter(Boolean);const alu=m.alu?`<p><b>Фасады в алюминиевой рамке</b>: ${esc(aluLabel(m.alu))}. Вставки (фасад минус припуск ${aluProfile(m.alu.profile)?.allowance??0} мм): ${moduleParts.filter(d=>d.role==='door').map(d=>{const s=aluInsertSize(m.alu!,d.width,d.length);return `${Math.round(s.w)}×${Math.round(s.h)}`;}).join(', ')}. Петли GTV с доводчиком; проверить открывание каждого фасада.</p>`:'';return alu+(fillers.length?`<p>Фальши по регламенту: ${fillers.join('; ')}.</p>`:'')+(tall?`<p><b>Рекомендуется выпрямитель фасада</b>: ${tall} фасад(ов) выше ${RULES.straightenerH} и шире ${RULES.straightenerW} мм.</p>`:'');})()}<p>Положение: X ${a.x}, Z ${a.z}, от пола ${a.y??0}; поворот ${a.rotation??0}°. X/Z задают начало корпуса в системе помещения, без выступа фасадов.</p><p>Отступ по габариту расстановки: от левой стены ${Math.round(bounds(a).x*10)/10}, от задней стены ${Math.round(bounds(a).z*10)/10}; до потолка ${Math.round((p.room.height-(a.y??0)-m.height)*10)/10}. Учтены поворот, задник и место под фасады.</p><p>Цоколь ${plinth(m)}; задняя стенка — ${m.backType==='none'?'нет, проверить жёсткость':m.backType==='board'?'ЛДСП16 вкладная в цвет корпуса':m.backType==='groove'?`ЛХДФ3 в паз, отступ ${m.grooveInset??16}, глубина ${m.grooveDepth??8}`:'ЛХДФ3 набивная'}. Распашные фасады: ${m.doors?esc(m.facadeDecor):'нет'}. Фасады ящиков: ${esc(m.drawerFacadeDecor??m.facadeDecor)}.</p>${boxes(m).map((b,j)=>{const section=m.sections[j],yy=drawerOffsets(section);return `<h3>Секция ${j+1} · внутренний проём ${Math.round(b.width*10)/10}</h3><p>Полки от дна проёма, по центру: ${section.shelves.length?section.shelves.map(v=>Math.round(v*(b.top-b.bottom))).join(', '):'нет'}. Штанга: ${section.rod?'есть':'нет'}. Пантограф: ${section.pantograph?'есть':'нет'}.</p>${sectionAssemblyHTML(moduleParts.filter(d=>d.sectionId===section.id),b.bottom)}${section.rod?`<p>Крепление штанги D25: фланцы — 2 шт.; саморезы 3,5×16 — ${RULES.rodMountScrews} шт. Комплект по фрагменту цеха; присадку проверяет технолог.</p>`:''}${section.drawers?`<p>Над группой ящиков — обязательная полка ЛДСП16. Дно ящиков ЛДСП16.</p><table><thead><tr><th>Ящик</th><th>Направляющая</th><th>Длина</th><th>Высота боковины</th><th>От дна проёма</th><th>Ручка</th></tr></thead><tbody>${Array.from({length:section.drawers},(_,k)=>{const c=drawerConfig(m,section,k);return `<tr><td>${k+1}</td><td>${esc(c.mesh?(meshById(c.mesh)?.label??'Элемент Лемана Про')+' · арт. '+(meshById(c.mesh)?.art??'?')+' (свои направляющие)':SLIDES[c.slide].label)}</td><td>${c.mesh?'—':c.length}</td><td>${drawerBoxHeight(m,section,c)}</td><td>${yy[k]}</td><td>${drawerGripOn(m,section,c)?"нет · зазор 30 мм":drawerHasHandle(c)?esc(handleById(m.handleId).label):c.mesh?"нет · сетка":"нет · Push"}</td></tr>`;}).join('')}</tbody></table>`:''}`;}).join('')}</section>`;}).join('')}${warnings.length?`<h2>Проверить перед согласованием</h2><ul>${warnings.map(w=>`<li>${esc(w.message)}</li>`).join('')}</ul><p>Замечания по расстановке требуют проверки на замере; это не автоматическое разрешение на производство.</p>`:''}<h2>Примечания</h2><p class="note">${esc(p.offer?.notes||'—')}</p><p>Технолог: ____________________ Дата: ____________</p><p>После изменения проекта заново сформировать ведомость, карты листов и бирки.</p>`);
}
