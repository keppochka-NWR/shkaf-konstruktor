(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./retail-film.js') : root.facadeFilmRetail, node ? require('./sheet-count.js') : root.FacadeSheetCount);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FacadeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (retail, sheetCount) {
  'use strict';
  const families = ['MDF', 'PAINT', 'ALU', 'Eterno', 'AGT', 'LDSP'];
  const familyNames = {MDF:'МДФ в Плёнке', PAINT:'МДФ краска', ALU:'Алюминиевые фасады', Eterno:'Eterno', AGT:'AGT', LDSP:'ЛДСП / Lamarty'};
  const hasEdging = p => ['Eterno','AGT','LDSP'].includes(p.family);
  const clone = x => JSON.parse(JSON.stringify(x));
  const money = x => Math.round((x + Number.EPSILON) * 100) / 100;
  const number = (v, min, max, title, nullable=false) => {
    if (nullable && v === null) return null;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw Error(title + ': некорректное число');
    return v;
  };
  const text = (v, title, max=160) => {
    if (typeof v !== 'string' || v.length > max) throw Error(title + ': некорректный текст');
    return v;
  };
  function newPart(id='f1') {
    return {id, name:'Фасад 1', family:'MDF', h:716, w:596, t:16, qty:1,
      panelId:'', millingId:'', filmId:'', variant:'solid',
      paintMillingId:'',paintColorId:'',paintFinish:'',
      aluProfileId:'',aluColorId:'',aluFillId:'',aluColorName:'',aluColorHex:null,
      edges:{top:false,bottom:false,left:false,right:false},
      rates:{material:null,edge:null,work:null},
      rateNote:'', drilling:{enabled:false,side:'left',diameter:null,center:null,depth:null,ys:[]}};
  }
  function newProject() { return {format:'yo-facades',version:2,name:'Новый заказ фасадов',client:'',comment:'',basis:'area',parts:[newPart()]}; }
  function parseProject(value, catalog) {
    const p = typeof value === 'string' ? JSON.parse(value) : value;
    if (!p || p.format !== 'yo-facades' || ![1,2].includes(p.version) || p.basis !== 'area') throw Error('Это не проект калькулятора фасадов версии 1 или 2');
    if (!Array.isArray(p.parts) || p.parts.length < 1 || p.parts.length > 1000) throw Error('В проекте должно быть от 1 до 1000 позиций');
    const ids = new Set();
    const parts = p.parts.map((x, index) => {
      if (!x || typeof x !== 'object') throw Error('Пустая позиция ' + (index+1));
      const id = text(x.id,'ID',80);
      if (!id || ids.has(id) || !/^[a-zA-Z0-9_-]+$/.test(id)) throw Error('Повторяющийся или неверный ID позиции');
      ids.add(id);
      if (!families.includes(x.family)) throw Error('Неизвестный материал');
      const panelId = text(x.panelId,'Декор'), millingId = text(x.millingId,'Фрезеровка',30), filmId=text(x.filmId,'Плёнка',30);
      const selected = {};
      for(const [key,collection] of Object.entries({paintMillingId:'paintMillings',paintColorId:'paintColors',paintFinish:'paintFinishes',aluProfileId:'aluProfiles',aluColorId:'aluColors',aluFillId:'aluFills'})) {
        const id=text(x[key]===undefined?'':x[key],key,80);
        if(id && !(catalog[collection]||[]).some(item=>item.id===id)) throw Error('Выбранное значение отсутствует в каталоге: '+key);
        selected[key]=id;
      }
      const aluColorName=text(x.aluColorName===undefined?'':x.aluColorName,'Цвет профиля',120);
      const aluColorHex=x.aluColorHex===undefined?null:x.aluColorHex;
      if(aluColorHex!==null && (typeof aluColorHex!=='string'||!/^#[0-9a-f]{6}$/i.test(aluColorHex))) throw Error('Некорректный цвет профиля');
      if (panelId && !catalog.panels.some(p=>p.id===panelId && p.family===x.family)) throw Error('Декор отсутствует в каталоге выбранного материала');
      if (millingId && !catalog.millings.some(m=>m.id===millingId)) throw Error('Номер фрезеровки отсутствует в проверенном наборе');
      if (filmId && !catalog.films.some(f=>f.id===filmId)) throw Error('Плёнка отсутствует в каталоге');
      if ((x.family!=='MDF'&&(millingId||filmId)) || (!['Eterno','AGT','LDSP'].includes(x.family)&&panelId)
        || (x.family!=='PAINT'&&(selected.paintMillingId||selected.paintColorId||selected.paintFinish))
        || (x.family!=='ALU'&&(selected.aluProfileId||selected.aluColorId||selected.aluFillId||aluColorName||aluColorHex))) throw Error('Материал и каталог не согласованы');
      if (!['solid','drawer','glass'].includes(x.variant)) throw Error('Неизвестный тип детали');
      if (!x.edges || !x.rates || !x.drilling) throw Error('Отсутствуют обязательные поля позиции');
      const edges = {};
      for (const edge of ['top','bottom','left','right']) {
        if (typeof x.edges[edge] !== 'boolean') throw Error('Некорректные стороны кромки');
        edges[edge] = x.edges[edge];
      }
      const rates = {};
      for (const key of ['material','edge','work']) rates[key] = number(x.rates[key],0,10000000,'Ставка',true);
      const d=x.drilling;
      if (typeof d.enabled!=='boolean' || !['left','right'].includes(d.side) || !Array.isArray(d.ys) || d.ys.length>20) throw Error('Некорректная разметка петель');
      const qty=number(x.qty,1,1000,'Количество');
      if (!Number.isInteger(qty)) throw Error('Количество должно быть целым');
      return {id,name:text(x.name,'Название',120),family:x.family,
        h:number(x.h,50,3500,'Высота'),w:number(x.w,25,2200,'Ширина'),t:number(x.t,3,60,'Толщина'),qty,
        panelId,millingId,filmId,...selected,aluColorName,aluColorHex,variant:x.variant,edges,rates,rateNote:text(x.rateNote,'Источник ставки',240),
        drilling:{enabled:d.enabled,side:d.side,diameter:number(d.diameter,1,100,'Диаметр',true),
          center:number(d.center,1,300,'Центр отверстия',true),depth:number(d.depth===undefined?null:d.depth,0.1,60,'Глубина',true),ys:d.ys.map(y=>number(y,0,3500,'Координата петли'))}};
    });
    return {format:'yo-facades',version:2,name:text(p.name,'Название проекта',120),client:text(p.client===undefined?'':p.client,'Клиент',240),comment:text(p.comment===undefined?'':p.comment,'Комментарий',3000),basis:'area',parts};
  }
  function area(part) { return part.h * part.w * part.qty / 1000000; }
  function edgeLength(p) { return (p.w*(Number(p.edges.top)+Number(p.edges.bottom))+p.h*(Number(p.edges.left)+Number(p.edges.right)))*p.qty/1000; }
  // Рамка ALU (24.11.2026): цена как в смете Ё Конструктора — профиль по периметру, наполнение по площади, уплотнитель по периметру
  // (retail.alu выгружает studio/scripts/build-facade-retail.ts). Ручная ставка материала по-прежнему главнее.
  function aluPart(p) {
    const al=retail.alu, perM=al&&al.profiles[p.aluProfileId], perM2=al&&al.fills[p.aluFillId];
    if(p.family!=='ALU'||p.rates.material!==null||perM==null||perM2==null) return null;
    const q3=x=>Math.round(x*1000)/1000, perimeter=q3(2*(p.h+p.w)/1000*p.qty), a=q3(area(p)); // количества — до 0,001, как в смете Конструктора
    const lines=[
      {key:'alu-profile',label:'Профиль рамки · по прайсу Конструктора',amount:perimeter,unit:'м',rate:perM},
      {key:'alu-fill',label:'Наполнение рамки · по прайсу Конструктора',amount:a,unit:'м²',rate:perM2},
      {key:'alu-seal',label:'Уплотнитель рамки',amount:perimeter,unit:'м',rate:al.gasket}];
    if(p.rates.work!==null) lines.push({key:'work',label:'Дополнительная обработка',amount:p.qty,unit:'шт.',rate:p.rates.work});
    for (const l of lines) l.total=l.rate===null?null:money(l.amount*l.rate);
    const missing=lines.filter(l=>l.total===null).map(l=>l.label);
    return {priceGroup:0,area:a,edge:0,lines,known:money(lines.reduce((v,l)=>v+(l.total??0),0)),complete:missing.length===0,missing};
  }
  // Плиты AGT, Eterno и ЛДСП — целыми листами, как в смете Ё Конструктора (24.11.2026): позиции одной плиты и толщины
  // раскладываются вместе тем же движком (sheet-count.js = studio/src/sheetCount.ts), заказ платит за каждый начатый лист;
  // ЛДСП — доплата ×2 за лист с крупной деталью, как у корпусов. Кромка и раскрой входят в цену листа. Сумма группы делится
  // между позициями по площади. Ручная ставка материала по-прежнему главнее.
  const sheetFamily=p=>['AGT','Eterno','LDSP'].includes(p.family);
  function sheetPanel(p){const s=retail.sheets&&retail.sheets.panels[p.panelId];return sheetFamily(p)&&p.rates.material===null&&s&&sheetCount?s:null;}
  function sheetPlan(project){
    const groups=new Map(),plan=new Map();
    for(const p of project.parts){const s=sheetPanel(p);if(!s)continue;const k=p.panelId+'/'+p.t;const g=groups.get(k)||{panel:s,parts:[]};g.parts.push(p);groups.set(k,g);}
    for(const g of groups.values()){
      const owner=id=>g.parts.find(p=>id.startsWith(p.id+'#'));
      const r=sheetCount.classicSheets(g.parts.flatMap(p=>Array.from({length:p.qty},(_,i)=>({id:p.id+'#'+i,w:p.w,h:p.h,rot:g.panel.rot}))),g.panel.sheet[0],g.panel.sheet[1]);
      const big=id=>{const p=owner(id),L=Math.max(p.h,p.w),S=Math.min(p.h,p.w);return retail.sheets.doubleThresholds.some(([l,w])=>L>l&&S>w);};
      const oversized=g.panel.double?r.sheets.filter(s=>s.some(big)).length:0,unplaced=new Set(r.unplaced.map(id=>owner(id).id));
      const placed=g.parts.filter(p=>!unplaced.has(p.id)),units=r.sheets.length+oversized,total=units*g.panel.price,area=placed.reduce((a,p)=>a+p.h*p.w*p.qty,0);
      let left=total;
      placed.forEach((p,i)=>{const frac=p.h*p.w*p.qty/area,share=i===placed.length-1?money(left):money(total*frac);left-=share;plan.set(p.id,{share,frac:units*frac,sheets:r.sheets.length,oversized,price:g.panel.price,parts:g.parts.length});});
      for(const id of unplaced)plan.set(id,{unplaced:true});
    }
    return plan;
  }
  function sheetRow(p,sp){
    const a=area(p),lines=sp.unplaced
      ?[{key:'sheets',label:'Деталь больше листа плиты — сращивать или заказать отдельно',amount:p.qty,unit:'шт.',rate:null,total:null}]
      :[{key:'sheets',label:'Плита целыми листами: '+sp.sheets+' л. на '+(sp.parts>1?sp.parts+' позиции заказа':'позицию')+(sp.oversized?' (из них '+sp.oversized+' с доплатой ×2 за крупную деталь)':'')+' · доля позиции',amount:Math.round(sp.frac*1000)/1000,unit:'лист',rate:sp.price,total:sp.share}];
    if(!sp.unplaced&&p.rates.work!==null) lines.push({key:'work',label:'Дополнительная обработка',amount:p.qty,unit:'шт.',rate:p.rates.work,total:money(p.qty*p.rates.work)});
    const missing=lines.filter(l=>l.total===null).map(l=>l.label);
    return {priceGroup:0,area:a,edge:0,lines,known:money(lines.reduce((v,l)=>v+(l.total??0),0)),complete:missing.length===0,missing};
  }
  /** ctx — проект (или готовый план листов): цена позиции из плиты зависит от остальных позиций той же плиты. */
  function calculatePart(p,ctx) {
    const plan=ctx instanceof Map?ctx:ctx&&ctx.parts?sheetPlan(ctx):sheetPanel(p)?sheetPlan({parts:[p]}):null,sp=plan&&plan.get(p.id);
    if(sp) return sheetRow(p,sp);
    const aluRow=aluPart(p);
    if(aluRow) return aluRow;
    const a=area(p), e=hasEdging(p)?edgeLength(p):0;
    const film = p.family==='MDF';
    const variant=p.variant==='glass'?'glass':'solid';
    const paint=p.family==='PAINT'&&p.paintColorId&&retail.enamelPatterns.find(m=>m.id===p.paintMillingId);
    const rateKey=film ? [retail.series[p.millingId],retail.categories[p.filmId],p.t,variant] : paint ? [paint.studioId,'paint',p.paintFinish,p.t,variant] : [];
    const tableRate=retail.rates[rateKey.join('/')];
    const automatic = p.rates.material===null && tableRate!=null;
    const amount = automatic ? Math.round(Math.max(film?retail.minimum:0,p.w*p.h/1e6)*10000)/10000*p.qty : a;
    const lines=[{key:'material',label:automatic?(film?'Полотно в плёнке':'Полотно в краске')+' · по прайсу Конструктора':'Материал и изготовление полотна',amount,unit:'м²',rate:automatic?tableRate:p.rates.material}];
    if(automatic && p.drilling.enabled && p.drilling.ys.length) lines.push({key:'boring',label:'Присадка чашек петель',amount:p.qty*p.drilling.ys.length,unit:'шт.',rate:retail.boring});
    if(!automatic || p.rates.work!==null) lines.push({key:'work',label:'Дополнительная обработка',amount:p.qty,unit:'шт.',rate:p.rates.work});
    if(e>0) lines.splice(1,0,{key:'edge',label:'Кромление выбранных сторон',amount:e,unit:'м',rate:p.rates.edge});
    for (const l of lines) l.total=l.rate===null?null:money(l.amount*l.rate);
    const missing=lines.filter(l=>l.total===null).map(l=>l.label);
    const priceGroup=lines.reduce((sum,l)=>sum+((automatic&&l.key==='material'||l.key==='boring')?l.amount*l.rate:0),0);
    return {priceGroup,area:a,edge:e,lines,known:money(lines.reduce((v,l)=>v+(l.total??0),0)),complete:missing.length===0,missing};
  }
  function estimate(project) {
    const plan=sheetPlan(project),rows=project.parts.map(p=>calculatePart(p,plan));
    const group=rows.reduce((sum,row)=>sum+row.priceGroup,0);
    const rounding=money(Math.round(group/100)*100-rows.reduce((sum,row)=>sum+money(row.priceGroup),0));
    return {rows,rounding,area:rows.reduce((a,x)=>a+x.area,0),qty:project.parts.reduce((a,x)=>a+x.qty,0),
      known:money(rounding+rows.reduce((a,x)=>a+x.known,0)),missing:rows.reduce((a,x)=>a+x.missing.length,0)};
  }
  function warnings(p,catalog) {
    const list=[];
    if(p.family==='MDF') {
      const m=catalog.millings.find(m=>m.id===p.millingId);
      if(!m) list.push('Выберите точный номер фрезеровки. Автоматической замены нет.');
      if(!p.filmId) list.push('Плёнка не выбрана. Цена покрытия не подтверждена.');
      if(m) {
        const film=catalog.films.find(f=>f.id===p.filmId);
        if(m.id==='V5'&&film&&film.v5!==true) list.push('Совместимость выбранной плёнки с V5 не подтверждена в каталоге.');
        if(m.thicknesses?.length && !m.thicknesses.includes(p.t)) list.push('Толщина не входит в паспорт фрезеровки: '+m.thicknesses.join(' / ')+' мм.');
        const lim=m.limits?.[p.variant];
        if(!lim) list.push('В паспорте нет подтверждённых размеров для выбранного типа детали.');
        else {
          const [hmin,hmax,wmin,wmax]=lim;
          if(p.h<hmin || (hmax!==null&&p.h>hmax) || p.w<wmin || (wmax!==null&&p.w>wmax)) list.push('Размер вне паспортного диапазона: H '+hmin+'-'+(hmax??'?')+', W '+wmin+'-'+(wmax??'?')+' мм. Проверьте паспорт.');
        }
        if(p.variant==='glass') list.push('Витрина: заполнение, штапик и геометрия проёма в расчёт пока не включены.');
        if(p.variant==='drawer'&&m.drawerSmooth) list.push('Для фасада ящика паспорт предусматривает гладкое исполнение.');
      }
    } else if(p.family==='PAINT') {
      const m=(catalog.paintMillings||[]).find(m=>m.id===p.paintMillingId);
      if(!m) list.push('Выберите фрезеровку МДФ в краске; гладкий фасад выбирается отдельно.');
      if(!p.paintColorId) list.push('Цвет RAL не выбран.');
      if(!p.paintFinish) list.push('Покрытие МДФ в краске не выбрано.');
      if(m) {
        if(m.thicknesses?.length&&!m.thicknesses.includes(p.t)) list.push('Толщина не входит в исходную спецификацию фрезеровки: '+m.thicknesses.join(' / ')+' мм.');
        const lim=m.limits?.[p.variant];
        if(!lim) list.push('В исходном каталоге нет подтверждённых размеров для выбранного типа детали.');
        else if(p.h<lim[0]||(lim[1]!==null&&p.h>lim[1])||p.w<lim[2]||(lim[3]!==null&&p.w>lim[3])) list.push('Размер вне диапазона исходного каталога: H '+lim[0]+'-'+lim[1]+', W '+lim[2]+'-'+lim[3]+' мм.');
        if(p.variant==='glass') list.push('Витрина: наполнение, штапик и монтажные зазоры требуют отдельного согласования.');
      }
      if(m&&!m.studioId) list.push('Параметры МДФ в краске перенесены из прежнего калькулятора; актуальность у поставщика не подтверждена.');
    } else if(p.family==='ALU') {
      if(!p.aluProfileId) list.push('Профиль алюминиевого фасада не выбран.');
      if(!p.aluFillId) list.push('Наполнение алюминиевого фасада не выбрано.');
      if(!p.aluColorName) list.push('Укажите название цвета профиля; экранный оттенок задаётся вручную.');
      list.push('Сечение, толщина профиля, размер заполнения и совместимость фурнитуры требуют подтверждения по паспорту выбранного профиля.');
      if(!(p.rates.material===null&&retail.alu&&retail.alu.profiles[p.aluProfileId]!=null&&retail.alu.fills[p.aluFillId]!=null)) list.push('Выберите профиль и наполнение — цена посчитается по прайсу Конструктора; или задайте ставку вручную.');
    } else {
      const panel=catalog.panels.find(a=>a.id===p.panelId);
      if(!panel) list.push('Выберите декор по каталогу.');
      else {
        if(panel.thickness!==null && panel.thickness!==p.t) list.push('Толщина отличается от каталога: '+panel.thickness+' мм.');
        if(panel.thickness===null) list.push('Толщина материала не подтверждена каталогом.');
        if(panel.sheet && !((p.h<=panel.sheet[1]&&p.w<=panel.sheet[0])||(p.w<=panel.sheet[1]&&p.h<=panel.sheet[0]))) list.push('Деталь не помещается в лист каталога даже без припусков.');
      }
    }
    const d=p.drilling;
    if(d.enabled) {
      if(p.family==='ALU') list.push('Присадка ALU задаётся по схеме выбранной петли. Чашка 35 мм автоматически не назначается.');
      if(d.depth==null) list.push('Глубина присадки не задана.');
      else if(d.depth>=p.t) list.push('Глубина присадки достигает или превышает толщину фасада.');
      if(d.diameter===null||d.center===null||!d.ys.length) list.push('Для разметки нужны диаметр, отступ центра и координаты по высоте.');
      else {
        const r=d.diameter/2;
        if(d.center<r||d.center+r>p.w||d.ys.some(y=>y<r||y+r>p.h)) list.push('Чашка выходит за край фасада.');
        const ys=[...d.ys].sort((a,b)=>a-b);
        if(ys.some((y,i)=>i>0&&y-ys[i-1]<d.diameter)) list.push('Чашки пересекаются.');
      }
    }
    return list;
  }
  function thicknesses(p,catalog) {
    if(p.family==='MDF') return catalog.millings.find(m=>m.id===p.millingId)?.thicknesses||[];
    if(p.family==='PAINT') return (catalog.paintMillings||[]).find(m=>m.id===p.paintMillingId)?.thicknesses||[];
    if(p.family==='ALU') return [];
    const t=catalog.panels.find(a=>a.id===p.panelId)?.thickness;
    return t==null?[]:[t];
  }
  // Pure operation: validate the complete candidate before returning any changed state.
  function applyThickness(project,t,catalog) {
    number(t,3,60,'Толщина');
    const candidate=parseProject(project,catalog), conflicts=[], resultWarnings=[];
    for(const p of candidate.parts) {
      const allowed=thicknesses(p,catalog);
      if(allowed.length&&!allowed.includes(t)) conflicts.push({id:p.id,name:p.name,message:'Допустимая толщина: '+allowed.join(' / ')+' мм; запрошено '+t+' мм.'});
      if(p.drilling.enabled&&p.drilling.depth!==null&&p.drilling.depth>=t) conflicts.push({id:p.id,name:p.name,message:'Глубина присадки '+p.drilling.depth+' мм несовместима с толщиной '+t+' мм.'});
      if(!allowed.length) resultWarnings.push({id:p.id,name:p.name,message:'Допустимая толщина не подтверждена каталогом; установлено '+t+' мм.'});
      p.t=t;
    }
    if(conflicts.length) {
      const error=Error('Общая толщина не применена. '+conflicts.map(c=>c.name+': '+c.message).join(' '));
      error.conflicts=conflicts;
      throw error;
    }
    return {project:candidate,warnings:resultWarnings};
  }
  function description(p,catalog) {
    if(p.family==='MDF') return ['№ '+(p.millingId||'не выбран'),catalog.films.find(x=>x.id===p.filmId)?.name||'Плёнка не выбрана'].join(' · ');
    if(p.family==='PAINT') return [(catalog.paintMillings||[]).find(x=>x.id===p.paintMillingId)?.name||'Фрезеровка не выбрана',p.paintColorId?'RAL '+p.paintColorId:'Цвет не выбран',(catalog.paintFinishes||[]).find(x=>x.id===p.paintFinish)?.name||'Покрытие не выбрано'].join(' · ');
    if(p.family==='ALU') return [(catalog.aluProfiles||[]).find(x=>x.id===p.aluProfileId)?.name||'Профиль не выбран',p.aluColorName||'Цвет не задан',(catalog.aluFills||[]).find(x=>x.id===p.aluFillId)?.name||'Наполнение не выбрано'].join(' · ');
    return catalog.panels.find(x=>x.id===p.panelId)?.name||'Декор не выбран';
  }
  function csvCell(value) {
    let v=String(value??'');
    if(/^[\s]*[=+\-@]/.test(v)) v="'"+v;
    return '"'+v.replaceAll('"','""')+'"';
  }
  function csv(project,catalog) {
    const rows=[['Позиция','Название','Материал','Декор / фрезеровка','Плёнка','Вариант','Высота, мм','Ширина, мм','Толщина, мм','Количество','Площадь, м²','Кромка, м','Учтено, руб.','Не хватает ставок','Предупреждения','Источник ручной ставки']];
    project.parts.forEach((p,i)=>{
      const c=calculatePart(p,project), panel=catalog.panels.find(x=>x.id===p.panelId), film=catalog.films.find(x=>x.id===p.filmId);
      rows.push([i+1,p.name,familyNames[p.family],description(p,catalog),film?.name||'',p.variant,p.h,p.w,p.t,p.qty,c.area,c.edge,c.known,c.missing.join('; '),warnings(p,catalog).join('; '),p.rateNote]);
    });
    return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
  }
  return {families,familyNames,clone,money,newPart,newProject,parseProject,area,edgeLength,calculatePart,estimate,warnings,applyThickness,thicknesses,description,csv};
});
