"""Public source configuration only; never reads local AppInvest profiles."""
import json, re, datetime as dt, urllib.request, html
from pathlib import Path
from collect_news import parse_feed
SOURCES={
 'RERE':'https://ir.atrenew.com/rss/news-releases.xml',
 'ALDX':'https://ir.aldeyra.com/rss/news-releases.xml',
 'EDEN':'https://www.edenred.com/fr/investisseurs-actionnaires/communiques-de-presse'
}
def edenred(raw):
 text=raw.decode('utf-8');out=[];seen=set();months=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
 clean=lambda s:re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]*>',' ',s))).strip()
 for block in re.split(r'<li\b[^>]*class="swiper-container--documents__item"[^>]*>',text,flags=re.I)[1:]:
  title=re.search(r'<h2\b[^>]*>(.*?)</h2>',block,re.S|re.I);link=re.search(r'<a\b[^>]*href="(/system/files/[^"?#]+\.pdf)"',block,re.I);date=re.search(r'<li\b[^>]*class="list--custom__item"[^>]*>(.*?)</li>',block,re.S|re.I)
  if not title or not link or not date:continue
  url='https://www.edenred.com'+html.unescape(link[1]);date_raw=clean(date[1]);parts=date_raw.split();stamp=None
  if len(parts)==3 and parts[1] in months:
   try:stamp=dt.date(int(parts[2]),months.index(parts[1])+1,int(parts[0])).isoformat()
   except ValueError:pass
  if url not in seen:out.append({'title':clean(title[1]),'link':url,'date':stamp,'dateRaw':date_raw});seen.add(url)
  if len(out)>=50:break
 if not out:raise ValueError('Structure Edenred non reconnue')
 return out
def fetch_bytes(url):
 req=urllib.request.Request(url,headers={'User-Agent':'AppInvest-RSS/1.0 (public research; https://github.com/unknownjordan01/appinvest-data)','Accept':'application/rss+xml, application/atom+xml, application/json, application/xml, text/html'})
 with urllib.request.urlopen(req,timeout=20) as response:raw=response.read(3*1024*1024+1)
 if len(raw)>3*1024*1024:raise ValueError('Réponse trop volumineuse')
 return raw

def sec_filings(symbol,fetcher):
 # Public SEC issuer IDs verified against its official ticker registry.
 cik={'RERE':'0001838957','ALDX':'0001341235'}[symbol]
 expected={'RERE':'ATRENEW','ALDX':'ALDEYRA'}
 url='https://data.sec.gov/submissions/CIK'+cik+'.json'
 data=json.loads(fetcher(url))
 if str(data.get('cik','')).zfill(10)!=cik or symbol not in data.get('tickers',[]) or expected[symbol] not in str(data.get('name','')).upper():
  raise ValueError('Identité émetteur SEC contradictoire')
 recent=data.get('filings',{}).get('recent',{});out=[]
 for i,form in enumerate(recent.get('form',[])):
  if form not in ['8-K','6-K']:continue
  acc=recent['accessionNumber'][i];doc=recent['primaryDocument'][i];date=recent['filingDate'][i]
  if not re.fullmatch(r'\d{10}-\d{2}-\d{6}',acc) or not re.fullmatch(r'[A-Za-z0-9._-]+',doc):continue
  try:dt.date.fromisoformat(date)
  except ValueError:continue
  desc=(recent.get('primaryDocDescription') or ['']*len(recent['form']))[i] or 'Document réglementaire'
  out.append({'title':'Dépôt SEC '+form+' — '+desc,'link':'https://www.sec.gov/Archives/edgar/data/'+str(int(cik))+'/'+acc.replace('-','')+'/'+doc,'date':date,'dateRaw':date,'origin':'sec_filing','sourceUrl':url,'sourceNote':'Date de dépôt SEC ; distincte de la publication d’un communiqué. Aucune interprétation automatique.'})
  if len(out)>=20:break
 if not out:raise ValueError('Aucun dépôt SEC récent exploitable')
 return out

def collect(old=None,fetcher=None):
 old=old or {};items=dict(old.get('items',{}));report=[];now=dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00','Z')
 for symbol,url in SOURCES.items():
  try:
   mode='official_feed' if symbol!='EDEN' else 'official_page';source_error=None
   try:
    raw=(fetcher or fetch_bytes)(url)
    if len(raw)>3*1024*1024:raise ValueError('Réponse trop volumineuse')
    incoming=edenred(raw) if symbol=='EDEN' else parse_feed(raw,symbol)
   except Exception as error:
    if symbol not in ['RERE','ALDX']:raise
    source_error=str(error)[:300];incoming=sec_filings(symbol,fetcher or fetch_bytes);mode='sec_filings_fallback'
   previous={v['link']:v for v in items.get(symbol,[])}
   for v in incoming:previous[v['link']]={k:v[k] for k in ['title','link','date','dateRaw','origin','sourceUrl','sourceNote'] if k in v}|{'retrievedAt':now}
   items[symbol]=sorted(previous.values(),key=lambda v:v.get('date') or '',reverse=True)[:100];report.append({'symbol':symbol,'ok':True,'received':len(incoming),'mode':mode,'primaryError':source_error})
  except Exception as e:report.append({'symbol':symbol,'ok':False,'error':str(e)[:300]})
 return {'format':'kinara-official-news','version':1,'generatedAt':now,'sources':SOURCES,'items':items,'report':report}
if __name__=='__main__':
 target=Path('extra-news.json');old=json.loads(target.read_text()) if target.exists() else None;data=collect(old);temp=target.with_suffix('.json.tmp');temp.write_text(json.dumps(data,ensure_ascii=False)+'\n');temp.replace(target);print(json.dumps(data['report']))
