import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {load} from 'cheerio';
import {parseBillStatus,billStatusLinks} from './legislation.mjs';
import {loadWeeklyNews,screenFederalNews,mergeCuratedNews} from './refresh-news.mjs';
import {fetchOfficial} from './news-fetch.mjs';
import {activeWindow,isFresh,hash,clean,allowedURL,extractDocument,extractPDFDocument,discoverLinks,deduplicate,affectedArea,classifyCongressBill} from './monitor-core.mjs';

const readJSON=async(path,fallback)=>{try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if(fallback!==undefined)return fallback;throw error;}};
const asOf=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const isoNow=()=>new Date().toISOString();
const metadataTypes={'Final rule':'Final Regulation','Proposed rule':'Proposed Regulation','Regulatory notice':'Regulatory Notice','GSE policy':'Agency Guidance'};
function enrich(a) {
 return {...a,updateType:metadataTypes[a.updateType]||a.updateType,affectedArea:a.affectedArea||affectedArea(a.title+' '+a.summary),whatChanged:a.whatChanged||a.summary,whyItMatters:a.whyItMatters||a.mortgageRelevance,documentReference:a.documentReference||(a.sourceName==='Federal Register'?a.id:null),contentFingerprint:a.contentFingerprint||hash(a.title+'\n'+a.summary)};
}
export async function parallel(items,limit,fn) {
 const results=[];let next=0;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const index=next++;try{results[index]=await fn(items[index]);}catch(error){results[index]={report:{id:items[index].id,name:items[index].name,status:'failed',verifiedCount:0,errors:[error.message]},articles:[]};}}}));return results;
}
export async function verifyReviewed(article,source,fetchDoc=fetchOfficial) {
 const urls=[article.sourceUrl,...(article.alternateOfficialUrls||[])];
 if(article.sourceName==='Federal Register' && /^\d{4}-\d+$/.test(article.id))urls.push(`https://www.govinfo.gov/content/pkg/FR-${article.publishedDate}/html/${article.id}.htm`);
 const failures=[];
 for(const url of urls) {
  try {
   const host=new URL(url).hostname;
   if(host!==new URL(article.sourceUrl).hostname && !(article.sourceName==='Federal Register'&&host==='www.govinfo.gov'))throw Error('Unapproved alternate publisher');
   const result=await fetchDoc(url,{hosts:[host]});
   const $=load(result.text);$('script,style,nav,footer').remove();const text=clean(($('main').first().length?$('main').first():$('body')).text());
   const body=/pdf/i.test(result.contentType||'')?clean(result.text):text;
   const title=clean(article.title).toLowerCase();
   const reference=article.documentReference;
   const suffix=clean(reference&&article.title.includes(reference)?article.title.slice(article.title.indexOf(reference)+reference.length).replace(/^[\s:–-]+/,''):article.title.split(':').at(-1)).toLowerCase();
   const matches=body.toLowerCase().includes(title)||(reference&&body.toLowerCase().includes(reference.toLowerCase())&&body.toLowerCase().includes(suffix));
   if(!matches)throw Error('Reviewed headline/reference is not present in official document');
   const [y,m,d]=article.publishedDate.split('-');const month=new Date(`${y}-${m}-${d}T12:00:00Z`).toLocaleString('en-US',{month:'long',timeZone:'UTC'});
   const datePattern=new RegExp(`${month}\\s+0?${Number(d)},?\\s+${y}|${y}-${m}-${d}|0?${Number(m)}/0?${Number(d)}/${y}`,'i');
   if(!datePattern.test(body+' '+result.text))throw Error('Reviewed publication date is not present in official document');
   return {...enrich(article),sourceUrl:url,verifiedAt:isoNow(),verificationMethod:url===article.sourceUrl?'original official publication':'verified official alternate document'};
  }catch(error){failures.push(error.message);}
 }
 throw Error([...new Set(failures)].join('; '));
}
async function congressSource() {
 const source={id:'congress',name:'Congress.gov public legislation',url:'https://www.congress.gov/rss/most-recent-bills.xml',hosts:['www.congress.gov','congress.gov'],kind:'federal-legislation'};
 const report={id:source.id,name:source.name,url:source.url,kind:source.kind,checkedAt:isoNow(),verifiedCount:0,errors:[]};
 try {
  await fetchOfficial(source.url,source);
  report.status='action_adapter_required';report.errors.push('Public source retrieved, but structured official bill/action verification is not implemented. No status was inferred.');
 } catch(error){report.status='public_source_unavailable';report.errors.push(error.message);}
 return {report,articles:[]};
}
async function publicLegislationSource() {
 const source={id:'govinfo',name:'U.S. Congress / GovInfo bill status',url:'https://www.govinfo.gov/rss/bills.xml',hosts:['www.govinfo.gov','govinfo.gov']};
 const report={id:source.id,name:source.name,url:source.url,kind:'federal-legislation',checkedAt:isoNow(),verifiedCount:0,errors:[]};const articles=[];
 try {
  const feed=await fetchOfficial(source.url,source);const links=billStatusLinks(feed.text);report.discoveredCount=links.length;
  for(const url of links.slice(0,20)) {
   try {const xml=await fetchOfficial(url,source);const article=parseBillStatus(xml.text,url,asOf);if(article)articles.push(article);}
   catch(error){report.errors.push({url,message:error.message});}
  }
  report.status=report.errors.length?'partial_scan':'limited_structured_scan';report.verifiedCount=articles.length;
  report.note='Keyless official GPO bill-status XML. Uses substantive action dates, not RSS upload or XML maintenance dates. RSS discovery is bounded and not exhaustive congressional coverage.';
 }catch(error){report.status='failed';report.errors.push(error.message);}
 return {report,articles};
}
export async function monitorNews() {
 await mkdir('reports',{recursive:true});await mkdir('src/data',{recursive:true});
 const previous=await readJSON('src/data/news-archive.json',(await readJSON('src/data/weekly-news.json',{articles:[]})));
 const curated=await readJSON('src/data/curated-news.json');const reviews=await readJSON('src/data/editorial-review.json');
 const sources=await readJSON('scripts/news-sources.json');const articles=[],reports=[],reviewQueue=[];
 try {
  const candidates=await loadWeeklyNews(asOf,undefined,90);const screened=screenFederalNews(candidates,reviews);const merged=mergeCuratedNews(screened,curated);
  for(const a of candidates.articles)if(!reviews.federal?.[a.id])reviewQueue.push({id:a.id,title:a.title,publishedDate:a.publishedDate,sourceUrl:a.sourceUrl,reason:'Not editorially approved for mortgage regulatory relevance'});
  const verified=await parallel(merged.articles,5,async a=>{
   try {
    const host=new URL(a.sourceUrl).hostname;const result=await verifyReviewed(a,{hosts:[host]});return result;
   }catch(error){reports.push({id:'document-'+a.id,name:a.sourceName,url:a.sourceUrl,status:'verification_failed',errors:[error.message],checkedAt:isoNow(),verifiedCount:0});return null;}
  });articles.push(...verified.filter(Boolean));
  reports.push({id:'federal-register',name:'Federal Register reviewed mortgage publications',url:'https://www.federalregister.gov/api/v1/documents.json',status:'reviewed_subset',checkedAt:isoNow(),verifiedCount:verified.filter(a=>a?.sourceName==='Federal Register').length,discoveredCount:candidates.articles.length,excludedPendingReview:reviewQueue.length,errors:[],note:'Keyword matches are discovery candidates; only individually reviewed primary publications enter the feed.'});
 }catch(error){reports.push({id:'federal-register',name:'Federal Register',status:'failed',errors:[error.message],checkedAt:isoNow(),verifiedCount:0});}
 const scanned=await parallel(sources,8,async source=>{
  const report={id:source.id,name:source.name,url:source.url,state:source.state,kind:source.kind,checkedAt:isoNow(),verifiedCount:0,errors:[]};const found=[];
  try {
   const response=await fetchOfficial(source.url,source);
   if(source.kind==='legislature')return {report:{...report,status:'action_adapter_required',errors:['Index access checked only. This state needs a verified bill/action adapter before legislative events can be published.']},articles:[]};
   const links=discoverLinks(response.text,source,source.kind==='state-regulator'?3:8);
   report.discoveredCount=links.length;
   if(!links.length){if(source.id==='freddie-guide')report.diagnostic='JavaScript application shell. Browser investigation failed with ERR_CERT_AUTHORITY_INVALID in this cloud runtime; TLS verification was not disabled. A dedicated public API/browser trust adapter remains required.';report.status='no_parseable_publications';report.errors.push('No dated document candidates parsed; may require RSS, API, pagination, or JavaScript adapter.');return {report,articles:[]};}
   for(const url of links) {
    try {
     const doc=await fetchOfficial(url,source,{revalidate:false});
     const a=/pdf/i.test(doc.contentType||'')?extractPDFDocument(doc.text,url,source):extractDocument(doc.text,url,source);
     if(isFresh(a,asOf))found.push(a);
    }catch(error){report.errors.push({url,message:error.message});}
   }
   report.verifiedCount=found.length;report.status=report.errors.length?'partial_scan':'limited_document_scan';
   report.note='Bounded discovery scan; reaching an index is not evidence of complete agency coverage.';
  }catch(error){report.status='failed';report.errors.push(error.message);}
  return {report,articles:found};
 });
 for(const result of scanned){reports.push(result.report);articles.push(...result.articles);}
 const congress=await congressSource();reports.push(congress.report);articles.push(...congress.articles);
 const publicBills=await publicLegislationSource();reports.push(publicBills.report);articles.push(...publicBills.articles);
 reports.push({id:'state-ag',name:'State attorneys general across 50 states',status:'not_configured',verifiedCount:0,errors:['Dedicated official AG sources and action adapters have not been configured; no comprehensive AG monitoring claim.']});
 reports.push({id:'state-hfa',name:'State housing finance agencies across 50 states',status:'not_configured',verifiedCount:0,errors:['Dedicated official HFA bulletin sources have not been configured; no comprehensive HFA monitoring claim.']});
 // Never republish old unverified archive items when their source fails this run.
 const unique=deduplicate(articles,previous.articles||[]);const active=unique.filter(a=>isFresh(a,asOf));
 const generatedAt=isoNow();const historical=deduplicate([...unique,...(previous.articles||[])],previous.articles||[]);const oldest=historical.map(a=>a.publishedDate).sort()[0]||activeWindow(asOf).windowStart;const archive={windowStart:oldest,windowEnd:asOf,status:'verified',generatedAt,articles:historical};
 const feed={...activeWindow(asOf),status:active.length?'verified':reports.some(r=>r.status==='failed')?'unavailable':'verified',generatedAt,sourceName:'Official primary sources',articles:active};
 const report={asOf,generatedAt,policy:'14-day active feed based on original publication or verified material legislative action date; ordinary website modifications do not refresh age.',activeArticleCount:active.length,sources:reports};
 // Stage outputs before replacing the feed. Individual source failures are recorded, not fatal to other sources.
 for(const [file,data] of [['src/data/news-archive.json',archive],['src/data/weekly-news.json',feed],['reports/news-source-coverage.json',report],['reports/news-review-queue.json',reviewQueue]]){
  await writeFile(file+'.tmp',JSON.stringify(data,null,2)+'\n');await rename(file+'.tmp',file);
 }
 const lines=['# News source coverage',`Checked: ${generatedAt}`,`Active verified articles: ${active.length}`,'','Website accessibility is distinct from working document monitoring. State legislative index checks do not constitute bill-action monitoring.','', '| Source | Outcome | Verified documents |','| --- | --- | --- |',...reports.map(r=>`| ${r.name} | ${r.status} | ${r.verifiedCount||0} |`),'','See the JSON report for individual failures, bounded-scan notes, and missing adapters.','Congress.gov public access, state legislative action adapters, state AGs, and state HFAs remain coverage gaps. No API key is required by this configuration.','No Base44 connection or deployment is performed.'];
 await writeFile('reports/news-source-coverage.md',lines.join('\n')+'\n');
 console.log(`Monitoring completed: ${active.length} fresh verified updates; ${reports.length} source outcomes recorded.`);
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)monitorNews().catch(error=>{console.error('Monitoring failed before completion:',error.message);process.exitCode=1;});
