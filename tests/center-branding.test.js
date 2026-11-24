import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderCenterDashboard } from '../src/center-dashboard.js';
for(const role of ['admin','specialist'])test(`Damu ${role} sees center identity and supplied logo`,async()=>{
  globalThis.localStorage={getItem:()=> 'ru',setItem(){}};globalThis.document={documentElement:{lang:'ru'}};
  const app={innerHTML:'',addEventListener(){},querySelector:()=>null};
  await renderCenterDashboard({app,session:{user:{id:'staff'}},membership:{center_id:'center',center_name:'Даму логопедиялық орталығы',role,full_name:'Test Staff'},dataRequest:async()=>[]});
  assert.match(app.innerHTML,/Кабинет центра/);assert.match(app.innerHTML,/Даму логопедиялық орталығы/);assert.match(app.innerHTML,/src="\/public\/centers\/damu-logo.png"/);
});
