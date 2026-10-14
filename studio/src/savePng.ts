/** Download the already rendered image as a file, including browsers that reject data URL downloads. */
export function savePng(dataUrl:string){
  if(!dataUrl.startsWith('data:image/png;base64,'))throw Error('Нет готового изображения PNG.');
  const bytes=Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',')+1)),c=>c.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'})),a=document.createElement('a');
  a.href=url;a.download='Проект мебели.png';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
