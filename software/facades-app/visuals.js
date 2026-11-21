(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./studio-milling.js'):root.StudioMilling);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FacadeVisuals=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(M){
  'use strict';
  let serial=0;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=x=>Number(x).toLocaleString('ru-RU',{maximumFractionDigits:2});
  const num=x=>Math.round(x*1000)/1000;
  const get=(catalog,legacy,key,id)=>(legacy?.[key]||catalog?.[key]||[]).find(x=>x.id===id);
  const color=(value,fallback='#e6e1d8')=>/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value||'')?value:fallback;
  function swatchGradient(value,id){
    if(typeof value!=='string'||!value.startsWith('linear-gradient('))return '';
    const stops=[...value.matchAll(/(#[\da-f]{6}|rgba\((\d+),(\d+),(\d+),([\d.]+)\))\s+(\d+)%/gi)];
    if(stops.length<2)return '';
    const angle=Number(value.match(/^linear-gradient\((\d+)deg,/)?.[1]||135)*Math.PI/180;
    const dx=Math.sin(angle),dy=-Math.cos(angle),scale=.5/Math.max(Math.abs(dx),Math.abs(dy));
    return '<linearGradient id="'+id+'" x1="'+num((.5-dx*scale)*100)+'%" y1="'+num((.5-dy*scale)*100)+'%" x2="'+num((.5+dx*scale)*100)+'%" y2="'+num((.5+dy*scale)*100)+'%">'+stops.map(m=>'<stop offset="'+Math.min(100,Number(m[6]))+'%" stop-color="'+(m[1][0]==='#'?m[1]:'rgb('+[m[2],m[3],m[4]].map(v=>Math.min(255,Number(v))).join(',')+')')+'" stop-opacity="'+(m[1][0]==='#'?1:Math.min(1,Number(m[5])))+'"/>').join('')+'</linearGradient>';
  }
  function asset(value,options){
    if(!value)return '';
    const resolved=options.images?.[value]??value;
    return /^(?:assets\/[\w./%-]+|data:image\/(?:png|jpeg|webp|gif);base64,[a-z\d+/=\s]+)$/i.test(resolved)?resolved:'';
  }
  function selection(p,catalog={},legacy={}){
    return {milling:get(catalog,legacy,'millings',p.millingId),film:get(catalog,legacy,'films',p.filmId),
      panel:get(catalog,legacy,'panels',p.panelId),paintMilling:get(catalog,legacy,'paintMillings',p.paintMillingId),
      paintColor:get(catalog,legacy,'paintColors',p.paintColorId),paintFinish:get(catalog,legacy,'paintFinishes',p.paintFinish),
      aluProfile:get(catalog,legacy,'aluProfiles',p.aluProfileId),aluFill:get(catalog,legacy,'aluFills',p.aluFillId)};
  }
  function describe(p,catalog={},legacy={}){
    const s=selection(p,catalog,legacy);
    if(p.family==='MDF')return 'МДФ в плёнке · '+(s.milling?'№ '+s.milling.id+' · '+s.milling.series:'фрезеровка не выбрана')+' · '+(s.film?.name||'плёнка не выбрана');
    if(p.family==='PAINT')return 'МДФ в краске · '+(s.paintMilling?.name||'фрезеровка не выбрана')+' · '+(s.paintColor?'RAL '+s.paintColor.code+' '+s.paintColor.name:'цвет не выбран')+' · '+(s.paintFinish?.name||'покрытие не выбрано');
    if(p.family==='ALU')return 'ALU · '+(s.aluProfile?.name||'профиль не выбран')+' · '+(p.aluColorName||'цвет профиля не указан')+' · '+(s.aluFill?.name||'заполнение не выбрано');
    return p.family+' · '+(s.panel?.name||'декор не выбран');
  }
  function note(p,catalog={},legacy={}){
    const s=selection(p,catalog,legacy);
    if(p.family==='MDF'){const model=M?.drawing(String(p.millingId),p.w,p.h,p.t,p.variant||'solid');return model?'Рисунок построен по той же геометрии, что в Ё Конструкторе. Рамка и отступы сохраняются в миллиметрах при изменении размеров. '+model.notes.join(' '):'Выберите фрезеровку, чтобы показать рисунок на фасаде.';}
    if(p.family==='PAINT')return 'Параметрический эскиз: шаг фрезеровки взят из старого каталога. Цвет RAL на экране условный; сечение инструмента не моделируется.'+(p.variant==='glass'?' Проём витрины условный, требуется подтверждение.':'');
    if(p.family==='ALU')return 'Условный вид профиля и заполнения. Ширина и сечение рамки в источнике не заданы; проём не является размерным. Цвет профиля введён вручную.';
    return (s.panel?.image?'Фактура показана по образцу каталога без масштаба рисунка. ':'')+'Экранный цвет условный. Синим отмечены выбранные стороны кромки.';
  }
  function drillingRows(p){
    const d=p.drilling||{};
    if(!d.enabled)return [];
    return (d.ys||[]).map((y,i)=>({n:i+1,x:d.center==null?null:d.side==='right'?p.w-d.center:d.center,y,
      diameter:d.diameter??null,depth:d.depth??null,
      valid:d.center!=null&&d.diameter!=null&&d.center>=d.diameter/2&&d.center+d.diameter/2<=p.w&&y>=d.diameter/2&&y+d.diameter/2<=p.h}));
  }
  function render(p,catalog={},legacy={},side='front',options={}){
    const dims=options.dimensions!==false,back=side==='back',s=selection(p,catalog,legacy);
    const sample=false;
    const uid=String(options.idPrefix||('facade_'+p.id+'_'+(++serial))).replace(/[^\w-]/g,'_');
    const width=sample?760:640,height=500;
    const area=back?[72,82,320,312]:sample?[80,78,280,310]:[118,78,370,320];
    const scale=Math.min(area[2]/p.w,area[3]/p.h),rw=p.w*scale,rh=p.h*scale;
    const x=area[0]+(area[2]-rw)/2,y=area[1]+(area[3]-rh)/2,x2=x+rw,y2=y+rh;
    const line=(x1,y1,x2,y2,stroke='#72849c',extra='')=>'<line x1="'+num(x1)+'" y1="'+num(y1)+'" x2="'+num(x2)+'" y2="'+num(y2)+'" stroke="'+stroke+'" stroke-width="1" '+extra+'/>';
    const txt=(tx,ty,value,size=12,anchor='start',fill='#31465d')=>'<text x="'+num(tx)+'" y="'+num(ty)+'" font-size="'+size+'" text-anchor="'+anchor+'" fill="'+fill+'">'+esc(value)+'</text>';
    const rect=(rx,ry,rw,rh,fill,extra='')=>'<rect x="'+num(rx)+'" y="'+num(ry)+'" width="'+num(Math.max(0,rw))+'" height="'+num(Math.max(0,rh))+'" fill="'+fill+'" '+extra+'/>';
    let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" data-face-x="'+num(x)+'" data-face-y="'+num(y)+'" data-face-w="'+num(rw)+'" data-face-h="'+num(rh)+'" role="img" aria-label="'+esc((back?'Обратная':'Лицевая')+' сторона '+p.name+', '+p.w+' × '+p.h+' × '+p.t+' мм')+'" style="font-family:Arial,sans-serif">';
    svg+='<title>'+esc(p.name+' — '+(back?'обратная':'лицевая')+' сторона')+'</title><defs><marker id="'+uid+'_arrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M8 0L0 4L8 8" fill="none" stroke="#72849c"/></marker><clipPath id="'+uid+'_clip">'+rect(x,y,rw,rh,'white')+'</clipPath></defs>';
    svg+=txt(width/2,25,back?'Обратная сторона · координаты от её верхнего левого угла':dims?'Лицевая сторона · габариты':'Лицевая сторона · внешний вид',14,'middle');
    svg+=txt(width/2,45,'W '+fmt(p.w)+' × H '+fmt(p.h)+' × T '+fmt(p.t)+' мм',12,'middle');
    let base=back?'#f6f3ee':p.family==='PAINT'?color(s.paintColor?.hex):p.family==='MDF'?color(s.film?.color||s.film?.hex):color(s.panel?.color||s.panel?.hex);
    svg+=rect(x,y,rw,rh,base,'stroke="#687583" stroke-width="1.5"');
    if(!back){
      if(p.family==='MDF'||!['PAINT','ALU'].includes(p.family)){
        const img=asset(p.family==='MDF'?s.film?.image:s.panel?.image,options);
        if(img)svg+='<image href="'+esc(img)+'" x="'+num(x)+'" y="'+num(y)+'" width="'+num(rw)+'" height="'+num(rh)+'" preserveAspectRatio="xMidYMid slice" clip-path="url(#'+uid+'_clip)"/>';
      }
      if(p.family==='MDF'){
        const model=M?.drawing(String(p.millingId),p.w,p.h,p.t,p.variant||'solid');
        if(model)svg+='<g clip-path="url(#'+uid+'_clip)"><g data-milling="'+esc(p.millingId)+'" data-source="studio" data-width-mm="'+p.w+'" data-height-mm="'+p.h+'" data-frame-mm="'+(model.frame??'')+'" transform="translate('+num(x)+' '+num(y)+') scale('+scale+')">'+model.markup+'</g></g>';
      }
      if(p.family==='PAINT'&&s.paintMilling?.specs?.step>0){
        // Retains the source patterns and real millimetre pitch; no invented tool geometry.
        const step=s.paintMilling.specs.step*scale;
        let pattern='';
        if(s.paintMilling.id==='volna'){
          for(let offset=0,index=0;offset<rw;offset+=step,index++)pattern+=rect(x+offset,y,Math.min(step,rw-offset),rh,index%2?'#000':'#fff','opacity="'+(index%2?'.13':'.18')+'"');
        }else if(['pryamaya','type3'].includes(s.paintMilling.id)){
          for(let offset=step;offset<rw;offset+=step)pattern+=line(x+offset,y,x+offset,y2,'#000','opacity=".25"');
        }
        svg+='<g data-milling="'+esc(s.paintMilling.id)+'" data-pitch-mm="'+s.paintMilling.specs.step+'" clip-path="url(#'+uid+'_clip)">'+pattern+'</g>';
      }
      if(p.family==='PAINT'&&p.paintFinish==='glossy')svg+='<path d="M'+num(x)+' '+num(y)+'H'+num(x2)+'L'+num(x)+' '+num(y+rh*.65)+'Z" fill="#fff" opacity=".14"/>';
      if(p.family==='ALU'){
        const frame=color(p.aluColorHex,'#9b9fa4'),inset=Math.min(13,rw/6,rh/6);
        const gradient=swatchGradient(s.aluFill?.swatch,uid+'_fill');
        if(gradient)svg+='<defs>'+gradient+'</defs>';
        svg+=rect(x,y,rw,rh,frame,'stroke="#586574" stroke-width="1.5"');
        svg+=rect(x+inset,y+inset,rw-inset*2,rh-inset*2,gradient?'url(#'+uid+'_fill)':color(s.aluFill?.swatch||s.aluFill?.color,'#cbd7dd'),'stroke="#586574"');
        svg+='<path d="M'+num(x+inset)+' '+num(y+inset)+'H'+num(x2-inset)+'L'+num(x+inset)+' '+num(y2-inset)+'Z" fill="#fff" opacity=".16"/>';
        svg+=txt(x+rw/2,y2+18,'Рамка условная',11,'middle');
      }
    }
    if(!['MDF','PAINT','ALU'].includes(p.family)){
      for(const edge of ['top','bottom','left','right'])if(p.edges?.[edge]){
        const mirrored=back&&['left','right'].includes(edge)?edge==='left'?'right':'left':edge;
        const coords={top:[x,y,x2,y],bottom:[x,y2,x2,y2],left:[x,y,x,y2],right:[x2,y,x2,y2]}[mirrored];
        svg+=line(...coords,'#2463bd','style="stroke-width:3"');
      }
    }
    if(dims){
      const dimY=y2+30,dimX=x-30,arrows='marker-start="url(#'+uid+'_arrow)" marker-end="url(#'+uid+'_arrow)"';
      svg+=line(x,y2+5,x,dimY+6)+line(x2,y2+5,x2,dimY+6)+line(x,dimY,x2,dimY,'#72849c',arrows)+txt(x+rw/2,dimY+18,'W '+fmt(p.w),13,'middle');
      svg+=line(x-5,y,dimX-6,y)+line(x-5,y2,dimX-6,y2)+line(dimX,y,dimX,y2,'#72849c',arrows);
      svg+='<text transform="translate('+num(dimX-12)+' '+num(y+rh/2)+') rotate(-90)" text-anchor="middle" fill="#31465d" font-size="13">H '+fmt(p.h)+'</text>';
    }
    if(!back && options.projectDrilling){
      const holes=drillingRows(p).filter(r=>r.x!=null && r.diameter!=null);
      for(const r of holes){
        const cx=x+(p.w-r.x)*scale,cy=y+r.y*scale;
        svg+='<circle data-projected-hole="'+r.n+'" cx="'+num(cx)+'" cy="'+num(cy)+'" r="'+num(r.diameter*scale/2)+'" fill="none" stroke="#1766bd" stroke-width="2" stroke-dasharray="3 2"/>';
      }
      if(holes.length) svg+=txt(width/2,445,'Пунктир — присадка с обратной стороны',12,'middle');
    }
    if(back){
      svg+=txt(x,y-12,'0; 0',11)+line(x,y,x+28,y,'#536b83')+line(x,y,x,y+28,'#536b83')+txt(x+32,y+4,'X →',10)+txt(x-7,y+42,'Y ↓',10);
      const rows=drillingRows(p),d=p.drilling||{};
      svg+=txt(432,86,'Центры, мм: X / Y',12);
      if(!d.enabled)svg+=txt(432,110,'Присадка не задана',11);
      else if(!rows.length)svg+=txt(432,110,'Координаты не заданы',11,'start','#b33e2d');
      rows.forEach((r,i)=>{
        const stroke=r.valid?'#2765bd':'#bd3025',cy=y+r.y*scale;
        if(r.x!=null&&r.diameter!=null){
          const cx=x+r.x*scale;
          svg+='<g data-hole-index="'+i+'"><circle data-hole="'+r.n+'" data-x-mm="'+r.x+'" data-y-mm="'+r.y+'" cx="'+num(cx)+'" cy="'+num(cy)+'" r="'+num(r.diameter*scale/2)+'" fill="none" stroke="'+stroke+'" stroke-width="1.5"/>';
          svg+=line(cx-4,cy,cx+4,cy,stroke)+line(cx,cy-4,cx,cy+4,stroke)+txt(cx+(d.side==='right'?-10:10),cy-7,r.n,10,d.side==='right'?'end':'start',stroke);
          svg+='<circle cx="'+num(cx)+'" cy="'+num(cy)+'" r="'+num(Math.max(10,r.diameter*scale/2))+'" fill="transparent" style="cursor:ns-resize"/></g>';
        }
        svg+=txt(432,108+i*14,r.n+': '+(r.x==null?'?':fmt(r.x))+' / '+fmt(r.y),11,'start',stroke);
      });
      if(d.enabled){
        svg+=txt(432,416,'Ø '+(d.diameter==null?'не задан':fmt(d.diameter)+' мм'),11);
        svg+=txt(432,433,'Глубина: '+(d.depth==null?'не задана':fmt(d.depth)+' мм'),11);
      }
      svg+=txt(width/2,478,'Сторона петель указана при взгляде на обратную сторону.',11,'middle');
    }else if(sample){
      const image=asset(s.milling?.image,options);
      if(image)svg+='<image data-passport-sample="true" href="'+esc(image)+'" x="435" y="74" width="245" height="310" preserveAspectRatio="xMidYMid meet"/>';
      else svg+=txt(555,230,'Образец не выбран',14,'middle');
      svg+=txt(555,410,'Образец из паспорта'+(s.milling?' № '+s.milling.id:''),12,'middle');
      svg+=txt(220,422,'Габарит выбранного фасада',12,'middle');
      svg+=txt(width/2,465,'Фото не перекрашено. Контур образца не является чертежом заказной детали.',11,'middle');
    }else svg+=txt(width/2,477,p.family==='ALU'?'Условная геометрия рамки. Размеры проёма не заданы.':p.family==='MDF'?'Параметрическая визуализация. Размеры в мм; цвет на экране условный.':'Цвет на экране условный. Размеры указаны в мм.',11,'middle');
    return svg+'</svg>';
  }
  const front=(p,c,l,o={})=>render(p,c,l,'front',o);
  const back=(p,c,l,o={})=>render(p,c,l,'back',o);
  function imagesFor(project,catalog={},legacy={}){
    const paths=new Set();
    project.parts.forEach(p=>{const s=selection(p,catalog,legacy);for(const item of p.family==='MDF'?[s.film]:!['PAINT','ALU'].includes(p.family)?[s.panel]:[])if(item?.image)paths.add(item.image);});
    return [...paths];
  }
  return {front,back,render,describe,note,drillingRows,imagesFor,selection};
});
