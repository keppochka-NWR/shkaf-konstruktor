// Решение Макса 14.10.2026: помещение с коммуникациями → построение мебели → документы.
// Каждый этап показывает только свои панели и подсвечен своим цветом; «Все настройки» снимает фильтр.
export type Stage = "room" | "fixtures" | "bodies" | "filling" | "facades" | "docs";
/** Legacy ids remain accepted by context-menu commands and saved preferences. */
export const normalizeStage=(s:Stage):Stage=>s==='fixtures'?'room':s==='filling'||s==='facades'?'bodies':s;
export const STAGES: { id: Stage; n: number; title: string; short: string; color: string; hint: string }[] = [
 {id:'room',n:1,title:'Помещение',short:'Помещение',color:'#1b697a',hint:'Габариты помещения, проёмы и коммуникации — справа.'},
 {id:'bodies',n:2,title:'Построение мебели',short:'Мебель',color:'#325bee',hint:'Слева добавляйте модули. Справа раскрывайте нужный раздел выбранного модуля: наполнение, фасады и фурнитура.'},
 {id:'docs',n:3,title:'Документы',short:'Документы',color:'#55606a',hint:'Смета, карты листов, ведомость и коммерческое предложение.'},
];
export const stageIndex=(s:Stage)=>Math.max(0,STAGES.findIndex(x=>x.id===normalizeStage(s)));
export const nextStage=(s:Stage)=>STAGES[Math.min(STAGES.length-1,stageIndex(s)+1)].id;
export const prevStage=(s:Stage)=>STAGES[Math.max(0,stageIndex(s)-1)].id;
export const STAGE_KEY = "studio-stage";
