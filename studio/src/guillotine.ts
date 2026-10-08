/**
 * Многостадийный гильотинный раскрой «как в Базисе» (форматно-раскроечный станок, каждый рез сквозной).
 *
 * Система координат как у карт студии (Sheet в exports.ts): x — поперёк листа (ширина 1830), y — вдоль листа
 * (длина 2750, вдоль текстуры). Деталь: w — поперёк, h — вдоль (длина детали по текстуре).
 *
 * Структура карты (≤ 5 стадий, как NumberOfTurns=5 / FirstCutType у Базиса):
 *   стадия 1 — продольные резы: полосы во всю рабочую длину листа (вдоль 2750, вдоль текстуры);
 *   стадия 2 — поперечные резы полосы на отрезки (длина отрезка = самая длинная деталь в нём);
 *   стадия 3 — продольные резы отрезка на столбцы (ширина столбца = его первая деталь);
 *   стадия 4 — поперечные резы столбца на ряды (детали друг за другом по длине);
 *   стадия 5 — продольные резы ряда: торцовка ширины детали или несколько деталей одной длины рядом.
 * Полоса на всю ширину листа — частный случай: тогда первый реальный рез поперечный (как «Обрезок 835×1830» у Базиса).
 *
 * Поиск: последовательное заполнение листов (каждый лист — рюкзак по ширине из полос, полоса — рюкзак по длине
 * из отрезков) + коррекция цен деталей (Sequential Value Correction, Мухачёва/Белов): детали, попавшие на плохо
 * заполненные листы, дорожают и на следующей итерации ставятся раньше. Детерминированно: шум цен — от сида,
 * число итераций фиксировано (время не влияет на результат, пока не превышен аварийный предел timeLimitMs).
 */
export type GuillotinePart={id:string;w:number;h:number;rot?:boolean};
export type GuillotineOptions={
  /** пропил пилы, мм (Базис: Saw=4.4) */ kerf?:number;
  /** обрезка края листа с каждой стороны, мм (Базис: Undercut 12) */ trim?:number;
  /** предел стадий (Базис: NumberOfTurns=5) */ maxStages?:number;
  /** итераций коррекции цен; больше — дольше и обычно не хуже */ iterations?:number;
  /** сид шума цен */ seed?:number;
  /** аварийный предел времени на группу, мс (по умолчанию без предела — результат детерминирован) */ timeLimitMs?:number;
};
export type GuillotinePlaced={id:string;x:number;y:number;w:number;h:number;rotated:boolean};
export type GuillotineCut={stage:number;x1:number;y1:number;x2:number;y2:number};
export type GuillotineNode={x:number;y:number;w:number;h:number;stage:number;cut?:'x'|'y';item?:string;waste?:boolean;children?:GuillotineNode[]};
/** Обрезок (лист после выпиливания деталей). business — деловой (≥ 100 × 50), large — крупный (≥ 600 × 300). */
export type Offcut={x:number;y:number;w:number;h:number;business:boolean;large:boolean};
export type GuillotineSheet={width:number;height:number;items:GuillotinePlaced[];cuts:GuillotineCut[];tree:GuillotineNode;stages:number;offcuts:Offcut[];usedArea:number;kim:number};
export type GuillotineUnplaced={id:string;w:number;h:number;reason:string};
export type GuillotineResult={sheets:GuillotineSheet[];unplaced:GuillotineUnplaced[];kerf:number;trim:number;maxStages:number;iterations:number};
export const GUILLOTINE_DEFAULTS={kerf:4.4,trim:12,maxStages:5,iterations:12,seed:20261009};
export const BUSINESS_OFFCUT={long:100,short:50},LARGE_OFFCUT={long:600,short:300};

const EPS=1e-6;
/** допуск проверки карты, мм: координаты округлены до 0,001 */
const VEPS=0.01;

