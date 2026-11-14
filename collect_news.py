"""Collecte les titres et liens RSS officiels ; ne déduit aucune donnée clinique."""
import concurrent.futures
import datetime as dt
import email.utils
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

FEEDS = {
 'tiziana':'https://tizianalifesciences.gcs-web.com/rss/news-releases.xml',
 'proqr':'https://www.proqr.com/press-releases/rss.xml',
 'biocryst':'https://ir.biocryst.com/rss/news-releases.xml',
 'valneva':'https://valneva.com/feed/?post_type=press-release',
 'maat':'https://www.maatpharma.com/category/press-releases/feed/',
 'capricor':'https://www.capricor.com/investors/news-events/press-releases/rss',
 'atyr':'https://investors.atyrpharma.com/rss/news-releases.xml',
}

def safe_url(value):
    p=urllib.parse.urlsplit(value)
    return p.scheme=='https' and bool(p.hostname) and not p.username and not p.password

def parse_feed(raw, slug):
    root=ET.fromstring(raw)
    tag=lambda el:el.tag.rsplit('}',1)[-1]
    if tag(root) not in ('rss','feed','RDF'): raise ValueError('Réponse non RSS/Atom')
    result=[]
    for item in (el for el in root.iter() if tag(el) in ('item','entry')):
        def value(*names):
            return next((''.join(el.itertext()).strip() for el in item if tag(el) in names),'')
        title=value('title')
        link=next((el.attrib.get('href','') or (el.text or '').strip() for el in item if tag(el)=='link' and el.attrib.get('rel','alternate')=='alternate'),'')
        if not title or not safe_url(link): continue
        date_raw=value('pubDate','published','updated','date'); date=None
        try:
            try: parsed=dt.datetime.fromisoformat(date_raw.replace('Z','+00:00'))
            except ValueError: parsed=email.utils.parsedate_to_datetime(date_raw)
            if parsed.tzinfo: date=parsed.astimezone(dt.timezone.utc).isoformat().replace('+00:00','Z')
        except (ValueError,TypeError,OverflowError): pass
        result.append({'slug':slug,'title':title[:3000],'link':link,'date':date,'dateRaw':date_raw[:100]})
    if not result: raise ValueError('Flux vide ou sans liens HTTPS exploitables')
    return result[:100]

def fetch(slug, address):
    req=urllib.request.Request(address,headers={'User-Agent':'AppInvest-RSS/1.0','Accept':'application/rss+xml, application/atom+xml, application/xml, text/xml'})
    with urllib.request.urlopen(req,timeout=25) as response:
        raw=response.read(2*1024*1024+1)
    if len(raw)>2*1024*1024: raise ValueError('Flux trop volumineux')
    return parse_feed(raw,slug)

def collect(data, fetcher=fetch, now=None):
    now=now or dt.datetime.now(dt.timezone.utc)
    stamp=now.isoformat().replace('+00:00','Z')
    slugs={c['slug'] for c in data['companies']}
    # MaaT's existing stable slug can differ from its display name.
    configured={s:u for s,u in FEEDS.items() if s in slugs}
    for c in data['companies']:
        if 'maat' in c['slug'].lower(): configured[c['slug']]=FEEDS['maat']
    articles={(a['slug'],a['link']):a for a in data.get('remoteNews',[])}
    checks=[]; added=0; success=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        tasks={pool.submit(fetcher,s,u):(s,u) for s,u in configured.items()}
        for future in concurrent.futures.as_completed(tasks):
            slug,url=tasks[future]
            try:
                items=future.result();success+=1
                for item in items:
                    key=(slug,item['link'])
                    if key not in articles:
                        articles[key]={**item,'retrievedAt':stamp};added+=1
                checks.append({'slug':slug,'ok':True,'count':len(items)})
            except Exception as error:
                checks.append({'slug':slug,'ok':False,'error':str(error)[:300]})
    for slug in sorted(slugs-set(configured)):
        checks.append({'slug':slug,'ok':False,'error':'Aucun flux récent validé ; contrôle manuel requis.'})
    data['remoteNews']=sorted(articles.values(),key=lambda a:(a.get('date') or '',a['slug'],a['link']),reverse=True)[:1500]
    data['collection']={'checkedAt':stamp,'added':added,'checks':sorted(checks,key=lambda c:c['slug']), 'scope':'Titres et liens RSS uniquement ; fiches financières et cliniques non réanalysées.'}
    # Ne jamais rajeunir asOf/verifiedOn : ils datent la recherche documentaire.
    today=now.date().isoformat(); old_day,old_n=data['version'].split('.')
    version_day=max(today,old_day)
    data['version']=version_day+'.'+str(int(old_n)+1 if version_day==old_day else 1)
    return data,success

def main():
    path=Path('biotech-data.json');data=json.loads(path.read_text(encoding='utf-8'))
    data,success=collect(data)
    content=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
    if len(content.encode())>2*1024*1024: raise ValueError('Données trop volumineuses ; publication annulée')
    temporary=path.with_suffix('.tmp');temporary.write_text(content,encoding='utf-8');os.replace(temporary,path)
    report=data['collection']
    print(json.dumps(report,ensure_ascii=False,indent=2))
    for check in report['checks']:
        if not check['ok']: print('::warning::Source non actualisée : '+check['slug'])
    summary=os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary,'a',encoding='utf-8') as output:
            output.write('## Collecte AppInvest\n\n'+str(report['added'])+' nouveaux liens. Les analyses restent inchangées.\n\n')
            for check in report['checks']:output.write('- '+check['slug']+': '+('OK' if check['ok'] else check['error'])+'\n')
    # Le workflow publie aussi le bilan d'erreurs : aucune fausse réussite silencieuse.
    return success

if __name__=='__main__': main()
