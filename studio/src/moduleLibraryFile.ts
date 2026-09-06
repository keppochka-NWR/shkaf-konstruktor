import {parseModule,type Module} from './model';
export type LibraryEntry={id:string;name:string;module:Module};
export function parseLibraryFile(raw:unknown):LibraryEntry[]{
 const x=raw as any;if(x?.format!=='module-library'||x.version!==1||!Array.isArray(x.items)||x.items.length>30)throw Error('Нужен файл библиотеки модулей, до 30 шаблонов.');
 return x.items.map((a:any)=>{if(typeof a?.name!=='string'||!a.name.trim()||a.name.length>80)throw Error('Проверьте названия шаблонов.');return {id:crypto.randomUUID(),name:a.name.trim(),module:parseModule(a.module)};});
}
export function libraryFile(items:LibraryEntry[]){return JSON.stringify({format:'module-library',version:1,items:items.map(({name,module})=>({name,module}))},null,2);}