// ---------------------------------------------------------------- проверка карты
type VRect={id:string;x:number;y:number;w:number;h:number};
export type GuillotineCheck={ok:boolean;stages:number;errors:string[];tree:GuillotineNode;cuts:GuillotineCut[];offcuts:Offcut[]};
/**
 * Проверка, что карта распиливается сквозными резами: стадия 1 — продольные резы (x = const во всю длину),
 * далее направления чередуются; между деталями, разделяемыми резом, не меньше пропила; всё внутри поля после обрезки.
 * Стадии считаются с торцовкой (рез, отделяющий деталь от отхода, тоже стадия). Пустая стадия (рез не нужен)
 * всё равно занимает номер — как у станка, где направление меняется поворотом заготовки.
 */
export function verifyGuillotine(sheet:{width:number;height:number;items:{x:number;y:number;w:number;h:number;id?:string;detail?:{code:string}}[]},opt:{kerf?:number;trim?:number;maxStages?:number}={}):GuillotineCheck{
  const kerf=opt.kerf??GUILLOTINE_DEFAULTS.kerf,trim=opt.trim??GUILLOTINE_DEFAULTS.trim,maxStages=opt.maxStages??GUILLOTINE_DEFAULTS.maxStages;
  const errors:string[]=[],cuts:GuillotineCut[]=[],offcuts:Offcut[]=[];
  const items:VRect[]=sheet.items.map((a,i)=>({id:a.id??a.detail?.code??String(i),x:a.x,y:a.y,w:a.w,h:a.h}));
  const X0=trim,Y0=trim,X1=sheet.width-trim,Y1=sheet.height-trim;
  for(const a of items){
    if(![a.x,a.y,a.w,a.h].every(Number.isFinite)||a.w<=0||a.h<=0)errors.push(`Деталь ${a.id}: неверный размер.`);
    else if(a.x<X0-VEPS||a.y<Y0-VEPS||a.x+a.w>X1+VEPS||a.y+a.h>Y1+VEPS)errors.push(`Деталь ${a.id} заходит в обрезку края (${trim} мм) или за лист.`);
  }
  const addWaste=(x:number,y:number,w:number,h:number,stage:number,list:GuillotineNode[])=>{
    if(w<=VEPS||h<=VEPS)return;
    const node:GuillotineNode={x,y,w,h,stage,waste:true};list.push(node);
    const long=Math.max(w,h),short=Math.min(w,h);
    offcuts.push({x,y,w,h,business:long>=BUSINESS_OFFCUT.long-VEPS&&short>=BUSINESS_OFFCUT.short-VEPS,large:long>=LARGE_OFFCUT.long-VEPS&&short>=LARGE_OFFCUT.short-VEPS});
  };
  let deepest=0;
  const rec=(x0:number,y0:number,x1:number,y1:number,list:VRect[],stage:number,dir:'x'|'y',triedOther:boolean):GuillotineNode=>{
    const node:GuillotineNode={x:x0,y:y0,w:x1-x0,h:y1-y0,stage};
    if(!list.length){node.waste=true;return node;}
    if(stage>12){errors.push('Слишком глубокое дерево резов: карта не гильотинная.');return node;}
    const lo=(a:VRect)=>dir==='x'?a.x:a.y,hi=(a:VRect)=>dir==='x'?a.x+a.w:a.y+a.h;
    const a0=dir==='x'?x0:y0,a1=dir==='x'?x1:y1;
    const sorted=[...list].sort((p,q)=>lo(p)-lo(q)||hi(p)-hi(q));
    const groups:{lo:number;hi:number;items:VRect[]}[]=[];
    for(const a of sorted){
      const g=groups.at(-1);
      if(g&&lo(a)<g.hi+kerf-VEPS){
        if(lo(a)<g.hi-VEPS&&g.items.some(b=>overlaps(a,b)))errors.push(`Детали ${a.id} и ${g.items.find(b=>overlaps(a,b))!.id} пересекаются.`);
        g.hi=Math.max(g.hi,hi(a));g.items.push(a);
      }else groups.push({lo:lo(a),hi:hi(a),items:[a]});
    }
    const needCut=groups.length>1||groups[0].lo>a0+VEPS||groups[0].hi<a1-VEPS;
    if(!needCut){
      if(list.length===1){
        const a=list[0],fills=Math.abs(a.x-x0)<VEPS&&Math.abs(a.y-y0)<VEPS&&Math.abs(a.x+a.w-x1)<VEPS&&Math.abs(a.y+a.h-y1)<VEPS;
        if(fills){node.item=a.id;return node;}
      }
      if(triedOther){if(!errors.some(e=>e.includes('пересекаются')))errors.push(`Детали ${list.map(a=>a.id).slice(0,4).join(', ')}: нет сквозного реза — карта не гильотинная.`);return node;}
      // рез в этом направлении не нужен: стадия пустая, следующая — в другом направлении
      const inner=rec(x0,y0,x1,y1,list,stage+1,dir==='x'?'y':'x',true);
      return inner;
    }
    deepest=Math.max(deepest,stage);node.cut=dir;node.children=[];
    const line=(c:number)=>{cuts.push(dir==='x'?{stage,x1:c,y1:y0,x2:c,y2:y1}:{stage,x1:x0,y1:c,x2:x1,y2:c});};
    let prev=a0;
    for(const [i,g] of groups.entries()){
      // отход перед группой (между предыдущей группой/краем и этой группой)
      const gapStart=i===0?a0:prev+kerf,gapEnd=g.lo-kerf;
      if(i===0){if(g.lo>a0+VEPS){line(g.lo-kerf/2);if(gapEnd>a0+VEPS)addWaste(...span(dir,a0,gapEnd,x0,y0,x1,y1),stage,node.children);}}
      else{
        line(prev+kerf/2);
        if(g.lo-prev>kerf+1+VEPS){line(g.lo-kerf/2);addWaste(...span(dir,gapStart,gapEnd,x0,y0,x1,y1),stage,node.children);}
      }
      const [sx0,sy0,sx1,sy1]=dir==='x'?[g.lo,y0,g.hi,y1]:[x0,g.lo,x1,g.hi];
      node.children.push(rec(sx0,sy0,sx1,sy1,g.items,stage+1,dir==='x'?'y':'x',false));
      prev=g.hi;
    }
    if(prev<a1-VEPS){line(prev+kerf/2);if(a1-(prev+kerf)>VEPS)addWaste(...span(dir,prev+kerf,a1,x0,y0,x1,y1),stage,node.children);}
    return node;
  };
  const tree=rec(X0,Y0,X1,Y1,items,1,'x',false);
  // торцовка детали внутри области без резов этой области тоже стадия: учтено рекурсией (needCut по краям)
  const stages=deepest;
  if(stages>maxStages)errors.push(`Нужно ${stages} стадий резов, допустимо ${maxStages}.`);
  return {ok:!errors.length,stages,errors:[...new Set(errors)],tree,cuts,offcuts};
}
function overlaps(a:VRect,b:VRect){return a.x<b.x+b.w-VEPS&&b.x<a.x+a.w-VEPS&&a.y<b.y+b.h-VEPS&&b.y<a.y+a.h-VEPS;}
function span(dir:'x'|'y',s0:number,s1:number,x0:number,y0:number,x1:number,y1:number):[number,number,number,number]{
  return dir==='x'?[s0,y0,s1-s0,y1-y0]:[x0,s0,x1-x0,s1-s0];
}

