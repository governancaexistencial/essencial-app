// Confere no Mercado Pago se um pagamento do Essencial Completo foi aprovado.
// Aceita ?payment_id=... (volta do checkout) ou ?email=... (recuperar a compra em outro aparelho).
const MIN = 39.9, ITEM = "essencial-completo-1ano";
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const isOurs = (p) => {
  const items = (p.additional_info && p.additional_info.items) || [];
  return items.some((i) => i.id === ITEM) || /essencial/i.test(String(p.description || ""));
};
const ours = (p) => !!p && p.status === "approved" && Number(p.transaction_amount) >= MIN - 0.001 && isOurs(p);
const dateOf = (p) => Date.parse(p.date_approved || p.date_created || "") || Date.now();
// Cada compra vale 12 meses; uma nova compra soma 12 meses ao fim do período atual (o cliente não perde dias).
const chain = (list) => {
  let exp = 0;
  for (const p of [...list].sort((a, b) => dateOf(a) - dateOf(b))) exp = Math.max(exp, dateOf(p)) + 365 * 864e5;
  return exp;
};
const iso = (t) => new Date(t).toISOString().slice(0, 10);
async function byEmail(email, H) {
  const out = [];
  for (let off = 0; off < 500; off += 100) {
    const u = "https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=100&offset=" + off + "&payer.email=" + encodeURIComponent(email);
    const r = await fetch(u, H);
    if (!r.ok) break;
    const d = await r.json(), res = d.results || [];
    for (const p of res) if (String((p.payer && p.payer.email) || "").toLowerCase() === email && ours(p)) out.push(p);
    if (res.length < 100) break;
  }
  return out;
}

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
      if (!ours(p)) return json({ ok: false, status: p.status || "desconhecido" });
      const email = String((p.payer && p.payer.email) || "").toLowerCase() || null;
      let list = [p];
      if (email) { try { const all = await byEmail(email, H); if (all.length) list = all.some((x) => String(x.id) === String(p.id)) ? all : [...all, p]; } catch (e) {} }
      const exp = chain(list);
      if (exp <= Date.now()) return json({ ok: false, status: "expirado", ate: iso(exp) });
      return json({ ok: true, pid: p.id, email, ate: iso(exp) });
    }
    const email = String(q.get("email") || "").trim().toLowerCase();
    if (/^\S+@\S+\.\S+$/.test(email)) {
      const list = await byEmail(email, H);
      if (!list.length) return json({ ok: false, status: "nao_encontrado" });
      const exp = chain(list);
      if (exp <= Date.now()) return json({ ok: false, status: "expirado", ate: iso(exp) });
      const last = [...list].sort((a, b) => dateOf(b) - dateOf(a))[0];
      return json({ ok: true, pid: last.id, email, ate: iso(exp) });
    }
    return json({ ok: false, status: "parametro" }, 400);
  } catch (e) {
    return json({ ok: false, status: "rede" }, 502);
  }
};
