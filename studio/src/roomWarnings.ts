import {ceilingClearance,nicheSize} from './measurement';
import {obstacleBounds,bounds,closedModuleBounds,overlap,type Opening,type Project,type Room} from './project';
import {FIXTURES,fixtureBox,fixtureLabel} from './fixtures';
import {parts} from './model';
import {partCollisions,rawCheck,RAW_FAR} from './collisions';

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
  const horizontal=o.wall==='back'||o.wall==='front';
  const reach=Math.min(o.type==='door'?900:100,horizontal?room.depth:room.width);
  return {x:horizontal?o.offset:o.wall==='left'?0:room.width-reach,
    z:horizontal?(o.wall==='back'?0:room.depth-reach):o.offset,
    y:o.sill,w:horizontal?o.width:reach,d:horizontal?reach:o.width,h:o.height};
}
export function roomWarnings(project:Project){
  const closed=project.modules.map(a=>({a,b:closedModuleBounds(a)}));
  const warnings:RoomWarning[]=[];
  for(const [index,o] of (project.room.openings||[]).entries())for(const a of project.modules){
    if(!overlap(bounds(a),openingZone(project.room,o)))continue;
    warnings.push({moduleId:a.id,openingId:o.id,message:o.type==='door'
      ?`«${a.module.name}»: проверьте проход к двери ${index+1}. Корпус попадает в зону 900 мм перед проёмом.`
      :`«${a.module.name}»: корпус перекрывает окно ${index+1} у стены. Проверьте доступ к окну и подоконнику.`});
  }
  const clearance=ceilingClearance(project.room.ceiling);
  for(const a of project.modules){const gap=project.room.height-(a.y??0)-a.module.height;if(gap<clearance-.001)warnings.push({moduleId:a.id,kind:"ceiling",message:`«${a.module.name}»: до потолка ${Math.round(gap*10)/10} мм. По регламенту оставьте ${clearance} мм до ${project.room.ceiling==='stretch'?'натяжного':'стационарного'} потолка; проверьте светильники и выступы.`});}
  // «Ряд» импорта Базиса (столешница, цоколь, панели) — не корпус в сборе
  for(const a of project.modules)if(a.module.width>900&&!a.module.kupe&&!a.module.raw?.row)warnings.push({moduleId:a.id,kind:'logistics',message:`«${a.module.name}»: корпус шириной ${a.module.width} мм в сборе не во все лифты входит. Уточните лифт и подъём на этаж или разбейте на два корпуса.`});
  for(const {a,b} of closed){
    const exits=[['левой',-b.x],['задней',-b.z],['правой',b.x+b.w-project.room.width],['передней',b.z+b.d-project.room.depth]] as const;
    for(const [wall,amount] of exits)if(amount>.1)warnings.push({moduleId:a.id,kind:`closed-wall-${wall}`,message:`«${a.module.name}»: закрытая мебель выступает за плоскость ${wall} стены на ${Math.ceil(amount)} мм. Проверьте ручки и фасады; отодвиньте модуль от стены.`});
  }
  for(const [i,f] of (project.room.fixtures||[]).entries()){
    const spec=FIXTURES[f.type],box=fixtureBox(project.room,f);
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
  return warnings;
}
/** Пересечения деталей внутри корпусов (петли, полки, царги, крепёж, фурнитура) — правило Макса 09.10.2026: ничего не должно пересекаться.
 *  Отдельно от roomWarnings (размещение в помещении); панель предупреждений студии показывает оба списка. */
const list=(xs:{name:string;gap:number}[])=>xs.slice(0,3).map(x=>`${x.name} (${Math.abs(x.gap)} мм)`).join("; ")+(xs.length>3?` и ещё ${xs.length-3}`:"");
/** Фурнитура сырого модуля дальше RAW_FAR от любой его детали — это не пересечение, а модель Базиса без детали-хозяина: статистика по 271
 *  шкафу и эталонам кухонь — у всех таких точек в САМОЙ модели Базиса (все панели, без отбора импорта) детали ближе 100 мм нет
 *  (194, 189: петли без дверей; 239: в модели 2 детали из корпуса навесного; 187, 207: подпятники в 165 мм под дном; кухни k12…k31:
 *  навесы в 985 мм над антресолью — высоту модуля уменьшили, навесы остались). Сведения «как в Базисе», не тревога (n4-wardrobes). */
export function bazisHostNotes(project:Project):RoomWarning[]{
  const out:RoomWarning[]=[];
  for(const a of project.modules){if(!a.module.raw)continue;const r=rawCheck(parts(a.module),a.module,false);
    if(r.far.length)out.push({moduleId:a.id,kind:"bazis-host",message:`«${a.module.name}»: фурнитура без детали в модели Базиса (дальше ${RAW_FAR} мм от деталей) — ${list(r.far)}. Не пересечение: в проекте Базиса нет детали, на которой она крепится.`});}
  return out;
}
export function collisionWarnings(project:Project):RoomWarning[]{
  const out:RoomWarning[]=[];
  // Сырой модуль — геометрия Базиса как есть (ХДФ в пазу, чашки петель, опоры в днище, Axis PRO): реестра контактов студии для неё нет,
  // совет «сдвиньте полку или петлю» к ней неприменим. Пересечение по политике rawCheck — только тело фурнитуры внутри корпусной панели
  // (186: фланец штанги развёрнут в стойку — так в Базисе). Фурнитура без детали в модели Базиса — не пересечение: bazisHostNotes.
  for(const a of project.modules){if(a.module.raw){const r=rawCheck(parts(a.module),a.module,false);
    if(r.deep.length)out.push({moduleId:a.id,kind:"collision",message:`«${a.module.name}»: фурнитура Базиса внутри детали — ${list(r.deep)}. Так стоит в проекте Базиса — исправить в Базисе.`});
    continue;}const c=partCollisions(parts(a.module),a.module);if(c.length)out.push({moduleId:a.id,kind:"collision",message:`«${a.module.name}»: пересекаются детали — ${c.slice(0,3).map(x=>`${x.names[0]} × ${x.names[1]} (${x.depth} мм)`).join("; ")}${c.length>3?` и ещё ${c.length-3}`:""}. Сдвиньте полку или петлю, измените наполнение.`});}
  return out;
}
