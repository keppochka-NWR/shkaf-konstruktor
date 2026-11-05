import * as k from '../src/kupeData';
import * as a from '../src/alu';
import * as v from '../src/vernissageData';
import * as h from '../src/handles';
import * as p from '../src/pricing';
for (const [name,mod] of Object.entries({k,a,v,h,p})) {
 console.log(name,Object.keys(mod));
 for(const [key,val] of Object.entries(mod)) if(Array.isArray(val))console.log(key,'count',val.length,'first',JSON.stringify(val[0]).slice(0,1800));
}