// ---------------------------------------------------------------- построение карт
type T={a:number;l:number;rot:boolean;ids:string[];area:number};
type Cand={t:number;o:0|1;across:number;along:number};
type Piece={t:number;o:0|1;across:number;along:number};
type Row={along:number;free:number;pieces:Piece[]};
type Col={c:number;free:number;rows:Row[]};
type Seg={l:number;free:number;cols:Col[];value:number};
type Strip={w:number;free:number;segs:Seg[];value:number};
type Layout={strips:Strip[];free:number;value:number};

function mulberry32(seed:number){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}

class Packer{
  readonly cands:Cand[];
  price:Float64Array;
  constructor(readonly types:T[],readonly X:number,readonly Y:number,readonly k:number){
    const cands:Cand[]=[];
    types.forEach((t,i)=>{
      if(t.a<=X+EPS&&t.l<=Y+EPS)cands.push({t:i,o:0,across:t.a,along:t.l});
      if(t.rot&&Math.abs(t.a-t.l)>EPS&&t.l<=X+EPS&&t.a<=Y+EPS)cands.push({t:i,o:1,across:t.l,along:t.a});
    });
    // «высокие» вперёд: длинные детали задают отрезки, короткие заполняют
    this.cands=cands.sort((p,q)=>q.along-p.along||q.across-p.across||p.t-q.t||p.o-q.o);
    this.price=Float64Array.from(types,t=>t.area);
  }
  /** Заполнить столбец (ширина c) рядами по длине; free — остаток длины в единицах «размер + пропил». */
  fillColumn(col:Col,cnt:Int32Array){
    const k=this.k;
    for(;;){
      let best:Cand|undefined,bv=-1;
      for(const c of this.cands){
        if(!cnt[c.t]||c.across>col.c+EPS||c.along+k>col.free+EPS)continue;
        const v=this.price[c.t];
        if(v>bv+EPS||(Math.abs(v-bv)<=EPS&&best&&c.along>best.along)){bv=v;best=c;}
      }
      if(!best)return;
      const row:Row={along:best.along,free:col.c+k-(best.across+k),pieces:[{...best}]};cnt[best.t]--;
      // рядом в том же ряду — только детали той же длины (иначе нужна шестая стадия)
      for(const c of this.cands){
        if(Math.abs(c.along-row.along)>EPS)continue;
        while(cnt[c.t]>0&&c.across+k<=row.free+EPS){row.pieces.push({...c});cnt[c.t]--;row.free-=c.across+k;}
      }
      col.rows.push(row);col.free-=row.along+k;
    }
  }
  /** Отрезок длины l в полосе ширины w: первым — лидер (деталь длиной ровно l), затем столбцы по убыванию длины. */
  buildSegment(w:number,l:number,cnt:Int32Array):Seg|null{
    const k=this.k,seg:Seg={l,free:w+k,cols:[],value:0};
    for(;;){
      let pick:Cand|undefined;
      for(const c of this.cands){
        if(!cnt[c.t]||c.along>l+EPS||c.across+k>seg.free+EPS)continue;
        if(!seg.cols.length&&Math.abs(c.along-l)>EPS)continue;
        pick=c;break; // cands уже отсортированы: длиннее, затем шире
      }
      if(!pick)break;
      const col:Col={c:pick.across,free:l+k,rows:[]};
      const row:Row={along:pick.along,free:0,pieces:[{...pick}]};cnt[pick.t]--;
      col.rows.push(row);col.free-=pick.along+k;
      this.fillColumn(col,cnt);
      seg.cols.push(col);seg.free-=col.c+k;
    }
    if(!seg.cols.length)return null;
    seg.value=segValue(seg,this.price);
    return seg;
  }
  /** Полоса ширины w во всю длину: рюкзак по длине из отрезков-кандидатов, затем жадный добор остатка. */
  buildStrip(w:number,cnt:Int32Array):Strip|null{
    const k=this.k,strip:Strip={w,free:this.Y+k,segs:[],value:0};
    const lengths=distinctLengths(this.cands,cnt,w,this.Y);
    if(!lengths.length)return null;
    // кандидаты: по отрезку на каждую длину-лидера, на копии наличия
    type SC={l:number;value:number;use:Map<number,number>;max:number};
    const sc:SC[]=[];
    for(const l of lengths){
      const tmp=cnt.slice(),seg=this.buildSegment(w,l,tmp);if(!seg)continue;
      const use=usage(seg);let max=Infinity;for(const [t,n] of use)max=Math.min(max,Math.floor(cnt[t]/n));
      sc.push({l,value:seg.value,use,max:Math.max(1,Math.min(max,Math.floor((this.Y+k)/(l+k))))});
    }
    const plan=knapsack(sc.map(s=>({size:s.l+k,value:s.value,max:s.max})),this.Y+k);
    const chosen=plan.flatMap((n,i)=>Array(n).fill(sc[i].l) as number[]).sort((a,b)=>b-a);
    for(const l of chosen){
      if(l+k>strip.free+EPS)continue;
      const seg=this.buildSegment(w,l,cnt);if(!seg)continue;
      strip.segs.push(seg);strip.free-=seg.l+k;
    }
    // добор: лучший по цене отрезок, который ещё помещается
    for(;;){
      let best:Seg|undefined,bestL=0;
      for(const l of distinctLengths(this.cands,cnt,w,strip.free-k)){
        const seg=this.buildSegment(w,l,cnt.slice());if(seg&&(!best||seg.value>best.value+EPS)){best=seg;bestL=l;}
      }
      if(!best)break;
      const seg=this.buildSegment(w,bestL,cnt)!;strip.segs.push(seg);strip.free-=seg.l+k;
    }
    if(!strip.segs.length)return null;
    strip.value=strip.segs.reduce((s,g)=>s+g.value,0);
    return strip;
  }
  /** Лист: рюкзак по ширине из полос-кандидатов (ширины = поперечные размеры деталей и весь остаток ширины). */
  buildSheet(cnt:Int32Array,mode:'normal'|'cross'='normal'):Layout{
    const k=this.k,layout:Layout={strips:[],free:this.X+k,value:0};
    if(mode==='cross'){
      // одна полоса во всю ширину: первая реальная стадия — поперечные резы (остаток — полоса во всю ширину листа)
      const s=this.buildStrip(this.X,cnt);
      if(s){layout.strips.push(s);layout.free-=s.w+k;layout.value=s.value;}
      return layout;
    }
    // Лучевой поиск по последовательностям полос: полосы строятся на фактическом остатке деталей (без двойного счёта),
    // состояние оценивается ценой уложенного + оптимистичной оценкой остатка ширины.
    type State={strips:Strip[];cnt:Int32Array;free:number;value:number;est:number};
    let beam:State[]=[{strips:[],cnt:cnt.slice(),free:this.X+k,value:0,est:0}];
    const complete:State[]=[];
    for(let depth=0;depth<12&&beam.length;depth++){
      const next:State[]=[];
      for(const st of beam){
        let grew=false;
        for(const w of this.stripWidths(st.cnt,st.free)){
          const c2=st.cnt.slice(),s=this.buildStrip(w,c2);if(!s)continue;
          shrink(s);grew=true;
          const free=st.free-(s.w+k),value=st.value+s.value;
          next.push({strips:[...st.strips,s],cnt:c2,free,value,est:value+this.estimate(c2,free)});
        }
        if(!grew)complete.push(st);
      }
      next.sort((a,b)=>b.est-a.est||b.value-a.value||b.free-a.free);
      const seen=new Set<string>();beam=[];
      for(const st of next){const key=Math.round(st.value)+'|'+Math.round(st.free);if(seen.has(key))continue;seen.add(key);beam.push(st);if(beam.length>=this.beamWidth)break;}
    }
    complete.push(...beam);
    complete.sort((a,b)=>b.value-a.value||b.free-a.free);
    const pick=complete[0];
    if(pick&&pick.strips.length){cnt.set(pick.cnt);layout.strips=pick.strips;layout.free=pick.free;layout.value=pick.value;}
    return layout;
  }
  beamWidth=3;
  /** Ширины-кандидаты полосы: поперечные размеры самых «дорогих» оставшихся деталей и весь остаток ширины. */
  stripWidths(cnt:Int32Array,free:number):number[]{
    const k=this.k,best=new Map<number,number>();
    for(const c of this.cands){
      if(!cnt[c.t]||c.across+k>free+EPS)continue;
      const key=Math.round(c.across*1000)/1000,v=this.price[c.t];
      if((best.get(key)??-1)<v)best.set(key,v);
    }
    if(!best.size)return [];
    const widths=[...best].sort((a,b)=>b[1]-a[1]||b[0]-a[0]).slice(0,this.widthCands).map(([w])=>w);
    const rest=Math.round((free-k)*1000)/1000;
    if(!widths.includes(rest))widths.push(rest);
    return widths;
  }
  widthCands=4;
  /** Оптимистичная оценка цены, которую ещё можно уложить в остаток ширины free. */
  estimate(cnt:Int32Array,free:number){
    const k=this.k;if(free<=k)return 0;
    let area=0,value=0;
    for(let t=0;t<this.types.length;t++){
      if(!cnt[t])continue;const ty=this.types[t];
      const fits=(ty.a+k<=free+EPS&&ty.l<=this.Y+EPS)||(ty.rot&&ty.l+k<=free+EPS&&ty.a<=this.Y+EPS);
      if(!fits)continue;area+=ty.area*cnt[t];value+=this.price[t]*cnt[t];
    }
    if(!area)return 0;
    const cap=0.9*(free-k)*this.Y;
    return area<=cap?value:value*cap/area;
  }
}
function segValue(seg:Seg,price:Float64Array){let v=0;for(const c of seg.cols)for(const r of c.rows)for(const p of r.pieces)v+=price[p.t];return v;}
function usage(seg:Seg){const m=new Map<number,number>();for(const c of seg.cols)for(const r of c.rows)for(const p of r.pieces)m.set(p.t,(m.get(p.t)??0)+1);return m;}
/** Фактическая ширина полосы: самый широкий отрезок (free отрезка = w + пропил − Σ(столбец + пропил)). */
function stripTight(s:Strip){let w=0;for(const g of s.segs)w=Math.max(w,s.w-g.free);return w;}
/** Поджать полосу до фактической ширины (освобождая ширину листа для следующих полос). */
function shrink(s:Strip){const t=stripTight(s),d=s.w-t;if(d<=0)return;for(const g of s.segs)g.free-=d;s.w=t;}
function distinctLengths(cands:Cand[],cnt:Int32Array,w:number,maxL:number){
  const out:number[]=[];
  for(const c of cands){if(!cnt[c.t]||c.across>w+EPS||c.along>maxL+EPS)continue;if(!out.length||Math.abs(out[out.length-1]-c.along)>EPS)out.push(c.along);}
  return [...new Set(out)];
}
/** Ограниченный рюкзак по целым мм: размер округляется вверх (раскладка всегда реальна), вместимость — вниз. */
let takeBuf=new Uint8Array(1<<16),bestBuf=new Float64Array(4096);
function knapsack(items:{size:number;value:number;max:number}[],cap:number):number[]{
  const C=Math.floor(cap+EPS),out=items.map(()=>0);if(C<=0||!items.length)return out;
  // двоичное разбиение кратностей
  const parts:{i:number;n:number;s:number;v:number}[]=[];
  items.forEach((it,i)=>{const s=Math.max(1,Math.ceil(it.size-EPS));if(s>C||it.max<=0)return;let left=Math.min(it.max,Math.floor(C/s)),b=1;while(left>0){const n=Math.min(b,left);parts.push({i,n,s:s*n,v:it.value*n});left-=n;b*=2;}});
  if(!parts.length)return out;
  const W=C+1;
  if(bestBuf.length<W)bestBuf=new Float64Array(W);
  if(takeBuf.length<W*parts.length)takeBuf=new Uint8Array(W*parts.length);
  const best=bestBuf,take=takeBuf;best.fill(0,0,W);take.fill(0,0,W*parts.length);
  parts.forEach((p,j)=>{const off=j*W;for(let c=C;c>=p.s;c--){const v=best[c-p.s]+p.v;if(v>best[c]+1e-9){best[c]=v;take[off+c]=1;}}});
  let c=C;
  for(let j=parts.length-1;j>=0;j--)if(take[j*W+c]){out[parts[j].i]+=parts[j].n;c-=parts[j].s;}
  return out;
}

