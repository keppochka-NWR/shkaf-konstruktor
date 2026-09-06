import {parts,drawerConfig,RULES,legCount,fastenerCounts} from './model';
import {nest,type Sheet} from './exports';
import type {Project} from './project';
import {catalog,type Tier} from './catalog';
import {handleById} from './handles';
import {meshById} from './mesh';
import {aluProfile,aluColor,aluInsert,ALU_EXTRAS} from './alu';
/** model: 'markup' — себестоимость × коэффициент; 'sheet' — модель цеха: листы ЛДСП × цена листа (фурнитура и работа включены) + розничные позиции. */
export type PriceSettings={markup:number;overrides:Record<string,number>;model?:'markup'|'sheet';sheetPrice?:number};
export const SHEET_PRICE_DEFAULT=23000; // экономика цеха (модель 08.2026): цена клиенту за лист ЛДСП с фурнитурой и работой
export type PriceLine={id:string;label:string;quantity:number;unit:string;unitPrice:number|null;source:string;retail?:boolean};

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
export const LEG={price:127.4,source:'МДМ, INTEGRATO TECH G опора регулируемая с шипами; 4 на корпус, 6 при ширине от 900'};
export const LEG_M6={price:30,source:'Ножка мебельная M6×18 + гайка BP01 (заказы цеха); оценка, счёта нет'};
export const HINGE_FREE={price:80,source:'ФАМ: петля GTV ZP-COCA клиповая без пружины'};
export const PUSH_LATCH={price:90,source:'Толкатель push-to-open (старый калькулятор 90 ₽); подтвердить счётом'};
export const FASTENERS={
  confirmat:{price:2.45,source:'МДМ: конфирмат 5,0×50 чёрный цинк'},
  cap:{price:0.7,source:'ФАМ: заглушка самоклеящаяся D14, лист 35 ₽ ≈ 50 шт'},
  shelfHolder:{price:6,source:'Оценка: Boyard p521 (СТП цеха); цены в счетах нет — подтвердить'},
  eccentric:{price:10,source:'Оценка: эксцентрик 15 + шток (СТП: скрытый крепёж); цены в счетах нет — подтвердить'},
};
export const HARDWARE_KIT={label:'Мелочёвка корпуса (шурупы задника, стяжки антресолей, подпятники)',price:150,source:'Норматив; конфирматы, заглушки, полкодержатели и опоры считаются отдельно'};

