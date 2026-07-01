// Deploy-uri Vercel pentru marcaje pe grafic. Config 100% din env (fără UI/DB):
//   VERCEL_TOKEN    — token API Vercel (read)
//   VERCEL_TEAM_ID  — opțional, dacă proiectele sunt sub un team
//   VERCEL_PROJECTS — JSON { "<domain>": "<projectId>" }
//                     ex. {"ericcosulea.ro":"prj_abc","cesaicumpar.ro":"prj_def"}

export type Deploy = {
  id: string;
  ts: string; // ISO — momentul în care deploy-ul a devenit live
  message: string; // mesajul commitului asociat
  url: string | null;
};

function projectIdFor(domain: string): string | null {
  try {
    const map = JSON.parse(process.env.VERCEL_PROJECTS || "{}") as Record<string, string>;
    return map[domain] ?? null;
  } catch {
    return null;
  }
}

type VercelDeployment = {
  uid: string;
  name?: string;
  url?: string;
  created?: number;
  ready?: number;
  state?: string;
  readyState?: string;
  meta?: { githubCommitMessage?: string; gitCommitMessage?: string };
};

// Întoarce deploy-urile de producție din interval, sau null dacă nu e configurat.
export async function fetchDeploys(
  domain: string,
  fromIso: string,
  toIso: string,
): Promise<Deploy[] | null> {
  const token = process.env.VERCEL_TOKEN;
  const projectId = projectIdFor(domain);
  if (!token || !projectId) return null;

  const params = new URLSearchParams({
    projectId,
    target: "production",
    limit: "100",
    since: String(new Date(fromIso).getTime()),
    until: String(new Date(toIso).getTime()),
  });
  if (process.env.VERCEL_TEAM_ID) params.set("teamId", process.env.VERCEL_TEAM_ID);

  const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json()) as { deployments?: VercelDeployment[] };
  return (json.deployments ?? [])
    .filter((d) => (d.readyState ?? d.state) === "READY")
    .map((d) => {
      const raw =
        d.meta?.githubCommitMessage || d.meta?.gitCommitMessage || d.name || "Deployment";
      return {
        id: d.uid,
        ts: new Date(d.ready ?? d.created ?? Date.now()).toISOString(),
        message: raw.split("\n")[0].slice(0, 100),
        url: d.url ? `https://${d.url}` : null,
      };
    });
}
