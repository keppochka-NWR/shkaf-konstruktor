import type { Module, Part } from './model';

/** Parametric approval geometry. Hardware envelopes are explicitly not drilling templates. */
export type Casework = {
  kind: 'hanging' | 'drawers' | 'trousers' | 'solid' | 'upper';
  blind: number; blindSide: 'left' | 'right'; floorGap: number;
  drawerFace: number; topDrawerFace: number; drawerGap: number;
  filler: number; shelfCount: number; pantsWidth: number; pantsHeight: number;
  rodHeight: number; light: boolean; openSide?: 'left' | 'right';
};
export function caseworkErrors(m: Module): string[] {
  const c=m.casework!,e:string[]=[];
  if(!c||typeof c!=='object')return ['Некорректный конструктив заказа.'];
  for(const [key,lo,hi] of [['width',250,2500],['height',250,2500],['depth',150,700]] as const)
    if(!Number.isFinite(m[key])||m[key]<lo||m[key]>hi)e.push(`${key}: размер вне диапазона ${lo}–${hi} мм.`);
  if(!['hanging','drawers','trousers','solid','upper'].includes(c.kind))e.push('Неизвестное наполнение.');
  if(!['left','right'].includes(c.blindSide))e.push('Неверная сторона угла.');
  for(const [key,lo,hi] of [['blind',0,m.width-280],['floorGap',2,30],['drawerFace',100,400],['topDrawerFace',100,200],['drawerGap',3,40],['filler',16,48],['shelfCount',0,6],['pantsWidth',350,900],['pantsHeight',400,1600],['rodHeight',300,2200]] as const)
    if(!Number.isFinite(c[key])||c[key]<lo||c[key]>hi)e.push(`Проверьте параметр ${key}.`);
  if(!Number.isInteger(c.shelfCount)||typeof c.light!=='boolean'||(c.openSide!==undefined&&!['left','right'].includes(c.openSide)))e.push('Некорректные параметры конструкции.');
  if(c.kind==='trousers'&&c.pantsWidth+48>m.width-c.blind)e.push('Проём брючницы не помещается между стойками.');
  const stack=c.floorGap+3*(c.drawerFace+c.drawerGap)+c.topDrawerFace+30+16;
  if(c.kind==='drawers'&&stack+100*(c.shelfCount+1)>m.height-16)e.push('Ящики и полки не помещаются по высоте.');
  if(['hanging','trousers'].includes(c.kind)&&c.rodHeight>m.height-60)e.push('Штанга должна быть ниже крыши на 60 мм.');
  if(c.kind==='hanging'&&m.width-c.blind<650)e.push('Двум ящикам нужен доступный фронт от 650 мм.');
  if(!m.sections.length||m.sections.length!==1)e.push('У составного узла должен быть один идентификатор секции.');
  if(e.length)return e;
  if(caseworkParts(m).some(p=>p.size.some(v=>!Number.isFinite(v)||v<=0)||p.position.some(v=>!Number.isFinite(v))))e.push('Недопустимая геометрия узла.');
  return e;
}

