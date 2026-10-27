import {readFileSync} from 'node:fs';

export const NVD_URL='https://services.nvd.nist.gov/rest/json/cves/2.0';
export const KEV_URL='https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
export const CACHE_MS=6*60*60*1000;
export const PAGE_SIZE=50;
const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
const app=JSON.parse(readFileSync(new URL('../on-client/package.json',import.meta.url),'utf8'));
export const COMPONENTS=Object.freeze({
  node:{name:'Node.js',version:app.engines.node,keyword:'node.js',vendors:['nodejs'],products:['nodejs','node.js'],versionSource:'on-client/package.json · engines.node'},
  jose:{name:'jose',version:lock.packages['node_modules/jose'].version,keyword:'jose',vendors:['panva'],products:['jose'],versionSource:'package-lock.json · node_modules/jose'},
  supabase:{name:'@supabase/supabase-js',version:lock.packages['node_modules/@supabase/supabase-js'].version,keyword:'supabase',vendors:['supabase'],products:['supabase-js','supabase_js'],versionSource:'package-lock.json · node_modules/@supabase/supabase-js'},
  esbuild:{name:'esbuild',version:lock.packages['node_modules/esbuild'].version,keyword:'esbuild',vendors:['evanw','esbuild'],products:['esbuild'],versionSource:'package-lock.json · node_modules/esbuild'},
  wazuh:{name:'Wazuh',version:'4.14.9',keyword:'wazuh',vendors:['wazuh'],products:['wazuh'],versionSource:'pc-security 설치 스크립트의 고정 버전'},
});
const cveId=value=>typeof value==='string'&&/^CVE-\d{4}-\d{4,10}$/.test(value);
const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const fault=code=>Object.assign(Error(code),{code});
function compare(a,b){
  const parse=value=>typeof value==='string'&&/^v?\d+(?:\.\d+){0,3}$/.test(value)?value.replace(/^v/,'').split('.').map(Number):null;
  const x=parse(a),y=parse(b);if(!x||!y)return null;
  for(let i=0;i<4;i++){const delta=(x[i]??0)-(y[i]??0);if(delta)return Math.sign(delta);}return 0;
}
// Only simple ORs of this exact product's version ranges can produce a comparison.
// Environment ANDs, negations, prereleases and related products require human review.
export function compareCveVersion(cve,component){
  const configs=cve.configurations;
  if(!Array.isArray(configs)||!configs.length)return 'needs_review';
  const outcomes=[];
  for(const config of configs){
    if(config.negate||config.operator==='AND'||!Array.isArray(config.nodes)||config.nodes.length!==1)return 'needs_review';
    const n=config.nodes[0];if(n.negate||n.operator!=='OR'||n.nodes?.length||!Array.isArray(n.cpeMatch)||!n.cpeMatch.length)return 'needs_review';
    for(const match of n.cpeMatch){
      const cpe=typeof match.criteria==='string'?match.criteria.split(':'):[];
      if(match.vulnerable!==true||cpe.length!==13||cpe[0]!=='cpe'||cpe[1]!=='2.3'||cpe[2]!=='a'||!component.vendors?.includes(cpe[3])||!component.products.includes(cpe[4])||cpe.slice(6).some(v=>v!=='*'))return 'needs_review';
      let matches=true,known=false;
      if(cpe[5]!=='*'){const cmp=compare(component.version,cpe[5]);if(cmp===null)return 'needs_review';matches=cmp===0;known=true;}
      for(const [key,pass] of [['versionStartIncluding',v=>v>=0],['versionStartExcluding',v=>v>0],['versionEndIncluding',v=>v<=0],['versionEndExcluding',v=>v<0]]){
        if(match[key]!==undefined){const cmp=compare(component.version,match[key]);if(cmp===null)return 'needs_review';matches=matches&&pass(cmp);known=true;}
      }
      if(!known)return 'needs_review';outcomes.push(matches);
    }
  }
  return outcomes.some(Boolean)?'version_range_match':'outside_listed_ranges';
}

