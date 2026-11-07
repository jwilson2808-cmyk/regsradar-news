import test from 'node:test';
import assert from 'node:assert/strict';
import {activeWindow,isFresh,classifyDocument,classifyCongressBill,extractDocument,deduplicate,allowedURL} from '../scripts/monitor-core.mjs';
import {dateRangeError,rangeForPeriod,filterNews,pacificToday} from '../src/news-filters.ts';
const source={id:'official',name:'Official Agency',category:'Federal',hosts:['agency.gov'],kind:'official-publications'};
const item=(date,changes={})=>({id:date,title:'Mortgage disclosure requirements',publishedDate:date,sourceUrl:'https://agency.gov/doc/'+date,agency:'Official Agency',sourceName:'Official Agency',category:'Federal',topic:'Disclosures',summary:'Verified source summary.',verifiedAt:'2026-11-07T12:00:00Z',...changes});
test('14-day freshness is inclusive and ignores ordinary webpage modification dates',()=>{
 assert.deepEqual(activeWindow('2026-11-07'),{windowStart:'2026-10-25',windowEnd:'2026-11-07'});
 assert.equal(isFresh(item('2026-10-25'),'2026-11-07'),true);
 assert.equal(isFresh(item('2026-10-24',{updatedDate:'2026-11-07'}),'2026-11-07'),false);
 assert.equal(isFresh(item('2026-11-08'),'2026-11-07'),false);
});
test('only a verified material legal action can refresh an older publication',()=>{
 const a=item('2026-01-01',{materialUpdatedDate:'2026-11-06'});
 assert.equal(isFresh(a,'2026-11-07'),false);
 assert.equal(isFresh({...a,materialUpdateVerified:true},'2026-11-07'),true);
});
test('proposed bills remain proposed after chamber passage and enacted status needs explicit official evidence',()=>{
 assert.equal(classifyCongressBill({latestAction:{actionDate:'2026-11-06',text:'Passed Senate.'}}).updateType,'Proposed Legislation');
 assert.equal(classifyCongressBill({latestAction:{actionDate:'2026-11-06',text:'Became Public Law No: 119-1.'}}).updateType,'Enacted Legislation');
 assert.equal(classifyCongressBill({latestAction:{actionDate:'2026-11-06',text:'Referred to committee.'}}),null);
 assert.throws(()=>classifyCongressBill({latestAction:{text:'Passed Senate.'}}));
});
test('market reports and education events cannot pass the mortgage regulatory classifier',()=>{
 for(const title of ['Mortgage Rates Decline Again','Financial Education Webinar','Fannie Mae Announces Non-Performing Loan Sale','Weekly Banking Bulletin November 6, 2026'])assert.equal(classifyDocument({title,text:'Mortgage regulations and requirements.',source}),null);
 assert.equal(classifyDocument({title:'Proposed Mortgage Disclosure Rule',text:'A proposed rule changes mortgage disclosures.',source}),'Proposed Regulation');
 assert.equal(classifyDocument({title:'Final Mortgage Disclosure Rule',text:'This final rule changes mortgage disclosures.',source}),'Final Regulation');
});
test('published metadata is required and dateModified alone is never accepted',()=>{
 const html='<html><head><meta property="article:modified_time" content="2026-11-07"/></head><body><main><h1>Mortgage servicing guidance</h1><p>Official mortgage servicing guidance clarifies existing requirements for regulated servicers and describes documentation of compliance.</p></main></body></html>';
 assert.throws(()=>extractDocument(html,'https://agency.gov/specific',source),/publication date/);
 const dated=html.replace('<main>','<main><time datetime="2026-11-06">November 6, 2026</time>');
 assert.equal(extractDocument(dated,'https://agency.gov/specific',source).publishedDate,'2026-11-06');
 assert.throws(()=>extractDocument(dated.replace('Mortgage servicing guidance','Newsroom'),'https://agency.gov/news',source),/specific publication/);
 assert.throws(()=>extractDocument(dated.replace('Mortgage servicing guidance','Policies and Guidance'),'https://agency.gov/index',source),/specific publication/);
});
test('deduplication happens before summary reuse and preserves first seen date for unchanged content',()=>{
 const a=item('2026-11-06',{contentFingerprint:'same',summary:'Existing approved summary',firstSeenAt:'2026-11-06T12:00:00Z'});
 const result=deduplicate([{...a,summary:'New redundant summary',verifiedAt:'2026-11-07T12:00:00Z'},{...a,sourceUrl:a.sourceUrl+'?utm_source=test'}],[a]);
 assert.equal(result.length,1);assert.equal(result[0].summary,'Existing approved summary');assert.equal(result[0].firstSeenAt,a.firstSeenAt);
});
test('source host and transport validation prevents publication of arbitrary or insecure destinations',()=>{
 assert.throws(()=>allowedURL('https://example.com/fake',source));assert.throws(()=>allowedURL('http://agency.gov/document',source));
});
test('time, category, and search filters combine with inclusive dates',()=>{
 const data=[item('2026-10-25'),item('2026-11-01',{category:'GSEs',agency:'Fannie Mae'}),item('2026-11-07',{category:'GSEs',agency:'Fannie Mae'}),item('2026-10-24')];
 assert.equal(filterNews(data,{category:'All',query:'',range:rangeForPeriod('14','2026-11-07')}).length,3);
 assert.equal(filterNews(data,{category:'GSEs',query:'fannie',range:{from:'2026-11-01',to:'2026-11-01'}}).length,1);
 assert.equal(filterNews(data,{category:'States',query:'',range:rangeForPeriod('14','2026-11-07')}).length,0);
});
test('custom ranges validate calendar dates and available history; Pacific dates are independent of UTC midnight',()=>{
 assert.ok(dateRangeError('2026-02-30','2026-11-07'));
 assert.ok(dateRangeError('2026-11-07','2026-11-01'));
 assert.ok(dateRangeError('2026-10-24','2026-11-07','2026-10-25'));
 assert.equal(dateRangeError('2026-10-25','2026-11-07','2026-10-25'),null);
 assert.equal(pacificToday(new Date('2026-11-07T02:00:00Z')),'2026-11-06');
});

