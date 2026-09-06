import {roomWarnings,type RoomWarning} from './roomWarnings';
import type {Project} from './project';
export function RoomWarnings({project,select}:{project:Project;select:(warning:RoomWarning)=>void}){
  const warnings=roomWarnings(project);
  if(!warnings.length)return null;
  return <div className="room-warnings"><h3>Проверьте расстановку</h3>{warnings.map(w=><button key={w.moduleId+(w.openingId??w.kind??':room')} onClick={()=>select(w)}>{w.message}</button>)}<p>Подсказки не запрещают расстановку. У двери отмечена условная зона подхода 900 мм, у окна — 100 мм от стены. Направление открывания и тепловые зазоры не рассчитываются; радиаторы задаются объектами замера.</p></div>;
}
