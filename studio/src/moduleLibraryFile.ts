import {parseModule,type Module} from './model';
export type LibraryEntry={id:string;name:string;module:Module};
export function parseLibraryFile(raw:unknown):LibraryEntry[]{
 const x=raw as any;if(x?.format!=='module-library'||x.version!==1||!Array.isArray(x.items)||x.items.length>30)throw Error('Нужен файл библиотеки модулей, до 30 шаблонов.');
 return x.items.map((a:any)=>{if(typeof a?.name!=='string'||!a.name.trim()||a.name.length>80)throw Error('Проверьте названия шаблонов.');return {id:crypto.randomUUID(),name:a.name.trim(),module:parseModule(a.module)};});
}
export function libraryFile(items:LibraryEntry[]){return JSON.stringify({format:'module-library',version:1,items:items.map(({name,module})=>({name,module}))},null,2);}


export function inspectStoredLibrary(text:string|null):{items:LibraryEntry[];problem:string} {
 if(text===null)return {items:[],problem:''};
 let raw:unknown;try{raw=JSON.parse(text);}catch{return {items:[],problem:'Не удалось прочитать сохранённую библиотеку. Исходная запись сохранена без изменений.'};}
 if(!Array.isArray(raw))return {items:[],problem:'Сохранённая библиотека имеет неизвестный формат. Исходная запись сохранена без изменений.'};
 const items:LibraryEntry[]=[],ids=new Set<string>();let rejected=0;
 for(const a of raw){try{
  if(items.length>=30||typeof a?.id!=='string'||!a.id||ids.has(a.id)||typeof a.name!=='string'||!a.name.trim()||a.name.length>80)throw Error();
  const module=parseModule(a.module);items.push({id:a.id,name:a.name,module});ids.add(a.id);
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
