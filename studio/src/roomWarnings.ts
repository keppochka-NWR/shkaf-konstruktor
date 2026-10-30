import {dishwasherServiceWarnings} from './dishwasherServices';
import {sinkChecks} from './sinkChecks';
import {environmentChecks} from './environmentChecks';
import {ceilingClearance,nicheSize} from './measurement';
import {obstacleBounds,bounds,closedModuleBounds,overlap,type Opening,type Project,type Room} from './project';
import {convexOverlap} from './roomGeometry';
import {edgeZone,openingEdge,outsideOutline,pointsBox} from './roomEdges';
import {FIXTURES,fixtureBox,fixtureLabel} from './fixtures';
import {parts,RULES,facadeTop,hasDrawerCap,isDrawerModule,rodClearanceWarnings} from './model';
import {partCollisions,rawCheck,bazisAirHardware,edgePullGaps,LEAF_GAP_MIN,RAW_FAR,BAZIS_AIR,type EdgePullGap} from './collisions';
import {rawHangerSeats,rawKitchen,RAW_HANGER_DROP} from './rawModule';
import {cutoutWarnings,mansardWarnings} from './shapes';

export type RoomWarning={moduleId:string;openingId?:string;obstacleId?:string;fixtureId?:string;kind?:string;message:string};
/** Что советуем по каждому типу объекта на стене, если его перекрывает мебель. */
const FIXTURE_ADVICE:Record<string,string>={
  socket:'розетка окажется за корпусом — перенести розетку или сделать вырез в заднике с доступом',
  switch:'выключатель окажется за корпусом — перенести или оставить нишу',
  stoveSocket:'розетка плиты должна остаться доступной — вырез в заднике и цоколе',
  api:'пожарный извещатель нельзя закрывать — сдвиньте корпус или согласуйте перенос',
  panel:'электрощит должен открываться — оставить нишу или отступить от стены на его глубину',
  cableDuct:'кабель-канал: вырез в заднике, крыше и дне по трассе',
  radiator:'батарея за корпусом — отступ и тепловой зазор, либо решётка в столешнице/полке',
  pipe:'труба: вырез в заднике и горизонталях по месту, проверить диаметр с изоляцией',
  waterHeater:'водонагреватель должен остаться доступным для обслуживания',
  gasMeter:'газовый счётчик: доступ и вентиляция обязательны, корпус глухим не закрывать',
  hatch:'лючок ревизии должен открываться — оставить съёмную панель или нишу',
  vent:'вентканал нельзя перекрывать — решётка в фасаде или отступ',
  verticalBox:'вертикальный короб: корпус упирается — уменьшить ширину или сделать вырез',
  horizontalBox:'горизонтальный короб под потолком: уменьшить высоту корпуса или антресоли',
  ceilingPlinth:'потолочный плинтус: корпус до потолка не встанет вплотную к стене — снять плинтус или зазор',
  floorPlinth:'напольный плинтус: корпус на цоколе не встанет вплотную — снять плинтус или вырез в цоколе и боковинах',
  apron:'фартук: корпус ляжет на фартук — учесть его толщину в глубине',
  niche:'ниша в стене: за корпусом пустота — проверить крепление к стене',
};

