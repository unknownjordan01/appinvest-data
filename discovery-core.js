(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./intel-core.js'));else root.AppInvestDiscoveryCore=factory(root.AppInvestIntelCore);})(typeof window==='object'?window:globalThis,function(C){
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
function config(row){if(!row||!['US','FR'].includes(row.region)||!/^[A-Z][A-Z0-9.-]{0,14}$/.test(row.symbol))throw Error('Cotation invalide');return {yahoo:row.symbol+(row.region==='FR'?'.PA':''),currency:row.region==='FR'?'EUR':'USD',base:row.region==='FR'?'https://stockanalysis.com/quote/epa/'+row.symbol+'/':'https://stockanalysis.com/stocks/'+row.symbol.toLowerCase()+'/'};}
function parseHistory(raw,row,range,now=new Date().toISOString()){
 const cfg=config(row),r=raw?.chart?.result?.[0],m=r?.meta;if(!m||m.symbol?.toUpperCase()!==cfg.yahoo||m.currency!==cfg.currency)throw Error('Historique pour une autre cotation ou devise');
 const ex=m.fullExchangeName||m.exchangeName||'';if(row.region==='FR'?!/paris|par/i.test(ex):!/nasdaq|nyse|nms|ngm|ncm|ase|pcx|bts|nys|american/i.test(ex))throw Error('Place non confirmée');
 const quote=r.indicators?.quote?.[0],adj=r.indicators?.adjclose?.[0]?.adjclose,points=[];
 for(let i=0;i<(r.timestamp||[]).length;i++){const rawClose=quote?.close?.[i],close=adj?.[i]??rawClose;if(!C.positive(close))continue;points.push({at:new Date(r.timestamp[i]*1000).toISOString(),close,volume:quote?.volume?.[i]??null});}
 points.sort((a,b)=>a.at.localeCompare(b.at));const splits=Object.values(r.events?.splits||{}).map(s=>({at:new Date(s.date*1000).toISOString(),ratio:s.splitRatio}));
 if(!C.positive(m.regularMarketPrice)||!C.positive(m.regularMarketTime)||!points.length)throw Error('Historique vide');const at=new Date(m.regularMarketTime*1000).toISOString();if(Date.parse(at)>Date.parse(now)+300000)throw Error('Cours futur refusé');
 const previous=m.chartPreviousClose??m.previousClose; // Pour 1j seulement : référence de clôture de la veille du fournisseur.
 const dailyChange=range==='1d'&&C.positive(previous)?(m.regularMarketPrice/previous-1)*100:null;
 return {key:row.key,currency:m.currency,price:m.regularMarketPrice,at,retrievedAt:now,range,points,splits,dailyChange,volume:m.regularMarketVolume??null,exchange:ex,instrument:(row.region==='FR'?'EURONEXT':/nasdaq|nms|ngm|ncm/i.test(ex)?'NASDAQ':/american|ase/i.test(ex)?'AMEX':'NYSE')+':'+row.symbol,adjusted:!!adj,url:'https://finance.yahoo.com/quote/'+cfg.yahoo+'/'};
}
function parseStats(html,row,now=new Date().toISOString()){
 const cfg=config(row),plain=C.clean(html);if(!plain.includes(row.symbol)||!plain.includes(row.region==='FR'?'EUR':'USD'))throw Error('Statistiques : devise/cotation non confirmée');
 const all=tables(html).flat(),get=k=>magnitude(all.find(r=>r[0]===k)?.[1]);
 return {marketCap:get('Market Cap'),cash:get('Cash & Cash Equivalents'),operatingCashFlow:get('Operating Cash Flow'),currency:cfg.currency,period:'TTM pour le flux opérationnel ; date de clôture non fournie ici',asOf:'',retrievedAt:now,url:cfg.base+'statistics/'};
}
function parseFinancial(balance,cashflow,row,now=new Date().toISOString()){
 const cfg=config(row);const extract=html=>{const plain=C.clean(html),currency=plain.match(/Millions (USD|EUR|GBP|CHF)\./)?.[1],dateRaw=html.match(/id="TTM" title="Trailing twelve month period ending ([A-Z][a-z]{2} \d{1,2}, \d{4})"/)?.[1];
 if(!plain.includes(row.symbol)||!currency||!dateRaw)throw Error('Comptes : unité, période ou cotation non confirmée');
 const dt=new Date(dateRaw+' UTC');if(!Number.isFinite(+dt))throw Error('Date des comptes invalide');const asOf=dt.toISOString().slice(0,10);if(asOf>now.slice(0,10))throw Error('Comptes datés dans le futur');return {currency,asOf,rows:tables(html).flat()};};
 const b=extract(balance),c=extract(cashflow);if(b.currency!==c.currency||b.asOf!==c.asOf)throw Error('Comptes de périodes ou devises différentes');
 const get=(x,key)=>magnitude(x.rows.find(r=>r[0]===key)?.[1]),cash=get(b,'Cash & Short-Term Investments')??get(b,'Cash & Equivalents'),ocf=get(c,'Operating Cash Flow');
 if(cash===null||cash<0||ocf===null)throw Error('Flux opérationnel ou liquidités absents');
 return {cash:cash*1e6,operatingCashFlow:ocf*1e6,currency:b.currency,asOf:b.asOf,months:12,indicativeMonths:ocf<0?cash/Math.abs(ocf)*12:null,retrievedAt:now,url:cfg.base+'financials/cash-flow-statement/',balanceUrl:cfg.base+'financials/balance-sheet/',note:'S&P Global via Stock Analysis ; flux opérationnel sur 12 mois. Ratio indicatif depuis la clôture, trésorerie restreinte non identifiée, dépenses futures et financements ultérieurs non intégrés. Ce ratio n’est pas une autonomie annoncée.'};
}
function dailyRank(rows,details,mode,now=Date.now()){
 const eligible=[];
 for(const r of rows){const d=details[r.key],q=d?.day,cap=(d?.stats&&d.stats.retrievedAt>=(r.retrievedAt||''))?d.stats.marketCap:r.marketCap;if(!q||!C.iso(q.at)||!Number.isFinite(q.dailyChange)||!C.positive(cap)||C.age(q.at,now)<-0.004||C.age(q.at,now)>4||C.age(q.retrievedAt,now)<-0.004||C.age(q.retrievedAt,now)>1||q.splits?.length)continue;
 const fx=r.currency==='USD'?1:d?.fx?.usdPerEur;if(!C.positive(fx)||r.currency==='EUR'&&(!C.iso(d.fx.at)||C.age(d.fx.at,now)>4))continue;const usd=cap*fx;if(usd<1e7||usd>5e9||mode==='fr'&&r.region!=='FR')continue;eligible.push({...r,q,capUSD:usd});
 }
 // Ne pas mélanger une séance clôturée de la veille et une séance plus récente sur une même place.
 const dates={};for(const r of eligible){const d=new Date(r.q.at).toLocaleDateString('sv-SE',{timeZone:r.region==='FR'?'Europe/Paris':'America/New_York'});if(!dates[r.region]||d>dates[r.region])dates[r.region]=d;}
 return eligible.filter(r=>new Date(r.q.at).toLocaleDateString('sv-SE',{timeZone:r.region==='FR'?'Europe/Paris':'America/New_York'})===dates[r.region]).sort((a,b)=>b.q.dailyChange-a.q.dailyChange);
}
function measure(points,a,b){if(!points.length)return null;a=Math.max(0,Math.min(points.length-1,a));b=Math.max(0,Math.min(points.length-1,b));return {from:points[a],to:points[b],percent:(points[b].close/points[a].close-1)*100};}
return {france,tables,magnitude,parseUniverse,config,parseHistory,parseStats,parseFinancial,dailyRank,measure};
});
