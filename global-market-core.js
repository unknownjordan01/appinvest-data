(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AppInvestGlobalMarket=factory();})(typeof window==='object'?window:globalThis,function(){
'use strict';
// Fixed exchange/URL mapping: renderer requests cannot choose a remote host or suffix.
const markets={
 US:{currency:'USD',suffix:'',zone:'America/New_York',label:'États-Unis',exchange:/nasdaq|nyse|nms|ngm|ncm|ase|pcx|bts|nys|american/i,sa:'',instrument:'NASDAQ'},
 FR:{currency:'EUR',suffix:'.PA',zone:'Europe/Paris',label:'France · Paris',exchange:/paris|par/i,sa:'epa',instrument:'EURONEXT'},
 JP:{currency:'JPY',suffix:'.T',zone:'Asia/Tokyo',label:'Japon',exchange:/tokyo|jpx|jpn|tyo/i,sa:'tyo',instrument:'TSE'},
 HK:{currency:'HKD',suffix:'.HK',zone:'Asia/Hong_Kong',label:'Hong Kong',exchange:/hong.?kong|hkg|hkse/i,sa:'hkg',instrument:'HKEX'},
 CNSS:{currency:'CNY',suffix:'.SS',zone:'Asia/Shanghai',label:'Chine · Shanghai',exchange:/shanghai|shh|sse/i,sa:'sha',instrument:'SSE'},
 CNSZ:{currency:'CNY',suffix:'.SZ',zone:'Asia/Shanghai',label:'Chine · Shenzhen',exchange:/shenzhen|shz|szse/i,sa:'she',instrument:'SZSE'},
 KR:{currency:'KRW',suffix:'.KS',zone:'Asia/Seoul',label:'Corée du Sud',exchange:/korea|kse|ksc|kosdaq|koe|kq/i,sa:'krx',instrument:'KRX'},
 TW:{currency:'TWD',suffix:'.TW',zone:'Asia/Taipei',label:'Taïwan · TWSE',exchange:/taiwan|tai|tpe/i,sa:'tpe',instrument:'TWSE'},
 TWO:{currency:'TWD',suffix:'.TWO',zone:'Asia/Taipei',label:'Taïwan · Taipei',exchange:/taipei|two|otc/i,sa:'tpex',instrument:'TPEX'},
 AU:{currency:'AUD',suffix:'.AX',zone:'Australia/Sydney',label:'Australie',exchange:/asx|australian|sydney/i,sa:'asx',instrument:'ASX'},
 GB:{currency:'GBP',forecastCurrency:'GBX',forecastPriceScale:0.01,suffix:'.L',zone:'Europe/London',label:'Royaume-Uni',exchange:/london|lse|lsm|aim/i,sa:'lon',instrument:'LSE'},
 CA:{currency:'CAD',suffix:'.TO',zone:'America/Toronto',label:'Canada · Toronto',exchange:/toronto|tsx|tor/i,sa:'tsx',instrument:'TSX'},
 CAV:{currency:'CAD',suffix:'.V',zone:'America/Toronto',label:'Canada · Venture',exchange:/venture|tsx|van/i,sa:'tsxv',instrument:'TSXV'},
 SE:{currency:'SEK',suffix:'.ST',zone:'Europe/Stockholm',label:'Suède',exchange:/stockholm|sto/i,sa:'sto',instrument:'OMXSTO'},
 DK:{currency:'DKK',suffix:'.CO',zone:'Europe/Copenhagen',label:'Danemark',exchange:/copenhagen|cph/i,sa:'cph',instrument:'OMXCOP'},
 NO:{currency:'NOK',suffix:'.OL',zone:'Europe/Oslo',label:'Norvège',exchange:/oslo|osl/i,sa:'osl',instrument:'OSL'},
 FI:{currency:'EUR',suffix:'.HE',zone:'Europe/Helsinki',label:'Finlande',exchange:/helsinki|hel/i,sa:'hel',instrument:'OMXHEX'},
 CH:{currency:'CHF',suffix:'.SW',zone:'Europe/Zurich',label:'Suisse',exchange:/swiss|swx|six/i,sa:'swx',instrument:'SIX'},
 DE:{currency:'EUR',suffix:'.DE',zone:'Europe/Berlin',label:'Allemagne · Xetra',exchange:/xetra|ger/i,sa:'etr',instrument:'XETR'},
 ES:{currency:'EUR',suffix:'.MC',zone:'Europe/Madrid',label:'Espagne',exchange:/madrid|mce|bme/i,sa:'bme',instrument:'BME'},
 PL:{currency:'PLN',suffix:'.WA',zone:'Europe/Warsaw',label:'Pologne',exchange:/warsaw|wse|gpw/i,sa:'wse',instrument:'GPW'},
 IN:{currency:'INR',suffix:'.NS',zone:'Asia/Kolkata',label:'Inde · NSE',exchange:/nse|india|nsi/i,sa:'nse',instrument:'NSE'},
 NZ:{currency:'NZD',suffix:'.NZ',zone:'Pacific/Auckland',label:'Nouvelle-Zélande',exchange:/new.?zealand|nze|nzx|nzse/i,sa:'nze',instrument:'NZX'},
 IT:{currency:'EUR',suffix:'.MI',zone:'Europe/Rome',label:'Italie',exchange:/milan|mil|italy/i,sa:'bit',instrument:'MIL'},
 BE:{currency:'EUR',suffix:'.BR',zone:'Europe/Brussels',label:'Belgique',exchange:/brussels|bru/i,sa:'ebr',instrument:'BRU'},
 NL:{currency:'EUR',suffix:'.AS',zone:'Europe/Amsterdam',label:'Pays-Bas',exchange:/amsterdam|ams/i,sa:'ams',instrument:'AMS'}
};
const symbolOK=s=>typeof s==='string'&&/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(s);
const regionForInstrument=ins=>{if(typeof ins!=='string'||ins.split(':').length!==2||!symbolOK(ins.split(':')[1]))return null;const market=ins.split(':')[0];if(['NASDAQ','NYSE','AMEX'].includes(market))return 'US';if(market==='EURONEXT')return 'FR';return Object.keys(markets).find(k=>markets[k].instrument===market)||null;};
function config(row){const m=markets[row?.region];if(!m||!symbolOK(row.symbol)||row.key!==row.region+':'+row.symbol)throw Error('Cotation internationale non prise en charge');let symbol=row.symbol;if(row.region==='HK')symbol=symbol.padStart(4,'0');const yahoo=symbol+m.suffix;const base=row.region==='US'?'https://stockanalysis.com/stocks/'+row.symbol.toLowerCase()+'/':'https://stockanalysis.com/quote/'+m.sa+'/'+row.symbol+'/';return {...m,symbol:row.symbol,forecastMarket:m.sa.toUpperCase(),base,yahoo,yahooCandidates:row.region==='KR'?[symbol+'.KS',symbol+'.KQ']:[yahoo],currency:m.currency,instrument:m.instrument+':'+row.symbol};}
const keyForInstrument=ins=>{const region=regionForInstrument(ins);return region?region+':'+String(ins).split(':')[1]:null;};
function capUSD(row,detail){if(row?.marketCapUSD>0&&Number.isFinite(row.marketCapUSD))return row.marketCapUSD;const stat=detail?.stats,local=stat&&stat.retrievedAt>=(row.retrievedAt||'')?stat.marketCap:row.marketCap;if(!(local>0))return null;if(row.currency==='USD')return local;if(row.currency==='EUR'&&detail?.fx?.usdPerEur>0)return local*detail.fx.usdPerEur;return null;}
function parseScanner(raw,now=new Date().toISOString(),selection=true){
 if(!raw||!Array.isArray(raw.data)||raw.data.length>3000)throw Error('Catalogue international non reconnu');const map={TSE:'JP',HKEX:'HK',SSE:'CNSS',SZSE:'CNSZ',KRX:'KR',TWSE:'TW',TPEX:'TWO',ASX:'AU',LSE:'GB',TSX:'CA',TSXV:'CAV',OMXSTO:'SE',OMXCOP:'DK',OSL:'NO',OMXHEX:'FI',SIX:'CH',XETR:'DE',BME:'ES',GPW:'PL',NSE:'IN',NZX:'NZ',MIL:'IT'};
 const rows=[];for(const v of raw.data){const d=v.d,region=d?.[2]==='EURONEXT'?({'France':'FR','Belgium':'BE','Netherlands':'NL'}[d[3]]):map[d?.[2]];if(!region||!symbolOK(d[0])||typeof d[1]!=='string'||d[9]!=='Biotechnology'||!Number.isFinite(d[5])||d[5]<=0||(selection&&(d[5]<1e7||d[5]>5e9)))continue;const symbol=d[0].replace(/_/g,'-'),key=region+':'+symbol,m=markets[region];if(d[4]!==m.currency&&!(region==='GB'&&d[4]==='GBX'))continue;rows.push({key,symbol,name:d[1],region,currency:m.currency,marketCap:null,marketCapUSD:d[5],capCurrency:'USD',capAsOf:now,source:'https://www.tradingview.com/screener/',retrievedAt:now,country:d[3],issuerKey:typeof d[10]==='string'?d[10]:v.s,global:true,classification:'Biotechnology · classification du fournisseur',screenSymbol:v.s});}return rows;
}
return {markets,symbolOK,config,regionForInstrument,keyForInstrument,capUSD,parseScanner};
});
