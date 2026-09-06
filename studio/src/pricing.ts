import {parts,drawerConfig,RULES} from './model';
import {nest,type Sheet} from './exports';
import type {Project} from './project';
export type PriceSettings={markup:number;overrides:Record<string,number>};
export type PriceLine={id:string;label:string;quantity:number;unit:string;unitPrice:number|null;source:string};
// Local workshop purchase records, not live supplier quotes.
const sheets:Record<string,number>={'Белый':2150,'Тэффи':2440,'Белоснежный':2440,'Бетон Пайн Белый':2540,'Дуб Вотан':2690,'Белый Кристалл':2900,'Графит':2900,'Клауд':2900,'Орегано':2960,'Дуб Галиано':2960,'Луно':2960,'Дуб Солсбери':3230,'Терра':3230,'Медея':3810,'Орех Бруно D*':3810};
const ball:Record<number,number>={250:445,350:550,450:650,500:695};
export function hingeCount(height:number,width:number){return (height<=900?2:height<=1600?3:height<=2000?4:5)+(width>450?1:0);}
export function estimate(p:Project,plan:Sheet[]=nest(p)){
  const lines:PriceLine[]=[];const settings=p.calculation||{markup:2.2,overrides:{}};
  function add(id:string,label:string,quantity:number,unit:string,unitPrice:number|null,source:string){if(!quantity)return;const existing=lines.find(l=>l.id===id);if(existing){existing.quantity+=quantity;return;}lines.push({id,label,quantity,unit,unitPrice:settings.overrides[id]??unitPrice,source:settings.overrides[id]===undefined?source:'Цена в этом проекте'});}
  for(const sheet of plan)add('sheet:'+sheet.decor,sheet.material==='hdf'?'ЛХДФ 3 мм':'Lamarty 16 мм · '+sheet.decor,1,'лист',sheet.material==='hdf'?1060:sheets[sheet.decor]??null,'База закупки СФЗ / Победа');
  let edge2=0,edge04=0,small=0;
  for(const a of p.modules){
    for(const d of parts(a.module)){
      if(d.material==='board'){
        d.edge.forEach((edge,k)=>{const length=(k<2?d.width:d.length)/1000;if(edge===2)edge2+=length;else if(edge===0.4)edge04+=length;});
        if(Math.min(d.length,d.width)<70)small++;
      }
      if(d.role==='door')add('hinge','Петля GTV SOLID PLUS',hingeCount(d.length,d.width),'шт',115,'Счета ФАМ, 2026');
      if(d.role==='handle')add('handle128','Ручка 128 мм · UZ 819',1,'шт',100,'Счета ФАМ, 2026');
      if(d.role==='flange')add('flange25','Фланец D25',1,'шт',40,'Старый калькулятор: 40 ₽; закупку подтвердить');
      if(d.role==='rod'&&!d.id.includes('pantograph'))add('rod25','Штанга D25',d.length/1000,'м',300,'Старый калькулятор: 300 ₽/м; закупку подтвердить');
    }
    for(const s of a.module.sections){
      if(s.rod)add('screw35x16-rod','Саморез 3,5×16 · крепление штанги D25',RULES.rodMountScrews,'шт',null,'Фрагмент цеха: 6 на штангу; закупочную цену уточнить');
      if(s.pantograph)add('pantograph','Пантограф GTV',1,'компл',null,'Закупочная цена не найдена; 9000 ₽ в прайсе — цена продажи');
      for(let j=0;j<s.drawers;j++){const c=drawerConfig(a.module,s,j);add('slide:'+c.slide+':'+c.length,(c.slide==='ball'?'GTV Versalite':'GTV 0FPO')+' · '+c.length+' мм',1,'компл',c.slide==='ball'?ball[c.length]??null:null,'Счета ФАМ; отсутствующие размеры требуют цены');}
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
 return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
