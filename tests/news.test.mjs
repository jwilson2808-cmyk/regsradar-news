import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {weeklyWindow, loadWeeklyNews, refreshNews, mergeCuratedNews} from '../scripts/refresh-news.mjs';
// Test fixtures only: never used as application news.
const publication = (overrides={})=>({document_number:'test-1', title:'Fixture mortgage publication', abstract:'Publisher fixture summary.', publication_date:'2026-11-06', html_url:'https://www.federalregister.gov/documents/2026/11/06/test-1', agencies:[{name:'Fixture agency'}], type:'Notice', ...overrides});
const response = (results=[publication()], extra={})=>({count:results.length, results, ...extra});
test('seven calendar dates include DST boundary and reject invalid dates',()=>{
  assert.deepEqual(weeklyWindow('2026-11-07'),{windowStart:'2026-11-01',windowEnd:'2026-11-07'});
  assert.throws(()=>weeklyWindow('2026-02-30'));
});
test('requests the requested week and preserves official text, date, and attribution',async()=>{
  const data=await loadWeeklyNews('2026-11-07',async url=>{
    const u=new URL(url); assert.equal(u.searchParams.get('conditions[publication_date][gte]'),'2026-11-01');
    assert.equal(u.searchParams.get('conditions[publication_date][lte]'),'2026-11-07');
    assert.equal(u.searchParams.get('conditions[term]'),'mortgage');return response();
  });
  assert.equal(data.status,'verified');assert.equal(data.articles[0].summary,'Publisher fixture summary.');
  assert.equal(data.articles[0].publishedDate,'2026-11-06');assert.equal(data.articles[0].sourceName,'Federal Register');
});
test('loads every page, sorts by publication date, and handles missing abstracts',async()=>{
  let calls=0;
  const data=await loadWeeklyNews('2026-11-07',async()=>++calls===1?response([publication()],{count:2,next_page_url:'https://www.federalregister.gov/api/v1/documents.json?page=2'}):response([publication({document_number:'test-2',publishedLabel:undefined,publication_date:'2026-11-07',abstract:null})],{count:2}));
  assert.equal(calls,2);assert.equal(data.articles[0].id,'test-2');assert.match(data.articles[0].summary,/not provided a summary/);
});
test('rejects out-of-window content rather than silently including it',async()=>{
  await assert.rejects(()=>loadWeeklyNews('2026-11-07',async()=>response([publication({publication_date:'2026-10-31'})])),/outside/);
});
test('rejects unexpected source and pagination destinations',async()=>{
  await assert.rejects(()=>loadWeeklyNews('2026-11-07',async()=>response([publication({html_url:'https://example.com/article'})])),/Untrusted/);
  await assert.rejects(()=>loadWeeklyNews('2026-11-07',async()=>response([],{count:1,next_page_url:'https://example.com/page'})),/Untrusted/);
});
test('rejects partial and duplicate publication results',async()=>{
  await assert.rejects(()=>loadWeeklyNews('2026-11-07',async()=>response([],{count:2})),/Incomplete/);
  await assert.rejects(()=>loadWeeklyNews('2026-11-07',async()=>response([publication(),publication()])),/Duplicate/);
});
test('distinguishes a successfully verified empty result from an unavailable feed',async()=>{
  const data=await loadWeeklyNews('2026-11-07',async()=>response([]));assert.equal(data.status,'verified');assert.equal(data.articles.length,0);
});
test('a failed refresh preserves the last saved edition',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'regsradar-news-'));
  try{const file=pathToFileURL(join(dir,'news.json'));await writeFile(file,'previous verified edition');
    await assert.rejects(()=>refreshNews('2026-11-07',file,async()=>{throw Error('403 Forbidden');},{articles:[]}));
    assert.equal(await readFile(file,'utf8'),'previous verified edition');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('a complete successful refresh writes a valid dated edition',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'regsradar-news-'));
  try{const file=pathToFileURL(join(dir,'news.json'));await refreshNews('2026-11-07',file,async()=>response(),{articles:[]});
    const saved=JSON.parse(await readFile(file,'utf8'));assert.equal(saved.status,'verified');assert.equal(saved.articles.length,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});

const gseFixture = {id:'gse-test',agency:'Fannie Mae',category:'GSEs',topic:'Loan sales',title:'Fixture GSE publication',summary:'Test only.',publishedDate:'2026-11-04',sourceName:'Fannie Mae',sourceUrl:'https://www.fanniemae.com/newsroom/test-fixture',verifiedAt:'2026-11-07T12:00:00Z'};
const emptyEdition = {...weeklyWindow('2026-11-07'),status:'verified',articles:[]};
test('merges verified GSE and state news in date order with jurisdiction',()=>{
 const state={...gseFixture,id:'state-test',agency:'New York DFS',sourceName:'New York DFS',sourceUrl:'https://www.dfs.ny.gov/test-fixture',category:'States',state:'New York',publishedDate:'2026-11-06'};
 const merged=mergeCuratedNews(emptyEdition,{articles:[gseFixture,state]});
 assert.deepEqual(merged.articles.map(a=>a.id),['state-test','gse-test']);assert.equal(merged.articles[0].state,'New York');
});
test('does not carry stale GSE or state publications into a newer weekly edition',()=>{
 const edition={...weeklyWindow('2026-11-14'),status:'verified',articles:[]};
 assert.equal(mergeCuratedNews(edition,{articles:[gseFixture]}).articles.length,0);
});
test('rejects unverified, misattributed, and unexpected-host curated news',()=>{
 for(const changes of [{verifiedAt:undefined},{sourceUrl:'https://example.com/fake'},{category:'States'},{id:''}]){
  assert.throws(()=>mergeCuratedNews(emptyEdition,{articles:[{...gseFixture,...changes}]}));
 }
});
test('rejects duplicate identifiers and incorrect state attribution',()=>{
 assert.throws(()=>mergeCuratedNews(emptyEdition,{articles:[gseFixture,gseFixture]}),/Duplicate/);
 const state={...gseFixture,category:'States',sourceName:'New York DFS',sourceUrl:'https://www.dfs.ny.gov/test',state:'Texas'};
 assert.throws(()=>mergeCuratedNews(emptyEdition,{articles:[state]}),/state/);
});
