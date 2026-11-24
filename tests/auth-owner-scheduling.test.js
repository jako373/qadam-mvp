import assert from 'node:assert/strict';
import { test } from 'node:test';

for(const initialCenter of [true,false])for(const nextCenter of [true,false,null])test(`page owner blocks ${initialCenter?'center':'email'} parent switching to ${nextCenter===null?'logout':nextCenter?'center':'email'}`,async()=>{
  const original={access_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'owner-a',app_metadata:{center_parent:initialCenter}}};
  const map=new Map([['qadam.auth.session.v1',JSON.stringify(original)]]);let writes=0;
  globalThis.localStorage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
  const app={innerHTML:''};globalThis.document={documentElement:{lang:''},getElementById:()=>app};globalThis.window={addEventListener(){}};
  globalThis.location={pathname:'/login',replace(){}};
  globalThis.fetch=async(url,options)=>{if(options?.method==='POST')writes++;return {ok:true,status:200,json:async()=>[]};};
  await import('../src/auth-entry.js?owner-case='+initialCenter+'-'+nextCenter);
  if(nextCenter===null)map.delete('qadam.auth.session.v1');else map.set('qadam.auth.session.v1',JSON.stringify({...original,user:{id:'owner-b',app_metadata:{center_parent:nextCenter}}}));
  const oldSetTimeout=globalThis.setTimeout;let scheduled=false;
  globalThis.setTimeout=()=>{scheduled=true;return 0;};
  try{globalThis.qadamAuth.scheduleSync({childProfile:{name:'old child'},progress:{onboardingCompleted:true}});}finally{globalThis.setTimeout=oldSetTimeout;}
  assert.equal(scheduled,false);assert.equal(writes,0);assert.match(app.innerHTML,/Аккаунт изменился/);
});