// Advisory inspection zones, not workshop rules or door-swing geometry.
export function openingZone(room:Room,o:Opening){
  // контур (задача Макса 30.10.2026): зона — повёрнутый четырёхугольник перед стеной контура (openingPolygon); здесь — его габарит для плана
  if(room.outline){const q=openingPolygon(room,o);return {...pointsBox(q.pts),y:q.y,h:q.h};}
  const horizontal=o.wall==='back'||o.wall==='front';
  const reach=Math.min(o.type==='door'?900:100,horizontal?room.depth:room.width);
  return {x:horizontal?o.offset:o.wall==='left'?0:room.width-reach,
    z:horizontal?(o.wall==='back'?0:room.depth-reach):o.offset,
    y:o.sill,w:horizontal?o.width:reach,d:horizontal?reach:o.width,h:o.height};
}
/** Зона перед проёмом на стене контура: дверь — 900 мм в комнату, окно — 100 мм, вдоль стены — ширина проёма (по хорде). */
export function openingPolygon(room:Room,o:Opening){
  const e=openingEdge(room,o);
  return {pts:edgeZone(room.outline!,e.edge,e.offset,e.offset+o.width,0,o.type==='door'?900:100),y:o.sill,h:o.height};
}
/** Пересечение габарита {x,y,z,w,h,d} с повёрнутой зоной у стены (по плану — выпуклые многоугольники, по высоте — отрезки). */
const hitsZone=(b:{x:number;y:number;z:number;w:number;h:number;d:number},z:{pts:{x:number;z:number}[];y:number;h:number})=>b.y<z.y+z.h-.1&&b.y+b.h>z.y+.1&&convexOverlap([{x:b.x,z:b.z},{x:b.x+b.w,z:b.z},{x:b.x+b.w,z:b.z+b.d},{x:b.x,z:b.z+b.d}],z.pts);
export function roomWarnings(project:Project){
  const closed=project.modules.map(a=>({a,b:closedModuleBounds(a)}));
  const warnings:RoomWarning[]=environmentChecks(project),ol=project.room.outline;
  for(const [index,o] of (project.room.openings||[]).entries())for(const a of project.modules){
    if(ol?!hitsZone(bounds(a),openingPolygon(project.room,o)):!overlap(bounds(a),openingZone(project.room,o)))continue;
    warnings.push({moduleId:a.id,openingId:o.id,message:o.type==='door'
      ?`«${a.module.name}»: проверьте проход к двери ${index+1}. Корпус попадает в зону 900 мм перед проёмом.`
      :`«${a.module.name}»: корпус перекрывает окно ${index+1} у стены. Проверьте доступ к окну и подоконнику.`});
  }
  const clearance=ceilingClearance(project.room.ceiling);
  for(const a of project.modules){const gap=project.room.height-(a.y??0)-a.module.height;if(gap<clearance-.001)warnings.push({moduleId:a.id,kind:"ceiling",message:`«${a.module.name}»: до потолка ${Math.round(gap*10)/10} мм. По регламенту оставьте ${clearance} мм до ${project.room.ceiling==='stretch'?'натяжного':'стационарного'} потолка; проверьте светильники и выступы.`});}
  // «Ряд» импорта Базиса (столешница, цоколь, панели; m.worktop / raw.row) — не корпус в сборе. Кухни (параметрика m.kitchen и сырые
  // кухонные модули Базиса) — без «лифта»: ширины модулей заданы проектом Базиса, предупреждение было 100 % шумом (k30 4 из 4, k25 2 из 2;
  // аудит 11.10.2026). Шкафы студии и сырые шкафы Базиса (bazis-corpus) — как прежде; порог 900 — вопрос Макса (ярус B).
  // свободная панель (щит на стену, заказ 7437584) — плоская деталь, не корпус в сборе: без «лифта»
  for(const a of project.modules)if(a.module.width>900&&!a.module.worktop&&!a.module.kupe&&!a.module.raw?.row&&!a.module.kitchen&&!rawKitchen(a.module.raw)&&a.module.raw?.source!=='garderyob-free-panel')warnings.push({moduleId:a.id,kind:'logistics',message:`«${a.module.name}»: корпус шириной ${a.module.width} мм в сборе не во все лифты входит. Уточните лифт и подъём на этаж или разбейте на два корпуса.`});
  // контур: выход углов закрытого габарита за стены контура (приблизительно — габарит по осям; у повёрнутого корпуса с запасом)
  if(ol)for(const {a,b} of closed)for(const [edge,amount] of outsideOutline(ol,[{x:b.x,z:b.z},{x:b.x+b.w,z:b.z},{x:b.x+b.w,z:b.z+b.d},{x:b.x,z:b.z+b.d}]))if(amount>.1)
    warnings.push({moduleId:a.id,kind:`closed-wall-e${edge}`,message:`«${a.module.name}»: закрытая мебель выступает за плоскость стены ${edge+1} на ${Math.ceil(amount)} мм. Проверьте ручки и фасады; отодвиньте модуль от стены.`});
  if(!ol)for(const {a,b} of closed){
    const exits=[['левой',-b.x],['задней',-b.z],['правой',b.x+b.w-project.room.width],['передней',b.z+b.d-project.room.depth]] as const;
    for(const [wall,amount] of exits)if(amount>.1)warnings.push({moduleId:a.id,kind:`closed-wall-${wall}`,message:`«${a.module.name}»: закрытая мебель выступает за плоскость ${wall} стены на ${Math.ceil(amount)} мм. Проверьте ручки и фасады; отодвиньте модуль от стены.`});
  }
  for(const [i,f] of (project.room.fixtures||[]).entries()){
    const spec=FIXTURES[f.type],box=fixtureBox(project.room,f);
    // контур: зона объекта — от стены контура (с зазором wallGap) на выступ, плоские — на 40 мм; по высоте — сам объект
    if(ol){const e=openingEdge(project.room,f),gap=f.wallGap??0,d=spec.recess?0:Math.max(0,f.depth),z={pts:edgeZone(ol,e.edge,e.offset,e.offset+f.width,gap,gap+Math.max(d,spec.access||spec.recess?40:1)),y:f.fromFloor,h:f.height};
      for(const {a,b} of closed)if(hitsZone(b,z))warnings.push({moduleId:a.id,fixtureId:f.id,kind:'fixture-'+f.id,message:`«${a.module.name}» перекрывает «${fixtureLabel(f,i)}»: ${FIXTURE_ADVICE[f.type]??'проверьте по замеру'}.`});
      continue;}
    // Плоские объекты (розетка, лючок, ниша) считаем с зоной 40 мм от стены: корпус вплотную к стене их закрывает.
    const reach=Math.max(spec.access||spec.recess?40:1,box.w===0||box.d===0?1:0);
    const probe=f.wall==='back'?{...box,d:Math.max(box.d,reach)}:f.wall==='front'?{...box,z:project.room.depth-Math.max(box.d,reach),d:Math.max(box.d,reach)}:f.wall==='left'?{...box,w:Math.max(box.w,reach)}:{...box,x:project.room.width-Math.max(box.w,reach),w:Math.max(box.w,reach)};
    for(const {a,b} of closed)if(overlap(b,probe))warnings.push({moduleId:a.id,fixtureId:f.id,kind:'fixture-'+f.id,message:`«${a.module.name}» перекрывает «${fixtureLabel(f,i)}»: ${FIXTURE_ADVICE[f.type]??'проверьте по замеру'}.`});
  }
  for(const o of project.room.obstacles||[])for(const {a,b} of closed)if(overlap(b,obstacleBounds(o)))warnings.push({moduleId:a.id,obstacleId:o.id,kind:'obstacle-'+o.id,message:`«${a.module.name}» пересекается с объектом замера «${o.name}». Измените расстановку или уточните замер${o.type==='radiator'?'; отдельно проверьте доступ и теплоотвод':''}.`});
  if(project.measurement?.niche&&closed.length){
    const fit=nicheSize(project.measurement.niche,project.room.ceiling);
    for(const [axis,size,label,limit] of [['x','w','Ширина',fit.width],['z','d','Глубина',fit.depth],['y','h','Высота от пола',fit.height]] as const){
      const edge=closed.reduce((a,b)=>a.b[axis]+a.b[size]>=b.b[axis]+b.b[size]?a:b);
      const start=axis==='y'?0:Math.min(...closed.map(a=>a.b[axis]));
      const actual=edge.b[axis]+edge.b[size]-start;
      if(actual>limit+.1)warnings.push({moduleId:edge.a.id,kind:'niche-'+size,message:`Ниша: ${label.toLocaleLowerCase('ru')} мебели ${Math.round(actual*10)/10} мм превышает допустимые ${limit} мм после вычетов СТП. Проверьте состав композиции и замер. Учтены закрытые фасады, ручки и промежутки между корпусами.`});
    }
  }
  return [...warnings,...sinkChecks(project),...dishwasherServiceWarnings(project),...shapeWarnings(project),...drawerGapWarnings(project),...rodWarnings(project)];
}
/** Штанга без нормы места под одеждой — предупреждение, не ошибка (правка Макса 29.10: штангу ставить независимо от места под ней). */
export function rodWarnings(project:Project):RoomWarning[]{
  const out:RoomWarning[]=[];
  for(const a of project.modules)for(const message of rodClearanceWarnings(a.module))out.push({moduleId:a.id,kind:'rod-clearance',message:`«${a.module.name}»: ${message}`});
  return out;
}
/** Щель между фасадами ящиков секции больше зазора фасадов (критик 29.10, п.5: после правок высот оставалась щель 34 мм без
 *  предупреждения). Правки фасада/короба смыкают ящики сами (editDrawerConfig); здесь — разрыв, заданный положением ящика. */
