export type StudioUser = {email:string;login:string;name:string;role:'manager'|'admin';active:boolean};

export async function studioApi(path:string,body?:unknown){
  const r=await fetch('/api/studio'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','x-studio-request':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let data;
  try{data=await r.json();}catch{throw Error('Сервер кабинета недоступен. Запустите студию с сервером.');}
  if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:'Проверьте введённые данные.');
  return data;
}
