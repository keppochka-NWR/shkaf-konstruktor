import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject} from '../src/project';
import {DEFAULT_ALU} from '../src/alu';
import {estimate} from '../src/pricing';
import {premialAluHingeQuote} from '../src/premialPricing';
test('aluminium facade uses ALUM hinges even in a saved GTV module, once',()=>{
 const p=newProject();p.modules[0].module.alu={...DEFAULT_ALU};p.modules[0].module.hingeBrand='gtv';
 const e=estimate(p),rows=e.lines.filter(l=>l.id.startsWith('premial-alu-hinge:'));
 assert.equal(rows.length,1);assert.match(rows[0].label,/250506/);assert.equal(rows[0].unitPrice,209.3);assert.equal(rows[0].retail,true);
 assert.ok(!e.lines.some(l=>/^hinge(:|$|-inset)|^premial-hinge:/.test(l.id)));
 delete p.modules[0].module.alu;assert.ok(!estimate(p).lines.some(l=>l.id.startsWith('premial-alu-hinge:')));
});
test('ALUM variants follow inset, black and push-to-open; special geometry stays pending',()=>{
 assert.match(premialAluHingeQuote(true,'soft').label,/250508/);
 assert.match(premialAluHingeQuote(false,'soft',true).label,/250503/);
 assert.match(premialAluHingeQuote(false,'free').label,/250521/);
 assert.equal(premialAluHingeQuote(false,'soft',false,155).price,null);
 assert.equal(premialAluHingeQuote(false,'soft',false,undefined,true).price,null);
});
