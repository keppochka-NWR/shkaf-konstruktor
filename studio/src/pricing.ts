import {facadeHandleId} from './model';
import {parts,drawerConfig,RULES,legCount,fastenerCounts,pulloutLength} from './model';
import {worktopLabel} from './kitchen';
import {edgeLength} from './edges';
import {nest,nestPlan,cuttingEngine,type Sheet} from './exports';
import {isBazisModule,type Project} from './project';
import type {BazisItem} from './model';
import {catalog,type Tier} from './catalog';
import {handleById} from './handles';
import {meshById} from './mesh';
import {aluProfile,aluColor,aluInsert,ALU_EXTRAS} from './alu';
import {hingeCount,HINGE_BRANDS,slideSystem,type DrawerConfig} from './hardware';
import {kupeLines} from './kupe';
import {rawKitchen,rawOwnMaterial,rawDims,rawWorktop,rawIsWorktop,rawIsRoom,rawIsNonBoard,rawOversize} from './rawModule';
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
/** Цена комплекта направляющих по системе и длине. Опора — известные цены; остальное — шаг по длине и множители класса, помечено «оценка». */
export function slidePrice(c:Pick<DrawerConfig,'slide'|'operation'|'brand'|'length'>):{price:number|null;source:string;label:string}{
  const sys=slideSystem(c),L=c.length;
  const label=sys.label+' · '+L+' мм';
  if(sys.slide==='ball'){
    const base=ball[L];if(!base)return {price:null,source:'Длины нет в закупке цеха; цену уточнить',label};
    if(sys.motion==='soft-close')return {price:base.price,source:base.source,label};
    if(sys.motion==='simple')return {price:Math.round(base.price*0.55/10)*10,source:'Оценка: шариковые без доводчика ≈ 55 % от Versalite с доводчиком; подтвердить счётом ФАМ',label};
    return {price:Math.round(base.price*1.15/10)*10,source:'Оценка: шариковые push-to-open ≈ +15 % к Versalite с доводчиком; подтвердить счётом ФАМ',label};
  }
  // Вне диапазона закупки/оценки длина остаётся без цены: смету не дополняем выдуманной позицией.
  const range=sys.brand==='premial'?[300,550]:[300,500];
  if(L<range[0]||L>range[1])return {price:null,source:'Длины нет в закупке цеха для '+sys.label+'; цену уточнить',label};
  const steps=(L-300)/50;
  if(sys.brand==='dtc'){
    if(sys.motion==='push'&&L===300)return {price:1040,source:'Счёт ФАМ: DTC F10D300H push-to-open, 300 мм',label};
    return {price:Math.round((1040+steps*50)*(sys.motion==='soft-close'?1.05:1)/10)*10,source:'Оценка от DTC F10D300H (1040 ₽ за 300 мм), +50 ₽ на каждые 50 мм; подтвердить счётом ФАМ',label};
  }
  if(sys.brand==='premial'){
    const soft=1729+(L-400)/50*60;
    return {price:Math.round((sys.motion==='soft-close'?soft:soft*0.95)/10)*10,source:'Оценка: Premial Morendo с доводчиком 400 мм — 1729 ₽ (розница allpremial.ru, 10.2026), ±60 ₽ на 50 мм'+(sys.motion==='push'?', push ≈ −5 %':'')+'; подтвердить закупкой',label};
  }
  const uni=hidden[L]?.price??(1100+steps*50);
  return {price:Math.round((sys.motion==='soft-close'?uni:uni*0.95)/10)*10,source:'Оценка по классу Unihopper (1000–1250 ₽); цены в счетах нет, подтвердить',label};
}
export const HINGE={label:HINGE_BRANDS.gtv.soft.label,price:HINGE_BRANDS.gtv.soft.price,source:HINGE_BRANDS.gtv.soft.source};
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

