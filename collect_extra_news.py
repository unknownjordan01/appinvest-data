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
def collect(old=None,fetcher=None):
 old=old or {};items=dict(old.get('items',{}));report=[];now=dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00','Z')
 for symbol,url in SOURCES.items():
  try:
   if fetcher:raw=fetcher(url)
   else:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Kinara public news collection'}),timeout=20) as response:raw=response.read(3*1024*1024+1)
   if len(raw)>3*1024*1024:raise ValueError('Réponse trop volumineuse')
   incoming=edenred(raw) if symbol=='EDEN' else parse_feed(raw,symbol)
   previous={v['link']:v for v in items.get(symbol,[])}
   for v in incoming:previous[v['link']]={k:v.get(k) for k in ['title','link','date','dateRaw']}|{'retrievedAt':now}
   items[symbol]=sorted(previous.values(),key=lambda v:v.get('date') or '',reverse=True)[:100];report.append({'symbol':symbol,'ok':True,'received':len(incoming)})
  except Exception as e:report.append({'symbol':symbol,'ok':False,'error':str(e)[:300]})
 return {'format':'kinara-official-news','version':1,'generatedAt':now,'sources':SOURCES,'items':items,'report':report}
if __name__=='__main__':
 target=Path('extra-news.json');old=json.loads(target.read_text()) if target.exists() else None;data=collect(old);temp=target.with_suffix('.json.tmp');temp.write_text(json.dumps(data,ensure_ascii=False)+'\n');temp.replace(target);print(json.dumps(data['report']))
