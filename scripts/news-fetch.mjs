import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {hash,allowedURL} from './monitor-core.mjs';
const run=promisify(execFile);
export async function fetchOfficial(url,source,{cacheRoot='.news-cache/responses',revalidate=true}={}) {
 allowedURL(url,source);await mkdir(cacheRoot,{recursive:true});
 const safe=new URL(url);safe.searchParams.delete('api_key');const key=hash(safe.href);
 const file=join(cacheRoot,key+'.json');let prior;try{prior=JSON.parse(await readFile(file,'utf8'));}catch{}
 if(!revalidate&&prior&&Date.now()-prior.checkedAt<4*3600*1000)return {...prior,cached:true};
 const dir=await mkdtemp(join(tmpdir(),'regsradar-fetch-'));const body=join(dir,'body'),headers=join(dir,'headers');
 try {
  const args=['--silent','--show-error','--location','--max-redirs','3','--proto','=https','--proto-redir','=https','--max-time','18','--max-filesize','8000000','-D',headers,'-o',body,'-w','%{http_code}\n%{url_effective}\n%{content_type}'];
  if(prior?.etag)args.push('-H','If-None-Match: '+prior.etag);
  if(prior?.lastModified)args.push('-H','If-Modified-Since: '+prior.lastModified);
  args.push(url);
  let result;try{result=await run('curl',args,{maxBuffer:1024*1024});}catch{throw Error('Official source request failed (connection, size, redirect, or timeout)');}
  const [code,effective,contentType]=result.stdout.trim().split('\n');
  allowedURL(effective,source);
  if(code==='304'&&prior){prior.checkedAt=Date.now();await writeFile(file,JSON.stringify(prior));return {...prior,cached:true};}
  if(code!=='200')throw Error(`Official source returned HTTP ${code}`);
  const rawHeaders=await readFile(headers,'utf8');
  const etag=[...rawHeaders.matchAll(/^etag:\s*(.+)$/gmi)].at(-1)?.[1].trim();
  const lastModified=[...rawHeaders.matchAll(/^last-modified:\s*(.+)$/gmi)].at(-1)?.[1].trim();
  let text;
  if(/pdf/i.test(contentType||'')||effective.endsWith('.pdf')) {
   try{const p=await run('pdftotext',['-layout',body,'-'],{maxBuffer:8*1024*1024});text=p.stdout;}catch{throw Error('PDF extraction unavailable or document could not be read');}
  } else text=await readFile(body,'utf8');
  const response={text,contentType,etag,lastModified,checkedAt:Date.now(),url:safe.href};await writeFile(file,JSON.stringify(response));return {...response,cached:false};
 }finally{await rm(dir,{recursive:true,force:true});}
}
