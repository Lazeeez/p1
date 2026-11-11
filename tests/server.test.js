import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const BASE='http://127.0.0.1:45273';
const DIR=fileURLToPath(new URL('..',import.meta.url));
let child;
before(async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'patternlab-test-server-'));
  child=spawn(process.execPath,['server.js'],{cwd:DIR,env:{...process.env,PORT:'45273',PATTERNLAB_DATA_DIR:dataDir},stdio:'ignore'});
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)throw Error('Server exited before responding.');
    try{if((await fetch(BASE+'/api/status')).ok)return;}catch{}
    await new Promise(r=>setTimeout(r,50));
  }
  throw Error('Test server did not respond.');
});
after(()=>child?.kill());

test('serves only allowed assets, never auth code, JSON manifests, or secrets',async()=>{
  for(const path of ['/','/index.html','/app.js','/catalog.js','/runner.worker.js','/styles.css','/study-guides.js','/personal-content.js'])assert.equal((await fetch(BASE+path)).status,200,path);
  for(const path of ['/server.js','/auth.js','/package.json','/README.md','/.git/config','/auth.json','/../server.js']){
    assert.equal((await fetch(BASE+path)).status,404,path);
  }
  const page=await (await fetch(BASE+'/')).text();assert.match(page,/PatternLab/);
  const status=await (await fetch(BASE+'/api/status')).json();assert.equal(status.provider,'offline');assert.equal(status.sharing,false);
});

test('forbids host-header attacks and cross-origin POST',async()=>{
  const evil=await new Promise((resolve,reject)=>{http.get(BASE+'/api/status',{headers:{Host:'attacker.example'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}).on('error',reject)});assert.equal(evil,403);
  const sameIpOtherHostname=await fetch(BASE+'/api/auth/start',{method:'POST',headers:{Origin:'http://localhost:45273','Content-Type':'application/json'},body:'{}'});assert.equal(sameIpOtherHostname.status,403);
  const cross=await fetch(BASE+'/api/auth/start',{method:'POST',headers:{Origin:'http://attacker.example','Content-Type':'application/json'},body:'{}'});assert.equal(cross.status,403);
  const missing=await fetch(BASE+'/api/auth/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(missing.status,403);
  const wrongContent=await fetch(BASE+'/api/auth/start',{method:'POST',headers:{Origin:BASE,'Content-Type':'text/plain'},body:'{}'});assert.equal(wrongContent.status,415);
  const wrongMethod=await fetch(BASE+'/api/auth/start');assert.equal(wrongMethod.status,405);
});

test('no paid API is used automatically and offline fallback remains functional',async()=>{
  const body={message:'I am stuck',code:'def foo(): pass',problem:{title:'Example',pattern:'Arrays'}};
  const response=await fetch(BASE+'/api/coach',{method:'POST',headers:{Origin:BASE,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal(response.status,409);assert.match((await response.json()).error,/AI not connected/);
  const json=await fetch(BASE+'/api/coach',{method:'POST',headers:{Origin:BASE,'Content-Type':'application/json'},body:'{' });assert.equal(json.status,400);
  const tooLong=await fetch(BASE+'/api/coach',{method:'POST',headers:{Origin:BASE,'Content-Type':'application/json'},body:JSON.stringify({...body,code:'x'.repeat(18001)})});assert.equal(tooLong.status,400);
});

test('generated-content endpoint denies unauthenticated use and rejects malformed input',async()=>{
  const headers={Origin:BASE,'Content-Type':'application/json'};
  const notConnected=await fetch(BASE+'/api/generate',{method:'POST',headers,body:JSON.stringify({kind:'pattern',topic:'segment trees'})});
  assert.equal(notConnected.status,409);assert.match((await notConnected.json()).error,/Connect ChatGPT/);
  for(const body of [{kind:'invalid',topic:'x'},{kind:'exercise',topic:'x'},{kind:'pattern',topic:'x'.repeat(171)}]){
    const res=await fetch(BASE+'/api/generate',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(res.status,400);
  }
});

test('sign-in uses official OAuth URL and callback checks the one-time state',async()=>{
  const response=await fetch(BASE+'/api/auth/start',{method:'POST',headers:{Origin:BASE,'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,200);
  const {url}=await response.json();const authUrl=new URL(url);assert.equal(authUrl.hostname,'auth.openai.com');assert.equal(authUrl.searchParams.get('client_id'),'dynamic_agent_client');
  assert.equal(authUrl.searchParams.get('redirect_uri'),BASE+'/auth/callback');
  const bad=await fetch(BASE+'/auth/callback?state=bad&code=fake',{redirect:'manual'});assert.equal(bad.status,303);assert.equal(bad.headers.get('location'),'/?chatgpt=error');
});
