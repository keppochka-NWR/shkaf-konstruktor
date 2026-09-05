import {nicheSize} from './measurement';
import {SLIDES,drawerHasHandle} from './hardware';
import { parts, RULES, boxes, drawerConfig, drawerOffsets, plinth, type Part } from "./model";
import { projectErrors, type Project } from "./project";
import {packRectangles} from './packing';
export type Detail = Part & { moduleName: string; code: string };
export type Placement = {
  detail: Detail;
  x: number;
  y: number;
  w: number;
  h: number;
};
export type Sheet = {
  decor: string;
  material: string;
  thickness: number;
  width: number;
  height: number;
  items: Placement[];
};
export function details(p: Project): Detail[] {
  return p.modules.flatMap((m, i) =>
    parts(m.module)
      .filter((p) => p.material !== "metal")
      .map((d, j) => ({
        ...d,
        moduleName: m.module.name,
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
/** Compare six fixed-grain nestings against the previous guaranteed baseline. */
export function nest(p:Project,gap=10):Sheet[]{
  const baseline=nestGuillotine(p,gap),all=details(p),groups=new Map<string,Detail[]>();
  for(const d of all){const key=JSON.stringify([d.material,d.material==='hdf'?'ЛХДФ':d.decor,d.thickness]);groups.set(key,[...(groups.get(key)||[]),d]);}
  const result:Sheet[]=[];
  for(const ds of groups.values()){
    const first=ds[0],decor=first.material==='hdf'?'ЛХДФ':first.decor,width=first.material==='hdf'?RULES.hdfH:RULES.sheetH,height=first.material==='hdf'?RULES.hdfW:RULES.sheetW;
    let best=baseline.filter(s=>s.material===first.material&&s.decor===decor&&s.thickness===first.thickness);
    const byId=new Map(ds.map(d=>[d.code,d]));
    const footprint=(s:Sheet[])=>Math.max(...s.at(-1)!.items.map(p=>p.y+p.h));
    for(const order of ['area','height','width'] as const)for(const fit of ['short','area'] as const){
      const packed=packRectangles(ds.map(d=>({id:d.code,w:d.width,h:d.length})),width-20,height-20,gap,order,fit);
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
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function detailCSV(p: Project) {
  const rows = [
    [
      "Код",
      "Модуль",
      "Деталь",
      "Материал",
      "Длина",
      "Ширина",
      "Толщина",
      "Кромка 1",
      "Кромка 2",
      "Кромка 3",
      "Кромка 4",
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
export function sheetSVG(s: Sheet) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.width} ${s.height}"><rect width="${s.width}" height="${s.height}" fill="#f1ede3" stroke="#90a7ac" stroke-width="5"/>${s.items.map((p) => `<g><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#d7e9e8" stroke="#4a8e98" stroke-width="3"/><text x="${p.x + p.w / 2}" y="${p.y + p.h / 2}" text-anchor="middle" font-size="65" font-family="Arial" fill="#234754">${esc(p.detail.code)}</text></g>`).join("")}</svg>`;
}
const style =
  "body{font:14px Arial;color:#23404c;max-width:1000px;margin:40px auto;padding:20px}h1{font-size:32px}h2{margin-top:32px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #d5dfe3}small{color:#637c85}svg{width:300px;max-height:480px}section{break-inside:avoid;margin:30px 0}.sum{font-size:24px;font-weight:bold}.note{white-space:pre-wrap}button{padding:12px 22px;background:#187f91;color:white;border:0;border-radius:6px}@media print{button{display:none}body{margin:0}thead{display:table-header}}";
function htmlDocument(title: string, body: string) {
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title><style>${style}</style><body><button onclick="window.print()">Печать / Сохранить PDF</button>${body}</body></html>`;
}
export function nestingHTML(p: Project) {
  return htmlDocument(
    "Карты листов",
    `<h1>Карты листов · для технолога</h1><p>ЛДСП Lamarty 2750 × 1830 мм. Поле обрезки 10 мм; промежуток 10 мм. Направление текстуры вдоль длинной стороны листа.</p><p>Предварительная укладка габаритов деталей. Припуски, инструмент, присадка и режимы станка требуют проверки; карты не являются управляющей программой.</p>${nest(
      p,
    )
      .map(
        (s, i) =>
          `<section><h2>Лист ${i + 1} · ${esc(s.decor)} · ${s.thickness} мм</h2>${sheetSVG(s)}<p>${s.height} × ${s.width} мм · ${s.items.length} деталей</p><table><tr><th>Код</th><th>Модуль / деталь</th><th>Размер</th></tr>${s.items.map((a) => `<tr><td>${a.detail.code}</td><td>${esc(a.detail.moduleName)} / ${esc(a.detail.name)}</td><td>${a.h} × ${a.w}</td></tr>`).join("")}</table></section>`,
      )
      .join("")}`,
  );
}
export function quoteHTML(
  p: Project,
  customer: string,
  price: string,
  notes: string,
  image?: string,
) {
  return htmlDocument(
    "Коммерческое предложение",
    `<h1>Коммерческое предложение</h1><p>${esc(customer || "Проект мебели")} · ${new Date().toLocaleDateString("ru-RU")}</p>${image ? `<img src="${image}" style="width:100%;max-height:420px;object-fit:contain" alt="Вид проекта"/>` : ""}<table><thead><tr><th>Модуль</th><th>Ш × В × Г, мм</th><th>Материалы</th><th>Наполнение</th></tr></thead><tbody>${p.modules
      .map((a) => {
        const m = a.module;
        return `<tr><td>${esc(m.name)}</td><td>${m.width} × ${m.height} × ${m.depth}</td><td>${esc(m.decor)}${m.doors ? " / " + esc(m.facadeDecor) : ""}</td><td>Полок: ${m.sections.reduce((n, s) => n + s.shelves.length, 0)}; ящиков: ${m.sections.reduce((n, s) => n + s.drawers, 0)}; штанг: ${m.sections.filter((s) => s.rod).length}</td></tr>`;
      })
      .join(
        "",
      )}</tbody></table><p class="sum">${price.trim() && Number.isFinite(Number(price)) && Number(price) >= 0 ? "Стоимость: " + Number(price).toLocaleString("ru-RU") + " ₽" : "Стоимость: после согласования"}</p><p class="note">${esc(notes)}</p><small>Эскиз и комплектация для согласования. Стоимость введена менеджером. Производственные размеры уточняются после проверки технологом.</small>`,
  );
}

export function labelDetails(p:Project){
  const sheets=nest(p),location=new Map(sheets.flatMap((s,i)=>s.items.map(a=>[a.detail.code,i+1] as const)));
  return details(p).map(d=>({...d,sheet:location.get(d.code)!}));
}
export function labelsHTML(p:Project){
  const labels=labelDetails(p),stamp=new Date().toLocaleString('ru-RU');
  return htmlDocument('Бирки деталей для проверки',`<style>@page{size:A4;margin:10mm}.labels{display:grid;grid-template-columns:90mm 90mm;gap:3mm}.part-label{box-sizing:border-box;width:90mm;height:50mm;border:1px solid #8e9a9f;padding:3mm;break-inside:avoid;color:#172c36;font-size:11px;overflow:hidden}.label-top{display:flex;justify-content:space-between;align-items:center}.label-code{font-size:28px;font-weight:bold}.label-name{font-weight:bold;font-size:14px;margin:2mm 0;line-height:1.15;max-height:9mm;overflow:hidden}.label-material{margin:1mm 0}.label-size{font-size:20px;font-weight:bold}.label-note{font-size:9px;color:#5c6870;margin-top:1mm}@media print{body{padding:0;max-width:none}.label-heading{display:none}}</style><div class="label-heading"><h1>Бирки деталей · для проверки</h1><p>90 × 50 мм, печать 100%. ${labels.length} деталей. Сформировано ${esc(stamp)}.</p><p>Коды соответствуют картам текущего проекта. После изменения конструкции сформируйте карты и бирки заново. Размеры габаритные; припуски, кромление и присадку проверяет технолог.</p></div><div class="labels">${labels.map(d=>`<article class="part-label"><div class="label-top"><span class="label-code">${esc(d.code)}</span><span>Лист ${d.sheet} · ↑ текстура</span></div><div class="label-name">${esc(d.name)}</div><div>${esc(d.moduleName)}</div><div class="label-material">${esc(d.material==='hdf'?'ЛХДФ':d.decor)} · ${d.thickness} мм</div><div class="label-size">${d.length} × ${d.width} мм</div><div class="label-note">ПРОВЕРКА · ${esc(stamp)} · длина вдоль текстуры</div></article>`).join('')}</div>`);
}

export function specificationHTML(p:Project){
  const wall={back:'Задняя',front:'Передняя',left:'Левая',right:'Правая'};
  return htmlDocument('Ведомость проекта',`<h1>Ведомость проекта</h1><p>${esc(p.offer?.customer||'Проект мебели')} · ${new Date().toLocaleString('ru-RU')}</p><p>Комплектация для согласования и проверки технологом. Все размеры в миллиметрах. Это не карта присадки и не управляющая программа.</p><h2>Замер</h2><p>Номер: ${esc(p.measurement?.number||"—")} · дата: ${esc(p.measurement?.date||"—")}</p><p class="note">${esc(p.measurement?.notes||"")}</p>${p.measurement?.niche?`<p>Ниша: минимальные ${p.measurement.niche.width} × ${p.measurement.niche.height} × ${p.measurement.niche.depth}, отклонение ${p.measurement.niche.deviation}. Предельные габариты мебели после вычетов СТП: ${nicheSize(p.measurement.niche).width} × ${nicheSize(p.measurement.niche).height} × ${nicheSize(p.measurement.niche).depth}.</p>`:""}<h2>Помещение</h2><p>Ширина ${p.room.width} × глубина ${p.room.depth} × высота ${p.room.height}.</p><table><thead><tr><th>Проём</th><th>Стена</th><th>Отступ</th><th>Ш × В</th><th>От пола</th></tr></thead><tbody>${(p.room.openings||[]).map((o,i)=>`<tr><td>${i+1}. ${o.type==='window'?'Окно':'Дверь'}</td><td>${wall[o.wall]}</td><td>${o.offset}</td><td>${o.width} × ${o.height}</td><td>${o.sill}</td></tr>`).join('')}</tbody></table>${p.modules.map((a,i)=>{const m=a.module;return `<section><h2>${i+1}. ${esc(m.name)}</h2><p><b>${m.width} × ${m.height} × ${m.depth}</b> · корпус ${esc(m.decor)} · ЛДСП16</p><p>Положение: X ${a.x}, Z ${a.z}, от пола ${a.y??0}; поворот ${a.rotation??0}°. X/Z задают начало корпуса в системе помещения, без выступа фасадов.</p><p>Цоколь ${plinth(m)}; задняя стенка — ${m.backType==='none'?'нет, проверить жёсткость':m.backType==='board'?'ЛДСП16 вкладная в цвет корпуса':m.backType==='groove'?`ЛХДФ3 в паз, отступ ${m.grooveInset??16}, глубина ${m.grooveDepth??8}`:'ЛХДФ3 набивная'}. Распашные фасады: ${m.doors?esc(m.facadeDecor):'нет'}. Фасады ящиков: ${esc(m.drawerFacadeDecor??m.facadeDecor)}.</p>${boxes(m).map((b,j)=>{const section=m.sections[j],yy=drawerOffsets(section);return `<h3>Секция ${j+1} · внутренний проём ${Math.round(b.width*10)/10}</h3><p>Полки от дна проёма, по центру: ${section.shelves.length?section.shelves.map(v=>Math.round(v*(b.top-b.bottom))).join(', '):'нет'}. Штанга: ${section.rod?'есть':'нет'}. Пантограф: ${section.pantograph?'есть':'нет'}.</p>${section.drawers?`<p>Над группой ящиков — обязательная полка ЛДСП16. Дно ящиков ЛДСП16.</p><table><thead><tr><th>Ящик</th><th>Направляющая</th><th>Длина</th><th>Высота боковины</th><th>От дна проёма</th><th>Ручка</th></tr></thead><tbody>${Array.from({length:section.drawers},(_,k)=>{const c=drawerConfig(m,section,k);return `<tr><td>${k+1}</td><td>${esc(SLIDES[c.slide].label)}</td><td>${c.length}</td><td>${c.height}</td><td>${yy[k]}</td><td>${drawerHasHandle(c)?"128 мм":"нет · Push"}</td></tr>`;}).join('')}</tbody></table>`:''}`;}).join('')}</section>`;}).join('')}<h2>Примечания</h2><p class="note">${esc(p.offer?.notes||'—')}</p><p>Технолог: ____________________ Дата: ____________</p><p>После изменения проекта заново сформировать ведомость, карты листов и бирки.</p>`);
}
