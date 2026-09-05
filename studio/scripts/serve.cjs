const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../../web");
const {spawn}=require('node:child_process');
const python=process.env.STUDIO_PYTHON||path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const apiProcess=spawn(python,[path.resolve(__dirname,'../../server/run_studio.py')],{env:{...process.env,STUDIO_DEMO:process.env.STUDIO_DEMO||'1'},windowsHide:true,stdio:['ignore','inherit','inherit']});
apiProcess.on('error',()=>console.error('Cabinet server unavailable. Set STUDIO_PYTHON to a Python interpreter.'));
process.on('exit',()=>apiProcess.kill());
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
http
  .createServer((req, res) => {
    if(req.url.startsWith('/api/studio')){
      const upstream=http.request({hostname:'127.0.0.1',port:8104,path:req.url,method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
      upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({detail:'Сервер кабинета ещё не запущен. Повторите через несколько секунд.'}));});req.pipe(upstream);return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400);
      return res.end();
    }
    let file = path.resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    try {
      if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      const data = fs.readFileSync(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(8103, "127.0.0.1", () =>
    console.log("Module studio: http://127.0.0.1:8103/studio/"),
  );
