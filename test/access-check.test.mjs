import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';

test('read-only live check distinguishes owner denial, auth failure and exposed data without disclosing secrets', async () => {
  const source = await readFile(new URL('../public/access-check.js', import.meta.url), 'utf8');
  const id = '00000000-0000-4000-8000-000000000001';
  const nodes = new Map(['#status','#result','#prepare','#compare'].map(key=>[key,{textContent:'',addEventListener(event,handler){this.click=handler;}}]));
  const storage = new Map();
  let account = 'a', bStatus = 404;
  const apiCalls = [];
  await runInNewContext(source, {
    document:{querySelector:key=>nodes.get(key),querySelectorAll:()=>[nodes.get('#prepare'),nodes.get('#compare')]},
    sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
    crypto:webcrypto,TextEncoder,URL,AbortSignal,location:{origin:'https://vault.example.org'},
    window:{supabase:{createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:account},access_token:'TEST_'+account}},error:null})}})}},
    fetch:async (path, options={}) => {
      assert.ok(!options.method || options.method === 'GET');
      if(path==='/auth-config.json')return {json:async()=>({url:'https://auth.example.org'})};
      assert.equal(options.headers.Authorization,'Bearer TEST_'+account);
      apiCalls.push(path);
      if(path==='/api/notes')return {status:200,json:async()=>[{id,title:'PRIVATE_TEST_TITLE',body:'PRIVATE_TEST_BODY'}]};
      assert.equal(path,'/api/notes/'+id);
      const status=account==='a'?200:bStatus;
      const body=status===200?{id,title:'PRIVATE_TEST_TITLE',body:'PRIVATE_TEST_BODY'}:{error:status===404?'NOTE_NOT_FOUND':'INVALID_LOGIN'};
      return {status,json:async()=>body,headers:{get:()=>null}};
    },
  });
  await nodes.get('#prepare').click();
  assert.equal(JSON.parse(nodes.get('#result').textContent).a.httpStatus,200);
  const before=apiCalls.length;
  await nodes.get('#compare').click();
  assert.equal(apiCalls.length,before,'same account must not masquerade as B');
  account='b';
  await nodes.get('#compare').click();
  assert.equal(JSON.parse(nodes.get('#result').textContent).result,'A_ALLOWED_B_DENIED');
  bStatus=401;await nodes.get('#compare').click();
  assert.equal(JSON.parse(nodes.get('#result').textContent).result,'INCONCLUSIVE');
  bStatus=200;await nodes.get('#compare').click();
  assert.equal(JSON.parse(nodes.get('#result').textContent).result,'OTHER_USER_NOTE_EXPOSED');
  const recorded=[nodes.get('#result').textContent,...storage.values()].join('\n');
  for(const sensitive of ['TEST_a','TEST_b','PRIVATE_TEST_TITLE','PRIVATE_TEST_BODY'])assert.ok(!recorded.includes(sensitive));
});
