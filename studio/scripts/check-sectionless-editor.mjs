// Regression: valid non-cabinet objects can survive after the cabinets are removed.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
// Only viewport values are needed by the tour during server rendering; effects do not run.
globalThis.window = {innerWidth:1280,innerHeight:800};
globalThis.innerWidth = 1280;
globalThis.innerHeight = 800;
globalThis.document = {documentElement:{clientWidth:1280,clientHeight:800}};
const baseline = process.argv.includes('--baseline');
const server = await createServer({server:{middlewareMode:true}, appType:'custom',plugins:baseline?[{
  name:'baseline-app',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/src/App.tsx'))return execFileSync('git',['show','81fe30b4:studio/src/App.tsx'],{encoding:'utf8'});}
}]:[]});
try {
  const {default:App} = await server.ssrLoadModule('/src/App.tsx');
  const {createModule} = await server.ssrLoadModule('/src/ModulePalette.tsx');
  const {initialModule} = await server.ssrLoadModule('/src/model.ts');
  const {newProject,parseProject} = await server.ssrLoadModule('/src/project.ts');
  for (const [kind,w,h,d] of [['kupe',1600,2400,100],['worktop',800,38,600]]) {
    const module = createModule(kind,w,h,d,initialModule());
    module.sections = [];
    const project = parseProject(JSON.parse(JSON.stringify(newProject(module))));
    if(process.argv.includes('--fixtures')) {
      await mkdir('public/local-projects',{recursive:true});
      await writeFile(`public/local-projects/regression-sectionless-${kind}.json`,JSON.stringify(project,null,2));
    }
    const before = JSON.stringify(project);
    const html = renderToString(createElement(App,{initialProject:project,saveManagedProject:()=>true}));
    assert.ok(html.includes('Рабочая область'));
    assert.equal(JSON.stringify(project),before,'Rendering must not insert fictitious sections');
    console.log(`PASS: ${kind} without sections renders after save/load`);
  }
} finally { await server.close(); }