export function drawerGapWarnings(project:Project):RoomWarning[]{
  const out:RoomWarning[]=[];
  for(const a of project.modules){const m=a.module;if(m.kitchen||m.raw||m.kupe||m.corner||!m.sections.some(s=>s.drawers>0))continue;let ps;try{ps=parts(m);}catch{continue;}
    m.sections.forEach((s,i)=>{if(s.drawers<1)return;
      const f=ps.filter(p=>p.sectionId===s.id&&/:drawer:\d+:facade$/.test(p.id)).map(p=>({j:Number(p.id.split(':drawer:')[1].split(':')[0]),lo:p.position[1]-p.size[1]/2,hi:p.position[1]+p.size[1]/2})).sort((x,y)=>x.lo-y.lo);
      const allow=Math.max(s.drawerGrip?RULES.drawerGrip:0,s.drawerGap??RULES.drawerFrontGap,RULES.drawerFrontGap)+1;
      // круг 2 критика 29.10: и у одного ящика — ящичный модуль (комод), ящики не до крыши, над ними сама встала полка: открытая ниша без
      // фасада над верхним ящиком (2 ящика, фасад полем, «−» → фасад 30…482,5 и ниша 515 мм без предупреждения). Полка, заданная явно, — замысел.
      const top=f.at(-1);if(top&&isDrawerModule(m)&&s.drawerCap===undefined&&hasDrawerCap(m,s)){const niche=facadeTop(m)-top.hi;if(niche>allow)out.push({moduleId:a.id,kind:`drawer-niche-${s.id}`,message:`«${m.name}»: секция ${i+1} — над ящиком ${top.j+1} открытая ниша ${Math.round(niche)} мм без фасада: ящики не до крыши, над ними встала полка. «Полка над ящиками» — «Нет»: фасады снова поровну до крыши; если ниша задумана — «Есть».`});}
      for(let k=1;k<f.length;k++){const gap=f[k].lo-f[k-1].hi;if(gap>allow)out.push({moduleId:a.id,kind:`drawer-gap-${s.id}-${k}`,message:`«${m.name}»: секция ${i+1} — между фасадами ящиков ${f[k-1].j+1} и ${f[k].j+1} щель ${Math.round(gap)} мм. Нажмите «Собрать ящики от дна» или задайте высоту фасада ящика ${f[k-1].j+1} больше на ${Math.round(gap-(s.drawerGap??RULES.faceGap))} мм.`});}
    });}
  return out;
}
/** Фигурные детали (shapes.ts, 29.10.2026): вырез задевает петлю/полкодержатель/крепёж; полка или штанга выше скоса мансарды;
 *  антресоль над мансардным шкафом (потолок скошен — не ставится). Предупреждения, не ошибки. */
