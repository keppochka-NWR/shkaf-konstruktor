import type {Room,Opening} from './project';
export type WallPanel={wall:Opening['wall'];u:number;y:number;width:number;height:number};
/** Rectangular subdivision gives actual empty openings, even with several windows. */
export function wallPanels(room:Room):WallPanel[]{
  const result:WallPanel[]=[];
  for(const wall of ['back','left','right','front'] as const){
    const length=wall==='back'||wall==='front'?room.width:room.depth,os=(room.openings||[]).filter(o=>o.wall===wall);
    const xs=[...new Set([0,length,...os.flatMap(o=>[o.offset,o.offset+o.width])])].sort((a,b)=>a-b);
    const ys=[...new Set([0,room.height,...os.flatMap(o=>[o.sill,o.sill+o.height])])].sort((a,b)=>a-b);
    for(let x=1;x<xs.length;x++)for(let y=1;y<ys.length;y++){
      const u=(xs[x-1]+xs[x])/2,v=(ys[y-1]+ys[y])/2;
      if(!os.some(o=>u>o.offset&&u<o.offset+o.width&&v>o.sill&&v<o.sill+o.height))result.push({wall,u,y:v,width:xs[x]-xs[x-1],height:ys[y]-ys[y-1]});
    }
  }
  return result;
}
