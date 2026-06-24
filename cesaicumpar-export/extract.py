#!/usr/bin/env python3
"""Extract all articles + gift ideas from cesaicumpar.ro via the WordPress REST API.

Output (JSON, UTF-8) into ./out:
  articole.json   – 99 posts: full HTML content + metadata
  cadouri.json    – 294 gift ideas: affiliate link + taxonomies
  pagini.json     – 5 static pages
  taxonomii.json  – resolved term maps
  manifest.json   – counts + image URL list for a later media download
"""
import json, os, re, sys, time, urllib.request, urllib.error
from html.parser import HTMLParser

BASE = "https://cesaicumpar.ro/wp-json/wp/v2"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
os.makedirs(OUT, exist_ok=True)

def get(url):
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "cesaicumpar-export/1.0"})
            with urllib.request.urlopen(req, timeout=40) as r:
                total = r.headers.get("X-WP-Total")
                return json.loads(r.read().decode("utf-8")), total
        except urllib.error.HTTPError as e:
            if e.code == 400:  # page out of range -> done
                return [], None
            print(f"  HTTP {e.code} on {url} (attempt {attempt+1})", file=sys.stderr)
            time.sleep(2)
        except Exception as e:
            print(f"  error {e} on {url} (attempt {attempt+1})", file=sys.stderr)
            time.sleep(2)
    raise RuntimeError(f"failed: {url}")

def fetch_all(endpoint, per_page=100, extra=""):
    """Paginate an endpoint fully."""
    items, page = [], 1
    while True:
        url = f"{BASE}/{endpoint}?per_page={per_page}&page={page}{extra}"
        batch, _ = get(url)
        if not batch:
            break
        items.extend(batch)
        if len(batch) < per_page:
            break
        page += 1
    return items

def media_map(ids):
    """Resolve featured_media ids -> source_url in batches."""
    ids = sorted({i for i in ids if i})
    out = {}
    for i in range(0, len(ids), 50):
        chunk = ids[i:i+50]
        inc = ",".join(str(x) for x in chunk)
        batch, _ = get(f"{BASE}/media?per_page=50&include={inc}&_fields=id,source_url")
        for m in batch:
            out[m["id"]] = m.get("source_url")
    return out

class Stripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
    def handle_data(self, d):
        self.parts.append(d)

def to_text(html):
    s = Stripper()
    try:
        s.feed(html or "")
    except Exception:
        return re.sub(r"<[^>]+>", " ", html or "")
    return re.sub(r"\s+", " ", "".join(s.parts)).strip()

def term_map(taxonomy):
    """Return {term_id: name} for a taxonomy."""
    terms = fetch_all(taxonomy)
    return {t["id"]: t["name"] for t in terms}

def names(item, taxonomy, tmap):
    return [tmap.get(tid, str(tid)) for tid in (item.get(taxonomy) or [])]

print("Resolving taxonomies...")
cat_map  = term_map("categories")
tag_map  = term_map("tags")
ocazie_map      = term_map("ocazie")
pentru_cine_map = term_map("pentru-cine")
pret_map        = term_map("pret")
tip_map         = term_map("tip")

taxonomii = {
    "categories": cat_map, "tags": tag_map, "ocazie": ocazie_map,
    "pentru-cine": pentru_cine_map, "pret": pret_map, "tip": tip_map,
}
json.dump(taxonomii, open(os.path.join(OUT, "taxonomii.json"), "w"), ensure_ascii=False, indent=2)
print(f"  categories={len(cat_map)} tags={len(tag_map)} ocazie={len(ocazie_map)} "
      f"pentru-cine={len(pentru_cine_map)} pret={len(pret_map)} tip={len(tip_map)}")

image_urls = set()

print("Fetching articles (posts)...")
posts_raw = fetch_all("posts", per_page=20)
print(f"  resolving {len(posts_raw)} post images...")
post_imgs = media_map(p.get("featured_media") for p in posts_raw)
articole = []
for p in posts_raw:
    content_html = p.get("content", {}).get("rendered", "")
    img = post_imgs.get(p.get("featured_media"))
    if img: image_urls.add(img)
    articole.append({
        "id": p["id"],
        "slug": p["slug"],
        "title": p["title"]["rendered"],
        "date": p["date"],
        "modified": p["modified"],
        "status": p["status"],
        "link": p["link"],
        "categories": names(p, "categories", cat_map),
        "tags": names(p, "tags", tag_map),
        "featured_image": img,
        "excerpt_html": p.get("excerpt", {}).get("rendered", ""),
        "content_html": content_html,
        "content_text": to_text(content_html),
        "content_chars": len(content_html),
    })
json.dump(articole, open(os.path.join(OUT, "articole.json"), "w"), ensure_ascii=False, indent=2)
print(f"  {len(articole)} articles")

print("Fetching gift ideas (cadouri)...")
cadouri_raw = fetch_all("cadouri", per_page=50)
print(f"  resolving {len(cadouri_raw)} cadou images...")
cadou_imgs = media_map(c.get("featured_media") for c in cadouri_raw)
cadouri = []
for c in cadouri_raw:
    img = cadou_imgs.get(c.get("featured_media"))
    if img: image_urls.add(img)
    cadouri.append({
        "id": c["id"],
        "slug": c["slug"],
        "title": c["title"]["rendered"],
        "affiliate_link": c["link"],            # the 2Performant / external URL
        "internal_guid": c.get("guid", {}).get("rendered", ""),
        "date": c["date"],
        "modified": c["modified"],
        "status": c["status"],
        "featured_image": img,
        "ocazie": names(c, "ocazie", ocazie_map),
        "pentru_cine": names(c, "pentru-cine", pentru_cine_map),
        "pret": names(c, "pret", pret_map),
        "tip": names(c, "tip", tip_map),
    })
json.dump(cadouri, open(os.path.join(OUT, "cadouri.json"), "w"), ensure_ascii=False, indent=2)
print(f"  {len(cadouri)} gift ideas")

print("Fetching pages...")
pages_raw = fetch_all("pages")
pagini = [{
    "id": p["id"], "slug": p["slug"], "title": p["title"]["rendered"],
    "link": p["link"], "content_html": p.get("content", {}).get("rendered", ""),
} for p in pages_raw]
json.dump(pagini, open(os.path.join(OUT, "pagini.json"), "w"), ensure_ascii=False, indent=2)
print(f"  {len(pagini)} pages")

manifest = {
    "source": "https://cesaicumpar.ro",
    "counts": {"articole": len(articole), "cadouri": len(cadouri), "pagini": len(pagini),
               "images": len(image_urls)},
    "image_urls": sorted(image_urls),
}
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), ensure_ascii=False, indent=2)
print(f"\nDONE. {len(image_urls)} unique images referenced. Output in {OUT}")
