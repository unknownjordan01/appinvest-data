/* Fonctions partagées, sans accès au stockage ni au réseau. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AppInvestIntelCore=factory();})(typeof window==='object'?window:globalThis,function(){
'use strict';
const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const iso=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const object=o=>o&&typeof o==='object'&&!Array.isArray(o);
const url=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
const str=s=>typeof s==='string'&&s.length<=12000;
const age=(s,now=Date.now())=>(now-Date.parse(s))/86400000;
const clean=s=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const num=s=>{const t=String(s).replace(/[$€£,\s]/g,'');return /^\d+(?:\.\d+)?$/.test(t)?Number(t):NaN;};
function englishDay(s){const m=String(s).match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/);if(!m)return '';const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(m[1])+1;const result=m[3]+'-'+String(month).padStart(2,'0')+'-'+m[2].padStart(2,'0');return day(result)?result:'';}
function parseForecast(html,config,now=new Date().toISOString()){
 const plain=clean(html);if(!plain.includes('Stock Price Forecast'))throw Error('Page sans prévisions publiques');
 const expected=config.market==='EURONEXT'?'EPA:'+config.symbol:(config.forecastMarket||config.market)+': '+config.symbol;
 const sourceCurrency=config.forecastCurrency||config.currency,scale=config.forecastPriceScale||1;
 if((!plain.includes(expected)&&!plain.includes(expected.replace(': ',':')))||!plain.includes(sourceCurrency))throw Error('Cotation ou devise de la page non confirmée');
 const tables=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(m=>[...m[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>clean(c[1]))));
 const t=tables.find(t=>t[0]?.join(' ').includes('Low Average Median High'));
 const values=t?.find(r=>r[0]==='Price')?.slice(1).map(v=>num(v)*scale),count=Number(plain.match(/According to (\d+) analysts? /)?.[1]);
 if(!values||values.length!==4||values.some(v=>!positive(v))||!Number.isInteger(count)||count<1||count>200)throw Error('Consensus public incomplet ou format modifié');
 const [low,mean,median,high]=values;if(low>high||median<low||median>high||mean<low||mean>high)throw Error('Bornes du consensus incohérentes');
 const rows=tables.find(t=>t[0]?.includes('Price Target')&&t[0]?.includes('Firm'))||[];
 const analysts=[];
 for(const row of rows.slice(1)){
  const headers=rows[0],value=k=>row[headers.indexOf(k)]||'',rawTarget=value('Price Target'),targets=rawTarget.match(/[$€£]\s*[\d,.]+/g)||[],dateRaw=value('Date'),date=englishDay(dateRaw);
  if(!targets.length||!date)continue;
  const target=num(targets.at(-1))*scale,previous=targets.length>1?num(targets[0])*scale:null,firm=value('Firm');
  if(positive(target)&&firm)analysts.push({firm,target,previous:positive(previous)?previous:null,date,rating:row[3]||'',url:config.forecastUrl});
 }
 const updated=plain.match(/Last updated:\s*([A-Z][a-z]{2} \d{1,2}, \d{4})/),dataDate=updated?englishDay(updated[1]):'';
 return {instrument:config.instrument,currency:config.currency,low,mean,median,high,count,analysts:analysts.slice(0,20),retrievedAt:now,dataDate,url:config.forecastUrl,provider:'Stock Analysis · consensus S&P Global, avis TipRanks',dispersion:high/low>=8};
}
function validForecast(v){return object(v)&&str(v.instrument)&&/^[A-Z]{3}$/.test(v.currency)&&['low','mean','median','high'].every(k=>positive(v[k]))&&v.low<=v.median&&v.median<=v.high&&v.low<=v.mean&&v.mean<=v.high&&Number.isInteger(v.count)&&v.count>0&&v.count<=200&&iso(v.retrievedAt)&&(!v.dataDate||day(v.dataDate))&&url(v.url)&&str(v.provider)&&typeof v.dispersion==='boolean'&&Array.isArray(v.analysts)&&v.analysts.length<=20&&v.analysts.every(a=>object(a)&&str(a.firm)&&positive(a.target)&&(a.previous===null||positive(a.previous))&&day(a.date)&&url(a.url));}
function parseQuote(data,config,now=new Date().toISOString()){
 const m=data?.chart?.result?.[0]?.meta;
 const priceScale=m?.currency==='GBp'&&config.currency==='GBP'?0.01:1;
 if(!m||!(config.yahooCandidates||[config.yahoo]).map(s=>s.toUpperCase()).includes(m.symbol?.toUpperCase())||(m.currency!==config.currency&&priceScale===1)||!positive(m.regularMarketPrice)||!positive(m.regularMarketTime))throw Error('Cours non reconnu pour cette cotation/devise');
 const us=/nasdaq|nyse|nms|ngm|ncm|ase|pcx|bts|nys/i.test(m.fullExchangeName||m.exchangeName||'');
 if(config.market==='EURONEXT'&&!/paris|par/i.test(m.fullExchangeName||m.exchangeName||''))throw Error('Place de Paris non confirmée');
 if(!['NASDAQ','NYSE','AMEX','EURONEXT'].includes(config.market)&&!config.exchange?.test(m.fullExchangeName||m.exchangeName||''))throw Error('Place internationale non confirmée');
 if(['NASDAQ','NYSE','AMEX'].includes(config.market)&&!us)throw Error('Place américaine non confirmée');
 const exchange=m.fullExchangeName||m.exchangeName||'';if(config.market==='NASDAQ'&&!/nasdaq|nms|ngm|ncm/i.test(exchange)||config.market==='NYSE'&&!/nyse|nys/i.test(exchange)||config.market==='AMEX'&&!/amex|american|ase/i.test(exchange))throw Error('Place de cotation différente de celle configurée');
 const at=new Date(m.regularMarketTime*1000).toISOString();if(Date.parse(at)>Date.parse(now)+300000)throw Error('Cours daté dans le futur');
 return {instrument:config.instrument,currency:config.currency,price:m.regularMarketPrice*priceScale,at,retrievedAt:now,provider:'Yahoo Finance · dernier cours de séance disponible',url:'https://finance.yahoo.com/quote/'+encodeURIComponent(config.yahoo)+'/'};
}
function validQuote(q){return object(q)&&str(q.instrument)&&/^[A-Z]{3}$/.test(q.currency)&&positive(q.price)&&iso(q.at)&&iso(q.retrievedAt)&&url(q.url);}
function upside(f,q,now=Date.now()){
 if(!validForecast(f)||!validQuote(q)||f.instrument!==q.instrument||f.currency!==q.currency||age(q.at,now)<-0.004||age(q.at,now)>4||age(f.retrievedAt,now)>30||age(f.retrievedAt,now)<0)return null;
 if(f.dataDate&&(age(f.dataDate,now)>180||age(f.dataDate,now)<-1))return null;
 return (f.median/q.price-1)*100;
}
function configFor(instrument){
 const G=typeof module==='object'&&module.exports?require('./global-market-core.js'):globalThis.AppInvestGlobalMarket;
 if(typeof instrument==='string'&&G?.regionForInstrument(instrument)&&!['US','FR'].includes(G.regionForInstrument(instrument))){const region=G.regionForInstrument(instrument),symbol=instrument.split(':')[1],cfg=G.config({region,symbol,key:region+':'+symbol});return {...cfg,instrument,market:instrument.split(':')[0],symbol,forecastUrl:cfg.base+'forecast/'};}
 if(typeof instrument!=='string'||!/^(NASDAQ|NYSE|AMEX|EURONEXT):[A-Z0-9][A-Z0-9.-]{0,14}$/.test(instrument))throw Error('Cotation attendue : NASDAQ:TLSA ou EURONEXT:VLA');
 const [market,symbol]=instrument.split(':'),currency=market==='EURONEXT'?'EUR':'USD';
 return {instrument,market,symbol,currency,yahoo:market==='EURONEXT'?symbol+'.PA':symbol,forecastUrl:market==='EURONEXT'?'https://stockanalysis.com/quote/epa/'+symbol+'/forecast/':'https://stockanalysis.com/stocks/'+symbol.toLowerCase()+'/forecast/'};
}
function parseTrial(raw,id,now=new Date().toISOString()){
 const p=raw?.protocolSection,s=p?.statusModule,i=p?.identificationModule,d=p?.designModule;
 if(!p||i?.nctId!==id||!s?.overallStatus)throw Error('Essai non reconnu');
 return {id,title:String(i.briefTitle||id).slice(0,2000),status:s.overallStatus,enrollment:d?.enrollmentInfo?.count??null,enrollmentType:d?.enrollmentInfo?.type||'',primaryCompletion:s.primaryCompletionDateStruct?.date||'',completion:s.completionDateStruct?.date||'',updated:s.lastUpdatePostDateStruct?.date||'',retrievedAt:now,url:'https://clinicaltrials.gov/study/'+id};
}
function validTrial(t){return object(t)&&/^NCT\d{8}$/.test(t.id)&&['title','status','primaryCompletion','completion','updated','enrollmentType'].every(k=>str(t[k]))&&(t.enrollment===null||(Number.isInteger(t.enrollment)&&t.enrollment>=0))&&iso(t.retrievedAt)&&url(t.url);}
function validFinance(f){return f===null||(object(f)&&day(f.asOf)&&day(f.sourceDate)&&url(f.url)&&/^[A-Z]{3}$/.test(f.currency)&&['cash','restricted','debt','cashBurn','months'].every(k=>f[k]===null||(typeof f[k]==='number'&&Number.isFinite(f[k])&&f[k]>=0))&&(f.months===null||f.months>0)&&(!f.runwayEnd||day(f.runwayEnd))&&str(f.note)&&typeof f.dilution==='boolean');}
function runway(f){if(!validFinance(f)||!f)return null;if(f.runwayEnd)return {end:f.runwayEnd,basis:f.runwayApprox?'Borne prudente de l’horizon annoncé':'Horizon annoncé',estimated:false};if(f.cash===null||f.restricted===null||f.cashBurn===null||f.months===null||!positive(f.cashBurn)||!positive(f.months))return null;
 const available=Math.max(0,f.cash-(f.restricted||0)),months=available/(f.cashBurn/f.months);if(!Number.isFinite(months)||months>120)return null;
 const d=new Date(f.asOf+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+Math.round(months*30.4375));return {end:d.toISOString().slice(0,10),basis:'Estimation linéaire depuis les comptes',estimated:true,months};}
function funding(f,event,now=Date.now()){
 const r=runway(f);if(!r)return {status:'unknown',label:'Autonomie non calculable',runway:null};
 if(age(f.asOf,now)>180)return {status:'stale',label:'Comptes anciens : couverture à revérifier',runway:r};
 if(!event)return {status:'unknown',label:'Échéance clinique non datée',runway:r};
 const start=event.dateKind==='exact'?event.date:event.start,end=event.dateKind==='exact'?event.date:event.end;
 if(!day(start)||!day(end))return {status:'unknown',label:'Fenêtre non bornée',runway:r};
 if(r.end<start)return {status:'gap',label:'Horizon financier avant le catalyseur',runway:r};
 if(r.end<end)return {status:'partial',label:'Horizon financier au milieu de la fenêtre',runway:r};
 return {status:'covered',label:'Horizon couvrant la fenêtre selon les hypothèses',runway:r};
}
function riskFlags(f,company,now=Date.now()){
 const flags=[];if(f){const r=runway(f);if(r&&age(r.end,now)>0)flags.push('Horizon financier dépassé');else if(r&&(Date.parse(r.end)-now)/86400000<180)flags.push('Horizon financier inférieur à six mois');if(f.dilution)flags.push('Financement dilutif signalé dans la source');if(age(f.asOf,now)>180)flags.push('Comptes anciens');}
 const programs=company?.programs||[];if(programs.length===1)flags.push('Un seul programme documenté');if(/phase\s*[12]|préclinique/i.test(company?.phase||'')&&!/commercial/i.test(company?.phase||''))flags.push('Développement clinique encore incertain');
 return flags;
}
return {day,iso,positive,object,url,str,age,clean,num,parseForecast,validForecast,parseQuote,validQuote,upside,configFor,parseTrial,validTrial,validFinance,runway,funding,riskFlags};
});
