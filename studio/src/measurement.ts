// Зазор до потолка: стационарный 30 мм, натяжной 20 мм (Перечень для передачи в производство; регламент по ФП).
export const MEASUREMENT_RULES={ceilingClearance:30,stretchCeilingClearance:20} as const;
export type CeilingType='stationary'|'stretch';
export function ceilingClearance(type?:CeilingType){return type==='stretch'?MEASUREMENT_RULES.stretchCeilingClearance:MEASUREMENT_RULES.ceilingClearance;}
export type Niche={width:number;height:number;depth:number;deviation:number};
export function nicheSize(n:Niche,ceiling?:CeilingType){const side=n.deviation>=10?15:10;return {width:n.width-side,height:n.height-ceilingClearance(ceiling),depth:n.depth-5,side};}
