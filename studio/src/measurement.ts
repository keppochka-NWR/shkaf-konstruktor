// Зазор до потолка: стационарный 30 мм, натяжной 20 мм (Перечень для передачи в производство; регламент по ФП).
export const MEASUREMENT_RULES={ceilingClearance:30,stretchCeilingClearance:20} as const;
export type CeilingType='stationary'|'stretch';
export function ceilingClearance(type?:CeilingType){return type==='stretch'?MEASUREMENT_RULES.stretchCeilingClearance:MEASUREMENT_RULES.ceilingClearance;}
export type MeasureAxis='width'|'height'|'depth';
export type Niche={width:number;height:number;depth:number;deviation:number;readings?:Partial<Record<MeasureAxis,number[]>>};
export function nicheMinimum(n:Niche,axis:MeasureAxis){const values=n.readings?.[axis];return values?.length?Math.min(...values):n[axis];}
export function parseReadings(text:string):number[]{
 if(!text.trim())return [];
 const values=text.trim().split(/[;\s]+/).map(v=>Number(v.replace(',','.')));
 if(values.length>20||values.some(v=>!Number.isFinite(v)||v<500||v>20000))throw Error('Введите до 20 размеров от 500 до 20000 мм, через пробел или точку с запятой.');
 return values;
}
export function nicheSize(n:Niche,ceiling?:CeilingType){const side=n.deviation>=10?15:10;return {width:nicheMinimum(n,'width')-side,height:nicheMinimum(n,'height')-ceilingClearance(ceiling),depth:nicheMinimum(n,'depth')-5,side};}
