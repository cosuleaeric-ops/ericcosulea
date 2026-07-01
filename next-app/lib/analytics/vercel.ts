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
  branch?: string;
  author?: string;
  commitUrl?: string; // link către commit pe GitHub
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
  meta?: {
    githubCommitMessage?: string;
    gitCommitMessage?: string;
    githubCommitRef?: string;
    githubCommitAuthorName?: string;
    githubCommitSha?: string;
    githubCommitOrg?: string;
    githubCommitRepo?: string;
  };
};

export type DeployResult =
  | { ok: true; deploys: Deploy[] }
  | { ok: false; reason: string }; // reason nu conține secrete — sigur de expus

// Întoarce deploy-urile de producție din interval, sau motivul pentru care nu.
export async function fetchDeploys(
  domain: string,
  fromIso: string,
  toIso: string,
): Promise<DeployResult> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return { ok: false, reason: "no-token" };
  const projectId = projectIdFor(domain);
  if (!projectId) return { ok: false, reason: `no-project-for:${domain}` };

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
  if (!res.ok) return { ok: false, reason: `vercel-${res.status}` };

  const json = (await res.json()) as { deployments?: VercelDeployment[] };
  const deploys = (json.deployments ?? [])
    .filter((d) => (d.readyState ?? d.state) === "READY")
    .map((d) => {
      const m = d.meta ?? {};
      const raw = m.githubCommitMessage || m.gitCommitMessage || d.name || "Deployment";
      const commitUrl =
        m.githubCommitOrg && m.githubCommitRepo && m.githubCommitSha
          ? `https://github.com/${m.githubCommitOrg}/${m.githubCommitRepo}/commit/${m.githubCommitSha}`
          : undefined;
      return {
        id: d.uid,
        ts: new Date(d.ready ?? d.created ?? Date.now()).toISOString(),
        message: raw.split("\n")[0].slice(0, 100),
        url: d.url ? `https://${d.url}` : null,
        branch: m.githubCommitRef,
        author: m.githubCommitAuthorName,
        commitUrl,
      };
    });
  return { ok: true, deploys };
}
