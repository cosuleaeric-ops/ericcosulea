# Export cesaicumpar.ro → Vercel + Supabase

Extracție completă a conținutului de pe https://cesaicumpar.ro prin WordPress REST API
(`/wp-json/wp/v2/...`). Niciun conținut nu a fost citit „vizual" — totul vine ca JSON
structurat, fidel sursei.

## Ce conține `out/`

| Fișier | Conținut |
|---|---|
| `articole.json` | **99 articole** — titlu, slug, date, categorii, tag-uri, imagine featured, `content_html` (HTML complet), `content_text` (text simplu) |
| `cadouri.json` | **294 idei de cadou** (CPT separat) — titlu, slug, **`affiliate_link`** (2Performant / Profitshare), imagine, taxonomii (`ocazie`, `pentru_cine`, `pret`, `tip`) |
| `articole_produse.json` | **Produse afiliate din CORPUL articolelor** — 3071 produse (995 linkuri unice), grupate pe articol, fiecare cu nume + `affiliate_link` + network + merchant + imagine. Acoperă atât cardurile media-text cât și linkurile puse direct în text. |
| `articole_produse_flat.csv` | Aceleași date, aplatizate (1 rând = 1 produs), pentru import rapid în Supabase |
| `pagini.json` | 5 pagini statice |
| `taxonomii.json` | Toți termenii rezolvați (categorii, tag-uri, ocazie, pentru-cine, preț, tip) |
| `manifest.json` | Numărători + lista URL-urilor de imagini referite |

## Verificare calitate (QA)

- Articole: **0** cu conținut gol, **0** fără imagine. Medie ~125k caractere/articol.
- Cadouri (CPT): **0** fără link. **294/294 au link afiliat real** (210 Profitshare + 84 2Performant). 0 linkuri interne.
- Produse în articole: **3071** linkuri afiliate extrase, **0** fără nume detectabil. 61 sunt linkuri inline în text (fără card) — la acestea numele e textul ancorei (uneori generic, ex. „apasă aici"), restul au nume curat din `alt`/heading. Toate sunt mapate la articolul lor.
- Imagini: 99/99 articole + **221/294** cadouri. Restul de **72 imagini** sunt blocate
  de o permisiune REST (HTTP 401 pe `/wp/v2/media/<id>`) — vezi mai jos cum le recuperezi.

### Cum recuperezi cele 72 de imagini lipsă

Deții site-ul, deci cel mai curat e o **Application Password** (WP-Admin → Utilizatori →
profilul tău → „Application Passwords"). Cu ea, endpoint-ul `/wp/v2/media` returnează și
atașamentele private. Dă-mi parola (o folosesc doar local) sau rulează:

```bash
# completează USER și APP_PASS, apoi:
python3 extract_images_auth.py   # (ți-l generez când ai parola)
```

Alternativ: WP-Admin → Unelte → Export (WXR) îți dă toate atașamentele autoritar.

## Import în Supabase

1. Rulează `schema.sql` în Supabase (SQL Editor) — creează tabelele `articole` și `cadouri`.
2. Importă JSON-ul cu un script (`@supabase/supabase-js`) sau prin dashboard.
   Taxonomiile sunt `text[]`, deci se interoghează cu `&&` / `@>`.

## Cum a fost generat

`python3 extract.py` — paginează tot REST API-ul, rezolvă taxonomiile și imaginile,
scrie totul în `out/`. Idempotent: îl poți rerula oricând pentru un export proaspăt.