export type LineGroup='material'|'hardware';
/** Материал: плита, кромка, обработка, работа цеха, рамочные и стеклянные элементы. Всё остальное — фурнитура. */
export function lineGroup(id:string):LineGroup{return /^(sheet:|mat:|edge|small$|work$|alu-|glass-|kupe-(fill|profile|track|work|film))/.test(id)?'material':'hardware';}
/** Выдвижной тремпель GTV: решение Макса 07.10.2026 — 500 ₽ за штуку, пока нет счёта поставщика. */
export const PULLOUT_PRICE=500;
export type HardwareKind='hinges'|'slides'|'handles'|'legs'|'fasteners'|'rods'|'kupe'|'other';
export const HARDWARE_KINDS:Record<HardwareKind,string>={hinges:'Петли и открывание',slides:'Направляющие и сетки',handles:'Ручки',legs:'Опоры',fasteners:'Крепёж',rods:'Штанги',kupe:'Двери-купе: доводчики и фурнитура',other:'Прочее'};
export function hardwareKind(id:string):HardwareKind{
  // фурнитура Базиса: bazis:<категория>:<название> — по категории Базиса, иначе по наименованию (ручка-рейлинг бывает в «ящик-системе»)
  if(id.startsWith('bazis:')){const c=id.split(':')[1],n=id.toLowerCase();
    if(/ручк/.test(n))return 'handles';
    if(c==='газлифт'||c==='подъёмник')return 'hinges';
    if(c==='направляющая'||c==='ящик-система'||c==='сушка'||c==='карго')return 'slides';
    if(c==='рафикс'||c==='заглушка')return 'fasteners';
    if(/направл|ящик|царг|indigo|firmax|старт|start|atira/.test(n))return 'slides';
    if(/газ|шток|подъ/.test(n))return 'hinges';
    if(c==='прочее'||/рафикс|шуруп|саморез|гвозд|винт|заглушк/.test(n))return 'fasteners';
    return 'other';}
  if(id.startsWith('firmax'))return 'slides';
  if(/^(hinge|push-latch|lift-mechanism|kitchen-lift)/.test(id))return 'hinges';
  if(/^(slide:|mesh:|pantograph|pullout|axis-pro)/.test(id))return 'slides';
  if(id.startsWith('handle:'))return 'handles';
  if(id.startsWith('legs'))return 'legs';
  if(/^(confirmat|eccentric|shelf-holder|rafix|kit$|screw)/.test(id))return 'fasteners';
  if(/^(rod|flange)/.test(id))return 'rods';
  if(id.startsWith('kupe-'))return 'kupe';
  return 'other';
}
export {hingeCount};
/** Количество студии по названиям Базиса: одно название — всё ему; сумма совпала — как в Базисе; иначе — самому частому в Базисе. */
export function byNames(total:number,names:Record<string,number>):Record<string,number>{
  const es=Object.entries(names);if(!es.length||!total)return {};
  if(es.length===1)return {[es[0][0]]:total};
  if(es.reduce((s,[,n])=>s+n,0)===total)return {...names};
  return {[es.sort((a,b)=>b[1]-a[1])[0][0]]:total};
}
export function estimate(p:Project,plan:Sheet[]=nest(p)){
  const lines:PriceLine[]=[];const settings=p.calculation||{markup:2.2,overrides:{}};
  // retail=true: розничная позиция прайса цеха, добавляется к цене ПОСЛЕ коэффициента и не входит в себестоимость.
  function add(id:string,label:string,quantity:number,unit:string,unitPrice:number|null,source:string,retail=false){if(!quantity)return;const existing=lines.find(l=>l.id===id);if(existing){existing.quantity+=quantity;return;}lines.push({id,label,quantity,unit,unitPrice:settings.overrides[id]??unitPrice,source:settings.overrides[id]===undefined?source:'Цена в этом проекте',...(retail?{retail:true}:{})});}
  for(const sheet of plan){
    if(sheet.material==='hdf'){add('sheet:hdf','ЛХДФ 3 мм',1,'лист',HDF_SHEET,'Древиз: ХДФ Kronospan 2800×2070');continue;}
    // толщина листа — из раскроя (у кухонь Базиса бывает 19 мм); строка 16 мм как раньше
    const d=decorPrice(sheet.decor),t=sheet.thickness??16,t16=Math.abs(t-16)<.01;
    // декор вне каталога Lamarty (МДФ IDM из Базиса и т. п.) — «Плита», а не «Lamarty»
    const lam=sheets[sheet.decor]!==undefined||catalog.some(c=>c.n===sheet.decor);
    add('sheet:'+sheet.decor+(t16?'':':'+t),(lam?'Lamarty ':'Плита ')+(t16?16:t)+' мм · '+sheet.decor,1,'лист',d.price,t16?d.source:d.source+'; цена как у 16 мм — уточнить для '+t+' мм');
  }
  // Гильотина (флаг cuttingEngine): деталь длиннее рабочего поля листа в карты не попала — смета не завершена,
  // пока технолог не решит (сращивание / отдельная плита). Старый движок на такой детали падает целиком.
  const unplaced=cuttingEngine(p)==='guillotine'?nestPlan(p).unplaced:[];
  for(const u of unplaced)add('unplaced:'+u.detail.code,`Не помещается в лист: ${u.detail.code} ${u.detail.name} ${u.detail.length} × ${u.detail.width}`,1,'шт',null,u.reason);
  let edge2=0,edge04=0,edge05=0,edge1=0,edge08=0,small=0;
  // Кухня из Базиса (правило Макса): в смету — только то, что есть в Базисе, с его названиями.
  const BZ='Как в проекте Базиса; закупочная цена не найдена — уточнить';
  const bazisProject=p.modules.some(a=>isBazisModule(p,a));
  // Gola ряда Базиса (профили с длинами) — та же Gola, что студия рисует в параметрических модулях: считаем один раз, по Базису.
  const rowGola=p.modules.some(b=>b.module.raw?.row&&b.module.raw.items?.some(i=>/gola|[LC]-\s*образн/i.test(i.name)));
  function addItems(items?:BazisItem[]){for(const it of items??[]){const prof=it.len!==undefined;
    // Firmax в Базисе — по направляющей на сторону: в смету парами, одной строкой с параметрическими модулями
    if(it.category==='направляющая'&&/firmax/i.test(it.name)){add('firmax:'+it.name,it.name+' — пара (короб ЛДСП — в раскрое)',it.n/2,'пара',null,BZ);continue;}
    add('bazis:'+it.category+':'+it.name+(prof?':m':''),it.name,prof?it.len!/1000:it.n,prof?'м':'шт',null,BZ);}}
  const hingeType=(name:string)=>name.replace(/^петля\s*/i,'').trim()||'накладная';
  /** Петли по названиям Базиса: накладная — стандарт цеха (GTV с доводчиком), другие типы — тот же бренд с типом из Базиса. */
  function addHinges(names:Record<string,number>,bk:string){const hb=HINGE_BRANDS[bk as keyof typeof HINGE_BRANDS]??HINGE_BRANDS.gtv,suffix=bk==='gtv'?'':':'+bk;
    for(const [name,n] of Object.entries(names)){const t=hingeType(name);
      if(/^накладная$/i.test(t))add('hinge'+suffix,hb.soft.label,n,'шт',hb.soft.price,hb.soft.source);
      else if(/^вкладная$/i.test(t))add('hinge-inset'+suffix,hb.soft.label+' · вкладная',n,'шт',hb.soft.price,hb.soft.source);
      else add('hinge-bazis:'+t+suffix,hb.soft.label+' · '+t+' (тип как в Базисе)',n,'шт',hb.soft.price,hb.soft.source+'; тип петли — по Базису, цену типа подтвердить');}}
  function addShelfHolders(names:Record<string,number>){for(const [name,n] of Object.entries(names))add('shelf-holder:'+name,/^полкодержатель/i.test(name)?name:'Полкодержатель '+name,n,'шт',FASTENERS.shelfHolder.price,'Артикул — как в Базисе; цена — оценка как у Boyard p521, подтвердить');}
  function addLegs(names:Record<string,number>){for(const [name,n] of Object.entries(names)){if(/^опора кухонная регулируемая/i.test(name))add('kitchen-leg','Опора кухонная регулируемая H100-120, чёрная',n,'шт',null,'Как в проектах Базиса цеха; закупочная цена не найдена — уточнить');else add('kitchen-leg:'+name,name,n,'шт',null,BZ);}}
  for(const a of p.modules){
    // Двери-купе: строки по формуле калькулятора купе, розничные; корпусных деталей и крепежа у объекта нет.
    if(a.module.kupe){for(const l of kupeLines(a.module))add(l.id,l.label,l.quantity,l.unit,l.unitPrice,l.source,true);continue;}
    // Столешница (kitchen.ts): за погонный метр по материалу и толщине, вырезы под мойку и варку — отдельно. Цен поставщика пока нет.
    if(a.module.worktop){const w=a.module.worktop;add('worktop:'+w.material+':'+w.thickness,'Столешница '+worktopLabel(w)+' '+w.thickness+' мм',a.module.width/1000,'пог.м',null,'Закупочная цена столешницы не найдена — нужен прайс поставщика');for(const c of w.cutouts)add('worktop-cut:'+c.kind,c.kind==='sink'?'Вырез под мойку':'Вырез под варочную панель',1,'шт',null,'Цена работы не найдена');continue;}
    // Сырой модуль (импорт Базиса): фурнитура — по счётчикам Базиса (raw.counts), а не по правилам студии (без фантомных петель
    // на фасадах ящиков и планках); фасадный материал — фасады поставщика (м²); столешница — пог.м; кромка — по длинам Базиса.
    if(a.module.raw){
      // kr — сырой модуль кухни Базиса (импорт: source «bazis-kitchen», ряд или счётчики Базиса; rawKitchen).
      // Правило Макса 09.10.2026: в кухню из Базиса студия ничего не добавляет — ни «мелочёвки корпуса», ни заглушек под конфирматы,
      // ни вырезов в столешнице по названиям модулей (в Базисе их нет); петли, полкодержатели и опоры — по названиям Базиса;
      // прочая фурнитура Базиса — строками «как в Базисе». Сырой шкаф Базиса (корпус, правила шкафов) — как было.
      const r=a.module.raw,c=r.counts??{},bk=a.module.hingeBrand??'gtv',src='Как в проекте Базиса',kr=rawKitchen(r);
      if(!kr)add('kit',HARDWARE_KIT.label,1,'корпус',HARDWARE_KIT.price,HARDWARE_KIT.source);
      // крепёж корпуса под именем Базиса, если это не «Конфирмат 7х50» (k33/k34: «Евровинт 6х50», n3-wall)
      if(r.confirmatName)add('confirmat:'+r.confirmatName,r.confirmatName+' (по проекту Базиса)',c.confirmats??0,'шт',FASTENERS.confirmat.price,'Цена как у 5×50 — уточнить по счёту');
      else add('confirmat-7x50','Конфирмат 7×50, Zn (как в проектах Базиса)',c.confirmats??0,'шт',FASTENERS.confirmat.price,'Цена как у 5×50 — уточнить по счёту');
      if(!kr)add('confirmat-cap','Заглушка самоклеящаяся под конфирмат',c.confirmats??0,'шт',FASTENERS.cap.price,FASTENERS.cap.source);
      add('eccentric','Эксцентриковая стяжка D15 (бочонок + шток)',c.eccentrics??0,'компл',FASTENERS.eccentric.price,FASTENERS.eccentric.source);
      if(r.names?.shelfHolders)addShelfHolders(r.names.shelfHolders);else add('shelf-holder','Полкодержатель Boyard p521',c.shelfHolders??0,'шт',FASTENERS.shelfHolder.price,FASTENERS.shelfHolder.source);
      add('dowel','Шкант 8×30',c.dowels??0,'шт',null,src+'; закупочная цена шканта не найдена');
      if(r.names?.legs)addLegs(r.names.legs);else add('kitchen-leg','Опора кухонная регулируемая H100-120, чёрная',c.legs??0,'шт',null,'Как в проектах Базиса цеха; закупочная цена не найдена — уточнить');
      add('kitchen-clip','Клипса для ПВХ цоколя, чёрная',c.clips??0,'шт',null,'Как в проектах Базиса цеха; закупочная цена не найдена — уточнить');
      add('kitchen-hanger','Навес мебельный регулируемый',c.hangers??0,'шт',null,'Закупочная цена навеса не найдена');
      if(r.names?.hinges)addHinges(r.names.hinges,bk);else{const hb=HINGE_BRANDS[bk];add('hinge'+(bk==='gtv'?'':':'+bk),hb.soft.label,c.hinges??0,'шт',hb.soft.price,hb.soft.source);}
      add('lift-mechanism','Подъёмный механизм — требуется подбор по массе фасада',c.lifts??0,'компл',null,src+' (ФриФолд/подъёмник); цена не найдена');
      add('axis-pro:raw','Ящик Axis PRO (по проекту Базиса) — комплект фурнитуры',c.drawers??0,'компл',null,'Как в проектах Базиса цеха; закупочная цена не найдена — уточнить');
      // прочая фурнитура Базиса (bazisItems): рафиксы, заглушки навесов, Firmax/Indigo/СТАРТ, газлифты PD-G, сушки, профили, штанга — как в спецификации Базиса
      if(kr)addItems(r.items);
      // Вырезов под мойку/варку в столешницах Базиса нет (в эталоне у столешниц только завалы и пазы) — по правилу Макса
      // 09.10.2026 студия их не добавляет (раньше домысливала по именам модулей «Мойка»/«Варка»).
      for(const p of r.panels){
        // размеры — по осям детали: у повёрнутой — obb (наклонная полка) или t/lw (угловая дверь под 45°), иначе габарит:
        // наклонная полка 16 мм — не «столешница 158 мм», угловая дверь — не «столешница 261 мм»
        const s=rawDims(p),wt=rawWorktop(p,r,s);
        // стекло Базиса (полки ВМКП) — как стеклянная полка студии, м²
        if(p.kind==='glass'){add('glass-shelf','Стеклянная полка · обработка и держатели',s[0]*s[1]/1e6,'м²',null,'Толщина/обработка и цена требуют согласования; дополнительно к листовой модели');continue;}
        // больше листа (как в Базисе, в т. ч. ХДФ задника): в раскрой не попала — строка без цены, как «не помещается в лист» у гильотины
        if(p.kind!=='mirror'&&!p.fm&&!rawIsRoom(p)&&!wt&&!rawIsNonBoard(p)&&!(kr&&rawOwnMaterial(p))&&!(r.row&&p.wall)&&rawOversize(p))add('unplaced-raw:'+a.id+':'+r.panels.indexOf(p),`Больше листа — сращивание или отдельная плита: ${p.name} ${s.map(Math.round).join(' × ')}`,1,'шт',null,'Как в проекте Базиса; раскрой такой детали — решение технолога');
        // ХДФ, зеркало и элементы помещения (стена, пол, бетон) — не в смету деталей
        if(p.kind==='hdf'||p.kind==='mirror'||rawIsRoom(p))continue;
        // стеновая панель «Ряда» кухни (материал Базиса «Стеновая панель», фартук) — изделие поставщика, м² по деталям Базиса:
        // не лист Lamarty 6 мм и не «столешница 26 мм». Только ряд кухни (r.row) — сырые шкафы не меняются.
        if(r.row&&p.wall){add('wallpanel:raw:'+Math.round(s[2]),'Стеновая панель по проекту Базиса '+Math.round(s[2])+' мм',Math.round(s[0]*s[1]/1e2)/1e4,'м²',null,'Цена стеновой панели по прайсу поставщика — уточнить');continue;}
        // столешница — только названная так в Базисе (имя/материал; rawWorktop), ЛДСП 25/32 мм идёт в раскрой своей толщиной
        if(wt){add('worktop:raw:'+Math.round(s[2]),'Столешница по проекту Базиса '+Math.round(s[2])+' мм',s[0]/1000,'пог.м',null,'Закупочная цена столешницы не найдена — нужен прайс поставщика');continue;}
        // цоколь ряда кухни из фасадного материала (импорт Базиса: «Цоколь · …») — тот же материал поставщика, но своей строкой:
        // это цоколь, не фасад. Только ряд кухни (r.row) — сырые шкафы не меняются.
        if(r.row&&p.fm&&/^\s*цокол/i.test(p.name)){add('plinth-external','Цоколь — фасадный материал (по проекту Базиса), без раскроя ЛДСП',Math.round(s[0]*s[1]/1e2)/1e4,'м²',null,'Цена фасадного материала по прайсу поставщика — уточнить');continue;}
        if(p.fm){add('facade-external','Фасады — фасадный материал (МДФ/плёнка/эмаль), без раскроя ЛДСП',Math.round(s[0]*s[1]/1e2)/1e4,'м²',null,'Цена фасадов по прайсу поставщика — уточнить');continue;}
        const edges=()=>{for(const [t,len] of p.edges??[]){const L=len/1000;if(t===2)edge2+=L;else if(t===1)edge1+=L;else if(t===0.8)edge08+=L;else if(t===0.5)edge05+=L;else edge04+=L;}};
        // не плитный материал Базиса — не лист ЛДСП: строка м² по материалу Базиса (кромка Базиса на нём — как в Базисе, обработки узких
        // деталей нет). Кухня Базиса — любой «прочий» материал без фасадного (пластик, хром, стеновая панель вне «Ряда»; n3-additions),
        // сырой шкаф — пластик, хром, стеновая панель, металл (n3-wardrobes2). Деталь «Ряда» нулевой толщины — без строки (только кромка).
        // Плита МДФ — в раскрое своей плитой («Плита 18 мм · <декор Базиса>», не Lamarty).
        if((kr&&rawOwnMaterial(p))||rawIsNonBoard(p)){if(s[2]>=0.5){const name=(p.mat??'').trim()||'Материал Базиса '+Math.round(s[2])+' мм';
          add('mat:'+name,name+' (как в проекте Базиса), без раскроя ЛДСП',Math.round(s[0]*s[1]/1e2)/1e4,'м²',null,'Не ЛДСП: площадь деталей Базиса, цена материала по прайсу поставщика — уточнить');}edges();continue;}
        edges();
        if(s[1]<70)small++;
      }
      continue;
    }
    const fc=fastenerCounts(a.module);
    // модуль из Базиса: без заглушек под конфирматы и «мелочёвки корпуса» (их нет в Базисе), артикулы — по названиям Базиса
    const bz=isBazisModule(p,a),nm=bz?a.module.bazisNames:undefined;
    // кухня по Базису — конфирмат 7×50 (под него присадка D8+D5×35); шкафы — 5×50 по прайсу цеха
    // кухня (правила Базиса): только то, что есть в спецификации Базиса — без заглушек под конфирмат и норматива «Мелочёвка корпуса»
    const kitchen=!!a.module.kitchen;
    // крепёж с другим именем в проекте Базиса (k33/k34: «Евровинт 6х50», n3-wall) — своей строкой, цена как у 5×50 до счёта;
    // евровинт шаблонов без имени из проекта (n3-sink) — «Евровинт 6×50»
    if(a.module.kitchen?.confirmatName)add('confirmat:'+a.module.kitchen.confirmatName,a.module.kitchen.confirmatName+' (по проекту Базиса)',fc.confirmats,'шт',FASTENERS.confirmat.price,'Цена как у 5×50 — уточнить по счёту');
    else if(a.module.kitchen?.screw==='euro-6x50')add('confirmat-euro-6x50','Евровинт 6×50 (как в проекте Базиса)',fc.confirmats,'шт',FASTENERS.confirmat.price,'Цена как у конфирмата 5×50 — уточнить по счёту');
    else if(kitchen)add('confirmat-7x50','Конфирмат 7×50, Zn (как в проектах Базиса)',fc.confirmats,'шт',FASTENERS.confirmat.price,'Цена как у 5×50 — уточнить по счёту');
    else add('confirmat','Конфирмат 5×50 чёрный цинк',fc.confirmats,'шт',FASTENERS.confirmat.price,FASTENERS.confirmat.source);
    // кухня (правила Базиса — для кухонь m.kitchen) и модуль из Базиса: заглушек под конфирмат и «Мелочёвки корпуса» в проектах
    // Базиса нет; шкафы — как раньше
    if(!kitchen&&!bz)add('confirmat-cap','Заглушка самоклеящаяся под конфирмат',fc.confirmats,'шт',FASTENERS.cap.price,FASTENERS.cap.source);
    if(fc.shelfHolders){if(nm?.shelfHolders)addShelfHolders(byNames(fc.shelfHolders,nm.shelfHolders));else add('shelf-holder','Полкодержатель Boyard p521',fc.shelfHolders,'шт',FASTENERS.shelfHolder.price,FASTENERS.shelfHolder.source);}
    if(fc.eccentrics)add('eccentric','Эксцентриковая стяжка D15 (бочонок + шток)',fc.eccentrics,'компл',FASTENERS.eccentric.price,FASTENERS.eccentric.source);
    if(!kitchen&&!bz)add('kit',HARDWARE_KIT.label,1,'корпус',HARDWARE_KIT.price,HARDWARE_KIT.source);
    if(bz)addItems(a.module.bazisItems);
    // рафиксы жёстких полок кухни Базиса (n3-tall) — той же строкой фурнитуры Базиса, что у сырых модулей (bazis:рафикс:…, n3-kitchens2)
    if(fc.rafix)add('bazis:рафикс:Полкодержатель стяжка РАФИКС','Полкодержатель стяжка РАФИКС',fc.rafix,'шт',null,BZ);
    if(a.module.kitchen){
      // Кухня: опоры и клипсы — по фактическим деталям сцены (kitchenLegs), как в спецификациях Базиса цеха.
      const ps=parts(a.module),legs=ps.filter(p=>p.id.startsWith('leg:')).length,clips=ps.filter(p=>p.id.startsWith('kitchen-clip:')).length;
      if(nm?.legs&&legs)addLegs(byNames(legs,nm.legs));else add('kitchen-leg','Опора кухонная регулируемая H100-120, чёрная',legs,'шт',null,'Как в проектах Базиса цеха; закупочная цена не найдена — уточнить');
      add('kitchen-clip','Клипса для ПВХ цоколя, чёрная',clips,'шт',null,'Как в проектах Базиса цеха; закупочная цена не найдена — уточнить');
      // шканты 8×30 — по деталям сцены (в Базисе они в спецификации); только кухня, смета шкафов не меняется
      add('dowel','Шкант 8×30',ps.filter(p=>p.id.startsWith('dowel:')).length,'шт',null,'Как в проектах Базиса; закупочная цена шканта не найдена');
      // Firmax из Базиса: пары по направляющим сцены (у ящика без своих точек Базиса направляющих нет), артикул — по Базису («L - 500»
      // — длина направляющей, не короба)
      const fx=(a.module.kdrawers??[]).filter(k=>k.system==='firmax-ldsp'),fxNames=Object.keys(nm?.slides??{});
      if(bz&&fx.length&&fxNames.length){const runs=ps.filter(q=>/^Направляющая скрытого монтажа Firmax/.test(q.name)).length,pairs=Math.ceil(runs/2);
        if(fxNames.length===1)add('firmax:'+fxNames[0],fxNames[0]+' — пара (короб ЛДСП — в раскрое)',pairs,'пара',null,BZ);
        else for(const [name,n] of Object.entries(byNames(runs,nm!.slides!)))add('firmax:'+name,name+' — пара (короб ЛДСП — в раскрое)',Math.ceil(n/2),'пара',null,BZ);}
      // ящики Axis PRO: комплект на ящик (2 направляющие, 2 царги, держатели фасада и задней стенки, 2 заглушки); дно и стенка — в раскрое ЛДСП
      for(const k of a.module.kdrawers??[])if(k.system==='modern-slide')add(`modern-slide:500`,`Направляющие MODERN SLIDE 500 мм с доводчиком — пара (короб ЛДСП — в раскрое)`,1,'пара',null,'Как в проектах Базиса цеха (только 500); закупочная цена не найдена — уточнить');else if(k.system==='indigo')add(`indigo:${k.hc}:${k.len}:${k.color??'grey'}`,`Ящик Indigo H=${k.hc}, ${k.len} мм${k.color==='white'?', белый':', орион серый'} — комплект (направляющие, царги; дно и стенка — в раскрое)`,1,'компл',null,'Как в проектах Базиса цеха; закупочная цена не найдена — уточнить');else if(k.system==='start-sc'){add(`start-sc:${k.sb}:${k.len}`,`Ящик Boyard СТАРТ ${k.sb}, ${k.len} мм${k.rail?' с рейлингом':''} — комплект (направляющие Soft-Closing, боковины, держатели, крепления фасада, заглушки; дно и стенка — в раскрое)`,1,'компл',null,'Как в проектах Базиса цеха; закупочная цена не найдена — уточнить');if(k.rail&&(k.railYs?.length??1)>1)add(`start-sc:rail:${k.len}`,`Рейлинг Boyard СТАРТ ${k.len} мм — дополнительный, пара (сверх комплекта; в проекте Базиса по ${k.railYs!.length} с каждой стороны)`,k.railYs!.length-1,'пара',null,'Как в проектах Базиса цеха; закупочная цена не найдена — уточнить');}else if(k.system==='versalite-h45')add(`versalite-h45:${k.len}`,`Направляющие шариковые Versalite Light H45 ${k.len} мм — пара (короб ЛДСП — в раскрое; шурупы 3,5×16 и конфирматы — по проекту)`,1,'пара',null,'Как в проектах Базиса цеха; закупочная цена не найдена — уточнить');else if(k.system==='firmax-ldsp'){if(!(bz&&fxNames.length))add(`firmax-ldsp:${k.box.len}`,`Направляющие скрытого монтажа Firmax ${k.box.len} мм — пара (короб ЛДСП — в раскрое)`,1,'пара',null,'Как в проектах Базиса цеха; закупочная цена не найдена — уточнить');}else add(`axis-pro:${k.h}:${k.len}:${k.color??'white'}`,`Ящик Axis PRO H-${k.h}, ${k.len} мм${k.color==='anthracite'?', антрацит':', белый'} — комплект фурнитуры`,1,'компл',null,'Как в проектах Базиса цеха; закупочная цена не найдена — уточнить');
    }
    let bzHinges=0;
    const legs=a.module.kitchen?0:legCount(a.module,a.y??0);if(legs){const low=a.module.feet&&a.module.feet.height<=30;add(low?'legs-m6':'legs',low?'Ножка мебельная M6×18 с гайкой':'Опора регулируемая INTEGRATO TECH G с шипами',legs,'шт',low?LEG_M6.price:LEG.price,low?LEG_M6.source:LEG.source);}
    const allParts=parts(a.module);
    // газлифт подъёмного фасада кухни (Базис: PD-G-N02 — шток, газблок, фиксаторы на фасад и боковину; комплект на боковину), без цены
    const lifts=a.module.kitchenLift?allParts.filter(p=>p.id.startsWith('lift:')&&p.id.endsWith(':block')).length:0;
    if(lifts)add('kitchen-lift:'+a.module.kitchenLift!.system,'Газлифт PD-G-N02 — комплект на боковину (шток, газблок, 2 фиксатора, саморезы)',lifts,'компл',null,'Как в проектах Базиса цеха; закупочная цена не найдена — уточнить');
    for(const d of allParts){
      if(d.material==='board'){
        // кромка фасадов из фасадного материала — у поставщика фасадов, не кромка цеха
        if(!d.external)d.edge.forEach((edge,k)=>{const length=edgeLength(d,k)/1000;if(edge===2)edge2+=length;else if(edge===0.4)edge04+=length;else if(edge===0.5)edge05+=length;else if(edge===1)edge1+=length;else if(edge===0.8)edge08+=length;});
        if(Math.min(d.length,d.width)<70)small++;
      }
      if(d.id.startsWith('gola:')&&!(bz&&rowGola))add(`gola-${d.id.split(':')[1]}`,`Профиль Gola ${d.id.split(':')[1]==='L'?'L (верхний)':'C (средний)'}, алюминий`,d.length/1000,'м',null,'Профиль-ручка Gola по Базису; цена не найдена — уточнить');
      if((d.role==='door'||d.id.endsWith(':facade'))&&d.external&&a.module.facadeMaterial==='external')add('facade-external','Фасады — фасадный материал (МДФ/плёнка/эмаль), без раскроя ЛДСП',Math.round(d.size[0]*d.size[1]/1e2)/1e4,'м²',null,'Цена фасадов по прайсу поставщика — уточнить');
      // кухня из Базиса без петель (kitchen.hinges:false, n3-base) или фасад без петель (фасад холодильника на двери техники,
      // sections.hingeless, n3-tall) — петель и толкателя в смете нет, как в Базисе
      if(d.role==='door'&&d.id!=='slope-filler'&&a.module.kitchen?.hinges!==false&&!d.hingeless){
        // Число петель — фактические петли сцены (как в 3D и присадке); без них (подъёмный, скос) — по правилу.
        const placedHinges=allParts.filter(p=>p.id.startsWith(d.id.replace(':door:',':hingeplate:')+':')).length;
        const push=a.module.doorOpen==='push',inset=a.module.doorMount==='inset',n=placedHinges||hingeCount(d.length,d.width);
        // СТП: с ручками — петля с доводчиком; push-to-open — петля без пружины + толкатель. Бренд — выбор клиента (GTV по умолчанию).
        const bk=a.module.hingeBrand??'gtv',hb=HINGE_BRANDS[bk],suffix=bk==='gtv'?'':':'+bk;
        // кухня: подъёмник — только выбранный газлифт Базиса (kitchenLift); без него у Базиса на откидном фасаде одни петли
        if(d.hinge==='top'&&!a.module.kitchenLift&&!kitchen)add('lift-mechanism','Подъёмный механизм — требуется подбор по массе фасада',1,'компл',null,'Модель и техкарта механизма не заданы');
        // подъёмный фасад кухни: петли по верху поставлены по Базису — считаем их как обычные; без петель (шкаф) — только механизм
        if(d.hinge==='top'&&!placedHinges){/* петли не расставлены */}
        else if(nm?.hinges&&!push)bzHinges+=n; // тип петли — по Базису (после цикла)
        else if(push)add((inset?'hinge-push-inset':'hinge-push')+suffix,(bk==='gtv'?'Петля GTV без пружины '+(inset?'вкладная COCA':'накладная'):hb.free.label+(inset?' · вкладная':' · накладная')),n,'шт',bk==='gtv'?HINGE_FREE.price:hb.free.price,bk==='gtv'?HINGE_FREE.source:hb.free.source);
        else add((inset?'hinge-inset':'hinge')+suffix,inset?hb.soft.label+' · вкладная':hb.soft.label,n,'шт',hb.soft.price,hb.soft.source);
        if(push&&d.hinge!=='top')add('push-latch','Толкатель push-to-open',1,'шт',PUSH_LATCH.price,PUSH_LATCH.source);
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
        if(d.hinge!=='top')add('alu-hinge-hole'+(prof?.narrow?'-narrow':''),'Отверстие под петлю'+(prof?.narrow?' в узком профиле':''),hingeCount(d.length,d.width),'шт',prof?.narrow?ALU_EXTRAS.hingeHoleNarrow:ALU_EXTRAS.hingeHole,ALU_EXTRAS.source);
        add('alu-handle-hole','Отверстие под ручку (стекло 8 мм под втулку)',1,'шт',ALU_EXTRAS.handleHole,ALU_EXTRAS.source);
      }
      if(d.role==='handle'){const h=handleById(facadeHandleId(a.module,d.id));add('handle:'+h.id,'Ручка '+h.label,1,'шт',h.price,h.source);}
      if(d.role==='flange')add('flange25','Фланец D25',1,'шт',40,'Старый калькулятор: 40 ₽; закупку подтвердить');
      // навес кухни — с заглушкой ABS, как в Базисе (34 кухни: у параметрических модулей навесов 34, заглушек 34)
      if(d.id.startsWith('kitchen-hanger:')){add('kitchen-hanger','Навес мебельный регулируемый',1,'шт',null,'Закупочная цена навеса не найдена');add('kitchen-hanger-cap','Заглушка для мебельного навеса ABS',1,'шт',null,'Как в проектах Базиса: заглушка на каждый навес; цена не найдена');}
      if(d.material==='glass'&&d.role==='shelf')add('glass-shelf','Стеклянная полка · обработка и держатели',d.size[0]*d.size[2]/1e6,'м²',null,'Толщина/обработка и цена требуют согласования; дополнительно к листовой модели');
      if(d.role==='rod'&&!d.id.includes('pantograph')){if(a.module.rodType==='oval')add('rod-oval','Труба-штанга овальная 15×30',d.length/1000,'м',300,'Оценка по трубе D25; хлыст 3000, закупку подтвердить');else add('rod25','Штанга D25',d.length/1000,'м',300,'Старый калькулятор: 300 ₽/м; закупку подтвердить');}
      if(d.id==='top'&&d.material==='glass'&&a.module.topGlass){
        const ins=aluInsert(a.module.topGlass),area=d.size[0]*d.size[2]/1e6,perimeter=2*(d.size[0]+d.size[2])/1000;
        add('glass-top:'+a.module.topGlass,'Крыша · '+(ins?.label??'стекло'),area,'м²',ins?.perM2??null,ins?.source??'Цена стекла не найдена');
        add('glass-top-temper','Закалка стекла 4 мм',area,'м²',RULES.glassTopTemper,'АТБ, прайс 01.01.2026');
        add('glass-top-polish','Полировка кромки стекла 4 мм',perimeter,'пог.м',RULES.glassTopPolishPerM,'Прайс МВМ стеклообработка 13.01.2026');
      }
      // паз Базиса (groove:*) — обработка детали, не подсветка: в 3D тёмной полосой, в смете его нет (кухня: самой подсветки в проекте
      // Базиса нет — строку не добавляем). Ленты подсветки в спецификациях Базиса нет.
      // Настоящая подсветка (опция «Подсветка в стойках», в т.ч. в кухне студии) — считается как раньше.
      if(d.role==='light'&&!d.id.startsWith('groove:'))add('light-stand','Подсветка врезная в стойках',d.length/1000,'пог.м',RULES.lightRetailPerM,'Прайс цеха (розница): '+RULES.lightRetailPerM+' ₽/пог.м, поверх коэффициента',true);
    }
    if(bzHinges&&nm?.hinges)addHinges(byNames(bzHinges,nm.hinges),a.module.hingeBrand??'gtv');
    for(const s of a.module.sections){
      if(s.rod)add('screw35x16-rod','Саморез 3,5×16 · крепление штанги',RULES.rodMountScrews,'шт',0.3,'ФАМ: шуруп 4×16 — 0,28 ₽ (ориентир); 6 на штангу по фрагменту цеха');
      if(s.pantograph)add('pantograph','Пантограф GTV',1,'компл',null,'Закупочная цена не найдена; 9000 ₽ в прайсе — цена продажи');
      if(s.pullouts)add('pullout:'+pulloutLength(a.module),'Выдвижной тремпель GTV '+pulloutLength(a.module)+' мм',s.pullouts,'шт',PULLOUT_PRICE,'Цена Макса 07.10.2026: 500 ₽ за тремпель');
      for(let j=0;j<s.drawers;j++){
        const c=drawerConfig(a.module,s,j);
        if(c.mesh){const item=meshById(c.mesh);add('mesh:'+c.mesh,item?item.label+' · Лемана Про':'Элемент Лемана Про',1,'шт',item?.price??null,item?'Лемана Про, розница 01.09.2026, арт. '+item.art:'Не найден в каталоге');continue;}
        const sys=slideSystem(c),q=slidePrice(c),isDefault=sys.id==='ball-soft'||sys.id==='hidden-dtc-push';
        add('slide:'+c.slide+':'+c.length+(isDefault?'':':'+sys.id),q.label,1,'компл',q.price,q.source);
      }
    }
  }
  add('edge2','Кромка 2 мм',edge2,'м',45,'База цеха');add('edge1','Кромка 1 мм',edge1,'м',33,'Оценка между 0,8 (27 ₽) и 2 мм (45 ₽) с работой; подтвердить счётом Победы');add('edge08','Кромка 0,8 мм',edge08,'м',27,'Победа: кромка 0,8×19 (Дуб Дарго) 27 ₽/м');add('edge04','Кромка 0,4 мм',edge04,'м',15,'База цеха');add('edge05','Кромка 0,5 мм (как в проекте Базиса)',edge05,'м',15,'Цена как у кромки 0,4 — уточнить по счёту');add('small','Обработка деталей уже 70 мм',small,'шт',300,'Правило цеха'+(bazisProject?' (работа цеха, не из Базиса)':''));
  // Работа цеха — за лист ЛДСП. У кухни (все объекты — кухонные модули, сырые модули кухни Базиса, столешницы) лист ХДФ работой
  // не считается; у шкафов, в т.ч. сырых шкафов из корпуса Базиса, — как было (решение не менять правила шкафов).
  const kitchenOnly=p.modules.length>0&&p.modules.every(a=>a.module.kitchen||rawKitchen(a.module.raw)||a.module.worktop);
  add('work','Работа цеха',kitchenOnly?plan.filter(s=>s.material!=='hdf').length:plan.length,'лист',2500,(kitchenOnly?'База расчёта: 2 500 ₽ за лист ЛДСП (лист ХДФ без работы)':'База расчёта шкафа')+(bazisProject?' (работа цеха, не из Базиса)':''));
  for(const l of lines)l.quantity=Math.round(l.quantity*1000)/1000;
  const missing=lines.filter(l=>l.unitPrice===null),knownCost=Math.round(lines.filter(l=>!l.retail).reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0));
  const retailExtras=Math.round(lines.filter(l=>l.retail).reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0));
  const ldspSheets=plan.filter(s=>s.material!=='hdf').length,sheetPrice=settings.sheetPrice??SHEET_PRICE_DEFAULT,model=settings.model??'markup';
  // Решение Макса 06.10.2026: клиенту показываем отдельно «материалы» (плита, кромка, работа, фасадные материалы) и «фурнитуру»,
  // чтобы смена фурнитуры сразу меняла цену. Итог по коэффициенту = сумма двух округлённых частей.
  const costOf=(g:LineGroup)=>Math.round(lines.filter(l=>!l.retail&&lineGroup(l.id)===g).reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0));
  const materialCost=costOf('material'),hardwareCost=costOf('hardware');
  // Розничные позиции (двери-купе по прайсу калькулятора купе, подсветка) идут в свою группу без коэффициента.
  const retailOf=(g:LineGroup)=>Math.round(lines.filter(l=>l.retail&&lineGroup(l.id)===g).reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0));
  const split={materialCost,hardwareCost,material:Math.round(materialCost*settings.markup/100)*100+retailOf('material'),hardware:Math.round(hardwareCost*settings.markup/100)*100+retailOf('hardware')};
  const byMarkup=missing.length?null:split.material+split.hardware;
  // Модель цеха: цена за лист ЛДСП включает фурнитуру, кромку и работу; сверху — розница (подсветка) и позиции Лемана по выбору клиента.
  const lemana=Math.round(lines.filter(l=>!l.retail&&(l.id.startsWith('mesh:')||l.id.startsWith('handle:lm'))).reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0));
  const bySheet=ldspSheets*sheetPrice+retailExtras+lemana;
  return {lines,missing,knownCost,retailExtras,split,markup:settings.markup,model,sheetPrice,ldspSheets,byMarkup,bySheet,perSheet:byMarkup!==null&&ldspSheets?Math.round(byMarkup/ldspSheets):null,retail:unplaced.length?null:model==='sheet'?bySheet:byMarkup};
}


