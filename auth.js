// Official Sign in with ChatGPT (local open-source app) via PKCE and OpenID Connect.
// Node built-ins only: credentials are never exposed to the browser or repository.
import {randomBytes,randomUUID,createHash,createPublicKey,verify,constants,timingSafeEqual} from 'node:crypto';
import {readFile,writeFile,rename,mkdir,chmod} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';

const ISSUER='https://auth.openai.com';
const TOKEN_URL=ISSUER+'/api/accounts/oauth/token';
const AUTHORIZE_URL=ISSUER+'/api/accounts/authorize';
const JWKS_URL=ISSUER+'/.well-known/jwks.json';
const RESOURCE='https://api.openai.com/v1';
const REQUEST_SCOPES='openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const rand=()=>randomBytes(32).toString('base64url');
const hash=s=>createHash('sha256').update(s).digest('base64url');
const matches=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)};
const fetchLimited=async (fetchFn,url,opts={})=>fetchFn(url,{...opts,signal:AbortSignal.timeout(15000)});
const stringValue=(v)=>typeof v==='string'&&v.length>0?v:null;
const errorSafe=(message)=>new Error(message);

export async function verifyIdentityToken(token,clientId,nonce,fetchFn=fetch){
  if(typeof token!=='string'||token.length>16000)throw errorSafe('Invalid identity token.');
  const parts=token.split('.');if(parts.length!==3)throw errorSafe('Invalid identity token format.');
  let header,payload;
  try{header=JSON.parse(Buffer.from(parts[0],'base64url').toString());payload=JSON.parse(Buffer.from(parts[1],'base64url').toString())}
  catch{throw errorSafe('Invalid identity token encoding.');}
  // Explicit algorithm allowlist prevents signature-algorithm confusion.
  if(!['RS256','PS256','ES256'].includes(header.alg)||typeof header.kid!=='string')throw errorSafe('Unsupported identity signature.');
  const jwksResponse=await fetchLimited(fetchFn,JWKS_URL);
  if(!jwksResponse.ok)throw errorSafe('Could not verify ChatGPT identity keys.');
  const jwks=await jwksResponse.json();
  const key=Array.isArray(jwks.keys)?jwks.keys.find(k=>k.kid===header.kid&&(!k.alg||k.alg===header.alg)&&(!k.use||k.use==='sig')):null;
  if(!key)throw errorSafe('ChatGPT identity signing key not found.');
  let publicKey;
  try{publicKey=createPublicKey({key,format:'jwk'});}catch{throw errorSafe('Invalid identity signing key.');}
  const message=Buffer.from(parts[0]+'.'+parts[1]);const signature=Buffer.from(parts[2],'base64url');
  let options=publicKey;
  if(header.alg==='PS256')options={key:publicKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32};
  if(header.alg==='ES256')options={key:publicKey,dsaEncoding:'ieee-p1363'};
  if(!verify('sha256',message,options,signature))throw errorSafe('ChatGPT identity signature did not verify.');
  const now=Math.floor(Date.now()/1000);
  const audience=Array.isArray(payload.aud)?payload.aud:[payload.aud];
  if(payload.iss!==ISSUER||!audience.includes(clientId)||!stringValue(payload.sub)||!matches(payload.nonce,nonce)||!Number.isFinite(payload.exp)||payload.exp<now-5||!Number.isFinite(payload.iat)||payload.iat>now+60|| (Number.isFinite(payload.nbf)&&payload.nbf>now+60))throw errorSafe('ChatGPT identity validation failed.');
  return {issuer:payload.iss,subject:payload.sub,email:typeof payload.email==='string'?payload.email:null};
}

