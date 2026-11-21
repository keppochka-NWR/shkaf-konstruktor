import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {V_FILMS,V_MILLINGS,V_NOTES} from '../src/vernissageData';
import {vernissageFacadePrice} from '../src/facadesVernissage';
import {VERNISSAGE_MARKUP_DEFAULT as factor} from '../src/pricing';

const rates:Record<string,number>={};
const films=new Map(V_FILMS.map(f=>[f.cat,f.name]));
for(const m of V_MILLINGS) for(const [cat,film] of films) {
  for(const thickness of [16,18,19,22,25] as const) for(const open of ['solid','glass'] as const){
    const q=vernissageFacadePrice({milling:m.id,cover:'film',film,thickness:thickness as 19,open},600,800);
    if(q.perM2!==null)rates[[m.series,cat,thickness,open].join('/')]=Math.round(q.perM2*factor*100)/100;
  }
}
const data={rates,series:Object.fromEntries(V_MILLINGS.map(m=>[m.id,m.series])),categories:Object.fromEntries(V_FILMS.map((f,i)=>[i,f.cat])),minimum:V_NOTES.minAreaM2Pvc,boring:V_NOTES.hingeBoringPerPc*factor,date:V_NOTES.priceDate};
writeFileSync(join(process.argv[2],'retail-film.js'),'const facadeFilmRetail='+JSON.stringify(data)+';\nif(typeof module==="object"&&module.exports)module.exports=facadeFilmRetail;else globalThis.facadeFilmRetail=facadeFilmRetail;\n');