export function caseworkParts(m:Module):Part[]{
  const c=m.casework!,t=16,w=m.width,h=m.height,d=m.depth,sid=m.sections[0]?.id??'case',out:Part[]=[];
  function add(id:string,name:string,size:Part['size'],position:Part['position'],role:Part['role']='body',material:Part['material']='board',axis:0|1|2=1){
    const dims=[...size].sort((a,b)=>b-a);
    out.push({id,name,size,position,role,material,sectionId:sid,decor:m.decor,length:dims[0],width:dims[1],thickness:dims[2],grain:'length',grainAxis:axis,edge:material==='board'?[.4,.4,2,.4]:[0,0,0,0],edgeColor:material==='board'&&id!=='back'?'#151515':undefined});
    return out.at(-1)!;
  }
  if(c.openSide!=='left')add('left','Стойка левая',[t,h,d],[t/2,h/2,d/2]);
  if(c.openSide!=='right')add('right','Стойка правая',[t,h,d],[w-t/2,h/2,d/2]);
  add('bottom','Дно',[w-2*t,t,d],[w/2,t/2,d/2],'body','board',0);
  add('top','Крыша',[w-2*t,t,d],[w/2,h-t/2,d/2],'body','board',0);
  add('back','Задняя стенка в цвет',[w-2*t,h-2*t,3],[w/2,h/2,1.5],'body','hdf');
  const l=c.blindSide==='left'?c.blind:0,r=w-(c.blindSide==='right'?c.blind:0),span=r-l;
  if(c.blind>0)add('blind','Угловая фальшпанель',[c.blind,h,16],[c.blindSide==='left'?c.blind/2:w-c.blind/2,h/2,d-8]);
  function shelf(y:number,x0=l+t,x1=r-t,id='shelf'){
    add(`${sid}:${id}`,'Полка',[x1-x0,t,d-25],[ (x0+x1)/2,y,d/2-12.5],'shelf','board',0);
  }
  function doors(){
    if(!m.doors)return;
    const n=Math.max(1,Math.ceil((span-4)/600)),dw=(span-4-(n-1)*2)/n;
    for(let j=0;j<n;j++){
      const hinge=j===n-1&&n>1?'right':'left';
      const q=add(`${sid}:door:${j}`,m.alu?'Фасад F1-17 · чёрный':'Фасад ЛДСП',[dw,h-c.floorGap-2,m.alu?20:16],[l+2+dw/2+j*(dw+2),(h-2+c.floorGap)/2,d+(m.alu?12:10)],'door',m.alu?'alu':'board');
      q.hinge=hinge;q.edge=[2,2,2,2];
      for(let k=0;k<(h>1600?4:2);k++)add(`${sid}:hinge:${j}:${k}`,'Premial · петля · схема подлежит подбору',[30,18,60],[hinge==='left'?l+18+j*(dw+2):l+2+dw+j*(dw+2)-15,90+k*(h-180)/(h>1600?3:1),d-30],'hinge','metal');
    }
  }
  function drawer(index:number,x0:number,x1:number,y0:number,fh:number,internal:boolean){
    const prefix=`${sid}:drawer:${index}`,front=internal?d-40:d+10;
    const boxh=Math.max(68,fh-50),boxD=Math.min(500,d-70),bx0=x0+10,bx1=x1-10,by=Math.max(20,y0+20),bz=d-55-boxD;
    for(const [side,x] of [['left',bx0+8],['right',bx1-8]] as const)add(`${prefix}:${side}`,'Ящик · боковина · предварительно',[16,boxh,boxD],[x,by+boxh/2,bz+boxD/2],'drawer','board',2);
    for(const [side,z] of [['front',bz+boxD-8],['rear',bz+8]] as const)add(`${prefix}:${side}`,'Ящик · поперечина',[bx1-bx0-32,boxh,16],[(bx0+bx1)/2,by+boxh/2,z],'drawer');
    add(`${prefix}:bottom`,'Ящик · дно ЛДСП',[bx1-bx0-32,16,boxD-32],[(bx0+bx1)/2,by+8,bz+boxD/2],'drawer','board',0);
    add(`${prefix}:facade`,'Ящик · фасад '+fh+' мм',[x1-x0,fh,16],[(x0+x1)/2,y0+fh/2,front],'drawer');
    for(const [side,x] of [['left',bx0+10],['right',bx1-10]] as const)add(`${prefix}:slide:${side}`,'Blum скрытые · условный габарит · артикул не выбран',[20,10,boxD],[x,by-5,bz+boxD/2],'drawer','metal');
  }
  if(c.kind==='drawers'){
    let y=c.floorGap;
    for(let j=0;j<4;j++){const fh=j===3?c.topDrawerFace:c.drawerFace;drawer(j,l+2,r-2,y,fh,false);y+=fh+c.drawerGap;}
    const cap=y+8;shelf(cap,l+t,r-t,'drawer-cap');
    for(let j=0;j<c.shelfCount;j++)shelf(cap+(h-t-cap)*(j+1)/(c.shelfCount+1),l+t,r-t,`shelf:${j}`);
  }
  if(c.kind==='hanging'){
    const fl=c.filler,cap=16+c.drawerFace+30;
    for(const [side,x] of [['left',l+t+fl/2],['right',r-t-fl/2]] as const)add(`${sid}:filler:${side}`,'Фальшпанель '+fl+' мм',[fl,cap-t,d-30],[x,(cap+t)/2,(d-30)/2]);
    const mid=(l+r)/2;
    add(`${sid}:divider`,'Опора под общей полкой',[t,cap-t,d-30],[mid,(cap+t)/2,(d-30)/2]);
    drawer(0,l+t+fl+3,mid-11,20,c.drawerFace,true);
    drawer(1,mid+11,r-t-fl-3,20,c.drawerFace,true);
    shelf(cap+8,t,w-t,'drawer-cap');
  }
  if(c.kind==='trousers'){
    const x1=r-t,x0=x1-c.pantsWidth;
    add(`${sid}:pants-divider`,'Стойка крепления брючницы',[t,c.pantsHeight+16-t,d-30],[x0-8,(c.pantsHeight+16+t)/2,(d-30)/2]);
    shelf(c.pantsHeight+8,x0-t,r-t,'pants-cover');
    for(const [side,x] of [['left',x0+8],['right',x1-8]] as const)add(`${sid}:pants:rail:${side}`,'Брючница · направляющая · условный габарит',[16,24,450],[x,c.pantsHeight-25,d-260],'drawer','metal');
    for(let j=0;j<10;j++)add(`${sid}:pants:bar:${j}`,'Брючница · держатель брюк',[12,12,420],[x0+35+(c.pantsWidth-70)*j/9,c.pantsHeight-40,d-245],'drawer','metal');
  }
  if(['hanging','trousers'].includes(c.kind)){
    add(`${sid}:rod`,'Штанга для одежды',[w-32,25,25],[w/2,c.rodHeight,d/2],'rod','metal',0);
    for(const x of [18,w-18])add(`${sid}:flange:${x}`,'Фланец штанги',[5,45,45],[x,c.rodHeight,d/2],'flange','metal');
  }
  if(c.kind==='solid')for(let j=0;j<4;j++)shelf(t+(h-2*t)*(j+1)/5,t,w-t,`shelf:${j}`);
  if(c.light&&['hanging','trousers'].includes(c.kind))add(`${sid}:light:roof`,'Подсветка в крыше нижнего модуля',[w-80,4,15],[w/2,h-t-2,d/2],'light','metal',0);
  if(c.kind!=='drawers')doors();
  return out;
}
