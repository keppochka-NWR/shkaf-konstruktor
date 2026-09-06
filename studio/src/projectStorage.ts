import {parseProject,type Project} from './project';
export const PREVIOUS_PROJECT='module-studio-previous-project-v1';
export function backupProject(project:Project){
  try{localStorage.setItem(PREVIOUS_PROJECT,JSON.stringify(project));}
  catch{throw Error('Не удалось сохранить резервную копию. Скачайте текущий проект файлом и освободите место в браузере.');}
}
// Compare normalized documents regardless of object key order or server link metadata.
export function projectContent(project:Project){
  const {cloud:_,...data}=parseProject(project);
  function sorted(value:any):any{return Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;}
  return JSON.stringify(sorted(data));
}


export const CURRENT_PROJECT='module-studio-v3';
export const DAMAGED_PROJECT='module-studio-damaged-project-v1';
export class ProjectStorageConflict extends Error {constructor(){super('В другой вкладке сохранён новый вариант проекта. Текущие правки остались в этом окне: скачайте их отдельным файлом перед перезагрузкой.');}}
export function persistProject(storage:Pick<Storage,'getItem'|'setItem'>,project:Project,damaged?:string,expected?:string|null){
 if(expected!==undefined&&storage.getItem(CURRENT_PROJECT)!==expected)throw new ProjectStorageConflict();
 if(damaged!==undefined){const previous=storage.getItem(DAMAGED_PROJECT);if(previous!==damaged){if(previous!==null)storage.setItem(DAMAGED_PROJECT+'-'+crypto.randomUUID(),previous);storage.setItem(DAMAGED_PROJECT,damaged);}}
 const serialized=JSON.stringify(project);storage.setItem(CURRENT_PROJECT,serialized);return serialized;
}
