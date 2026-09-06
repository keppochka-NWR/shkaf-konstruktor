/** rot — деталь без направления текстуры (ЛХДФ, однотонный декор без рисунка): её можно класть поперёк листа. */
export type Rectangle={id:string;w:number;h:number;rot?:boolean};
type Free={x:number;y:number;w:number;h:number};
export type Packed={id:string;x:number;y:number;w:number;h:number};
type Bin={items:Packed[];free:Free[]};
const contains=(a:Free,b:Free)=>a.x<=b.x&&a.y<=b.y&&a.x+a.w>=b.x+b.w&&a.y+a.h>=b.y+b.h;
/** Fixed grain direction (except rot). Inflated rectangles reserve the tool gap without charging it at the sheet edge. */
export function packRectangles(input:Rectangle[],width:number,height:number,gap:number,order:'area'|'height'|'width',fit:'short'|'area'):Packed[][]{
  if(![width,height,gap].every(Number.isFinite)||width<=0||height<=0||gap<0)throw Error('Неверный формат листа.');
  if(new Set(input.map(r=>r.id)).size!==input.length)throw Error('Повторяются детали.');
  for(const r of input)if(![r.w,r.h].every(Number.isFinite)||r.w<=0||r.h<=0||((r.w>width||r.h>height)&&!(r.rot&&r.h<=width&&r.w<=height)))throw Error('Деталь не помещается в лист.');
  const sorted=[...input].sort((a,b)=>(order==='area'?b.w*b.h-a.w*a.h:order==='height'?b.h-a.h:b.w-a.w)||b.w*b.h-a.w*a.h||a.id.localeCompare(b.id));
  const bins:Bin[]=[];
  for(const r of sorted){
    const variants:[number,number][]=[];
    if(r.w<=width&&r.h<=height)variants.push([r.w,r.h]);
    if(r.rot&&r.w!==r.h&&r.h<=width&&r.w<=height)variants.push([r.h,r.w]);
    let best:{bin:Bin;box:Free;score:number;secondary:number;w:number;h:number}|undefined;
    for(const [vw,vh] of variants){
      const rw=vw+gap,rh=vh+gap;
      for(const bin of bins)for(const f of bin.free){
        if(f.w<rw||f.h<rh)continue;
        const short=Math.min(f.w-rw,f.h-rh),area=f.w*f.h-rw*rh,score=fit==='short'?short:area,secondary=fit==='short'?area:short;
        if(!best||score<best.score||(score===best.score&&secondary<best.secondary))best={bin,box:f,score,secondary,w:vw,h:vh};
      }
    }
    if(!best){const bin:Bin={items:[],free:[{x:0,y:0,w:width+gap,h:height+gap}]};bins.push(bin);const [vw,vh]=variants[0];best={bin,box:bin.free[0],score:0,secondary:0,w:vw,h:vh};}
    const {bin,box}=best,used={x:box.x,y:box.y,w:best.w+gap,h:best.h+gap};
    bin.items.push({id:r.id,w:best.w,h:best.h,x:used.x,y:used.y});
    const next:Free[]=[];
    for(const f of bin.free){
      if(used.x>=f.x+f.w||used.x+used.w<=f.x||used.y>=f.y+f.h||used.y+used.h<=f.y){next.push(f);continue;}
      if(used.x>f.x)next.push({x:f.x,y:f.y,w:used.x-f.x,h:f.h});
      if(used.x+used.w<f.x+f.w)next.push({x:used.x+used.w,y:f.y,w:f.x+f.w-used.x-used.w,h:f.h});
      if(used.y>f.y)next.push({x:f.x,y:f.y,w:f.w,h:used.y-f.y});
      if(used.y+used.h<f.y+f.h)next.push({x:f.x,y:used.y+used.h,w:f.w,h:f.y+f.h-used.y-used.h});
    }
    bin.free=next.filter((f,i)=>f.w>0&&f.h>0&&!next.some((other,j)=>j!==i&&contains(other,f)&&(!contains(f,other)||j<i)));
  }
  return bins.map(b=>b.items);
}