export class LocalChatGPT {
  constructor({port,dataDir=join(homedir(),'.patternlab'),fetchFn=fetch}={}){
    this.port=port;this.dataDir=dataDir;this.fetchFn=fetchFn;this.path=join(dataDir,'auth.json');this.hostPath=join(dataDir,'host.json');
    this.auth=null;this.hostId=null;this.pending=null;this.refreshPromise=null;this.models=null;this.modelsAt=0;
  }
  async init(){
    await mkdir(this.dataDir,{recursive:true,mode:0o700});
    try{const file=JSON.parse(await readFile(this.path,'utf8'));if(file&&typeof file.client_id==='string')this.auth=file;}catch{}
    try{const file=JSON.parse(await readFile(this.hostPath,'utf8'));if(/^urn:uuid:[a-f0-9-]{36}$/i.test(file.id))this.hostId=file.id;}catch{}
    if(!this.hostId){this.hostId='urn:uuid:'+randomUUID();await this.save(this.hostPath,{id:this.hostId});}
  }
  async save(path,value){
    const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});
    await chmod(temp,0o600);await rename(temp,path);
  }
  status(){return {connected:!!this.auth?.access_token,sharing:!!(this.auth?.access_token&&this.auth.scopes?.includes('chatgpt.tokens.use.direct')),email:this.auth?.email||null,clientRegistered:!!this.auth?.client_id};}
  begin(){
    // A second click intentionally replaces any abandoned sign-in attempt.
    const registered=!!this.auth?.client_id;const clientId=registered?this.auth.client_id:'dynamic_agent_client';
    const state=rand(),nonce=rand(),verifier=rand();
    const redirectUri=`http://127.0.0.1:${this.port}/auth/callback`;
    this.pending={state,nonce,verifier,clientId,redirectUri,expiresAt:Date.now()+10*60_000};
    const url=new URL(AUTHORIZE_URL);for(const [k,v] of Object.entries({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:REQUEST_SCOPES,resource:RESOURCE,state,nonce,code_challenge_method:'S256',code_challenge:hash(verifier),ext_agent_host_id:this.hostId}))url.searchParams.set(k,v);
    if(!registered)url.searchParams.set('agent_name_hint','PatternLab');
    // Avoid sending any retained ID token through the browser-facing start response.
    return url.toString();
  }
  async handleCallback(url){
    const tx=this.pending;this.pending=null;
    if(!tx||tx.expiresAt<Date.now()||!matches(url.searchParams.get('state'),tx.state))throw errorSafe('Sign-in expired or state verification failed. Restart sign-in from Settings.');
    if(url.searchParams.has('error'))throw errorSafe('ChatGPT sign-in was canceled or access was declined.');
    const code=url.searchParams.get('code');if(!stringValue(code)||code.length>5000)throw errorSafe('ChatGPT sign-in returned no valid code.');
    const clientId=tx.clientId==='dynamic_agent_client'?url.searchParams.get('client_id'):tx.clientId;
    if(!stringValue(clientId)||clientId==='dynamic_agent_client'||(tx.clientId!=='dynamic_agent_client'&&url.searchParams.has('client_id')&&url.searchParams.get('client_id')!==tx.clientId))throw errorSafe('ChatGPT registration did not return the expected client.');
    // Keep the new registered ID even if code exchange fails, to avoid repeat registration.
    if(tx.clientId==='dynamic_agent_client'&&!this.auth?.access_token){this.auth={client_id:clientId,scopes:[]};await this.save(this.path,this.auth);}
    const response=await fetchLimited(this.fetchFn,TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,code,code_verifier:tx.verifier,redirect_uri:tx.redirectUri,resource:RESOURCE})});
    if(!response.ok)throw errorSafe('ChatGPT sign-in could not be completed. Try connecting again.');
    const tokens=await response.json();if(!stringValue(tokens.id_token)||!stringValue(tokens.access_token)||!stringValue(tokens.refresh_token))throw errorSafe('ChatGPT did not return a complete session.');
    const identity=await verifyIdentityToken(tokens.id_token,clientId,tx.nonce,this.fetchFn);
    if(this.auth?.subject&&this.auth.subject!==identity.subject)throw errorSafe('This registration belongs to a different ChatGPT account.');
    const scopes=String(tokens.scope||'').split(/\s+/).filter(Boolean);
    this.auth={...identity,client_id:clientId,id_token:tokens.id_token,access_token:tokens.access_token,refresh_token:tokens.refresh_token,scopes,expiresAt:Date.now()+Number(tokens.expires_in||3600)*1000};
    await this.save(this.path,this.auth);this.models=null;return this.status();
  }
  async refresh(){
    if(this.refreshPromise)return this.refreshPromise;
    this.refreshPromise=(async()=>{
      const old=this.auth;
      if(!old?.refresh_token)throw errorSafe('Connect your ChatGPT account in Settings.');
      const response=await fetchLimited(this.fetchFn,TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams({grant_type:'refresh_token',client_id:old.client_id,refresh_token:old.refresh_token,resource:RESOURCE})});
      if(!response.ok)throw errorSafe('ChatGPT session expired. Reconnect from Settings.');
      const tokens=await response.json();if(!stringValue(tokens.access_token)||!stringValue(tokens.refresh_token))throw errorSafe('Could not renew ChatGPT access. Reconnect from Settings.');
      const updated={...old,access_token:tokens.access_token,refresh_token:tokens.refresh_token,expiresAt:Date.now()+Number(tokens.expires_in||3600)*1000};
      if(typeof tokens.scope==='string')updated.scopes=tokens.scope.split(/\s+/).filter(Boolean);
      this.auth=updated;await this.save(this.path,updated);return updated;
    })().finally(()=>{this.refreshPromise=null});
    return this.refreshPromise;
  }
  async accessToken(){
    if(!this.status().sharing)throw errorSafe('Connect ChatGPT and allow plan usage in Settings.');
    if(!this.auth.expiresAt||this.auth.expiresAt<Date.now()+90000)await this.refresh();
    return this.auth.access_token;
  }
  async listModels(force=false){
    if(!force&&this.models&&Date.now()-this.modelsAt<10*60_000)return this.models;
    const response=await fetchLimited(this.fetchFn,RESOURCE+'/models',{headers:{Authorization:'Bearer '+await this.accessToken()}});
    if(!response.ok)throw errorSafe(response.status===401?'ChatGPT session expired. Reconnect in Settings.':'Could not load the ChatGPT model list.');
    const result=await response.json();const list=Array.isArray(result.models)?result.models:Array.isArray(result.data)?result.data:[];
    this.models=list.filter(m=>m&&typeof (m.slug||m.id)==='string'&&(!m.visibility||m.visibility==='list')).map(m=>({slug:m.slug||m.id,name:m.display_name||m.name||m.slug||m.id}));
    this.modelsAt=Date.now();return this.models;
  }
  async coach({instructions,input,model}){
    const models=await this.listModels();
    const selected=models.some(m=>m.slug===model)?model:models[0]?.slug;
    if(!selected)throw errorSafe('No ChatGPT models are available for this connection.');
    const response=await this.fetchFn(RESOURCE+'/responses',{method:'POST',signal:AbortSignal.timeout(60000),headers:{Authorization:'Bearer '+await this.accessToken(),'Content-Type':'application/json','Accept':'text/event-stream'},body:JSON.stringify({model:selected,store:false,stream:true,instructions,input})});
    if(!response.ok)throw errorSafe(response.status===429?'Your ChatGPT plan limit was reached. Check Settings → Usage in ChatGPT.':response.status===401?'Reconnect ChatGPT in Settings.':`ChatGPT could not complete this request (HTTP ${response.status}).`);
    if(!response.body)throw errorSafe('ChatGPT returned no response stream.');
    const reader=response.body.getReader();const decoder=new TextDecoder();let buf='',completed=false,reply='',eventCount=0;
    try{
      while(true){const {done,value}=await reader.read();if(done)break;buf+=decoder.decode(value,{stream:true});if(buf.length>100000)throw errorSafe('AI stream was unexpectedly large.');
        const frames=buf.split(/\r?\n\r?\n/);buf=frames.pop();
        for(const frame of frames){const line=frame.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('');if(!line||line==='[DONE]')continue;
          let evt;try{evt=JSON.parse(line)}catch{continue}eventCount++;if(eventCount>12000)throw errorSafe('AI stream exceeded safe limits.');
          if(evt.type==='response.output_text.delta'&&typeof evt.delta==='string')reply+=evt.delta;
          if(evt.type==='response.completed'){completed=true;if(!reply)reply=(evt.response?.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n')}
          if(evt.type==='response.failed'||evt.type==='response.incomplete')throw errorSafe(evt.response?.error?.code==='subscription_sharing_usage_limit_exceeded'?'ChatGPT plan usage limit reached. Check ChatGPT Settings → Usage.':'ChatGPT did not finish the explanation. Please retry.');
          if(reply.length>15000)throw errorSafe('AI reply exceeded the length limit.');
        }
      }
    }finally{reader.releaseLock();}
    if(!completed||!reply.trim())throw errorSafe('ChatGPT did not finish the explanation. Please retry.');
    return {reply:reply.trim(),model:selected};
  }
  async disconnect(){
    // Remove local tokens immediately; do not expose refresh tokens in URL or console.
    const old=this.auth;this.auth=null;this.pending=null;this.models=null;
    if(old?.client_id){this.auth={client_id:old.client_id,subject:old.subject,email:old.email,scopes:[]};await this.save(this.path,this.auth);}
    // Server revocation is best effort. The user can revoke app access from ChatGPT Settings.
    if(old?.refresh_token){try{const discovery=await fetchLimited(this.fetchFn,ISSUER+'/.well-known/openid-configuration');if(discovery.ok){const doc=await discovery.json();const target=new URL(doc.revocation_endpoint);if(target.protocol==='https:'&&target.hostname==='auth.openai.com')await fetchLimited(this.fetchFn,target.toString(),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:old.refresh_token,token_type_hint:'refresh_token',client_id:old.client_id})});}}catch{}}
  }
}
