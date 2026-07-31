// Integrare WIP (wip.co): un task bifat în Elite Deux care conține un #proiect
// devine un todo completat pe WIP. POST /v1/todos creează direct un todo bifat.
//
// Fără WIP_API_KEY integrarea e pur și simplu oprită — asta e și comutatorul ei.
// Cheia stă doar pe server; nu ajunge niciodată în JS-ul din browser.
const WIP_TODOS_URL = "https://api.wip.co/v1/todos";

// Hashtag-uri care încep cu literă. Altfel „vezi issue #42" ar ajunge pe feed.
const PROJECT_TAG = /#[a-z][\w-]*/i;

export function hasProjectTag(text: string): boolean {
  return PROJECT_TAG.test(text);
}

export function wipEnabled(): boolean {
  return Boolean(process.env.WIP_API_KEY);
}

export type WipTodo = { id: string; url: string };

export async function createWipTodo(body: string): Promise<WipTodo> {
  const key = process.env.WIP_API_KEY;
  if (!key) {
    throw new Error("WIP_API_KEY missing");
  }

  const response = await fetch(WIP_TODOS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
    // Bifarea unui task nu are voie să aștepte după WIP dacă e lent.
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`WIP ${response.status}: ${detail.slice(0, 200)}`);
  }

  const todo = await response.json();
  return { id: String(todo?.id ?? ""), url: String(todo?.url ?? "") };
}
