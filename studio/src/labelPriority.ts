// Порядок раскладки подписей сцены (Scene.tsx: налезающие сдвигаются, на которые места нет — прячутся).
// Макс 29.10.2026: «как быстро понять высоту левого модуля» — у открытого стеллажа на виде спереди видны были проёмы полок,
// а общая высота пряталась. Общие высота и ширина выбранного модуля ставятся сразу после ручек растяжения и плашек зазоров
// (их места фиксированы), раньше подписей проёмов, и не прячутся никогда.
export const isOverallDim=(dim:string|undefined)=>dim==='height'||dim==='width'||dim==='column';
export function labelRank(l:{fixed?:boolean;rowGap?:boolean;gap?:boolean;overall?:boolean}):number{
  if(l.fixed)return -2;
  if(l.rowGap)return -1;
  if(l.overall)return -0.5;
  return l.gap?1:0;
}
