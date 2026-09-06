import {parseModule,type Module} from './model';
import {parseProject,mountingCompositionBounds,type PlacedModule} from './project';
export type LibraryEntry={id:string;name:string;module:Module;group?:PlacedModule[]};
export function parseLibraryFile(raw:unknown):LibraryEntry[]{
 const x=raw as any;if(x?.format!=='module-library'||![1,2].includes(x.version)||!Array.isArray(x.items)||x.items.length>30)throw Error('Нужен файл библиотеки модулей, до 30 шаблонов.');
 return x.items.map((a:any)=>{if(typeof a?.name!=='string'||!a.name.trim()||a.name.length>80)throw Error('Проверьте названия шаблонов.');return {id:crypto.randomUUID(),name:a.name.trim(),...entryContent(a,x.version===2)};});
}
export function libraryFile(items:LibraryEntry[]){return JSON.stringify({format:'module-library',version:items.some(a=>a.group)?2:1,items:items.map(({name,module,group})=>({name,module,...(group?{group}: {})}))},null,2);}


export function inspectStoredLibrary(text:string|null):{items:LibraryEntry[];problem:string} {
 if(text===null)return {items:[],problem:''};
 let raw:unknown;try{raw=JSON.parse(text);}catch{return {items:[],problem:'Не удалось прочитать сохранённую библиотеку. Исходная запись сохранена без изменений.'};}
 if(!Array.isArray(raw))return {items:[],problem:'Сохранённая библиотека имеет неизвестный формат. Исходная запись сохранена без изменений.'};
 const items:LibraryEntry[]=[],ids=new Set<string>();let rejected=0;
 for(const a of raw){try{
  if(items.length>=30||typeof a?.id!=='string'||!a.id||ids.has(a.id)||typeof a.name!=='string'||!a.name.trim()||a.name.length>80)throw Error();
  const content=entryContent(a,true);items.push({id:a.id,name:a.name,...content});ids.add(a.id);
 }catch{rejected++;}}
 return {items,problem:rejected?`Не удалось загрузить записей: ${rejected}. Доступно шаблонов: ${items.length}. Исходная библиотека не перезаписана.`:''};
}


export const LIBRARY_KEY='module-studio-library-v1';
export function recoverStoredLibrary(storage:Pick<Storage,'getItem'|'setItem'>,original:string,items:LibraryEntry[]){
 if(storage.getItem(LIBRARY_KEY)!==original)throw Error('Библиотека изменилась в другом окне. Закройте и откройте библиотеку перед восстановлением.');
 const backupKey=LIBRARY_KEY+'-backup-'+crypto.randomUUID();
 storage.setItem(backupKey,original);
 storage.setItem(LIBRARY_KEY,JSON.stringify(items));
 return backupKey;
}


/** Templates preserve relative placement but do not carry the source room or customer. */
export function templateGroup(raw:unknown):PlacedModule[]{
 if(!Array.isArray(raw)||!raw.length||raw.length>40)throw Error('В группе должно быть от 1 до 40 корпусов.');
 const p=parseProject({version:3,room:{width:20000,depth:20000,height:20000},modules:raw});
 const b=mountingCompositionBounds(p);
 return p.modules.map(a=>({...a,x:a.x-b.x,y:(a.y??0)-b.y,z:a.z-b.z}));
}
function entryContent(a:any,allowGroup:boolean):Pick<LibraryEntry,'module'|'group'>{
 if(a.group!==undefined){
  if(!allowGroup)throw Error('Для групп нужен файл библиотеки версии 2.');
  const group=templateGroup(a.group);return {module:group[0].module,group};
 }
 return {module:parseModule(a.module)};
}


/** Call while holding the same-origin library lock when available. */
export function writeStoredLibrary(storage:Pick<Storage,'getItem'|'setItem'>,expected:string|null,items:LibraryEntry[]):string{
 if(storage.getItem(LIBRARY_KEY)!==expected)throw Error('Библиотека изменилась в другом окне. Изменение не записано. Закройте и снова откройте библиотеку, затем повторите действие.');
 const raw=JSON.stringify(items);storage.setItem(LIBRARY_KEY,raw);return raw;
}