export function estimateCSV(p:Project,result=estimate(p)){
 const rows:(string|number)[][]=[['Проект',p.offer?.customer||'Проект мебели','','','','',''],['Позиция','Количество','Единица','Цена, ₽','Сумма, ₽','Источник','Статус']];
 for(const l of result.lines)rows.push([l.label,l.quantity,l.unit,l.unitPrice??'',l.unitPrice===null?'':Math.round(l.quantity*l.unitPrice),l.source,l.unitPrice===null?'Уточнить цену':'Учтено']);
 rows.push(['Учтённая себестоимость','','','',result.knownCost,'',''],['Коэффициент',result.markup,'','','','',''],...(result.retailExtras?[['Розничные позиции поверх коэффициента','','','',result.retailExtras,'','']]:[]),['Листов ЛДСП',result.ldspSheets,'лист',result.sheetPrice,result.bySheet,'Модель цеха: цена за лист с фурнитурой',result.model==='sheet'?'Выбрана':'Для сравнения'],['Цена по коэффициенту','','','',result.byMarkup??'','',result.model==='markup'?'Выбрана':'Для сравнения'],['Расчётная цена','','','',result.retail??'','',result.retail===null?'Смета не завершена':'Предварительно'],['Ограничения','Доставка, монтаж и неописанный крепёж не включены','','','','','']);
 const cell=(v:string|number)=>{let text=typeof v==='number'?String(v).replace('.',','):v;if(typeof v==='string'&&/^\s*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return '﻿'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
