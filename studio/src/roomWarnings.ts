import {MEASUREMENT_RULES,nicheSize} from './measurement';
import {obstacleBounds,bounds,closedModuleBounds,overlap,type Opening,type Project,type Room} from './project';

export type RoomWarning={moduleId:string;openingId?:string;obstacleId?:string;kind?:string;message:string};

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
  for(const a of project.modules){const gap=project.room.height-(a.y??0)-a.module.height;if(gap<MEASUREMENT_RULES.ceilingClearance-.001)warnings.push({moduleId:a.id,kind:"ceiling",message:`«${a.module.name}»: до потолка ${Math.round(gap*10)/10} мм. По СТП оставьте ${MEASUREMENT_RULES.ceilingClearance} мм от нижней точки потолка; проверьте светильники и выступы.`});}
  for(const {a,b} of closed){
    const exits=[['левой',-b.x],['задней',-b.z],['правой',b.x+b.w-project.room.width],['передней',b.z+b.d-project.room.depth]] as const;
    for(const [wall,amount] of exits)if(amount>.1)warnings.push({moduleId:a.id,kind:`closed-wall-${wall}`,message:`«${a.module.name}»: закрытая мебель выступает за плоскость ${wall} стены на ${Math.ceil(amount)} мм. Проверьте ручки и фасады; отодвиньте модуль от стены.`});
  }
  for(const o of project.room.obstacles||[])for(const {a,b} of closed)if(overlap(b,obstacleBounds(o)))warnings.push({moduleId:a.id,obstacleId:o.id,kind:'obstacle-'+o.id,message:`«${a.module.name}» пересекается с объектом замера «${o.name}». Измените расстановку или уточните замер${o.type==='radiator'?'; отдельно проверьте доступ и теплоотвод':''}.`});
  if(project.measurement?.niche&&closed.length){
    const fit=nicheSize(project.measurement.niche);
    for(const [axis,size,label,limit] of [['x','w','Ширина',fit.width],['z','d','Глубина',fit.depth],['y','h','Высота от пола',fit.height]] as const){
      const edge=closed.reduce((a,b)=>a.b[axis]+a.b[size]>=b.b[axis]+b.b[size]?a:b);
      const start=axis==='y'?0:Math.min(...closed.map(a=>a.b[axis]));
      const actual=edge.b[axis]+edge.b[size]-start;
      if(actual>limit+.1)warnings.push({moduleId:edge.a.id,kind:'niche-'+size,message:`Ниша: ${label.toLocaleLowerCase('ru')} мебели ${Math.round(actual*10)/10} мм превышает допустимые ${limit} мм после вычетов СТП. Проверьте состав композиции и замер. Учтены закрытые фасады, ручки и промежутки между корпусами.`});
    }
  }
  return warnings;
}
