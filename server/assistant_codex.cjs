// Dedicated, tool-disabled inference process. Does not use the Telegram queue or thread.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const input=fs.readFileSync(process.argv[2],'utf8');
(()=>{
 try{
  const q=JSON.parse(input),base='C:\\YoConstructorAI',job=path.resolve(q.directory);
  if(!job.startsWith(base+'\\')||!/^[a-f0-9]{32}$/.test(path.basename(job)))throw Error('Invalid request path');
  const auth='C:\\Users\\Макас\\CodexBridge\\auth';
  const codex='C:\\Users\\Макас\\CodexBridge\\runtime\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe';
  const args=['-c','approval_policy="never"','-c','sandbox_mode="read-only"','-c','project_doc_max_bytes=0','-c','features.skip_host_skill_discovery=true','-c','apps._default.enabled=false','-c','web_search="disabled"','-c','model_reasoning_effort="medium"'];
  for(const flag of ['shell_tool','apps','plugins','remote_plugin','plugin_discovery_prefetch','multi_agent','multi_agent_v2','computer_use','browser_use','browser_use_external','in_app_browser','view_image','image_generation','code_mode','code_mode_host','hooks','memories','skill_search','skill_mcp_dependency_install','artifact','workspace_dependencies'])args.push('-c',`features.${flag}=false`);
  args.push('-c','model_instructions_file='+JSON.stringify(path.join(job,'instructions.txt')),'exec','--ignore-user-config','--ephemeral','--model','gpt-6-astra','--skip-git-repo-check','--json','--output-schema',path.join(job,'schema.json'),'-o',path.join(job,'answer.json'));
  for(const image of q.images){if(path.dirname(path.resolve(image))!==job)throw Error('Invalid image path');args.push('--image',image);}
  args.push('--','-');
  const env={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,PATH:process.env.PATH,USERPROFILE:process.env.USERPROFILE,APPDATA:process.env.APPDATA,LOCALAPPDATA:process.env.LOCALAPPDATA,TEMP:process.env.TEMP,TMP:process.env.TMP,CODEX_HOME:auth};
  const p=spawn(codex,args,{cwd:job,env,windowsHide:true,stdio:['pipe','pipe','pipe']});p.stdout.resume();let diagnostic='';p.stderr.setEncoding('utf8');p.stderr.on('data',s=>{diagnostic=(diagnostic+s).slice(-12000)});
  const timer=setTimeout(()=>{p.kill();process.stdout.write(JSON.stringify({error:'Model timeout'}));process.exitCode=1;},210000);
  p.on('error',()=>{clearTimeout(timer);process.stdout.write(JSON.stringify({error:'Model launch failed'}));process.exitCode=1;});
  p.on('close',code=>{clearTimeout(timer);fs.writeFileSync(path.join(job,'diagnostic.txt'),diagnostic);if(code===0&&fs.existsSync(path.join(job,'answer.json')))process.stdout.write(fs.readFileSync(path.join(job,'answer.json'),'utf8'));else{process.stdout.write(JSON.stringify({error:'Model did not return an answer'}));process.exitCode=1;}});
  p.stdin.end(q.prompt);
 }catch{process.stdout.write(JSON.stringify({error:'Invalid inference request'}));process.exitCode=1;}
})();