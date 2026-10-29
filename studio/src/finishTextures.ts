// Процедурные текстуры отделки помещения (roomFinishes.ts): рисуются на canvas по цвету и рисунку позиции каталога,
// раппорт — в настоящих миллиметрах (finishUnit), поэтому доска, плитка и рулон на сцене своего размера.
// Фото товаров Лемана ПРО не используются (права) — вид условный, точный — по ссылке на товар.
import {finishUnit,texturePxPerMm,type FinishItem,type FinishUnit,type Rect} from './roomFinishes';
/** Предел стороны текстуры отделки на сцене, px (критик 29.10: 2048² у ёлочки — 21 МБ видеопамяти; 1024 хватает). */
export const FINISH_TEXTURE_PX=1024;

function rng(seed:number){let a=seed>>>0||1;return ()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function hash(s:string){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function rgb(hex:string):[number,number,number]{const n=Number.parseInt(hex.slice(1),16);return [n>>16&255,n>>8&255,n&255];}
/** Цвет со сдвигом яркости k (−1…1) и прозрачностью. */
function shade(hex:string,k:number,alpha=1){const c=rgb(hex).map(v=>Math.max(0,Math.min(255,Math.round(k>=0?v+(255-v)*k:v*(1+k)))));return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;}
function mix(a:string,b:string,t:number){const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}

/** Пятна (камень, бетон, штукатурка): полупрозрачные круги с мягким краем, с переносом через края раппорта. */
function blotches(g:CanvasRenderingContext2D,w:number,h:number,r:()=>number,color:string,count:number,size:number,alpha:number,wrap=true){
  for(let i=0;i<count;i++){
    const x=r()*w,y=r()*h,rad=size*(0.3+r()),c=r()<0.5?shade(color,-0.12-r()*0.1,alpha):shade(color,0.1+r()*0.1,alpha);
    for(const dx of wrap?[-w,0,w]:[0])for(const dy of wrap?[-h,0,h]:[0]){
      if(x+dx+rad<0||x+dx-rad>w||y+dy+rad<0||y+dy-rad>h)continue;
      const gr=g.createRadialGradient(x+dx,y+dy,0,x+dx,y+dy,rad);gr.addColorStop(0,c);gr.addColorStop(1,shade(color,0,0));g.fillStyle=gr;g.fillRect(x+dx-rad,y+dy-rad,2*rad,2*rad);
    }
  }
}
function speckles(g:CanvasRenderingContext2D,x0:number,y0:number,w:number,h:number,r:()=>number,color:string,count:number,size:number){
  for(let i=0;i<count;i++){g.fillStyle=shade(color,(r()-0.5)*0.5,0.25+r()*0.35);const s=size*(0.4+r());g.fillRect(x0+r()*w,y0+r()*h,s,s);}
}
/** Волокна дерева вдоль доски (доска в своих осях: длина по x). */
function woodGrain(g:CanvasRenderingContext2D,w:number,h:number,r:()=>number,base:string,dark:string,px:number){
  g.fillStyle=shade(base,(r()-0.5)*0.16);g.fillRect(0,0,w,h);
  // широкие полосы тона
  for(let i=0;i<3;i++){g.fillStyle=shade(dark,0,0.08+r()*0.08);const y=r()*h,bh=h*(0.1+r()*0.3);g.fillRect(0,y,w,bh);}
  // тонкие волокна — плавные кривые
  const lines=Math.max(6,Math.round(h/(2.2*px)));
  for(let i=0;i<lines;i++){
    const y=r()*h,amp=h*(0.02+r()*0.06),freq=(1+r()*3)*Math.PI*2/w,ph=r()*6;
    g.strokeStyle=shade(dark,(r()-0.5)*0.3,0.12+r()*0.22);g.lineWidth=Math.max(0.5,px*(0.3+r()*0.9));
    g.beginPath();for(let x=0;x<=w;x+=Math.max(2,w/60)){const yy=y+Math.sin(x*freq+ph)*amp+Math.sin(x*freq*3.1+ph*2)*amp*0.3;if(x===0)g.moveTo(x,yy);else g.lineTo(x,yy);}g.stroke();
  }
  // сучки — изредка
  if(r()<0.35){const x=r()*w,y=h*(0.25+r()*0.5),rx=px*(6+r()*10),ry=Math.min(h*0.35,px*(3+r()*5));for(let k=3;k>0;k--){g.strokeStyle=shade(dark,-0.2,0.25);g.lineWidth=Math.max(0.6,px*0.6);g.beginPath();g.ellipse(x,y,rx*k/3,ry*k/3,0,0,Math.PI*2);g.stroke();}}
}
function veins(g:CanvasRenderingContext2D,x0:number,y0:number,w:number,h:number,r:()=>number,color:string,px:number,count:number){
  for(let i=0;i<count;i++){
    let x=x0+r()*w,y=y0+r()*h;const ang=r()*Math.PI;g.strokeStyle=shade(color,(r()-0.5)*0.2,0.25+r()*0.4);g.lineWidth=Math.max(0.6,px*(0.4+r()*2.2));
    g.beginPath();g.moveTo(x,y);const steps=8+Math.floor(r()*10),step=Math.max(w,h)/10;
    for(let s=0;s<steps;s++){const a=ang+(r()-0.5)*1.2;x+=Math.cos(a)*step;y+=Math.sin(a)*step;g.lineTo(x,y);}g.stroke();
  }
}
function plankRect(g:CanvasRenderingContext2D,f:FinishItem,rect:Rect,unit:FinishUnit,px:number){
  const [base,dark]=f.tone,r=rng(rect.n^hash(f.id));
  g.save();g.translate(rect.x*px,rect.y*px);
  const w=rect.w*px,h=rect.h*px;g.beginPath();g.rect(0,0,w,h);g.clip();
  if(rect.rot){g.translate(w,0);g.rotate(Math.PI/2);}
  const L=rect.rot?h:w,W=rect.rot?w:h;woodGrain(g,L,W,r,base,dark,px);
  // фаска / стык: тёмная линия по краю доски
  const j=Math.max(1,unit.joint*px);g.strokeStyle=shade(dark,-0.35,f.chamfer?0.55:0.35);g.lineWidth=j;g.strokeRect(j/2,j/2,L-j,W-j);
  if(f.chamfer){g.strokeStyle=shade(base,0.25,0.35);g.lineWidth=Math.max(0.5,j/2);g.beginPath();g.moveTo(j*1.5,j*1.5);g.lineTo(L-j*1.5,j*1.5);g.stroke();}
  g.restore();
}
function tileRect(g:CanvasRenderingContext2D,f:FinishItem,rect:Rect,unit:FinishUnit,px:number){
  const [base,accent]=f.tone,r=rng(rect.n*7+hash(f.id)),x=rect.x*px,y=rect.y*px,w=rect.w*px,h=rect.h*px;
  g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
  if(f.look==='wood'){g.translate(x,y);woodGrain(g,w,h,r,base,accent,px);g.restore();}
  else{
    g.fillStyle=shade(base,(r()-0.5)*0.05);g.fillRect(x,y,w,h);
    const area=rect.w*rect.h/1e4;// дм²
    if(f.look==='concrete'){blotchesIn(g,x,y,w,h,r,accent,Math.round(area*0.8)+6,Math.min(w,h)*0.25,0.25);speckles(g,x,y,w,h,r,accent,Math.round(area*25),px*1.2);}
    if(f.look==='stone'){blotchesIn(g,x,y,w,h,r,accent,Math.round(area*0.6)+5,Math.min(w,h)*0.3,0.18);speckles(g,x,y,w,h,r,accent,Math.round(area*40),px);veins(g,x,y,w,h,r,accent,px*0.6,2);}
    if(f.look==='marble'){blotchesIn(g,x,y,w,h,r,mix(base,accent,0.3),4,Math.min(w,h)*0.4,0.12);veins(g,x,y,w,h,r,accent,px,3+Math.floor(r()*4));}
    if(f.look==='terrazzo'){const n=Math.round(area*60);for(let i=0;i<n;i++){g.fillStyle=shade(i%3?accent:mix(base,accent,0.5),(r()-0.5)*0.4,0.55+r()*0.4);const cx=x+r()*w,cy=y+r()*h,s=px*(2+r()*9);g.beginPath();for(let k=0;k<5;k++){const a=k/5*Math.PI*2+r();g.lineTo(cx+Math.cos(a)*s*(0.5+r()*0.5),cy+Math.sin(a)*s*(0.5+r()*0.5));}g.fill();}}
    if(f.look==='mosaic'){const s=Math.max(4,25*px);for(let mx=x;mx<x+w;mx+=s)for(let my=y;my<y+h;my+=s){g.fillStyle=shade(mix(base,accent,r()*0.8),(r()-0.5)*0.08);g.fillRect(mx+px,my+px,s-2*px,s-2*px);}}
    if(f.look==='plain')speckles(g,x,y,w,h,r,accent,Math.round(area*15),px);
    g.restore();
  }
  // шов
  const light=rgb(f.tone[0]).reduce((a,b)=>a+b,0)>3*180;
  g.strokeStyle=light?'rgba(128,124,118,0.95)':'rgba(205,202,196,0.9)';g.lineWidth=Math.max(2.5,unit.joint*px);g.strokeRect(x,y,w,h);
}
function blotchesIn(g:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:()=>number,color:string,count:number,size:number,alpha:number){g.save();g.translate(x,y);blotches(g,w,h,r,color,count,size,alpha,false);g.restore();}
function wallpaper(g:CanvasRenderingContext2D,f:FinishItem,unit:FinishUnit,px:number){
  const [base,accent]=f.tone,r=rng(hash(f.id)),w=unit.w*px,h=unit.h*px;
  g.fillStyle=base;g.fillRect(0,0,w,h);
  switch(f.look){
    case 'plain':blotches(g,w,h,r,base,30,w*0.12,0.06);speckles(g,0,0,w,h,r,accent,Math.round(w*h/400),px);break;
    case 'texture':blotches(g,w,h,r,accent,70,w*0.08,0.18);speckles(g,0,0,w,h,r,accent,Math.round(w*h/120),px*1.2);break;
    case 'concrete':blotches(g,w,h,r,accent,90,w*0.1,0.22);speckles(g,0,0,w,h,r,accent,Math.round(w*h/90),px*1.5);for(let i=0;i<14;i++){g.fillStyle=shade(accent,-0.3,0.25);g.beginPath();g.arc(r()*w,r()*h,px*(1+r()*3),0,Math.PI*2);g.fill();}break;
    case 'stripes':{const widths=[60,20,40,20],ws=widths.reduce((a,b)=>a+b,0),k=unit.w/ws;let x=0,i=0;while(x<w-0.5){const sw=widths[i%widths.length]*k*px;if(i%2)g.fillStyle=accent,g.fillRect(x,0,sw,h);x+=sw;i++;}break;}
    case 'geometric':{const n=4,cw=w/n,ch=h/2;g.strokeStyle=shade(accent,0,0.9);g.lineWidth=Math.max(1,px*3);for(let i=0;i<=n;i++)for(let j=0;j<=2;j++){const cx=i*cw,cy=j*ch;g.beginPath();g.moveTo(cx,cy-ch/2);g.lineTo(cx+cw/2,cy);g.lineTo(cx,cy+ch/2);g.lineTo(cx-cw/2,cy);g.closePath();g.stroke();}break;}
    case 'floral':{const n=7;for(let i=0;i<n;i++){const cx=r()*w,cy=r()*h,s=Math.min(w,h)*(0.06+r()*0.05);for(const dx of [-w,0,w])for(const dy of [-h,0,h]){const X=cx+dx,Y=cy+dy;if(X+3*s<0||X-3*s>w||Y+3*s<0||Y-3*s>h)continue;
      g.strokeStyle=shade(accent,-0.2,0.7);g.lineWidth=Math.max(1,px*2);g.beginPath();g.moveTo(X,Y);g.quadraticCurveTo(X+s,Y+2*s,X-s*0.5,Y+3*s);g.stroke();
      for(let k=0;k<6;k++){const a=k/6*Math.PI*2;g.fillStyle=shade(accent,(k%2)*0.15,0.85);g.beginPath();g.ellipse(X+Math.cos(a)*s*0.6,Y+Math.sin(a)*s*0.6,s*0.55,s*0.28,a,0,Math.PI*2);g.fill();}
      g.fillStyle=shade(base,0.2,0.9);g.beginPath();g.arc(X,Y,s*0.22,0,Math.PI*2);g.fill();}}break;}
    case 'abstract':{blotches(g,w,h,r,accent,30,w*0.1,0.12);for(let i=0;i<10;i++){g.strokeStyle=shade(accent,(r()-0.5)*0.3,0.35);g.lineWidth=Math.max(1,px*(1+r()*3));const y=r()*h;g.beginPath();g.moveTo(0,y);g.bezierCurveTo(w*0.3,y+(r()-0.5)*h*0.4,w*0.7,y+(r()-0.5)*h*0.4,w,y);g.stroke();}break;}
    default:break;
  }
  // стык полотен по краю рулона
  g.fillStyle=shade(base,-0.25,0.35);g.fillRect(0,0,Math.max(1,unit.joint*px),h);
}

/** Раппорт на canvas: px — пикселей на мм (по умолчанию так, чтобы большая сторона ≤ maxPx). */
export function drawFinish(f:FinishItem,maxPx=FINISH_TEXTURE_PX):{canvas:HTMLCanvasElement;unit:FinishUnit}{
  const unit=finishUnit(f),px=texturePxPerMm(unit,maxPx),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(unit.w*px));canvas.height=Math.max(1,Math.round(unit.h*px));
  const g=canvas.getContext('2d');if(!g)return {canvas,unit};
  const sx=canvas.width/(unit.w*px),sy=canvas.height/(unit.h*px);g.scale(sx,sy);
  if(f.kind==='wallpaper')wallpaper(g,f,unit,px);
  else if(f.kind==='laminate'){g.fillStyle=f.tone[1];g.fillRect(0,0,unit.w*px,unit.h*px);for(const rect of unit.rects)plankRect(g,f,rect,unit,px);}
  else for(const rect of unit.rects)tileRect(g,f,rect,unit,px);
  return {canvas,unit};
}
