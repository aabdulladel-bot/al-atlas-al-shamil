# نواة الطلبات للسكرابر: ذاكرة مؤقتة على القرص، وحد سرعة لكل مضيف، وإعادة محاولة تحترم مهلة الخادم (Retry-After).
# تستعمل curl كبقية سكربتات المستودع، فتعمل خلف وكيل البيئة وشهاداته بلا إعداد إضافي.
# الهوية في الطلبات رابط المستودع، لا بريد شخصي.
import hashlib
import json
import subprocess
import tempfile
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "scraper"
UA = "AlAtlasAlShamil/0.1 (https://github.com/aabdulladel-bot/al-atlas-al-shamil; non-commercial research)"
# أقل فاصل بين طلبين لكل مضيف (ثوانٍ): أبطأ من حدود الخدمات المعلنة، فلا نضغط على أحد
MIN_INTERVAL = {"query.wikidata.org": 1.0, "www.wikidata.org": 2.0, "en.wikipedia.org": 0.3, "ar.wikipedia.org": 0.3, "archive.org": 1.0}
_last = {}
stats = {"cache_hits": 0, "requests": 0, "retries": 0}


class FetchError(Exception):
    pass


class RateLimited(FetchError):
    """الخادم طلب انتظاراً أطول من الحد المقبول؛ يُترك القرار للمهمة (تأجيل أو إعادة لاحقاً)."""

    def __init__(self, host, wait):
        super().__init__(f"{host}: مقيّد بالسرعة، يطلب الانتظار {wait} ثانية")
        self.host, self.wait = host, wait


def _wait(host):
    gap = MIN_INTERVAL.get(host, 1.0)
    elapsed = time.monotonic() - _last.get(host, 0.0)
    if elapsed < gap:
        time.sleep(gap - elapsed)
    _last[host] = time.monotonic()


def _retry_after(head_text):
    for line in head_text.splitlines():
        if line.lower().startswith("retry-after:"):
            try:
                return max(1, int(line.split(":", 1)[1].strip()))
            except ValueError:
                return None
    return None


def fetch(url, data=None, headers=None, ttl_days=30, retries=6, max_wait=120):
    """يعيد نص الاستجابة. data: قاموس يُرسل POST مرمّزاً. الاستجابات الناجحة تُحفظ في .cache/scraper."""
    key = hashlib.sha256(json.dumps([url, data, headers or {}], sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    path = CACHE / key[:2] / f"{key}.json"
    if path.exists() and time.time() - path.stat().st_mtime < ttl_days * 86400:
        stats["cache_hits"] += 1
        return json.loads(path.read_text(encoding="utf-8"))["body"]
    host = urllib.parse.urlparse(url).hostname
    backoff = 5
    with tempfile.TemporaryDirectory() as tmp:
        body_f, head_f = Path(tmp) / "body", Path(tmp) / "head"
        for _ in range(retries):
            _wait(host)
            cmd = ["curl", "-sS", "-m", "120", "-A", UA, "-o", str(body_f), "-D", str(head_f), "-w", "%{http_code}"]
            for k, v in (headers or {}).items():
                cmd += ["-H", f"{k}: {v}"]
            for k, v in (data or {}).items():
                cmd += ["--data-urlencode", f"{k}={v}"]
            cmd.append(url)
            stats["requests"] += 1
            r = subprocess.run(cmd, capture_output=True, text=True)
            code = r.stdout.strip()[-3:]
            head = head_f.read_text(encoding="utf-8", errors="replace") if head_f.exists() else ""
            if code == "200":
                body = body_f.read_text(encoding="utf-8")
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps({"url": url, "fetched": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "body": body}, ensure_ascii=False), encoding="utf-8")
                return body
            if code in ("429", "500", "502", "503", "504", "000"):
                stats["retries"] += 1
                wait = _retry_after(head) or backoff
                if wait > max_wait:
                    raise RateLimited(host, wait)
                time.sleep(wait)
                backoff = min(backoff * 2, 300)
                continue
            raise FetchError(f"{host}: HTTP {code} {r.stderr.strip()[:200]}")
    raise FetchError(f"{host}: فشل بعد {retries} محاولات")
