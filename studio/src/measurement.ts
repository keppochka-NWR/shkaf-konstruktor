export const MEASUREMENT_RULES={ceilingClearance:30} as const;
export type Niche={width:number;height:number;depth:number;deviation:number};
export function nicheSize(n:Niche){const side=n.deviation>=10?15:10;return {width:n.width-side,height:n.height-MEASUREMENT_RULES.ceilingClearance,depth:n.depth-5,side};}
