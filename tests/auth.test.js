import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSign,generateKeyPairSync} from 'node:crypto';
import {LocalChatGPT,verifyIdentityToken} from '../auth.js';

function makeJwt(payload,privateKey){
  const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'mock-rsa'})).toString('base64url');
  const content=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const message=header+'.'+content;
  const signature=createSign('RSA-SHA256').update(message).end().sign(privateKey).toString('base64url');
  return message+'.'+signature;
}
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'mock-rsa',use:'sig',alg:'RS256'};
const now=()=>Math.floor(Date.now()/1000);
const claims=(client,nonce)=>({iss:'https://auth.openai.com',aud:client,sub:'test_user',nonce,iat:now(),exp:now()+3600,email:'test@example.com'});
function makeFetch(getNonce){
  return async (url,options={})=>{
    if(String(url).endsWith('/.well-known/jwks.json'))return Response.json({keys:[jwk]});
    if(String(url).endsWith('/api/accounts/oauth/token')){
      const body=new URLSearchParams(options.body);
      return Response.json(body.get('grant_type')==='refresh_token'
        ? {access_token:'renewed-access',refresh_token:'renewed-refresh',expires_in:3600}
        : {id_token:makeJwt(claims(body.get('client_id'),getNonce()),privateKey),access_token:'mock-access',refresh_token:'mock-refresh',expires_in:3600,scope:'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct'});
    }
    if(String(url).endsWith('/v1/models'))return Response.json({models:[{slug:'test-model',display_name:'Test model',visibility:'list'},{slug:'hidden',visibility:'hidden'}]});
    if(String(url).endsWith('/v1/responses')){
      const parsed=JSON.parse(options.body);
      assert.equal(parsed.store,false);assert.equal(parsed.stream,true);assert.equal(parsed.model,'test-model');
      return new Response('data: '+JSON.stringify({type:'response.output_text.delta',delta:'Try tracing the invariant.'})+'\n\n'+'data: '+JSON.stringify({type:'response.completed'})+'\n\n',{headers:{'Content-Type':'text/event-stream'}});
    }
    if(String(url).endsWith('/.well-known/openid-configuration'))return Response.json({revocation_endpoint:'https://auth.openai.com/api/accounts/oauth/revoke'});
    if(String(url).endsWith('/api/accounts/oauth/revoke'))return new Response('',{status:200});
    throw Error('Unexpected mocked endpoint: '+url);
  };
}

test('JWT verification rejects tampering, nonce mismatch, wrong audience, and expiry',async()=>{
  const fetchFn=makeFetch(()=> 'correct');const token=makeJwt(claims('issued-client','correct'),privateKey);
  assert.equal((await verifyIdentityToken(token,'issued-client','correct',fetchFn)).subject,'test_user');
  await assert.rejects(verifyIdentityToken(token,'issued-client','incorrect',fetchFn),/validation failed/);
  await assert.rejects(verifyIdentityToken(token,'other-client','correct',fetchFn),/validation failed/);
  const expired=makeJwt({...claims('issued-client','correct'),exp:now()-60},privateKey);
  await assert.rejects(verifyIdentityToken(expired,'issued-client','correct',fetchFn),/validation failed/);
  const [a,b,c]=token.split('.');const other=makeJwt({...claims('issued-client','correct'),email:'tampered@example.com'},privateKey).split('.')[1];
  await assert.rejects(verifyIdentityToken(a+'.'+other+'.'+c,'issued-client','correct',fetchFn),/signature/);
});

test('Official local OAuth lifecycle, model discovery, streamed coaching, refresh, and disconnect',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'patternlab-auth-'));
  let nonce;const client=new LocalChatGPT({port:4191,dataDir,fetchFn:makeFetch(()=>nonce)});await client.init();
  const firstHost=client.hostId;assert.ok(firstHost.startsWith('urn:uuid:'));
  assert.equal(client.status().sharing,false);
  const signInURL=new URL(client.begin());nonce=signInURL.searchParams.get('nonce');
  assert.equal(signInURL.searchParams.get('client_id'),'dynamic_agent_client');
  assert.equal(signInURL.searchParams.get('ext_agent_host_id'),firstHost);
  assert.equal(signInURL.searchParams.get('redirect_uri'),'http://127.0.0.1:4191/auth/callback');
  const mismatch=new URL('http://127.0.0.1:4191/auth/callback?code=abc&client_id=issued-client&state=invalid');
  await assert.rejects(client.handleCallback(mismatch),/state verification/);
  const fresh=new URL(client.begin());nonce=fresh.searchParams.get('nonce');
  const callback=new URL('http://127.0.0.1:4191/auth/callback');callback.searchParams.set('code','code-here');callback.searchParams.set('client_id','issued-client');callback.searchParams.set('state',fresh.searchParams.get('state'));
  const state=await client.handleCallback(callback);assert.equal(state.sharing,true);assert.equal(state.email,'test@example.com');
  assert.equal((await client.listModels()).length,1);
  assert.deepEqual(await client.coach({instructions:'Socratic',input:[{role:'user',content:'Help'}]}),{reply:'Try tracing the invariant.',model:'test-model'});
  client.auth.expiresAt=Date.now()-1;assert.equal(await client.accessToken(),'renewed-access');
  const stored=JSON.parse(await readFile(join(dataDir,'auth.json'),'utf8'));assert.equal(stored.refresh_token,'renewed-refresh');
  if(process.platform!=='win32')assert.equal((await stat(join(dataDir,'auth.json'))).mode&0o777,0o600);
  await client.disconnect();assert.equal(client.status().sharing,false);
  const another=new LocalChatGPT({port:4191,dataDir,fetchFn:makeFetch(()=>nonce)});await another.init();assert.equal(another.hostId,firstHost);assert.equal(another.status().sharing,false);
});