export function hingeCount(height:number,width:number){return (height<=900?2:height<=1600?3:height<=2000?4:5)+(width>450?1:0);}
export function estimate(p:Project,plan:Sheet[]=nest(p)){
  const lines:PriceLine[]=[];const settings=p.calculation||{markup:2.2,overrides:{}};
  // retail=true: розничная позиция прайса цеха, добавляется к цене ПОСЛЕ коэффициента и не входит в себестоимость.
  function add(id:string,label:string,quantity:number,unit:string,unitPrice:number|null,source:string,retail=false){if(!quantity)return;const existing=lines.find(l=>l.id===id);if(existing){existing.quantity+=quantity;return;}lines.push({id,label,quantity,unit,unitPrice:settings.overrides[id]??unitPrice,source:settings.overrides[id]===undefined?source:'Цена в этом проекте',...(retail?{retail:true}:{})});}
  for(const sheet of plan){
    if(sheet.material==='hdf'){add('sheet:hdf','ЛХДФ 3 мм',1,'лист',HDF_SHEET,'Древиз: ХДФ Kronospan 2800×2070');continue;}
    const d=decorPrice(sheet.decor);add('sheet:'+sheet.decor,'Lamarty 16 мм · '+sheet.decor,1,'лист',d.price,d.source);
  }
  let edge2=0,edge04=0,small=0;
  for(const a of p.modules){
    const fc=fastenerCounts(a.module);
    add('confirmat','Конфирмат 5×50 чёрный цинк',fc.confirmats,'шт',FASTENERS.confirmat.price,FASTENERS.confirmat.source);
    add('confirmat-cap','Заглушка самоклеящаяся под конфирмат',fc.confirmats,'шт',FASTENERS.cap.price,FASTENERS.cap.source);
    if(fc.shelfHolders)add('shelf-holder','Полкодержатель Boyard p521',fc.shelfHolders,'шт',FASTENERS.shelfHolder.price,FASTENERS.shelfHolder.source);
    if(fc.eccentrics)add('eccentric','Эксцентриковая стяжка D15 (бочонок + шток)',fc.eccentrics,'компл',FASTENERS.eccentric.price,FASTENERS.eccentric.source);
    add('kit',HARDWARE_KIT.label,1,'корпус',HARDWARE_KIT.price,HARDWARE_KIT.source);
    const legs=legCount(a.module,a.y??0);if(legs){const low=a.module.feet&&a.module.feet.height<=30;add(low?'legs-m6':'legs',low?'Ножка мебельная M6×18 с гайкой':'Опора регулируемая INTEGRATO TECH G с шипами',legs,'шт',low?LEG_M6.price:LEG.price,low?LEG_M6.source:LEG.source);}
    for(const d of parts(a.module)){
      if(d.material==='board'){
        d.edge.forEach((edge,k)=>{const length=(k<2?d.width:d.length)/1000;if(edge===2)edge2+=length;else if(edge===0.4)edge04+=length;});
        if(Math.min(d.length,d.width)<70)small++;
      }
      if(d.role==='door'){
        const push=a.module.doorOpen==='push',inset=a.module.doorMount==='inset',n=hingeCount(d.length,d.width);
        // СТП: с ручками — GTV с доводчиком; push-to-open — петля без пружины (накладная SOLID / вкладная COCA) + толкатель.
        if(push)add(inset?'hinge-push-inset':'hinge-push','Петля GTV без пружины '+(inset?'вкладная COCA':'накладная'),n,'шт',HINGE_FREE.price,HINGE_FREE.source);
        else add(inset?'hinge-inset':'hinge',inset?'Петля GTV с доводчиком вкладная':HINGE.label,n,'шт',HINGE.price,HINGE.source);
        if(push)add('push-latch','Толкатель push-to-open',1,'шт',PUSH_LATCH.price,PUSH_LATCH.source);
      }
      if(d.role==='door'&&d.material==='alu'&&a.module.alu){
        // Бланк цеха «Расчет алюм.фасад рам»: профиль по периметру, вставка по площади фасада, уплотнитель, уголки, отверстия.
        const al=a.module.alu,prof=aluProfile(al.profile),col=aluColor(al.profile,al.color),ins=aluInsert(al.insert);
        const perimeter=2*(d.length+d.width)/1000,area=d.length*d.width/1e6;
        add('alu-profile:'+al.profile+':'+al.color,'Профиль '+(prof?.label??al.profile)+' · '+(col?.label??al.color),perimeter,'м',col?.perM??null,col?.source??'Цена профиля не найдена');
        add('alu-insert:'+al.insert,'Вставка · '+(ins?.label??al.insert),area,'м²',ins?.perM2??null,ins?.source??'Цена вставки не найдена');
        if(ins?.mirror)add('alu-film','Армирующая плёнка на зеркало',area,'м²',ALU_EXTRAS.mirrorFilmPerM2,'АТБ, прайс 01.01.2026');
        add('alu-seal','Уплотнитель вставки',perimeter,'м',ALU_EXTRAS.sealPerM,ALU_EXTRAS.source);
        add('alu-corners','Соединительная фурнитура рамки',1,'фасад',ALU_EXTRAS.cornersPerFacade,ALU_EXTRAS.source);
        add('alu-hinge-hole'+(prof?.narrow?'-narrow':''),'Отверстие под петлю'+(prof?.narrow?' в узком профиле':''),hingeCount(d.length,d.width),'шт',prof?.narrow?ALU_EXTRAS.hingeHoleNarrow:ALU_EXTRAS.hingeHole,ALU_EXTRAS.source);
        add('alu-handle-hole','Отверстие под ручку (стекло 8 мм под втулку)',1,'шт',ALU_EXTRAS.handleHole,ALU_EXTRAS.source);
      }
      if(d.role==='handle'){const h=handleById(a.module.handleId);add('handle:'+h.id,'Ручка '+h.label,1,'шт',h.price,h.source);}
      if(d.role==='flange')add('flange25','Фланец D25',1,'шт',40,'Старый калькулятор: 40 ₽; закупку подтвердить');
      if(d.role==='rod'&&!d.id.includes('pantograph')){if(a.module.rodType==='oval')add('rod-oval','Труба-штанга овальная 15×30',d.length/1000,'м',300,'Оценка по трубе D25; хлыст 3000, закупку подтвердить');else add('rod25','Штанга D25',d.length/1000,'м',300,'Старый калькулятор: 300 ₽/м; закупку подтвердить');}
      if(d.id==='top'&&d.material==='glass'&&a.module.topGlass){
        const ins=aluInsert(a.module.topGlass),area=d.size[0]*d.size[2]/1e6,perimeter=2*(d.size[0]+d.size[2])/1000;
        add('glass-top:'+a.module.topGlass,'Крыша · '+(ins?.label??'стекло'),area,'м²',ins?.perM2??null,ins?.source??'Цена стекла не найдена');
        add('glass-top-temper','Закалка стекла 4 мм',area,'м²',RULES.glassTopTemper,'АТБ, прайс 01.01.2026');
        add('glass-top-polish','Полировка кромки стекла 4 мм',perimeter,'пог.м',RULES.glassTopPolishPerM,'Прайс МВМ стеклообработка 13.01.2026');
      }
      if(d.role==='light')add('light-stand','Подсветка врезная в стойках',d.length/1000,'пог.м',RULES.lightRetailPerM,'Прайс цеха (розница): '+RULES.lightRetailPerM+' ₽/пог.м, поверх коэффициента',true);
    }
    for(const s of a.module.sections){
      if(s.rod)add('screw35x16-rod','Саморез 3,5×16 · крепление штанги',RULES.rodMountScrews,'шт',0.3,'ФАМ: шуруп 4×16 — 0,28 ₽ (ориентир); 6 на штангу по фрагменту цеха');
      if(s.pantograph)add('pantograph','Пантограф GTV',1,'компл',null,'Закупочная цена не найдена; 9000 ₽ в прайсе — цена продажи');
      for(let j=0;j<s.drawers;j++){
        const c=drawerConfig(a.module,s,j);
        if(c.mesh){const item=meshById(c.mesh);add('mesh:'+c.mesh,item?item.label+' · Лемана Про':'Элемент Лемана Про',1,'шт',item?.price??null,item?'Лемана Про, розница 01.09.2026, арт. '+item.art:'Не найден в каталоге');continue;}
        const q=c.slide==='ball'?ball[c.length]:hidden[c.length];
        add('slide:'+c.slide+':'+c.length,(c.slide==='ball'?'Шариковые GTV Versalite с доводчиком':'Скрытые направляющие (закупка DTC / Unihopper)')+' · '+c.length+' мм',1,'компл',q?.price??null,q?.source??'Длины нет в закупке цеха; цену уточнить');
      }
    }
  }
  add('edge2','Кромка 2 мм',edge2,'м',45,'База цеха');add('edge04','Кромка 0,4 мм',edge04,'м',15,'База цеха');add('small','Обработка деталей уже 70 мм',small,'шт',300,'Правило цеха');add('work','Работа цеха',plan.length,'лист',2500,'База расчёта шкафа');
  for(const l of lines)l.quantity=Math.round(l.quantity*1000)/1000;
  const missing=lines.filter(l=>l.unitPrice===null),knownCost=Math.round(lines.filter(l=>!l.retail).reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0));
  const retailExtras=Math.round(lines.filter(l=>l.retail).reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0));
  const ldspSheets=plan.filter(s=>s.material!=='hdf').length,sheetPrice=settings.sheetPrice??SHEET_PRICE_DEFAULT,model=settings.model??'markup';
  const byMarkup=missing.length?null:Math.round(knownCost*settings.markup/100)*100+retailExtras;
  // Модель цеха: цена за лист ЛДСП включает фурнитуру, кромку и работу; сверху — розница (подсветка) и позиции Лемана по выбору клиента.
  const lemana=Math.round(lines.filter(l=>!l.retail&&(l.id.startsWith('mesh:')||l.id.startsWith('handle:lm'))).reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0));
  const bySheet=ldspSheets*sheetPrice+retailExtras+lemana;
  return {lines,missing,knownCost,retailExtras,markup:settings.markup,model,sheetPrice,ldspSheets,byMarkup,bySheet,perSheet:byMarkup!==null&&ldspSheets?Math.round(byMarkup/ldspSheets):null,retail:model==='sheet'?bySheet:byMarkup};
}


