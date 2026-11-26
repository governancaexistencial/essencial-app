// Lê os totais anônimos por dia (?dias=30). Só números agregados.
import { getStore } from "@netlify/blobs";
export default async (req) => {
  const n = Math.min(120, Math.max(1, parseInt(new URL(req.url).searchParams.get("dias") || "30", 10) || 30));
  const s = getStore({ name: "metricas", consistency: "strong" });
  const out = {}, tot = {};
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() - 3 * 36e5 - i * 864e5).toISOString().slice(0, 10);
    const v = await s.get(d, { type: "json" });
    if (v) { out[d] = v; for (const [k, x] of Object.entries(v)) tot[k] = (tot[k] || 0) + x; }
  }
  return new Response(JSON.stringify({ dias: n, total: tot, por_dia: out }, null, 1), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
};
