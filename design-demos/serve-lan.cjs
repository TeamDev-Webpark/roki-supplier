'use strict';
/* Serves this folder on the local network: node serve-lan.cjs [port] */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const ROOT=__dirname,PORT=Number(process.argv[2])||8080;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
  const rel=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,'')||'roki.html',file=path.resolve(ROOT,rel);
  if(rel==='favicon.ico'){res.writeHead(204).end();return}
  if(!file.startsWith(ROOT+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(e,d)=>{if(e){res.writeHead(404).end('Not found');return}res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(d)});
}).listen(PORT,'0.0.0.0',()=>{
  for(const l of Object.values(os.networkInterfaces()).flat())if(l.family==='IPv4'&&!l.internal)console.log(`http://${l.address}:${PORT}/roki.html   http://${l.address}:${PORT}/supplier.html`);
});