export function estimateCSV(p:Project,result=estimate(p)){
 const rows:(string|number)[][]=[['Проект',p.offer?.customer||'Проект мебели','','','','',''],['Позиция','Количество','Единица','Цена, ₽','Сумма, ₽','Источник','Статус']];
 for(const l of result.lines)rows.push([l.label,l.quantity,l.unit,l.unitPrice??'',l.unitPrice===null?'':Math.round(l.quantity*l.unitPrice),l.source,l.unitPrice===null?'Уточнить цену':'Учтено']);
 rows.push(['Учтённая себестоимость','','','',result.knownCost,'',''],['Коэффициент',result.markup,'','','','',''],...(result.retailExtras?[['Розничные позиции поверх коэффициента','','','',result.retailExtras,'','']]:[]),['Листов ЛДСП',result.ldspSheets,'лист',result.sheetPrice,result.bySheet,'Модель цеха: цена за лист с фурнитурой',result.model==='sheet'?'Выбрана':'Для сравнения'],['Цена по коэффициенту','','','',result.byMarkup??'','',result.model==='markup'?'Выбрана':'Для сравнения'],['Расчётная цена','','','',result.retail??'','',result.retail===null?'Смета не завершена':'Предварительно'],['Ограничения','Доставка, монтаж и неописанный крепёж не включены','','','','','']);
 const cell=(v:string|number)=>{let text=typeof v==='number'?String(v).replace('.',','):v;if(typeof v==='string'&&/^\s*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return '﻿'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
