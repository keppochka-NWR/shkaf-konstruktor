import test from 'node:test';
import assert from 'node:assert/strict';
import {Texture,Vector2} from 'three';
import {applyTextureContent,textureContentStyle} from '../src/textureContent';
import {textureContentRects} from '../src/textureContentRects';
import {compactProducts} from '../src/compactCatalog';
test('every Premial compact sample excludes its presentation margins in 3D',()=>{
 const textures=new Set(compactProducts.filter(d=>d.brand==='Premial').map(d=>d.tex));
 assert.equal(textures.size,43);
 for(const url of textures){const r=textureContentRects[url];assert.ok(r,url);assert.ok(r.width>0&&r.height>0&&r.x+r.width<=r.imageWidth&&r.y+r.height<=r.imageHeight);
  const map=new Texture();applyTextureContent(map,'/studio/'+url);const lo=new Vector2(0,0).applyMatrix3(map.matrix),hi=new Vector2(1,1).applyMatrix3(map.matrix);
  assert.ok(Math.abs(lo.x*r.imageWidth-r.x)<1e-8);assert.ok(Math.abs((1-hi.y)*r.imageHeight-r.y)<1e-8);
  assert.ok(Math.abs((hi.y-lo.y)*r.imageHeight-r.height)<1e-8);assert.ok(textureContentStyle(url).backgroundSize);
 }
});
test('ordinary wood and film textures retain their original mapping',()=>{
 const map=new Texture();applyTextureContent(map,'tex/wood.jpg');assert.deepEqual(map.repeat.toArray(),[1,1]);assert.deepEqual(map.offset.toArray(),[0,0]);assert.deepEqual(textureContentStyle('tex/wood.jpg'),{});
});
