import type {Project} from './project';
import {estimate} from './pricing';
/** A draft may be editable even when its manufacturing estimate is unavailable. */
export function previewPrice(project:Project):number|null {
 if(!project.modules.length)return 0;
 try{return estimate(project).retail;}catch{return null;}
}