/** Раскрой одной группы деталей (один материал/декор/толщина) на листы width × height (width — поперёк, height — вдоль текстуры). */
export function guillotinePack(parts:GuillotinePart[],width:number,height:number,options:GuillotineOptions={}):GuillotineResult{
  const kerf=options.kerf??GUILLOTINE_DEFAULTS.kerf,trim=options.trim??GUILLOTINE_DEFAULTS.trim,maxStages=options.maxStages??GUILLOTINE_DEFAULTS.maxStages;
  const iterations=Math.max(1,Math.floor(options.iterations??GUILLOTINE_DEFAULTS.iterations)),seed=options.seed??GUILLOTINE_DEFAULTS.seed;
  if(![width,height,kerf,trim].every(Number.isFinite)||width<=2*trim||height<=2*trim||kerf<0||trim<0)throw Error('Неверный формат листа, пропил или обрезка.');
  if(maxStages<5)throw Error('Движок строит карты в 5 стадий; предел стадий меньше 5 не поддерживается.');
  if(new Set(parts.map(p=>p.id)).size!==parts.length)throw Error('Повторяются детали.');
  const X=width-2*trim,Y=height-2*trim,unplaced:GuillotineUnplaced[]=[];
  const byKey=new Map<string,T>();
  for(const p of parts){
    if(![p.w,p.h].every(Number.isFinite)||p.w<=0||p.h<=0){unplaced.push({id:p.id,w:p.w,h:p.h,reason:'Неверный размер детали.'});continue;}
    const fits=(p.w<=X+EPS&&p.h<=Y+EPS)||(!!p.rot&&p.h<=X+EPS&&p.w<=Y+EPS);
    if(!fits){unplaced.push({id:p.id,w:p.w,h:p.h,reason:tooBig(p,X,Y,width,height,trim)});continue;}
    const key=[p.w,p.h,p.rot?1:0].join('|');
    const t=byKey.get(key);if(t)t.ids.push(p.id);else byKey.set(key,{a:p.w,l:p.h,rot:!!p.rot,ids:[p.id],area:p.w*p.h});
  }
  const types=[...byKey.values()].sort((a,b)=>b.area-a.area||b.l-a.l||b.a-a.a);
  types.forEach(t=>t.ids.sort((a,b)=>a.localeCompare(b,'ru',{numeric:true})));
  if(!types.length)return {sheets:[],unplaced,kerf,trim,maxStages,iterations:0};
  const packer=new Packer(types,X,Y,kerf),rand=mulberry32(seed),started=Date.now();
  const total=Int32Array.from(types,t=>t.ids.length);
  const base=Float64Array.from(types,t=>t.area);
  let best:{layouts:Layout[];score:number[]}|undefined,done=0;
  const correction=new Float64Array(types.length);
  for(let it=0;it<iterations;it++){
    if(it>0&&options.timeLimitMs!==undefined&&Date.now()-started>options.timeLimitMs)break;
    // цена = площадь × поправка по прошлым итерациям × шум от сида
    for(let i=0;i<types.length;i++)packer.price[i]=it===0?base[i]:base[i]*(1+correction[i])*(1+0.15*(rand()-0.5));
    const cnt=total.slice(),layouts:Layout[]=[];
    while(cnt.some(n=>n>0)){
      let L=packer.buildSheet(cnt);
      if(!L.strips.length){// страховка: одна деталь на лист (не должно случаться — все детали проверены на габарит)
        const i=cnt.findIndex(n=>n>0),c=packer.cands.find(c=>c.t===i)!;cnt[i]--;
        L={strips:[{w:c.across,free:0,value:0,segs:[{l:c.along,free:0,value:0,cols:[{c:c.across,free:0,rows:[{along:c.along,free:0,pieces:[{...c}]}]}]}]}],free:0,value:0};
      }
      layouts.push(L);
    }
    const score=scoreOf(layouts,packer,X,Y,kerf);
    if(!best||less(score,best.score))best={layouts,score};
    done++;
    // коррекция: детали на слабо заполненных листах дорожают
    const fill=layouts.map(L=>layoutArea(L,types)/(X*Y));
    const sum=new Float64Array(types.length),num=new Float64Array(types.length);
    layouts.forEach((L,j)=>{for(const p of pieces(L)){sum[p.t]+=1/Math.max(fill[j],0.05)-1;num[p.t]++;}});
    for(let i=0;i<types.length;i++)if(num[i])correction[i]=(correction[i]*it+sum[i]/num[i])/(it+1);
  }
  // последний лист: если всё помещается «поперечной» раскладкой и цельный остаток больше — берём её
  const layouts=best!.layouts;
  const lastIds=[...pieces(layouts.at(-1)!)];
  {
    const cnt=new Int32Array(types.length);for(const p of lastIds)cnt[p.t]++;
    const cross=packer.buildSheet(cnt.slice(),'cross');
    if(pieceCount(cross)===lastIds.length&&leftover(cross,X,Y,kerf)>leftover(layouts.at(-1)!,X,Y,kerf)+EPS)layouts[layouts.length-1]=cross;
  }
  // номера деталей одного типоразмера раздаются по порядку через все листы
  const used=new Map<number,number>();
  const sheets=layouts.map(L=>materialize(L,types,width,height,trim,kerf,maxStages,used));
  return {sheets,unplaced,kerf,trim,maxStages,iterations:done};
}
function tooBig(p:GuillotinePart,X:number,Y:number,width:number,height:number,trim:number){
  const long=Math.max(p.w,p.h);
  if(p.h>Y+EPS&&(!p.rot||p.w>Y+EPS||p.h>X+EPS))return `Длина ${fmt(p.h)} мм больше рабочей длины листа ${fmt(Y)} мм (${height} минус обрезка 2 × ${trim}): деталь сращивать из двух или заказать из целой плиты другого формата.`;
  if(p.w>X+EPS)return `Ширина ${fmt(p.w)} мм больше рабочей ширины листа ${fmt(X)} мм (${width} минус обрезка 2 × ${trim})${p.rot?'':' — поворот запрещён текстурой'}: сращивать или заказать отдельно.`;
  return `Деталь ${fmt(long)} мм не помещается в рабочее поле листа ${fmt(X)} × ${fmt(Y)} мм.`;
}
const fmt=(n:number)=>String(Math.round(n*10)/10).replace('.',',');
function* pieces(L:Layout){for(const s of L.strips)for(const g of s.segs)for(const c of g.cols)for(const r of c.rows)for(const p of r.pieces)yield p;}
function pieceCount(L:Layout){let n=0;for(const _ of pieces(L))n++;return n;}
function layoutArea(L:Layout,types:T[]){let a=0;for(const p of pieces(L))a+=types[p.t].area;return a;}
/** Цельный остаток листа: полоса справа во всю длину или (у поперечной раскладки) полоса сверху во всю ширину. */
function leftover(L:Layout,X:number,Y:number,k:number){
  if(L.strips.length===1&&Math.abs(L.strips[0].w-X)<1&&L.strips[0].segs.length){const used=L.strips[0].segs.reduce((s,g)=>s+g.l+k,0);return Math.max(0,Y-used)*X;}
  const used=L.strips.reduce((s,t)=>s+t.w+k,0);return Math.max(0,X-used)*Y;
}
/** Оценка решения: меньше листов → больше цельный остаток последнего листа → меньше резов. */
function scoreOf(layouts:Layout[],_p:Packer,X:number,Y:number,k:number){
  const last=layouts.at(-1)!;
  let cuts=0;for(const L of layouts){cuts+=L.strips.length;for(const s of L.strips){cuts+=s.segs.length;for(const g of s.segs){cuts+=g.cols.length;for(const c of g.cols)cuts+=c.rows.length;}}}
  return [layouts.length,-leftover(last,X,Y,k),cuts];
}
function less(a:number[],b:number[]){for(let i=0;i<a.length;i++){if(a[i]<b[i]-EPS)return true;if(a[i]>b[i]+EPS)return false;}return false;}
function materialize(L:Layout,types:T[],width:number,height:number,trim:number,k:number,maxStages:number,used:Map<number,number>):GuillotineSheet{
  const items:GuillotinePlaced[]=[];
  let x=trim;
  for(const s of L.strips){
    let y=trim;
    for(const g of s.segs){
      let cx=x;
      for(const c of g.cols){
        let ry=y;
        for(const r of c.rows){
          let px=cx;
          for(const p of r.pieces){
            const t=types[p.t],n=used.get(p.t)??0;used.set(p.t,n+1);
            items.push({id:t.ids[n],x:round(px),y:round(ry),w:p.across,h:p.along,rotated:p.o===1});
            px+=p.across+k;
          }
          ry+=r.along+k;
        }
        cx+=c.c+k;
      }
      y+=g.l+k;
    }
    x+=s.w+k;
  }
  const check=verifyGuillotine({width,height,items},{kerf:k,trim,maxStages});
  if(!check.ok)throw Error('Гильотина: внутренняя ошибка карты — '+check.errors.join(' '));
  const usedArea=items.reduce((s,a)=>s+a.w*a.h,0);
  return {width,height,items,cuts:check.cuts,tree:check.tree,stages:check.stages,offcuts:check.offcuts,usedArea,kim:usedArea/(width*height)};
}
const round=(v:number)=>Math.round(v*1000)/1000;
