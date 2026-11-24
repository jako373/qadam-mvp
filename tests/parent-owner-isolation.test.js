import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saveState } from '../src/storage.js';

test('a stale page cannot write shared browser state or schedule synchronization',()=>{
  const writes=[];globalThis.localStorage={getItem:()=>null,setItem:(...args)=>writes.push(args)};
  let scheduled=false,blocked=false;globalThis.qadamAuth={canSaveState:()=>false,onIdentityMismatch:()=>{blocked=true;},scheduleSync:()=>{scheduled=true;}};
  saveState({childProfile:{name:'stale'}});assert.equal(writes.length,0);assert.equal(scheduled,false);assert.equal(blocked,true);
  delete globalThis.qadamAuth;
});
