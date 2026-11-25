// Confere no Mercado Pago se um pagamento do Essencial Completo foi aprovado.
// Aceita ?payment_id=... (volta do checkout) ou ?email=... (recuperar a compra em outro aparelho).
const MIN = 39.9, ITEM = "essencial-completo-1ano", MAX_DIAS = 366;
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const isOurs = (p) => {
  const items = (p.additional_info && p.additional_info.items) || [];
  return items.some((i) => i.id === ITEM) || /essencial/i.test(String(p.description || ""));
};
const valid = (p) => {
  if (!p || p.status !== "approved" || Number(p.transaction_amount) < MIN - 0.001 || !isOurs(p)) return false;
  const d = Date.parse(p.date_approved || p.date_created || "");
  return !d || Date.now() - d < MAX_DIAS * 864e5;
};

export default async (req) => {
  const tok = process.env.MP_ACCESS_TOKEN;
  if (!tok) return json({ error: "config" }, 500);
  const q = new URL(req.url).searchParams;
  const H = { headers: { Authorization: "Bearer " + tok } };
  try {
    const pid = (q.get("payment_id") || "").replace(/\D/g, "");
    if (pid) {
      const r = await fetch("https://api.mercadopago.com/v1/payments/" + pid, H);
      if (!r.ok) return json({ ok: false, status: "nao_encontrado" });
      const p = await r.json();
      if (valid(p)) return json({ ok: true, pid: p.id, email: (p.payer && p.payer.email) || null });
      return json({ ok: false, status: p.status || "desconhecido" });
    }
    const email = String(q.get("email") || "").trim().toLowerCase();
    if (/^\S+@\S+\.\S+$/.test(email)) {
      for (let off = 0; off < 500; off += 100) {
        const u = "https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=100&offset=" + off + "&payer.email=" + encodeURIComponent(email);
        const r = await fetch(u, H);
        if (!r.ok) break;
        const d = await r.json(), res = d.results || [];
        const hit = res.find((p) => String((p.payer && p.payer.email) || "").toLowerCase() === email && valid(p));
        if (hit) return json({ ok: true, pid: hit.id, email });
        if (res.length < 100) break;
      }
      return json({ ok: false, status: "nao_encontrado" });
    }
    return json({ ok: false, status: "parametro" }, 400);
  } catch (e) {
    return json({ ok: false, status: "rede" }, 502);
  }
};
