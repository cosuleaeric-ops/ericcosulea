// Verifică WIP_API_KEY din .env.local fără să publice nimic: cere doar
// GET /v1/users/me (read-only) și arată contul cu care ar posta Elite Deux.
//
//   node scripts/check-wip.mjs
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const key = (() => {
  try {
    const txt = readFileSync(resolve(here, "../.env.local"), "utf8");
    const m = txt.match(/^WIP_API_KEY=(.*)$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
})();

if (!key) {
  console.error("WIP_API_KEY lipsește din next-app/.env.local — integrarea e oprită.");
  process.exit(1);
}

const res = await fetch("https://api.wip.co/v1/users/me", {
  headers: { Authorization: `Bearer ${key}` },
});

if (!res.ok) {
  console.error(`Cheia nu merge: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  process.exit(1);
}

const me = await res.json();
console.log(`Cheia e validă. Cont WIP: ${me.username ?? me.id}`);
console.log("Nu s-a publicat nimic (doar citire).");
