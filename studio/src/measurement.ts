export type Niche={width:number;height:number;depth:number;deviation:number};
export function nicheSize(n:Niche){const side=n.deviation>=10?15:10;return {width:n.width-side,height:n.height-30,depth:n.depth-5,side};}
