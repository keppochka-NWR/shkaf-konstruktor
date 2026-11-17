import type {Texture} from 'three';
import {textureContentRects} from './textureContentRects';

function content(url:string){
 const path=url.split(/[?#]/)[0];
 return textureContentRects[path.slice(path.indexOf('tex/'))];
}
/** Select the sample, not the white surround in the supplier's product image. */
export function applyTextureContent(map:Texture,url:string){
 const r=content(url);if(!r)return;
 map.repeat.set(r.width/r.imageWidth,r.height/r.imageHeight);
 map.offset.set(r.x/r.imageWidth,(r.imageHeight-r.y-r.height)/r.imageHeight);
 map.updateMatrix();
}
export function textureContentStyle(url:string){
 const r=content(url);if(!r)return {};
 return {backgroundSize:`${100*r.imageWidth/r.width}% ${100*r.imageHeight/r.height}%`,
  backgroundPosition:`${r.imageWidth===r.width?50:100*r.x/(r.imageWidth-r.width)}% ${r.imageHeight===r.height?50:100*r.y/(r.imageHeight-r.height)}%`};
}
