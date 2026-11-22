import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {V_FILMS,V_MILLINGS,V_NOTES} from '../src/vernissageData';
import {VERNISSAGE_MILLINGS,coversOf,openings,thicknessesOf,vernissageFacadePrice} from '../src/facadesVernissage';
import {VERNISSAGE_MARKUP_DEFAULT as factor} from '../src/pricing';

const rates:Record<string,number>={};
const films=new Map(V_FILMS.map(f=>[f.cat,f.name]));
for(const m of V_MILLINGS) for(const [cat,film] of films) {
  for(const thickness of [16,18,19,22,25] as const) for(const open of ['solid','glass'] as const){
    const q=vernissageFacadePrice({milling:m.id,cover:'film',film,thickness:thickness as 19,open},600,800);
    if(q.perM2!==null)rates[[m.series,cat,thickness,open].join('/')]=Math.round(q.perM2*factor*100)/100;
  }
}
const enamelPatterns=VERNISSAGE_MILLINGS.filter(m=>coversOf(m.id).includes('enamel-matte') && (!m.pp?.covers || /эмаль/i.test(m.pp.covers))).map(m=>{
  const finishes=!coversOf(m.id).includes('enamel-gloss')||/эмаль мат/i.test(m.pp?.covers??'')?['matte']:['matte','glossy'];
  const thicknesses=m.pp?.mdf??thicknessesOf(m.id);
  for(const finish of finishes) for(const thickness of thicknesses) for(const open of ['solid','glass'] as const){
    if(!thicknessesOf(m.id).some(t=>t===thickness) || !openings(m).includes(open))continue;
    const q=vernissageFacadePrice({milling:m.id,cover:finish==='matte'?'enamel-matte':'enamel-gloss',thickness:thickness as 19,open},600,800);
    if(q.perM2!==null) rates[[m.id,'paint',finish,thickness,open].join('/')]=Math.round(q.perM2*factor*100)/100;
  }
  return {id:'studio-'+m.id,studioId:m.id,name:'Фрезеровка № '+m.id,desc:finishes.length===1?'Матовая эмаль':'Матовая или глянцевая эмаль',finishes,thicknesses,limits:m.pp?.limits??{}};
});
const data={enamelPatterns,rates,series:Object.fromEntries(V_MILLINGS.map(m=>[m.id,m.series])),categories:Object.fromEntries(V_FILMS.map((f,i)=>[i,f.cat])),minimum:V_NOTES.minAreaM2Pvc,boring:V_NOTES.hingeBoringPerPc*factor,date:V_NOTES.priceDate};
writeFileSync(join(process.argv[2],'retail-film.js'),'const facadeFilmRetail='+JSON.stringify(data)+';\nif(typeof module==="object"&&module.exports)module.exports=facadeFilmRetail;else globalThis.facadeFilmRetail=facadeFilmRetail;\n');
