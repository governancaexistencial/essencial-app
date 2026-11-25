// Cria o pagamento no Mercado Pago (Checkout Pro). Preço e produto ficam fixos aqui, no servidor.
const PRICE = 39.9, ITEM = "essencial-completo-1ano", TITLE = "Essencial Completo · 1º ano";
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default async (req) => {
  const tok = process.env.MP_ACCESS_TOKEN;
  if (!tok) return json({ error: "config" }, 500);
  const origin = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  const ref = "ess-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const body = {
    items: [{ id: ITEM, title: TITLE, quantity: 1, unit_price: PRICE, currency_id: "BRL" }],
    back_urls: { success: origin + "/?mp=ok", pending: origin + "/?mp=pendente", failure: origin + "/?mp=falhou" },
    auto_return: "approved",
    external_reference: ref,
    statement_descriptor: "ESSENCIAL",
    payment_methods: { installments: 1 }
  };
  try {
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json", "X-Idempotency-Key": ref },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    if (!r.ok || !d.init_point) return json({ error: "mp", detail: d && d.message }, 502);
    return json({ url: d.init_point, ref });
  } catch (e) {
    return json({ error: "rede" }, 502);
  }
};
