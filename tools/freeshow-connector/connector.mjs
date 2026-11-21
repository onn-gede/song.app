import http from "node:http";

const HOST="127.0.0.1";
const PORT=5510;
const FREESHOW_URL="http://127.0.0.1:5506";
const MAX_BODY=2*1024*1024;
const ALLOWED_ORIGINS=new Set([
  "https://songappbcb.netlify.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function allowOrigin(request,response){
  const origin=request.headers.origin;
  if(!origin||!ALLOWED_ORIGINS.has(origin))return false;
  response.setHeader("Access-Control-Allow-Origin",origin);
  response.setHeader("Vary","Origin");
  response.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers","Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Private-Network","true");
  response.setHeader("Access-Control-Max-Age","600");
  return true;
}

function reply(response,status,payload){
  const body=typeof payload==="string"?payload:JSON.stringify(payload);
  response.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  response.end(body);
}

async function readCommand(request){
  let size=0;
  const chunks=[];
  for await(const chunk of request){
    size+=chunk.length;
    if(size>MAX_BODY)throw new Error("Cererea este prea mare.");
    chunks.push(chunk);
  }
  const value=JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}");
  if(!value||typeof value!=="object"||Array.isArray(value)||typeof value.action!=="string")throw new Error("Comanda FreeShow nu este validă.");
  if(value.action==="create_show"){
    if(value.open===undefined)value.open=true;
    if(!value.category)value.category="SongApp";
  }
  return JSON.stringify(value);
}

const server=http.createServer(async(request,response)=>{
  const allowed=allowOrigin(request,response);
  if(request.method==="OPTIONS"){
    response.writeHead(allowed?204:403,{"Cache-Control":"no-store"});
    response.end();
    return;
  }
  if(!allowed){reply(response,403,{error:"Originea SongApp nu este permisă."});return;}
  if(request.method==="GET"&&request.url==="/health"){
    reply(response,200,{ok:true,freeshow:FREESHOW_URL});
    return;
  }
  if(request.method!=="POST"||request.url!=="/freeshow"){
    reply(response,404,{error:"Rută inexistentă."});
    return;
  }
  try{
    const body=await readCommand(request);
    const headers={"Content-Type":"application/json;charset=UTF-8"};
    if(typeof request.headers.authorization==="string")headers.Authorization=request.headers.authorization;
    const result=await fetch(FREESHOW_URL,{method:"POST",headers,body,signal:AbortSignal.timeout(15000)});
    const text=await result.text();
    response.writeHead(result.status,{"Content-Type":result.headers.get("content-type")||"text/plain; charset=utf-8","Cache-Control":"no-store"});
    response.end(text);
  }catch(error){
    const message=error instanceof Error?error.message:"FreeShow nu a răspuns.";
    reply(response,502,{error:`Conectorul rulează, dar FreeShow nu a putut fi contactat: ${message}`});
  }
});

server.on("error",error=>{
  if(error&&error.code==="EADDRINUSE")console.error("Portul 5510 este deja folosit. Conectorul este probabil deja pornit.");
  else console.error(error);
  process.exitCode=1;
});

server.listen(PORT,HOST,()=>{
  console.log("====================================================");
  console.log(" SongApp - Conector FreeShow PORNIT");
  console.log("====================================================");
  console.log("SongApp LIVE: https://songappbcb.netlify.app");
  console.log(`Conector: http://${HOST}:${PORT}/freeshow`);
  console.log(`FreeShow REST: ${FREESHOW_URL}`);
  console.log("");
  console.log("Lasă această fereastră deschisă în timpul prezentării.");
  console.log("Pentru oprire apasă Ctrl+C sau închide fereastra.");
});
