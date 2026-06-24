#!/usr/bin/env python3
"""Extract affiliate product links embedded INSIDE article bodies.

Many articles list products inline (wp-block-media-text blocks, or plain text
links) rather than as `cadouri` CPT entries. This parses each article's
content_html and pulls out every Profitshare / 2Performant link with its
product name + image, deduplicated per article by URL.

Output: out/articole_produse.json  +  out/articole_produse_flat.csv
"""
import json, os, re, csv
from html.parser import HTMLParser
from urllib.parse import urlparse, parse_qs, unquote

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
art = json.load(open(os.path.join(OUT, "articole.json")))

AFFILIATE_HOSTS = ("l.profitshare.ro", "event.2performant.com")
CTA_WORDS = re.compile(r"^(vezi|cumpara|cumpără|comanda|comandă|aici|pret|preț|"
                       r"detalii|link|buy|shop|order|click)\b", re.I)

def network(host):
    if "profitshare" in host: return "profitshare"
    if "2performant" in host: return "2performant"
    return "other"

def merchant(url):
    """Final shop for 2Performant links (redirect_to). Profitshare hides it."""
    q = parse_qs(urlparse(url).query)
    rt = q.get("redirect_to") or q.get("url")
    if rt:
        return urlparse(unquote(rt[0])).netloc.lower().replace("www.", "")
    return None

class ProductParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.last_heading = ""
        self._in_heading = 0
        self._hbuf = []
        self._a_depth = 0          # >0 while inside an affiliate <a>
        self._href = None
        self._abuf = []            # anchor text
        self._img_alt = None
        self._img_src = None
        self.products = []         # raw hits (pre-dedupe)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("h1", "h2", "h3", "h4"):
            self._in_heading += 1
            self._hbuf = []
        elif tag == "a":
            href = a.get("href", "")
            host = urlparse(href).netloc.lower()
            if host in AFFILIATE_HOSTS:
                self._a_depth = 1
                self._href = href
                self._abuf = []
                self._img_alt = None
                self._img_src = None
            elif self._a_depth:
                self._a_depth += 1   # nested non-affiliate anchor (rare)
        elif tag == "img" and self._a_depth:
            self._img_alt = (a.get("alt") or "").strip() or None
            self._img_src = a.get("src")

    def handle_endtag(self, tag):
        if tag in ("h1", "h2", "h3", "h4") and self._in_heading:
            self._in_heading -= 1
            self.last_heading = re.sub(r"\s+", " ", "".join(self._hbuf)).strip()
        elif tag == "a" and self._a_depth:
            self._a_depth -= 1
            if self._a_depth == 0:
                anchor = re.sub(r"\s+", " ", "".join(self._abuf)).strip()
                self.products.append({
                    "url": self._href,
                    "anchor": anchor,
                    "img_alt": self._img_alt,
                    "image": self._img_src,
                    "heading": self.last_heading,
                })
                self._href = None

    def handle_data(self, d):
        if self._in_heading:
            self._hbuf.append(d)
        if self._a_depth:
            self._abuf.append(d)

def pick_name(hit):
    """Best product name: image alt > meaningful anchor text > nearest heading."""
    for cand in (hit["img_alt"], hit["anchor"], hit["heading"]):
        if cand and not CTA_WORDS.match(cand) and len(cand) > 2:
            return cand
    return hit["anchor"] or hit["heading"] or hit["img_alt"] or ""

results = []
flat_rows = []
total_products = 0
for a in art:
    p = ProductParser()
    p.feed(a["content_html"])
    # dedupe by URL within the article; merge best name + image
    by_url = {}
    for hit in p.products:
        host = urlparse(hit["url"]).netloc.lower()
        rec = by_url.setdefault(hit["url"], {
            "name": "", "url": hit["url"], "network": network(host),
            "merchant": merchant(hit["url"]), "image": None,
        })
        name = pick_name(hit)
        if name and (not rec["name"] or len(name) > len(rec["name"])):
            rec["name"] = name
        if hit["image"] and not rec["image"]:
            rec["image"] = hit["image"]
    products = list(by_url.values())
    total_products += len(products)
    results.append({
        "article_id": a["id"], "slug": a["slug"], "title": a["title"],
        "product_count": len(products), "products": products,
    })
    for pr in products:
        flat_rows.append({
            "article_id": a["id"], "article_slug": a["slug"], "article_title": a["title"],
            "product_name": pr["name"], "affiliate_link": pr["url"],
            "network": pr["network"], "merchant": pr["merchant"] or "", "image": pr["image"] or "",
        })

json.dump(results, open(os.path.join(OUT, "articole_produse.json"), "w"),
          ensure_ascii=False, indent=2)
with open(os.path.join(OUT, "articole_produse_flat.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["article_id", "article_slug", "article_title",
                       "product_name", "affiliate_link", "network", "merchant", "image"])
    w.writeheader()
    w.writerows(flat_rows)

uniq_links = {r["affiliate_link"] for r in flat_rows}
print(f"articole procesate: {len(results)}")
print(f"produse afiliate (dedupe per articol): {total_products}")
print(f"linkuri afiliate UNICE pe tot site-ul: {len(uniq_links)}")
no_name = [r for r in flat_rows if not r["product_name"]]
print(f"produse fara nume detectabil: {len(no_name)}")
print("output: out/articole_produse.json + out/articole_produse_flat.csv")
