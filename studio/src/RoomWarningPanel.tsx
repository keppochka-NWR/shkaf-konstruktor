import {roomWarnings,collisionWarnings,bazisHostNotes,type RoomWarning} from './roomWarnings';
import type {Project} from './project';
export function RoomWarnings({project,select}:{project:Project;select:(warning:RoomWarning)=>void}){
  const warnings=roomWarnings(project),collisions=collisionWarnings(project),bazis=bazisHostNotes(project);
  if(!warnings.length&&!collisions.length&&!bazis.length)return null;
  return <div className="room-warnings">
    {collisions.length>0&&<><h3>Пересечения деталей</h3>{collisions.map(w=><button key={w.moduleId+':collision'} onClick={()=>select(w)}>{w.message}</button>)}</>}
    {/* сырой модуль Базиса: фурнитура без детали-хозяина в самой модели — не пересечение, сведения (n4-wardrobes) */}
    {bazis.length>0&&<><h3>Как в проекте Базиса</h3>{bazis.map(w=><button key={w.moduleId+':bazis-host'} onClick={()=>select(w)}>{w.message}</button>)}</>}
    {warnings.length>0&&<><h3>Проверьте расстановку</h3>{warnings.map(w=><button key={w.moduleId+(w.openingId??w.kind??':room')} onClick={()=>select(w)}>{w.message}</button>)}<p>Подсказки не запрещают расстановку. У двери отмечена условная зона подхода 900 мм, у окна — 100 мм от стены. Направление открывания и тепловые зазоры не рассчитываются; радиаторы задаются объектами замера.</p></>}
  </div>;
}
