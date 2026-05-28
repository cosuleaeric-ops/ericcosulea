import { getCheltuieliByYear, getPortofelByYear, getVenituriByYear } from "@/lib/db/queries";
import { isAuthenticated } from "@/lib/session";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauth" }, { status: 401 });
  }

  const year = new URL(request.url).searchParams.get("year") ?? String(new Date().getFullYear());
  if (!/^\d{4}$/.test(year)) {
    return Response.json({ error: "invalid year" }, { status: 400 });
  }

  const [venituri, cheltuieli, portofel] = await Promise.all([
    getVenituriByYear(year),
    getCheltuieliByYear(year),
    getPortofelByYear(year),
  ]);

  return Response.json({
    venituri: venituri.map((v) => ({ id: v.id, data: v.data, descriere: v.descriere, suma: v.suma })),
    cheltuieli: cheltuieli.map((c) => ({ id: c.id, data: c.data, categorie: c.categorie, detalii: c.detalii, suma: c.suma })),
    portofel: portofel.map((p) => ({ id: p.id, data: p.data, cash: p.cash, ing: p.ing, revolut: p.revolut, trading212: p.trading212 })),
  });
}
