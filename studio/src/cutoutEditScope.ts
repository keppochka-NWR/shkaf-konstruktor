import type {Project} from './project';
/** Cutout repair must not trigger placement changes to unrelated cabinets. */
export function onlyCutoutOrRailEdit(before:Project,after:Project):boolean {
 const normalize=(p:Project)=>JSON.stringify({...p,modules:p.modules.map(a=>({...a,module:{...a.module,rails:undefined,...(a.module.worktop?{worktop:{...a.module.worktop,cutouts:[]}}:{})}}))});
 return normalize(before)===normalize(after);
}
