import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile, writeFile, rename, unlink} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {fileURLToPath} from 'node:url';

const run = promisify(execFile);
const officialHost = 'www.federalregister.gov';
export function weeklyWindow(asOf) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw Error('Use an ISO date: YYYY-MM-DD');
  const end = new Date(`${asOf}T12:00:00Z`);
  if (!Number.isFinite(+end) || end.toISOString().slice(0, 10) !== asOf) throw Error('Invalid date');
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
  return {windowStart: start.toISOString().slice(0, 10), windowEnd: asOf};
}
function officialURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== officialHost || url.username || url.password || url.port) {
    throw Error('Untrusted official-source URL');
  }
  return url.href;
}
export async function fetchJSON(url) {
  // curl honors the machine's proxy and CA trust; TLS verification stays enabled.
  const {stdout} = await run('curl', ['--fail-with-body', '--silent', '--show-error', '--max-time', '45', '--max-redirs', '0', url], {maxBuffer: 12 * 1024 * 1024});
  return JSON.parse(stdout);
}
export async function loadWeeklyNews(asOf, getJSON = fetchJSON) {
  const window = weeklyWindow(asOf);
  const query = new URL(`https://${officialHost}/api/v1/documents.json`);
  query.searchParams.set('conditions[term]', 'mortgage');
  query.searchParams.set('conditions[publication_date][gte]', window.windowStart);
  query.searchParams.set('conditions[publication_date][lte]', window.windowEnd);
  query.searchParams.set('per_page', '100');
  query.searchParams.set('order', 'newest');
  for (const field of ['document_number','title','abstract','publication_date','html_url','agencies','type']) query.searchParams.append('fields[]', field);
  const articles = []; const ids = new Set(); const pages = new Set();
  let next = query.href; let expectedCount;
  while (next) {
    const url = officialURL(next);
    if (pages.has(url) || pages.size >= 100) throw Error('Invalid pagination');
    pages.add(url);
    const data = await getJSON(url);
    if (!Array.isArray(data.results) || !Number.isInteger(data.count) || data.count < 0) throw Error('Unexpected publisher response');
    if (expectedCount !== undefined && expectedCount !== data.count) throw Error('Publisher results changed during refresh; retry');
    expectedCount = data.count;
    for (const item of data.results) {
      const date = item.publication_date;
      weeklyWindow(date);
      if (date < window.windowStart || date > window.windowEnd) throw Error('Publisher returned an article outside the requested week');
      if (typeof item.document_number !== 'string' || !item.document_number || typeof item.title !== 'string' || !item.title.trim()) throw Error('Missing article identity or title');
      if (ids.has(item.document_number)) throw Error('Duplicate publication in publisher results');
      const sourceUrl = officialURL(item.html_url);
      if (!Array.isArray(item.agencies) || !item.agencies.every(a => typeof a.name === 'string' && a.name.trim())) throw Error('Invalid agency data');
      if (item.abstract != null && typeof item.abstract !== 'string') throw Error('Invalid publisher summary');
      ids.add(item.document_number);
      articles.push({id: item.document_number, agency: item.agencies.map(a => a.name).join(' / ') || 'Federal Register', category: 'Federal', topic: item.type || 'Publication', title: item.title.trim(), summary: item.abstract?.trim() || 'The publisher has not provided a summary. Open the official publication for the full text.', publishedDate: date, sourceName: 'Federal Register', sourceUrl});
    }
    next = data.next_page_url || null;
  }
  if (articles.length !== expectedCount) throw Error('Incomplete publisher results');
  articles.sort((a,b) => b.publishedDate.localeCompare(a.publishedDate) || a.id.localeCompare(b.id));
  return {...window, status: 'verified', generatedAt: new Date().toISOString(), sourceName: 'Federal Register', scope: 'Federal Register publications matching “mortgage”; GSE and state sources are not included.', articles};
}
const curatedSources = {
  'Fannie Mae': {hosts: ['www.fanniemae.com'], category: 'GSEs'},
  'Freddie Mac': {hosts: ['freddiemac.gcs-web.com', 'www.freddiemac.com'], category: 'GSEs'},
  'New York DFS': {hosts: ['www.dfs.ny.gov'], category: 'States', state: 'New York'},
  'Texas Department of Banking': {hosts: ['www.dob.texas.gov'], category: 'States', state: 'Texas'},
  'Kansas OSBC': {hosts: ['osbckansas.gov', 'www.osbckansas.gov'], category: 'States', state: 'Kansas'},
  'Wisconsin DFI': {hosts: ['dfi.wi.gov'], category: 'States', state: 'Wisconsin'},
};
export function mergeCuratedNews(edition, curated) {
  if (!Array.isArray(curated.articles)) throw Error('Invalid curated news collection');
  const articles = [...edition.articles];
  const ids = new Set(articles.map(article=>article.id));
  for (const article of curated.articles) {
    const source = curatedSources[article.sourceName];
    const url = new URL(article.sourceUrl);
    if (!source || !source.hosts.includes(url.hostname) || url.protocol !== 'https:' || url.username || url.password || url.port) throw Error('Untrusted curated source URL');
    if (article.category !== source.category || (source.state && article.state !== source.state)) throw Error('Source category or state does not match publisher');
    for (const field of ['id', 'title', 'summary', 'agency', 'topic']) {
      if (typeof article[field] !== 'string' || !article[field].trim()) throw Error('Incomplete curated publication');
    }
    if (typeof article.verifiedAt !== 'string' || !Number.isFinite(Date.parse(article.verifiedAt))) throw Error('Missing source verification timestamp');
    weeklyWindow(article.publishedDate);
    // Historical curated records are retained on disk but never substituted into a newer week.
    if (article.publishedDate < edition.windowStart || article.publishedDate > edition.windowEnd) continue;
    if (ids.has(article.id)) throw Error('Duplicate curated publication');
    ids.add(article.id);
    articles.push(article);
  }
  articles.sort((a,b)=>b.publishedDate.localeCompare(a.publishedDate) || a.id.localeCompare(b.id));
  return {...edition, sourceName: 'Official publishers', scope: 'Official federal and GSE publications plus verified state financial-services news. State coverage is partial; education and market news are labeled separately from rules.', articles, stateCoverage: curated.stateCoverage ? {...curated.stateCoverage, verifiedItemStates: [...new Set(articles.filter(a=>a.category==='States').map(a=>a.state))].sort()} : null};
}
export async function refreshNews(asOf, output = new URL('../src/data/weekly-news.json', import.meta.url), getJSON = fetchJSON, curated = null) {
  const federal = await loadWeeklyNews(asOf, getJSON);
  const supplemental = curated || JSON.parse(await readFile(new URL('../src/data/curated-news.json', import.meta.url), 'utf8'));
  const data = mergeCuratedNews(federal, supplemental);
  const temp = new URL(`${fileURLToPath(output)}.tmp`, 'file:');
  try {
    await writeFile(temp, JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
    await rename(temp, output);
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
  return data;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const asOf = process.argv[2] || new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  try {
    const data = await refreshNews(asOf);
    console.log(`Saved ${data.articles.length} official publications for ${data.windowStart} through ${data.windowEnd}.`);
  } catch (error) {
    console.error('News refresh failed; existing edition was preserved. No sample articles were substituted.');
    console.error(error.message);
    process.exitCode = 1;
  }
}