export function shapeWarnings(project:Project):RoomWarning[]{
  const out:RoomWarning[]=[];
  for(const a of project.modules){const m=a.module;if(!m.cutouts?.length&&!m.mansard)continue;let ps;try{ps=parts(m);}catch{continue;}
    for(const message of [...cutoutWarnings(m,ps),...mansardWarnings(m,ps)])out.push({moduleId:a.id,kind:'shape',message:`«${m.name}»: ${message}`});
    if(m.mansard){const b=bounds(a),topY=(a.y??0)+m.height;
      for(const o of project.modules)if(o.id!==a.id&&(o.y??0)>=topY-2&&overlap({...bounds(o),y:0,h:1},{...b,y:0,h:1}))out.push({moduleId:o.id,kind:'mansard-upper',message:`«${o.module.name}» стоит над мансардным шкафом «${m.name}»: потолок там скошен назад — антресоль не ставится. Уберите её или сделайте шкаф выше без мансарды.`});}}
  return out;
}
/** Пересечения деталей внутри корпусов (петли, полки, царги, крепёж, фурнитура) — правило Макса 09.10.2026: ничего не должно пересекаться.
 *  Отдельно от roomWarnings (размещение в помещении); панель предупреждений студии показывает оба списка. */
const list=(xs:{name:string;gap:number}[])=>xs.slice(0,3).map(x=>`${x.name} (${Math.abs(x.gap)} мм)`).join("; ")+(xs.length>3?` и ещё ${xs.length-3}`:"");
/** Фурнитура сырого модуля дальше RAW_FAR от любой его детали — это не пересечение, а модель Базиса без детали-хозяина: статистика по 271
 *  шкафу и эталонам кухонь — у всех таких точек в САМОЙ модели Базиса (все панели, без отбора импорта) детали ближе 100 мм нет
 *  (194, 189: петли без дверей; 239: в модели 2 детали из корпуса навесного; 187, 207: подпятники в 165 мм под дном). Сведения
 *  «как в Базисе», не тревога (n4-wardrobes). Навесы кухонь над своей боковиной (k12…k31, до 985 мм) студия ставит на боковину
 *  (rawHangerSeats) — об этом тоже сведения.
 *  Параметрический модуль из Базиса повторяет положение фурнитуры как есть (сверка с Базисом) — навесы над корпусом (k26–k28, k31: +985,
 *  k12, k15) он не переставляет: фурнитура дальше BAZIS_AIR от его досок (collisions.ts bazisAirHardware) — те же сведения
 *  «как в проекте Базиса», что у сырого модуля (одна политика «висит в воздухе — не пересечение»; слияние n4-wardrobes и n4-antresol). */
