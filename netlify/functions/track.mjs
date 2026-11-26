// Contador anônimo do Essencial: só números por dia e por evento.
// Não guarda IP, nome, e-mail, aparelho nem nada da fatura.
import { getStore } from "@netlify/blobs";
const OK = new Set(["open", "demo", "doc", "manual", "plano", "clique_compra", "compra", "convite", "site", "site_app"]);
const H = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
export default async (req) => {
  const u = new URL(req.url);
  const e = u.searchParams.get("e") || "";
  const v = u.searchParams.get("v") === "fam" ? "_fam" : "";
  if (!OK.has(e)) return new Response(null, { status: 204, headers: H });
  try {
    const dia = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10); // horário de Brasília
    const s = getStore({ name: "metricas", consistency: "strong" });
    const cur = (await s.get(dia, { type: "json" })) || {};
    const k = e + v;
    cur[k] = (cur[k] || 0) + 1;
    await s.setJSON(dia, cur);
  } catch (x) {}
  return new Response(null, { status: 204, headers: H });
};
