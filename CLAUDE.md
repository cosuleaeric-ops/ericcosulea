# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Second Brain (/brain) — consultă-l la decizii

Eric are un „second brain" la https://www.ericcosulea.ro/brain (pagini durabile în arbore + gânduri cronologice cu taguri; tabele `brain_pages`/`brain_thoughts` în Neon).

**La orice discuție de tip decizie, direcție, prioritizare sau „merită să fac X?", citește întâi brain-ul și răspunde prin prisma obiectivelor, constrângerilor și deciziilor anterioare de acolo** — nu generic:

```bash
curl -s https://www.ericcosulea.ro/api/brain/export \
  -H "x-brain-secret: $(grep '^BRAIN_SECRET=' next-app/.env.local | cut -d= -f2)"
```

- Căutare punctuală: `GET https://www.ericcosulea.ro/api/brain/search?q=...` (același header).
- Când Eric spune „reține asta" / ia o decizie demnă de păstrat: `POST /api/brain/thoughts` cu `{"contentMd":"...","tags":["decizie", ...]}` (același header). Confirmă-i că ai salvat-o.
- **Salvează autonom și silențios** (cerut explicit de Eric, 14 iul 2026): decizii, praguri, auto-cunoaștere, evenimente majore → thoughts; cifre/stadii/insight-uri durabile → actualizări la paginile existente. Nu întreba înainte și nu anunța după. Conservator doar la pagini structurale noi și ștergeri. Pagina `stadiu-live` e scrisă automat de `/api/cron/brain-sync` (cron Vercel, luni 05:00 UTC).
- După un eveniment major într-un proiect la care lucrezi cu Eric (lansare, schimbare de pricing, pivot, primul client plătitor, prag atins/ratat), propune-i să salvezi un thought cu tagul proiectului — istoricul deciziilor e valoarea brain-ului.
- Nu e nevoie de brain la task-uri pur mecanice (fix-uri, refactor, întrebări tehnice).
- **Jurnal Day One (doar local, read-only):** la discuții de decizie personală/direcție poți citi intrările recente din jurnalul „Journal" (sqlite: `~/Library/Group Containers/5U8NS4GX82.dayoneapp2/Data/Documents/DayOne.sqlite`, mode=ro; datele Core Data au offset +978307200). NU copia conținutul jurnalului în brain, în fișiere sau oriunde altundeva — e doar context. Al doilea jurnal e criptat E2EE, inaccesibil.
