import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ClientWorkspace } from "./ClientWorkspace";
import VotanStudio from './VotanStudio';
import {cornerProject,CORNER_DEFAULT,CORNER_STORAGE} from './cornerWardrobe';
import {parseProject} from './project';
import "./style.css";
import "./studio-refresh.css";
import "./layout-fixes.css";
async function start(){
  const query=new URLSearchParams(location.search),slug=query.get('project');
  let initialProject;
  if(slug){
    if(!/^[a-z0-9-]{1,64}$/.test(slug))throw Error('Некорректная ссылка на локальный проект.');
    const response=await fetch(`./local-projects/${slug}.json`);
    if(!response.ok)throw Error('Не найден локальный файл проекта.');
    const raw=await response.text();if(raw.length>2000000)throw Error('Файл проекта слишком большой.');
    initialProject=parseProject(JSON.parse(raw));
  }
  if(query.get('order')==='corner'&&!initialProject){
    try{const stored=localStorage.getItem(CORNER_STORAGE);initialProject=cornerProject(stored?JSON.parse(stored):CORNER_DEFAULT);}catch{initialProject=cornerProject(CORNER_DEFAULT);}
  }
  createRoot(document.getElementById('root')!).render(<React.StrictMode>{query.get('order')==='votan'?<VotanStudio/>:initialProject||slug?<App initialProject={initialProject} projectKey={slug??(query.get('order')==='corner'?'corner-workspace':undefined)}/>:<ClientWorkspace/>}</React.StrictMode>);
}
start().catch(error=>{document.getElementById('root')!.textContent='Не удалось открыть проект: '+String(error.message);});