export function bazisHostNotes(project:Project):RoomWarning[]{
  const out:RoomWarning[]=[];
  for(const a of project.modules){
    if(!a.module.raw){const far=bazisAirHardware(parts(a.module),a.module);
      if(far.length)out.push({moduleId:a.id,kind:"bazis-host",message:`«${a.module.name}»: фурнитура Базиса висит в воздухе дальше ${BAZIS_AIR} мм от деталей — ${list(far)}. Стоит по координатам проекта Базиса. Проверьте в проекте Базиса: нет детали, на которой она крепится.`});
      continue;}
    const r=rawCheck(parts(a.module),a.module,false);
    // навесы кухни, висевшие над своей боковиной (комплект Базиса со старыми координатами), поставлены на боковину — сказать об этом
    const raw=a.module.raw,seat=[...rawHangerSeats(raw)].filter(([i])=>raw.hardware[i].category==="навес");
    if(seat.length)out.push({moduleId:a.id,kind:"bazis-host",message:`«${a.module.name}»: навесы (${seat.length}) в файле Базиса висят над боковиной на ${[...new Set(seat.map(([,d])=>Math.round(-d)))].join(", ")} мм — комплект навесов со старыми координатами. Поставлены на свою боковину, ${RAW_HANGER_DROP} мм ниже её верха, как остальные навесы кухонь.`});
    if(r.far.length)out.push({moduleId:a.id,kind:"bazis-host",message:`«${a.module.name}»: фурнитура без детали в модели Базиса (дальше ${RAW_FAR} мм от деталей) — ${list(r.far)}. Не пересечение: в проекте Базиса нет детали, на которой она крепится.`});}
  return out;
}
/** Сообщение о торцевых ручках в зазоре между створками (B2): сколько мм зазора и сколько нужно, что сделать. */
export function edgePullMessage(name:string,pulls:EdgePullGap[]):string{
  const x=pulls[0],two=x.handles.length>1,wall=x.walls/x.handles.length,more=pulls.length>1?` (пар створок: ${pulls.length})`:"";
  const what=two?`торцевые ручки на сходящихся кромках соседних створок${more} стоят друг в друге: зазор между створками ${x.gap} мм, а у каждой ручки стенка ${wall} мм за кромкой`
    :`торцевая ручка у соседней створки${more} упирается в неё: зазор между створками ${x.gap} мм, а стенка ручки ${wall} мм за кромкой`;
  const fix=x.sameSection?`увеличьте «Зазор между створками» секции до ${x.need} мм${two?" или поставьте на одну из створок обычную (не торцевую) ручку":" или выберите обычную (не торцевую) ручку"}`
    :`смените сторону петель у ${two?"одной из створок":"створки с ручкой"} — торцевая ручка уйдёт на внешнюю кромку — или выберите обычную (не торцевую) ручку`;
  return `«${name}»: ${what} — нужен зазор не меньше ${x.need} мм (${two?`${wall} + ${wall}`:wall} + ${LEAF_GAP_MIN} мм). Что сделать: ${fix}.`;
}
export function collisionWarnings(project:Project):RoomWarning[]{
  const out:RoomWarning[]=[];
  // Сырой модуль — геометрия Базиса как есть (ХДФ в пазу, чашки петель, опоры в днище, Axis PRO): реестра контактов студии для неё нет,
  // совет «сдвиньте полку или петлю» к ней неприменим. Пересечение по политике rawCheck — только тело фурнитуры внутри корпусной панели
  // (186: фланец штанги развёрнут в стойку — так в Базисе). Фурнитура без детали в модели Базиса — не пересечение: bazisHostNotes.
  for(const a of project.modules){if(a.module.raw){const r=rawCheck(parts(a.module),a.module,false);
    if(r.deep.length)out.push({moduleId:a.id,kind:"collision",message:`«${a.module.name}»: фурнитура Базиса внутри детали — ${list(r.deep)}. Так стоит в проекте Базиса — исправить в Базисе.`});
    continue;}const ps=parts(a.module);
    // «висит в воздухе» у параметрического модуля из Базиса (навесы над корпусом, k26–k28, k31) — не пересечение: сведения
    // «как в проекте Базиса», как у сырого модуля (bazisHostNotes; слияние n4-wardrobes и n4-antresol). Пересечение крепежа с пазом,
    // которое есть в самом проекте Базиса (двойник отверстия, kitchen.grooveHoles), — с подписью (n4-antresol)
    // торцевые ручки в зазоре между створками (B2, релиз 22.10): понятная причина вместо «сдвиньте полку или петлю»;
    // пересечения ручка × ручка / ручка × соседняя створка этой пары она и объясняет — в общий список не идут
    const pulls=edgePullGaps(ps),pullIds=new Set(pulls.flatMap(x=>[...x.doors,...x.handles]));
    if(pulls.length)out.push({moduleId:a.id,kind:"collision",message:edgePullMessage(a.module.name,pulls)});
    const c=partCollisions(ps,a.module).filter(x=>!(pullIds.has(x.a)&&pullIds.has(x.b)));if(c.length)out.push({moduleId:a.id,kind:"collision",message:`«${a.module.name}»: пересекаются детали — ${c.slice(0,3).map(x=>`${x.names[0]} × ${x.names[1]} (${x.depth} мм${x.bazis?", как в проекте Базиса":""})`).join("; ")}${c.length>3?` и ещё ${c.length-3}`:""}. ${c.every(x=>x.bazis)?"Так в самом проекте Базиса: отверстие крепежа вскрывает паз — исправляется в Базисе.":"Сдвиньте полку или петлю, измените наполнение."}`});}
  return out;
}
