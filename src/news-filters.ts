import type {Article, Category} from './news';

export type Period = '7' | '14' | 'all' | 'custom';
export type DateRange = {from?: string; to: string};
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0,10) === value;
}
export function pacificToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get = (type: string)=>parts.find(p=>p.type===type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function rangeForPeriod(period: Exclude<Period,'custom'>, today: string): DateRange {
  if (!isCalendarDate(today)) throw Error('Invalid current date');
  if (period === 'all') return {to:today};
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (Number(period)-1));
  return {from:start.toISOString().slice(0,10),to:today};
}
export function dateRangeError(from: string, to: string, earliest?: string): string | null {
  if (!isCalendarDate(from) || !isCalendarDate(to)) return 'Enter valid dates as YYYY-MM-DD.';
  if (from > to) return 'Start date must be on or before end date.';
  if (earliest && from < earliest) return `Earlier articles are not loaded. Choose ${earliest} or later.`;
  return null;
}
export function articleDate(article: Article): string {
  return article.materialUpdateVerified && article.materialUpdatedDate && isCalendarDate(article.materialUpdatedDate)?article.materialUpdatedDate:article.publishedDate;
}
export function filterNews(items: readonly Article[], options: {category: Category; query: string; range: DateRange}): Article[] {
  const query = options.query.trim().toLowerCase();
  return items.filter(a=>(options.category==='All'||a.category===options.category) &&
    (!options.range.from||articleDate(a)>=options.range.from) && articleDate(a)<=options.range.to &&
    `${a.title} ${a.summary} ${a.agency} ${a.topic} ${a.state||''}`.toLowerCase().includes(query))
    .sort((a,b)=>articleDate(b).localeCompare(articleDate(a))||a.id.localeCompare(b.id));
}

export function freshArticles(items: readonly Article[], today = pacificToday()): Article[] {
  const range=rangeForPeriod('14',today);
  return items.filter(a=>isCalendarDate(a.publishedDate)&&a.publishedDate<=today&&articleDate(a)>=range.from!&&articleDate(a)<=today);
}
export function validateRemoteFeed(value: unknown, today = pacificToday()): {windowStart:string;windowEnd:string;status:string;articles:Article[]} {
  if(!value||typeof value!=='object'||!('articles' in value)||!Array.isArray(value.articles))throw Error('Invalid feed');
  const seen=new Set<string>();
  for(const a of value.articles) {
    if(!a||['id','title','summary','agency','category','publishedDate','sourceUrl','updateType','mortgageRelevance'].some(k=>typeof a[k]!=='string'||!a[k].trim()))throw Error('Incomplete publication');
    if(!['Federal','GSEs','States'].includes(a.category)||!isCalendarDate(a.publishedDate)||!Number.isFinite(Date.parse(a.verifiedAt)))throw Error('Unverified publication');
    if(seen.has(a.id))throw Error('Duplicate publication');seen.add(a.id);
    const url=new URL(a.sourceUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error('Unsafe source');
    if(!['Proposed Legislation','Enacted Legislation','Proposed Regulation','Final Regulation','Agency Guidance','Enforcement','Regulatory Notice'].includes(a.updateType))throw Error('Unclassified publication');
  }
  const range=rangeForPeriod('14',today);
  return {windowStart:range.from!,windowEnd:today,status:'verified',articles:freshArticles(value.articles as Article[],today)};
}
