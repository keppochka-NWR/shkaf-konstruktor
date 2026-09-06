import {parts,drawerConfig,RULES} from './model';
import {nest,type Sheet} from './exports';
import type {Project} from './project';
import {catalog,type Tier} from './catalog';
export type PriceSettings={markup:number;overrides:Record<string,number>};
export type PriceLine={id:string;label:string;quantity:number;unit:string;unitPrice:number|null;source:string};

// ---- ЛДСП 16 мм, лист 2750×1830. Закупка цеха: СФЗ (Lamarty) / Победа.
// Явные цены по ходовым декорам — прайс Победы (совпадает с прайсом Lamarty «Спец» 01.01.2026).
const sheets:Record<string,number>={'Белый':2150,'Тэффи':2440,'Белоснежный':2440,'Бетон Пайн Белый':2540,'Дуб Вотан':2690,'Белый Кристалл':2900,'Графит':2900,'Клауд':2900,'Орегано':2960,'Дуб Галиано':2960,'Луно':2960,'Дуб Солсбери':3230,'Терра':3230,'Медея':3810,'Орех Бруно D*':3810};
// Остальные декоры — по ценовой группе прайса Lamarty 01.01.2026, 16 мм.
// Три колонки = группы тиснений: базовые (L,R,A,F,K,O,T,P,V) / D,N,G,US / N*,D*,U.
// В каталоге тиснение видно только у декоров с суффиксом «D*»; для остальных берётся базовая колонка.
const tierPrice:Record<Tier,[number,number,number]>={'КЛАССИКА':[2690,2980,3330],'ПРЕМИУМ':[2900,3440,3780],'ЛЮКС':[3160,3840,4060]};
export const HDF_SHEET=1060; // ХДФ Kronospan 2800×2070×3, Древиз.
export type DecorPrice={price:number|null;source:string};
export function decorPrice(name:string):DecorPrice{
  if(sheets[name]!==undefined)return {price:sheets[name],source:'База закупки СФЗ / Победа'};
  const c=catalog.find(c=>c.n===name);
  if(!c)return {price:null,source:'Декор вне каталога Lamarty; цену уточнить'};
  const column=/\s(N\*|D\*|U)$/.test(name)?2:/\s(D|N|G|US)$/.test(name)?1:0;
  return {price:tierPrice[c.tier][column],source:'Прайс Lamarty 01.01.2026 · '+c.tier.toLowerCase()+(column?' · тиснение '+name.split(' ').pop():'')};
}

// ---- Фурнитура. Закупочные цены цеха с указанием источника; оценки помечены явно.
// Шариковые GTV Versalite PLUS+ H45 с доводчиком: счета ФАМ 2026. 300 и 400 — интерполяция между соседними длинами.
const ball:Record<number,{price:number;source:string}>={
  250:{price:445,source:'Счета ФАМ, 2026'},300:{price:500,source:'Интерполяция прайса ФАМ (250 — 445, 350 — 550); подтвердить счётом'},
  350:{price:550,source:'Счета ФАМ, 2026'},400:{price:600,source:'Интерполяция прайса ФАМ (350 — 550, 450 — 650); подтвердить счётом'},
  450:{price:650,source:'Счета ФАМ, 2026'},500:{price:695,source:'Счета ФАМ, 2026'}};
// Скрытые направляющие. Цех закупает не GTV 0FPO, а DTC (push-to-open) и Unihopper (с доводчиком) —
// правило закупки из справочника цен. Геометрия ящика в модели остаётся по карте GTV 0FPO.
const hidden:Record<number,{price:number;source:string}>={
  300:{price:1040,source:'Счёт ФАМ: DTC F10D300H push-to-open, 300 мм'},
  350:{price:1100,source:'Оценка по классу DTC/Unihopper (1000–1250); подтвердить счётом'},
  400:{price:1150,source:'Оценка по классу DTC/Unihopper (1000–1250); подтвердить счётом'},
  450:{price:1200,source:'Оценка по классу DTC/Unihopper (1000–1250); подтвердить счётом'},
  500:{price:1250,source:'Оценка по классу DTC/Unihopper (1000–1250); подтвердить счётом'}};
export const HINGE={label:'Петля GTV SOLID PRO с доводчиком',price:157,source:'Счёт Мега-Трейд 6219, 2026 · стандарт цеха при ручках'};
export const HARDWARE_KIT={label:'Крепёж и мелочёвка корпуса',price:300,source:'Норматив старого калькулятора: конфирматы, полкодержатели, подпятники, заглушки — 300 ₽ на корпус; подтвердить по факту закупки'};

