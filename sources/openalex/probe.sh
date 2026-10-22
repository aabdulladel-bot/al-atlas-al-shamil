#!/bin/bash
# يطبع عدد النتائج وأول عناوين لكل استعلام، دون عرض المفتاح
q() { curl -sS -m 30 -A "atlas-sunan/0.1" -G "https://api.openalex.org/works" --data-urlencode "filter=$1" --data-urlencode "per-page=3" -o /tmp/p.json -w ""; python3 -c "
import json
d=json.load(open('/tmp/p.json'))
if 'error' in d: print('ERR',str(d.get('message'))[:120]); raise SystemExit
print('count',d['meta']['count'])
for w in d['results']: print('  ',w.get('publication_year'),w.get('type'),(w.get('title') or '')[:90])
"; }
echo "[1] encyclopedia in title, type reference-entry/book:"; q "title.search:encyclopedia,type:reference-entry|book"
echo "[2] history encyclopedia (title):"; q "title.search:history encyclopedia"
echo "[3] Arabic موسوعة التاريخ:"; q "title.search:موسوعة,language:ar"
echo "[4] French encyclopédie histoire:"; q "title.search:encyclopédie histoire,language:fr"
