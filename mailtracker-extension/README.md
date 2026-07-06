# MailTracker (personal)

Extensie Chrome self-contained care adaugă **open + click tracking** la emailurile trimise din Gmail, cu backend self-hosted pe `www.ericcosulea.ro`. Înlocuiește MailSuite. Funcționează pe oricâte conturi Gmail ești logat (compose nou și reply).

## Cum funcționează

La trimitere, content script-ul (rulează doar pe `mail.google.com`):

1. **Rescrie linkurile** din corpul emailului către `www.ericcosulea.ro/t/c/{id}?l=N` → la click se loghează și se redirecționează la destinația reală.
2. **Injectează un pixel** `www.ericcosulea.ro/t/o/{id}.gif` → la deschidere se loghează open-ul.
3. **Înregistrează** emailul (id, destinatar, subiect, cont, linkuri) la `POST /api/track/register`.

Direct în Gmail (interoghează `GET /api/track/status` la 20s):

- **Bife duble în listă** lângă subiect: gri = trimis/necitit, verde = citit. Hover → nr. deschideri + ultima.
- **Badge „Tracking"** în fereastra de compose; click pe el oprește tracking-ul doar pe emailul curent.
- **Toast „Email citit"** în colțul din dreapta-jos când cineva deschide un email trimis.

Rezultatele complete (timeline, click-uri per link) se văd în dashboard-ul protejat: **www.ericcosulea.ro/admin/mail**.

Nu blochează niciodată trimiterea — dacă backend-ul e picat sau ceva eșuează, mailul pleacă normal, doar fără tracking.

## Instalare

1. `chrome://extensions` → activează **Developer mode** (colț dreapta-sus).
2. **Load unpacked** → selectează folderul `mailtracker-extension/`.
3. Click dreapta pe iconița extensiei → **Opțiuni** (sau `chrome://extensions` → Details → Extension options):
   - **URL backend**: `www.ericcosulea.ro`
   - **TRACK_SECRET**: exact valoarea din `.env.local` / Vercel (vezi mai jos).
4. Reîncarcă tab-urile Gmail deschise.

## Server (o singură dată)

Variabila `TRACK_SECRET` trebuie să existe pe server (același string ca în extensie):

```bash
# local: deja în next-app/.env.local
# Vercel:
vercel env add TRACK_SECRET production   # lipește același secret
```

Tabelele (`tracked_emails`, `email_events`) sunt deja create în Neon prin `npm run db:push`.

## Limitări (le are și MailSuite)

- **Apple Mail Privacy Protection** deschide pixelii automat → open-uri false de la useri Apple. Sunt marcate „prefetch/scanner" și excluse din total; click-urile rămân semnalul de încredere.
- **Scannere corporate** (Outlook SafeLinks etc.) ating linkurile înaintea omului → click-uri false, la fel marcate și excluse.
- **Interceptarea butonului Send** e pe DOM-ul Gmail (alegere „vanilla"). Dacă Google schimbă interfața și un email pleacă fără tracking, semnalează — se repară în content.js (detectorul `isSendButton`).

## Fișiere

- `manifest.json` — MV3, permisiuni minime (storage + host pentru mail.google.com și www.ericcosulea.ro).
- `content.js` — toată logica de injectare la trimitere.
- `options.html` / `options.js` — configurare URL + secret (în `chrome.storage.sync`).