async function officialJSON(url,request,maxBytes){
  const response=await request(url,{headers:{accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw fault(response.status===429?'THREAT_SOURCE_RATE_LIMITED':'THREAT_SOURCE_UNAVAILABLE');
  const chunks=[];let size=0;const reader=response.body?.getReader();if(!reader)throw fault('THREAT_SOURCE_INVALID');
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw fault('THREAT_SOURCE_TOO_LARGE');chunks.push(value);}}
  finally{await reader.cancel();}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fault('THREAT_SOURCE_INVALID');}
}
export function createThreatIntelReader({cache,request=fetch,now=Date.now}){
  const pending=new Map();
  async function load(key,source,parse){
    if(pending.has(key))return pending.get(key);
    const work=(async()=>{
      const old=await cache.read(key),age=now()-Date.parse(old?.fetched_at);
      if(age>=0&&age<CACHE_MS&&old?.payload?.source===source&&stamp(old.payload.fetchedAt)&&Date.parse(old.payload.fetchedAt)===Date.parse(old.fetched_at)){
        return {...parse(old.payload.data),source,fetchedAt:old.payload.fetchedAt,cached:true};
      }
      const raw=await officialJSON(source,request,32*1024*1024),data=parse(raw),fetchedAt=new Date(now()).toISOString();
      await cache.write(key,{source,fetchedAt,data:raw},fetchedAt);
      return {...data,source,fetchedAt,cached:false};
    })();pending.set(key,work);
    try{return await work;}finally{pending.delete(key);}
  }
  return async function read(componentId,page=0){
    if(!Object.hasOwn(COMPONENTS,componentId)||!Number.isInteger(page)||page<0||page>39)throw fault('THREAT_COMPONENT_INVALID');
    const component=COMPONENTS[componentId];
    const nvdSource=NVD_URL+'?'+new URLSearchParams({keywordSearch:component.keyword,resultsPerPage:String(PAGE_SIZE),startIndex:String(page*PAGE_SIZE)});
    const [nvd,kev]=await Promise.all([
      load('nvd:'+componentId+':'+page,nvdSource,raw=>{
        if(raw?.format!=='NVD_CVE'||!Number.isSafeInteger(raw.totalResults)||raw.totalResults<0||raw.startIndex!==page*PAGE_SIZE||!Array.isArray(raw.vulnerabilities)||raw.vulnerabilities.length>PAGE_SIZE||raw.totalResults<raw.vulnerabilities.length)throw fault('THREAT_SOURCE_INVALID');
        const ids=new Set(),rows=[];
        for(const item of raw.vulnerabilities){
          const c=item?.cve;if(!cveId(c?.id)||ids.has(c.id)||!stamp(c.published)||!stamp(c.lastModified)||!Array.isArray(c.descriptions))throw fault('THREAT_SOURCE_INVALID');ids.add(c.id);
          rows.push({id:c.id,description:String(c.descriptions.find(x=>x.lang==='en')?.value??'').slice(0,1500),published:c.published,lastModified:c.lastModified,
            versionComparison:compareCveVersion(c,component),url:'https://nvd.nist.gov/vuln/detail/'+c.id});
        }
        return {rows,total:raw.totalResults,examined:rows.length,complete:page===0&&raw.totalResults===rows.length};
      }),
      load('cisa-kev',KEV_URL,raw=>{
        if(!stamp(raw?.dateReleased)||typeof raw.catalogVersion!=='string'||!Number.isSafeInteger(raw.count)||!Array.isArray(raw.vulnerabilities)||raw.count!==raw.vulnerabilities.length||raw.count>20000)throw fault('THREAT_SOURCE_INVALID');
        const ids=[];for(const row of raw.vulnerabilities){if(!cveId(row?.cveID))throw fault('THREAT_SOURCE_INVALID');ids.push(row.cveID);}
        if(new Set(ids).size!==ids.length)throw fault('THREAT_SOURCE_INVALID');return {ids,catalogVersion:raw.catalogVersion,releasedAt:raw.dateReleased};
      }),
    ]);
    const known=new Set(kev.ids),comparisons={version_range_match:0,outside_listed_ranges:0,needs_review:0};
    const rows=nvd.rows.map(row=>{comparisons[row.versionComparison]++;return {...row,inKev:known.has(row.id)};});
    rows.sort((a,b)=>Number(b.inKev)-Number(a.inKev)||Number(b.versionComparison==='version_range_match')-Number(a.versionComparison==='version_range_match')||b.lastModified.localeCompare(a.lastModified));
    return {component:{id:componentId,name:component.name,version:component.version,versionSource:component.versionSource},
      sources:{nvd:{url:nvd.source,fetchedAt:nvd.fetchedAt,cached:nvd.cached},kev:{url:kev.source,fetchedAt:kev.fetchedAt,cached:kev.cached,catalogVersion:kev.catalogVersion,releasedAt:kev.releasedAt}},
      scope:{page,startIndex:page*PAGE_SIZE,total:nvd.total,examined:nvd.examined,complete:nvd.complete,shown:rows.length,hasNext:page<39&&(page+1)*PAGE_SIZE<nvd.total,comparisons},findings:rows,
      warning:'공식 검색 목록의 현재 페이지와 소스에 선언된 버전을 대조했습니다. 최신순 정렬이나 전체 취약점 검사를 보장하지 않습니다. 검색어·CPE 조건·최대 40페이지 밖의 기록은 포함되지 않을 수 있습니다. 버전 일치나 KEV 등재는 침해 확정이 아니며 0건도 안전 보장이 아닙니다.',checkedAt:new Date(now()).toISOString()};
  };
}
