import type {Module} from './model';
import {RULES} from './model';
import {waterfallSides} from './kitchen';
import {packRectangles,type Packed} from './packing';
import {compactPriceCatalog} from './compactPriceCatalog';

export type CompactStock = typeof compactPriceCatalog[number];
export type CompactSheetQuote = {
  decor:string; thickness:number; stock:CompactStock|null;
  sheets:Packed[][]; price:number|null; error?:string;
};
/** Whole sheets, grouped by exact decor and thickness. Rectangular blanks include
 * waterfall mitres. Cutouts never reduce the purchased material. Grain is fixed.
 * Uses the current workshop margin/kerf, not a supplier cutting certificate.
 * Compares single-format layouts; does not claim a globally minimal mixed-format layout. */
export function compactSheetQuotes(modules:Module[],catalog:readonly CompactStock[]=compactPriceCatalog):CompactSheetQuote[]{
  const groups=new Map<string,{decor:string;thickness:number;parts:{id:string;w:number;h:number}[]}>();
  modules.forEach((m,i)=>{
    const w=m.worktop;if(w?.material!=='compact')return;
    const key=JSON.stringify([m.decor,w.thickness]);
    const g=groups.get(key)??{decor:m.decor,thickness:w.thickness,parts:[]};
    g.parts.push({id:`${i}:top`,w:m.width,h:m.depth});
    for(const side of waterfallSides(w))g.parts.push({id:`${i}:${side}`,w:w.waterfall!.drop+w.thickness,h:m.depth});
    groups.set(key,g);
  });
  return [...groups.values()].map(g=>{
    const stocks=catalog.filter(s=>s.decor===g.decor&&s.thickness===g.thickness&&s.clientSheetPrice>0);
    let best:CompactSheetQuote|null=null;
    for(const stock of stocks){
      const width=stock.length-2*RULES.sheetMargin,height=stock.width-2*RULES.sheetMargin;
      if(g.parts.some(p=>!Number.isFinite(p.w)||!Number.isFinite(p.h)||p.w<=0||p.h<=0||p.w>width||p.h>height))continue;
      for(const order of ['area','height','width'] as const)for(const fit of ['short','area'] as const){
        const sheets=packRectangles(g.parts,width,height,RULES.sheetKerf,order,fit)
          .map(s=>s.map(p=>({...p,x:p.x+RULES.sheetMargin,y:p.y+RULES.sheetMargin})));
        const price=sheets.length*stock.clientSheetPrice;
        if(!best||price<best.price!||(price===best.price&&sheets.length<best.sheets.length))best={decor:g.decor,thickness:g.thickness,stock,sheets,price};
      }
    }
    return best??{decor:g.decor,thickness:g.thickness,stock:null,sheets:[],price:null,
      error:stocks.length?'Детали не помещаются в подтверждённые форматы листов с припусками; требуется решение по раскрою.':'Нет подтверждённой цены для этого декора и толщины.'};
  });
}
