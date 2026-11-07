import {load} from 'cheerio';
import {clean,validDate,isFresh,hash,affectedArea} from './monitor-core.mjs';
export function parseBillStatus(xml,sourceUrl,asOf) {
 const $=load(xml,{xmlMode:true});const bill=$('billStatus > bill');if(!bill.length)throw Error('Not official bill-status XML');
 const title=clean(bill.children('title').text()),introduced=clean(bill.children('introducedDate').text());
 const congress=clean(bill.children('congress').text()),type=clean(bill.children('type').text()),number=clean(bill.children('number').text());
 if(!title||!validDate(introduced)||!/^\d+$/.test(congress)||!/^\d+$/.test(number)||!['HR','S','HJRES','SJRES'].includes(type))throw Error('Incomplete official bill identity');
 const actions=bill.find('actions > item').toArray().map(node=>({date:clean($(node).children('actionDate').text()),text:clean($(node).children('text').text())})).filter(a=>validDate(a.date)&&/introduced|reported|passed|agreed to|became public law|signed/i.test(a.text)).sort((a,b)=>b.date.localeCompare(a.date));
 if(!actions.length)return null;
 const action=actions[0];const enacted=bill.find('laws > item').length>0||actions.some(a=>/became public law|signed by (?:the )?president/i.test(a.text));
 const officialSummary=clean(load(bill.find('summaries summary text, summaries > item text').last().text()).text());
 const longTitle=clean(bill.find('titles > item > title').first().text());
 const context=title+' '+longTitle+' '+officialSummary;
 if(!/mortgage|foreclos|RESPA|HMDA|SAFE Act|fair lending|housing finance|home lending|home loan|housing loan/i.test(context))return null;
 const reference=`${congress}-${type}-${number}`;
 const summary=officialSummary||longTitle||title;
 const a={id:'bill-'+reference,agency:'U.S. Congress',sourceName:'U.S. Congress / GovInfo',category:'Federal',title:`${type==='HR'?'H.R.':type+'.'} ${number} — ${title}`,summary:summary.slice(0,1200),whatChanged:action.text,whyItMatters:enacted?'An enacted mortgage-related legislative development. Review the law text for applicability and effective dates; no compliance date has been inferred.':'A mortgage-related legislative proposal, not an existing legal obligation. Its requirements may change during the legislative process.',affectedArea:affectedArea(context),topic:affectedArea(context),updateType:enacted?'Enacted Legislation':'Proposed Legislation',publishedDate:introduced,materialUpdatedDate:action.date,materialUpdateVerified:true,legislativeAction:action.text,documentReference:reference,sourceUrl,mortgageRelevance:'Mortgage-related substantive federal legislative action.',verifiedAt:new Date().toISOString(),contentFingerprint:hash(reference+context+action.text)};
 return isFresh(a,asOf)?a:null;
}
export function billStatusLinks(rss) {
 const $=load(rss,{xmlMode:true});const links=new Set();
 $('channel > item').each((_,node)=>{
  const title=clean(load($(node).children('title').text()).text());
  if(!/mortgage|foreclos|RESPA|HMDA|housing|home |consumer|privacy|insurance|credit reporting/i.test(title)||/Medicare|home health|deposit insurance/i.test(title))return;
  const url=$(node).children('link').text();const id=url.match(/BILLS-(\d+)(hr|s|hjres|sjres)(\d+)[a-z]+$/i);
  if(id)links.add(`https://www.govinfo.gov/bulkdata/BILLSTATUS/${id[1]}/${id[2].toLowerCase()}/BILLSTATUS-${id[1]}${id[2].toLowerCase()}${id[3]}.xml`);
 });return [...links];
}