export function hingeCount(height:number,width:number){return (height<=900?2:height<=1600?3:height<=2000?4:5)+(width>450?1:0);}
export function estimate(p:Project,plan:Sheet[]=nest(p)){
  const lines:PriceLine[]=[];const settings=p.calculation||{markup:2.2,overrides:{}};
  function add(id:string,label:string,quantity:number,unit:string,unitPrice:number|null,source:string){if(!quantity)return;const existing=lines.find(l=>l.id===id);if(existing){existing.quantity+=quantity;return;}lines.push({id,label,quantity,unit,unitPrice:settings.overrides[id]??unitPrice,source:settings.overrides[id]===undefined?source:'Цена в этом проекте'});}
  for(const sheet of plan){
    if(sheet.material==='hdf'){add('sheet:hdf','ЛХДФ 3 мм',1,'лист',HDF_SHEET,'Древиз: ХДФ Kronospan 2800×2070');continue;}
    const d=decorPrice(sheet.decor);add('sheet:'+sheet.decor,'Lamarty 16 мм · '+sheet.decor,1,'лист',d.price,d.source);
  }
  let edge2=0,edge04=0,small=0;
  for(const a of p.modules){
    add('kit',HARDWARE_KIT.label,1,'корпус',HARDWARE_KIT.price,HARDWARE_KIT.source);
    for(const d of parts(a.module)){
      if(d.material==='board'){
        d.edge.forEach((edge,k)=>{const length=(k<2?d.width:d.length)/1000;if(edge===2)edge2+=length;else if(edge===0.4)edge04+=length;});
        if(Math.min(d.length,d.width)<70)small++;
      }
      if(d.role==='door')add('hinge',HINGE.label,hingeCount(d.length,d.width),'шт',HINGE.price,HINGE.source);
      if(d.role==='handle')add('handle128','Ручка 128 мм · UZ 819',1,'шт',100,'Счета ФАМ, 2026');
      if(d.role==='flange')add('flange25','Фланец D25',1,'шт',40,'Старый калькулятор: 40 ₽; закупку подтвердить');
      if(d.role==='rod'&&!d.id.includes('pantograph'))add('rod25','Штанга D25',d.length/1000,'м',300,'Старый калькулятор: 300 ₽/м; закупку подтвердить');
    }
    for(const s of a.module.sections){
      if(s.rod)add('screw35x16-rod','Саморез 3,5×16 · крепление штанги D25',RULES.rodMountScrews,'шт',null,'Фрагмент цеха: 6 на штангу; закупочную цену уточнить');
      if(s.pantograph)add('pantograph','Пантограф GTV',1,'компл',null,'Закупочная цена не найдена; 9000 ₽ в прайсе — цена продажи');
      for(let j=0;j<s.drawers;j++){
        const c=drawerConfig(a.module,s,j);
        const q=c.slide==='ball'?ball[c.length]:hidden[c.length];
        add('slide:'+c.slide+':'+c.length,(c.slide==='ball'?'Шариковые GTV Versalite с доводчиком':'Скрытые направляющие (закупка DTC / Unihopper)')+' · '+c.length+' мм',1,'компл',q?.price??null,q?.source??'Длины нет в закупке цеха; цену уточнить');
      }
    }
  }
  add('edge2','Кромка 2 мм',edge2,'м',45,'База цеха');add('edge04','Кромка 0,4 мм',edge04,'м',15,'База цеха');add('small','Обработка деталей уже 70 мм',small,'шт',300,'Правило цеха');add('work','Работа цеха',plan.length,'лист',2500,'База расчёта шкафа');
  for(const l of lines)l.quantity=Math.round(l.quantity*1000)/1000;
  const missing=lines.filter(l=>l.unitPrice===null),knownCost=Math.round(lines.reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0));
  return {lines,missing,knownCost,markup:settings.markup,retail:missing.length?null:Math.round(knownCost*settings.markup/100)*100};
}


export function estimateCSV(p:Project,result=estimate(p)){
 const rows:(string|number)[][]=[['Проект',p.offer?.customer||'Проект мебели','','','','',''],['Позиция','Количество','Единица','Цена, ₽','Сумма, ₽','Источник','Статус']];
 for(const l of result.lines)rows.push([l.label,l.quantity,l.unit,l.unitPrice??'',l.unitPrice===null?'':Math.round(l.quantity*l.unitPrice),l.source,l.unitPrice===null?'Уточнить цену':'Учтено']);
 rows.push(['Учтённая себестоимость','','','',result.knownCost,'',''],['Коэффициент',result.markup,'','','','',''],['Расчётная цена','','','',result.retail??'','',result.retail===null?'Смета не завершена':'Предварительно'],['Ограничения','Доставка, монтаж и неописанный крепёж не включены','','','','','']);
 const cell=(v:string|number)=>{let text=typeof v==='number'?String(v).replace('.',','):v;if(typeof v==='string'&&/^\s*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return '﻿'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
