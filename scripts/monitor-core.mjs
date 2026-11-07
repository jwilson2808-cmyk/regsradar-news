import {createHash} from 'node:crypto';
import {load} from 'cheerio';
export const hash = text=>createHash('sha256').update(text).digest('hex');
export const clean = text=>String(text||'').replace(/\s+/g,' ').trim();
export function validDate(value) {
 return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(+new Date(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
}
export function activeWindow(asOf) {
 if(!validDate(asOf))throw Error('Invalid monitoring date');
 const date=new Date(`${asOf}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-13);
 return {windowStart:date.toISOString().slice(0,10),windowEnd:asOf};
}
export function isFresh(article,asOf) {
 const {windowStart,windowEnd}=activeWindow(asOf);
 // An observed website modification is never a material regulatory update.
 const date=article.materialUpdateVerified===true&&validDate(article.materialUpdatedDate)?article.materialUpdatedDate:article.publishedDate;
 return validDate(article.publishedDate)&&validDate(date)&&date>=windowStart&&date<=windowEnd&&article.publishedDate<=windowEnd;
}
export function canonicalURL(value) {
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Unsafe source URL');
 url.hash='';for(const key of [...url.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(key))url.searchParams.delete(key);
 return url.href.replace(/\/$/,'');
}
export function allowedURL(value,source) {
 const url=canonicalURL(value);const host=new URL(url).hostname;
 if(!source.hosts.includes(host))throw Error('Destination is outside official source hosts: '+host);return url;
}
const mortgage= /\bmortgage\b|\bHMDA\b|\bRESPA\b|\bTRID\b|\bSAFE Act\b|\bFHA\b|\bforeclosure\b|\bloss mitigation\b|\bloan origination\b|\bhome loans?\b|\bhomeowner.*insurance\b|\bfair lending\b|\bservicing guide\b|\bVA partial claim\b|\bloan guaranty\b|\bselling guide\b|\bunderwriting\b/i;
const exclude=/mortgage rates (?:rise|fall|decline|increase)|primary mortgage market survey|debt funding calendar|tender offer|non-performing loan sale|financial literacy|financial education|awards?|webinar|quarterly (?:earnings|results)|net income|weekly banking bulletin/i;
export function classifyDocument({title,text,source}) {
 const excerpt=clean(title+' '+text.slice(0,5000));
 if(exclude.test(title))return null;
 if(!mortgage.test(excerpt))return null;
 // Bill status cannot be inferred from article prose. Legislative adapters must provide structured official actions.
 if(source.kind==='legislature')return null;
 if(/proposed (?:rule|regulation)|notice of proposed rulemaking/i.test(title+' '+text.slice(0,1200)))return 'Proposed Regulation';
 if(/final (?:rule|regulation)|interim final rule/i.test(title+' '+text.slice(0,1200)))return 'Final Regulation';
 if(/enforcement|consent order|settlement|cease.and.desist/i.test(title))return 'Enforcement';
 if(/lender letter|selling guide updates?|servicing guide updates?|bulletin|circular|mortgagee letter|APM|guidance|release notes|eligibility|handbook (?:update|revision)|requirements/i.test(title))return 'Agency Guidance';
 if(/notice of proposed information collection|comment request|matching program|loan guarantee fee/i.test(title))return 'Regulatory Notice';
 return null;
}
export function humanDate(text) {
 const match=clean(text).match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
 if(!match)return null;
 const month=['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(match[1].toLowerCase())+1;
 const date=`${match[3]}-${String(month).padStart(2,'0')}-${match[2].padStart(2,'0')}`;return validDate(date)?date:null;
}
export function extractDocument(html,url,source) {
 const $=load(html);$('script,style,nav,footer,header,.sidebar,.recent-news').remove();
 const main=$('article').first().length?$('article').first():$('main').first().length?$('main').first():$('body');
 const title=clean(main.find('h1').first().text()||$('h1').first().text());
 if(!title||/^(?:home|news|newsroom|press releases?|announcements?|publications?|news and alerts|latest news|news and announcements|circulars|guide bulletins|mortgagee letters|selling guide|policies and guidance|policy (?:index|library)|guidance library|404.*)$/i.test(title))throw Error('Not a specific publication');
 const text=clean(main.text());
 // dateModified is deliberately ignored: page maintenance is not a new legal action.
 const meta=$('meta[property="article:published_time"]').attr('content')||$('meta[name="date"]').attr('content')||$('meta[name="dcterms.date"]').attr('content');
 const time=main.find('time[datetime]').first().attr('datetime');
 const date=meta?.slice(0,10)||time?.slice(0,10)||humanDate(text.slice(0,1000));
 if(!validDate(date))throw Error('No verified publication date');
 const first=main.find('p').toArray().map(el=>clean($(el).text())).find(t=>t.length>90&&!/cookies|subscribe|copyright|contact us/i.test(t));
 if(!first)throw Error('No factual source summary');
 const type=classifyDocument({title,text,source});if(!type)throw Error('No verified mortgage regulatory development');
 const ref=(title+' '+text.slice(0,1000)).match(/(?:SEL|SVC|LL)-\d{4}-\d+|Circular\s+\d{2}-\d+-?\d*|Bulletin\s+\d{4}-\d+/i)?.[0];
 return {id:`${source.id}-${hash(canonicalURL(url)).slice(0,16)}`,agency:source.name,sourceName:source.name,category:source.category,state:source.state,title,summary:first.length>850?first.slice(0,847)+'…':first,whatChanged:first.length>850?first.slice(0,847)+'…':first,whyItMatters:'Relevant to mortgage compliance review. Consult the official document to establish applicability, required actions, and deadlines for your organization.',mortgageRelevance:'Mortgage-related official policy, compliance, or regulatory development.',affectedArea:affectedArea(title+' '+text.slice(0,2000)),topic:affectedArea(title+' '+text.slice(0,2000)),updateType:type,publishedDate:date,sourceUrl:allowedURL(url,source),documentReference:ref||null,contentFingerprint:hash(title+'\n'+first),verifiedAt:new Date().toISOString()};
}
export function affectedArea(text) {
 if(/HMDA|fair lending/i.test(text))return 'Fair lending and HMDA';
 if(/privacy|cybersecurity|data protection|recording/i.test(text))return 'Privacy and communications';
 if(/loss mitigation|foreclos|servicing|servicer|partial claim|force.placed/i.test(text))return 'Servicing and loss mitigation';
 if(/licens|SAFE Act/i.test(text))return 'Licensing';
 if(/disclos|RESPA|TRID|escrow/i.test(text))return 'Disclosures and settlement';
 return 'Underwriting and program requirements';
}
export function discoverLinks(html,source,limit=8) {
 const $=load(html);const results=[];const seen=new Set();
 $('nav,footer,header').remove();
 $('a[href]').each((_,el)=>{
  const href=$(el).attr('href');const text=clean($(el).text());if(!href)return;
  let url;try{url=allowedURL(new URL(href,source.url).href,source);}catch{return;}
  if(url===canonicalURL(source.url)||seen.has(url)||/login|signup|subscribe|facebook|twitter|privacy-policy|contact-us/i.test(url))return;
  if(!/mortgage|circular|bulletin|selling|servicing|underwrit|lender letter|guidance|rule|regulat|legislat|bill|HMDA|RESPA|SAFE Act|DU release|LPA|loan product advisor/i.test(text+' '+url))return;
  seen.add(url);results.push(url);
 });return results.sort((a,b)=>Number(/\.pdf$|news-events\//i.test(b))-Number(/\.pdf$|news-events\//i.test(a))).slice(0,limit);
}
export function deduplicate(articles,previous=[]) {
 const old=new Map(previous.map(a=>[a.sourceUrl,a]));const seen=new Map();
 for(const article of articles) {
  const url=canonicalURL(article.sourceUrl);const key=article.documentReference?`${article.agency}:${article.documentReference}`:clean(article.title).toLowerCase()+':'+article.publishedDate;
  const duplicate=[...seen.values()].find(a=>a.sourceUrl===url)||seen.get(key);
  if(duplicate){duplicate.alternateSources=[...new Set([...(duplicate.alternateSources||[]),url])].filter(u=>u!==duplicate.sourceUrl);continue;}
  const prior=old.get(url)||previous.find(a=>a.id===article.id||(article.documentReference&&a.documentReference===article.documentReference&&a.agency===article.agency));const unchanged=prior&&prior.contentFingerprint&&prior.contentFingerprint===article.contentFingerprint;
  seen.set(key,{...article,...(unchanged?{summary:prior.summary,whatChanged:prior.whatChanged,whyItMatters:prior.whyItMatters}:{}),sourceUrl:url,firstSeenAt:prior?.firstSeenAt||article.verifiedAt});
 }
 return [...seen.values()].sort((a,b)=>(b.materialUpdatedDate||b.publishedDate).localeCompare(a.materialUpdatedDate||a.publishedDate)||a.id.localeCompare(b.id));
}
export function classifyCongressBill(bill) {
 if(!bill?.latestAction||!validDate(bill.latestAction.actionDate))throw Error('No official legislative action');
 const action=bill.latestAction.text||'';
 if(!/introduced|reported|passed|agreed to|became public law|signed/i.test(action))return null;
 const enacted=/became public law|signed by (?:the )?president/i.test(action);
 return {updateType:enacted?'Enacted Legislation':'Proposed Legislation',materialUpdatedDate:bill.latestAction.actionDate,materialUpdateVerified:true,legislativeAction:action};
}

export function extractPDFDocument(text,url,source) {
  const body=clean(text);
  const reference=body.match(/Circular\s+\d{2}-\d{2}-\d+|Mortgagee Letter\s+\d{4}-\d+|APM\s*\d{2}-\d+|Bulletin\s+\d{4}-\d+/i)?.[0];
  const date=humanDate(body.slice(0,1200));
  if(!reference||!date)throw Error('PDF has no supported official identifier and publication date');
  const purpose=body.match(/(?:1\.\s*)?Purpose[.:]?\s+(.+?)(?=\s+2\.\s|$)/i)?.[1];
  if(!purpose||purpose.length<60)throw Error('PDF purpose text could not be verified');
  const heading=text.match(/\n[ \t]*([^\n]{12,180})[ \t]*\n\s*\n\s*1\.\s*Purpose/i)?.[1];
  const title=heading?reference+': '+clean(heading):reference;const updateType=classifyDocument({title,text:body,source});
  if(!updateType)throw Error('PDF has no verified mortgage policy development');
  return {id:source.id+'-'+hash(canonicalURL(url)).slice(0,16),agency:source.name,sourceName:source.name,category:source.category,title,summary:purpose.slice(0,850),whatChanged:purpose.slice(0,850),whyItMatters:'Review the official mortgage-program circular for applicability, required actions, and deadlines.',affectedArea:affectedArea(body),topic:affectedArea(body),updateType,publishedDate:date,sourceUrl:allowedURL(url,source),documentReference:reference,...(/effective immediately/i.test(body)?{effectiveDate:date}:{}),mortgageRelevance:'Official mortgage-program policy circular.',verifiedAt:new Date().toISOString(),contentFingerprint:hash(reference+purpose)};
}
