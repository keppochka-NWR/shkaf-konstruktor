import {applyFacadeAppearance} from './facadeAppearance';
import type {Project} from './project';
/** One appearance mechanism for the editor and all-module shortcut. */
export function applyFacadeStyle(project:Project,sourceId:string):Project {
 const source=project.modules.find(a=>a.id===sourceId)?.module;
 if(!source)throw Error('Выберите редактируемый корпус с фасадами.');
 return applyFacadeAppearance(project,sourceId,source,true);
}
