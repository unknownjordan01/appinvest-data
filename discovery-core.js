(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./intel-core.js'),require('./global-market-core.js'));else root.AppInvestDiscoveryCore=factory(root.AppInvestIntelCore,root.AppInvestGlobalMarket);})(typeof window==='object'?window:globalThis,function(C,G){
'use strict';
// Liste volontairement limitée aux cotations identifiées ; une absence de cours n'est pas zéro.
const france=[['VLA','Valneva'],['MAAT','MaaT Pharma'],['ALSEN','Sensorion'],['NANO','Nanobiotix'],['ABVX','Abivax'],['IPH','Innate Pharma'],['GNFT','Genfit'],['DBV','DBV Technologies'],['AB','AB Science'],['OSE','OSE Immunotherapeutics'],['SIGHT','GenSight Biologics'],['ALOPM','Oncodesign Precision Medicine'],['ALTHX','THX Pharma']];
const tables=html=>[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(t=>[...t[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>C.clean(c[1]))));
function magnitude(v){const m=String(v).replace(/[$€£,\s]/g,'').match(/^(-?\d+(?:\.\d+)?)([KMBT])?$/);return m?Number(m[1])*({K:1e3,M:1e6,B:1e9,T:1e12}[m[2]]||1):null;}
function parseUniverse(html,now=new Date().toISOString()){
 const t=tables(html).find(t=>t[0]?.includes('Symbol')&&t[0]?.includes('Market Cap'));if(!t||t.length<50)throw Error('Catalogue non reconnu ; données précédentes conservées');
 const h=t[0],at=k=>h.indexOf(k),seen=new Set(),rows=[];
 for(const r of t.slice(1)){const symbol=r[at('Symbol')],name=r[at('Company Name')],cap=magnitude(r[at('Market Cap')]);if(!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)||!name||seen.has(symbol))continue;seen.add(symbol);rows.push({key:'US:'+symbol,symbol,name,region:'US',marketCap:cap,currency:'USD',screenChange:magnitude(r[at('% Change')]?.replace('%','')),volume:magnitude(r[at('Volume')]),source:'https://stockanalysis.com/stocks/industry/biotechnology/',retrievedAt:now});}
 if(rows.length<50)throw Error('Catalogue incomplet');return rows;
}
function config(row){if(G.markets[row?.region]&&!['US','FR'].includes(row.region))return G.config(row);if(!row||!['US','FR'].includes(row.region)||!/^[A-Z][A-Z0-9.-]{0,14}$/.test(row.symbol))throw Error('Cotation invalide');return {yahoo:row.symbol+(row.region==='FR'?'.PA':''),currency:row.region==='FR'?'EUR':'USD',base:row.region==='FR'?'https://stockanalysis.com/quote/epa/'+row.symbol+'/':'https://stockanalysis.com/stocks/'+row.symbol.toLowerCase()+'/'};}
function parseHistory(raw,row,range,now=new Date().toISOString()){
 const cfg=config(row),r=raw?.chart?.result?.[0],m=r?.meta;const priceScale=m?.currency==='GBp'&&cfg.currency==='GBP'?0.01:1;if(!m||!(cfg.yahooCandidates||[cfg.yahoo]).includes(m.symbol?.toUpperCase())||(m.currency!==cfg.currency&&priceScale===1))throw Error('Historique pour une autre cotation ou devise');
 const ex=m.fullExchangeName||m.exchangeName||'';if(!G.markets[row.region].exchange.test(ex))throw Error('Place non confirmée');
 const quote=r.indicators?.quote?.[0],adj=r.indicators?.adjclose?.[0]?.adjclose,points=[];
 for(let i=0;i<(r.timestamp||[]).length;i++){const rawClose=quote?.close?.[i],close=adj?.[i]??rawClose;if(!C.positive(close))continue;points.push({at:new Date(r.timestamp[i]*1000).toISOString(),close:close*priceScale,volume:quote?.volume?.[i]??null});}
 points.sort((a,b)=>a.at.localeCompare(b.at));const splits=Object.values(r.events?.splits||{}).map(s=>({at:new Date(s.date*1000).toISOString(),ratio:s.splitRatio}));
 if(!C.positive(m.regularMarketPrice)||!C.positive(m.regularMarketTime)||(!points.length&&range!=='1d'))throw Error('Historique vide');const at=new Date(m.regularMarketTime*1000).toISOString();if(Date.parse(at)>Date.parse(now)+300000)throw Error('Cours futur refusé');
 const previous=m.chartPreviousClose??m.previousClose; // Pour 1j seulement : référence de clôture de la veille du fournisseur.
 const dailyChange=range==='1d'&&C.positive(previous)?(m.regularMarketPrice/previous-1)*100:null;
 return {key:row.key,currency:cfg.currency,price:m.regularMarketPrice*priceScale,at,retrievedAt:now,range,points,splits,dailyChange,volume:m.regularMarketVolume??null,exchange:ex,instrument:(row.region==='FR'?'EURONEXT':row.region!=='US'?G.markets[row.region].instrument:/nasdaq|nms|ngm|ncm/i.test(ex)?'NASDAQ':/american|ase/i.test(ex)?'AMEX':'NYSE')+':'+row.symbol,adjusted:!!adj,url:'https://finance.yahoo.com/quote/'+cfg.yahoo+'/'};
}
function parseStats(html,row,now=new Date().toISOString()){
 const cfg=config(row),plain=C.clean(html);if(!plain.includes(row.symbol)||!plain.includes(cfg.currency))throw Error('Statistiques : devise/cotation non confirmée');
 const all=tables(html).flat(),get=k=>magnitude(all.find(r=>r[0]===k)?.[1]);
 return {marketCap:get('Market Cap'),cash:get('Cash & Cash Equivalents'),operatingCashFlow:get('Operating Cash Flow'),currency:cfg.currency,period:'TTM pour le flux opérationnel ; date de clôture non fournie ici',asOf:'',retrievedAt:now,url:cfg.base+'statistics/'};
}
function parseFinancial(balance,cashflow,row,now=new Date().toISOString()){
 const cfg=config(row);const extract=html=>{const plain=C.clean(html),currency=plain.match(/Millions (USD|EUR|GBP|CHF|CNY|HKD|CAD|AUD|SEK|JPY|KRW|TWD|INR|NOK|DKK|NZD|PLN)\./)?.[1],dateRaw=html.match(/id="TTM" title="Trailing twelve month period ending ([A-Z][a-z]{2} \d{1,2}, \d{4})"/)?.[1];
 if(!plain.includes(row.symbol)||!currency||!dateRaw)throw Error('Comptes : unité, période ou cotation non confirmée');
 const dt=new Date(dateRaw+' UTC');if(!Number.isFinite(+dt))throw Error('Date des comptes invalide');const asOf=dt.toISOString().slice(0,10);if(asOf>now.slice(0,10))throw Error('Comptes datés dans le futur');return {currency,asOf,rows:tables(html).flat()};};
 const b=extract(balance),c=extract(cashflow);if(b.currency!==c.currency||b.asOf!==c.asOf)throw Error('Comptes de périodes ou devises différentes');
 const get=(x,key)=>magnitude(x.rows.find(r=>r[0]===key)?.[1]),cash=get(b,'Cash & Short-Term Investments')??get(b,'Cash & Equivalents'),ocf=get(c,'Operating Cash Flow');
 if(cash===null||cash<0||ocf===null)throw Error('Flux opérationnel ou liquidités absents');
 return {cash:cash*1e6,operatingCashFlow:ocf*1e6,currency:b.currency,asOf:b.asOf,months:12,indicativeMonths:ocf<0?cash/Math.abs(ocf)*12:null,retrievedAt:now,url:cfg.base+'financials/cash-flow-statement/',balanceUrl:cfg.base+'financials/balance-sheet/',note:'S&P Global via Stock Analysis ; flux opérationnel sur 12 mois. Ratio indicatif depuis la clôture, trésorerie restreinte non identifiée, dépenses futures et financements ultérieurs non intégrés. Ce ratio n’est pas une autonomie annoncée.'};
}
function parseStockFinancial(balance,cashflow,row,now=new Date().toISOString()){
 try{return parseFinancial(balance,cashflow,row,now);}catch{}
 const extract=(html,ttm)=>{const plain=C.clean(html),currency=plain.match(/Millions (USD|EUR|GBP|CHF|CNY|HKD|CAD|AUD|SEK|JPY|KRW|TWD|INR|NOK|DKK|NZD|PLN)\./)?.[1],table=html.match(/<table\b[^>]*>[\s\S]*?<\/table>/i)?.[0]||'';if(!plain.includes(row.symbol)||!currency)throw Error('Comptes : devise ou société non confirmée');const dateRaw=ttm?table.match(/id="TTM" title="Trailing twelve month period ending ([A-Z][a-z]{2} \d{1,2}, \d{4})"/)?.[1]:table.match(/<th id="(20\d{2}-\d{2}-\d{2})"/)?.[1];if(!dateRaw||!ttm&&tables(table)[0]?.[0]?.[1]?.slice(0,2)!=='FY')throw Error('Période annuelle non confirmée');const d=new Date(dateRaw+' UTC');if(!Number.isFinite(+d))throw Error('Date des comptes invalide');const asOf=d.toISOString().slice(0,10);if(asOf>now.slice(0,10))throw Error('Comptes datés dans le futur');return {currency,asOf,rows:tables(html).flat()};};
 const b=extract(balance,true),f=extract(cashflow,false);if(b.currency!==f.currency)throw Error('Devises des comptes différentes');const get=(x,k)=>magnitude(x.rows.find(r=>r[0]===k)?.[1]),cash=get(b,'Cash & Short-Term Investments')??get(b,'Cash & Equivalents'),ocf=get(f,'Operating Cash Flow');if(cash===null||cash<0||ocf===null)throw Error('Flux ou liquidités absents');const cfg=config(row);
 return {cash:cash*1e6,operatingCashFlow:ocf*1e6,currency:b.currency,asOf:b.asOf,flowAsOf:f.asOf,months:12,separatePeriods:true,indicativeMonths:null,retrievedAt:now,url:cfg.base+'financials/cash-flow-statement/',balanceUrl:cfg.base+'financials/balance-sheet/',note:'Données agrégées S&P Global via Stock Analysis. Liquidités au '+b.asOf+' ; flux opérationnel de l’exercice annuel clos le '+f.asOf+'. Périodes distinctes : aucun ratio d’autonomie calculé. Devise des comptes : '+b.currency+'.'};
}
const sessionFormats=new Map();
function dailyRank(rows,details,mode,now=Date.now()){
 const eligible=[];
 for(const r of rows){const d=details[r.key],q=d?.day,usd=G.capUSD(r,d);if(!q||!C.iso(q.at)||!Number.isFinite(q.dailyChange)||!C.positive(usd)||C.age(q.at,now)<-0.004||C.age(q.at,now)>4||C.age(q.retrievedAt,now)<-0.004||C.age(q.retrievedAt,now)>4||q.splits?.length)continue;
 if(r.global&&(!C.iso(r.capAsOf)||C.age(r.capAsOf,now)>30))continue;
 if(!r.global&&r.currency==='EUR'&&(!C.iso(d.fx?.at)||C.age(d.fx.at,now)>4))continue;
 if(usd<1e7||usd>5e9||mode==='fr'&&r.region!=='FR')continue;eligible.push({...r,q,capUSD:usd});
 }
 // A lone newly refreshed quote must not evict the rest of a market.
 const dates={},counts={};const session=r=>{const zone=G.markets[r.region].zone;if(!sessionFormats.has(zone))sessionFormats.set(zone,new Intl.DateTimeFormat('sv-SE',{timeZone:zone}));return sessionFormats.get(zone).format(new Date(r.q.at));};for(const r of eligible){const d=session(r),region=r.region;counts[region]??={};counts[region][d]=(counts[region][d]||0)+1;}for(const [region,days]of Object.entries(counts))dates[region]=Object.keys(days).sort((a,b)=>days[b]-days[a]||b.localeCompare(a))[0];
 const seen=new Set();return eligible.filter(r=>session(r)===dates[r.region]).sort((a,b)=>b.q.dailyChange-a.q.dailyChange).filter(r=>{const key=r.issuerKey||r.key;if(seen.has(key))return false;seen.add(key);return true;});
}

// Calendar horizons; short IPO histories and unadjusted split histories cannot stand in for a year.
function periodReturns(h){
 const points=h.points||[],last=points.at(-1),base={key:h.key,currency:h.currency,retrievedAt:h.retrievedAt,at:last?.at||h.at,url:h.url,adjusted:!!h.adjusted,six:null,year:null};
 if(!last||(!h.adjusted&&h.splits?.length))return base;
 for(const [key,months]of [['six',6],['year',12]]){const target=new Date(last.at),day=target.getUTCDate();target.setUTCDate(1);target.setUTCMonth(target.getUTCMonth()-months);const lastDay=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(day,lastDay));let first=null;
 for(const p of points)if(!first||Math.abs(Date.parse(p.at)-target)<Math.abs(Date.parse(first.at)-target))first=p;
 if(first&&first.at<last.at&&Math.abs(Date.parse(first.at)-target)<=7*86400000)base[key]={percent:(last.close/first.close-1)*100,from:first.at,to:last.at};
 }return base;
}
function sponsorName(name){return String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/(?:\s+(?:incorporated|inc|corporation|corp|limited|ltd|pty|plc|sa|se|nv|bv|ag|co|gmbh|sarl|n v|b v|s a|s e|s a s|societe anonyme))+\s*$/g,'').trim();}
function parseClinical(raw,row,now=new Date().toISOString()){
 const name=sponsorName(row.name);if(name.length<4||!Array.isArray(raw?.studies)||raw.studies.length>100)throw Error('Registre : réponse ou promoteur non confirmé');
 const trials=[];for(const study of raw.studies){const p=study.protocolSection,s=p?.statusModule,sp=p?.sponsorCollaboratorsModule?.leadSponsor?.name,id=p?.identificationModule?.nctId;
 if(sponsorName(sp)!==name||!/^NCT\d{8}$/.test(id||'')||!['RECRUITING','ACTIVE_NOT_RECRUITING','NOT_YET_RECRUITING','ENROLLING_BY_INVITATION'].includes(s?.overallStatus))continue;
 const phases=(p.designModule?.phases||[]).filter(v=>['EARLY_PHASE1','PHASE1','PHASE2','PHASE3','PHASE4'].includes(v));if(!phases.length)continue;
 trials.push({id,title:String(p.identificationModule.briefTitle||id).slice(0,600),sponsor:String(sp).slice(0,300),phases,status:s.overallStatus,primaryCompletion:s.primaryCompletionDateStruct?.date||'',completionType:s.primaryCompletionDateStruct?.type||'',updated:s.lastUpdatePostDateStruct?.date||'',interventions:(p.armsInterventionsModule?.interventions||[]).map(i=>String(i.name).slice(0,200)).slice(0,10),url:'https://clinicaltrials.gov/study/'+id});}
 return {key:row.key,queryName:row.name,retrievedAt:now,truncated:!!raw.nextPageToken,trials:trials.slice(0,20)};
}
function measure(points,a,b){if(!points.length)return null;a=Math.max(0,Math.min(points.length-1,a));b=Math.max(0,Math.min(points.length-1,b));return {from:points[a],to:points[b],percent:(points[b].close/points[a].close-1)*100};}
return {france,tables,magnitude,parseUniverse,config,parseHistory,parseStats,parseFinancial,parseStockFinancial,dailyRank,measure,periodReturns,sponsorName,parseClinical};
});