test('failed sources are isolated while successful sources still update',async()=>{
 const {parallel}=await import('../scripts/monitor-news.mjs');
 const results=await parallel([{id:'broken',name:'Broken source'},{id:'working',name:'Working source'}],2,async source=>{
  if(source.id==='broken')throw Error('Simulated source outage');
  return {report:{id:source.id,status:'limited_document_scan'},articles:[item('2026-11-06')]};
 });
 assert.equal(results[0].report.status,'failed');assert.equal(results[1].articles.length,1);
});
test('remote feed validation rejects unverified content and prevents stale saved articles from displaying',async()=>{
 const {validateRemoteFeed,freshArticles}=await import('../src/news-filters.ts');
 const valid=item('2026-11-06',{updateType:'Agency Guidance',mortgageRelevance:'Mortgage servicing requirements.'});
 assert.equal(validateRemoteFeed({articles:[valid]},'2026-11-07').articles.length,1);
 assert.throws(()=>validateRemoteFeed({articles:[valid,valid]},'2026-11-07'));
 assert.throws(()=>validateRemoteFeed({articles:[{...valid,updateType:'Market news'}]},'2026-11-07'));
 assert.equal(freshArticles([{...valid,publishedDate:'2026-09-01'}],'2026-11-07').length,0);
});
test('verified VA PDF circulars retain original date, reference, and explicit immediate effective date',async()=>{
 const {extractPDFDocument}=await import('../scripts/monitor-core.mjs');
 const text='Veterans Benefits Administration Circular 26-26-5 October 27, 2026\n\nRemittance of VA Partial Claim Payments Via Fedwire\n\n1. Purpose. This Circular provides instructions to mortgage servicers for VA Partial Claim program payments and submission requirements.\n\n2. Background. This circular is effective immediately.';
 const a=extractPDFDocument(text,'https://agency.gov/circular.pdf',source);
 assert.equal(a.publishedDate,'2026-10-27');assert.equal(a.documentReference,'Circular 26-26-5');assert.equal(a.effectiveDate,'2026-10-27');
 assert.throws(()=>extractPDFDocument('Undated mortgage policy','https://agency.gov/circular.pdf',source));
});

test('official bill-status XML uses substantive action dates, not a recent upload/update date',async()=>{
 const {parseBillStatus}=await import('../scripts/legislation.mjs');
 const bill=(actionDate,text,laws='')=>`<billStatus><bill><number>12</number><type>HR</type><congress>119</congress><introducedDate>2026-10-01</introducedDate><updateDate>2026-11-07</updateDate><title>Mortgage Disclosure Act</title><actions><item><actionDate>${actionDate}</actionDate><text>${text}</text></item></actions>${laws}</bill></billStatus>`;
 assert.equal(parseBillStatus(bill('2026-10-01','Introduced in House'),'https://www.govinfo.gov/test.xml','2026-11-07'),null);
 assert.equal(parseBillStatus(bill('2026-11-06','Passed House'),'https://www.govinfo.gov/test.xml','2026-11-07').updateType,'Proposed Legislation');
 assert.equal(parseBillStatus(bill('2026-11-06','Became Public Law 119-1','<laws><item><type>Public</type><number>119-1</number></item></laws>'),'https://www.govinfo.gov/test.xml','2026-11-07').updateType,'Enacted Legislation');
});
