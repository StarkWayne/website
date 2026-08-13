/**
 * Stark Wayne — booking backend.
 * Serves the static site (via the ASSETS binding) and handles POST /api/book:
 * emails the team (NOTIFY_EMAIL) and sends the customer an acknowledgement, via Resend.
 *
 * Config: NOTIFY_EMAIL, SENDER_EMAIL (vars) · RESEND_API_KEY (secret).
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/book") {
      return handleBooking(request, env);
    }
    // Everything else is the static site (pages, assets, 404).
    return env.ASSETS.fetch(request);
  },
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

const str = (v) => (typeof v === "string" ? v.trim() : "");
const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

async function handleBooking(request, env) {
  let d;
  try {
    d = await request.json();
  } catch {
    return json({ ok: false, error: "bad-request" }, 400);
  }

  // Honeypot — bots fill this hidden field. Pretend success, do nothing.
  if (d.company_hp) return json({ ok: true });

  const name = str(d.name);
  const phone = str(d.phone);
  const email = str(d.email);
  if (!name || !phone || !isEmail(email)) {
    return json({ ok: false, error: "Please add your name, phone and a valid email." }, 422);
  }

  const website = str(d.website);
  const role = str(d.role);
  const need = str(d.need);
  const when = str(d.when) || "Not specified";

  const notify = env.NOTIFY_EMAIL || "hello@starkwayne.co.uk";
  const from = env.SENDER_EMAIL || "Stark Wayne <onboarding@resend.dev>";

  if (!env.RESEND_API_KEY) return json({ ok: false, error: "not-configured" }, 503);

  const teamBody =
`New call request — ${name}

Phone:    ${phone}
Email:    ${email}
Website:  ${website || "—"}
Role:     ${role || "—"}
When:     ${when}

What they need:
${need || "—"}`;

  const first = name.split(" ")[0] || name;
  const ackBody =
`Hi ${first},

Thanks — we've got your request. Simon will call you ${when === "Within the hour" ? "within the hour" : "at " + when}, and he'll have looked at your website first, so you can skip the background.

Speak soon,
Stark Wayne
hello@starkwayne.co.uk · 01785 50 80 60`;

  // The team notification is critical — if this fails, the booking failed.
  try {
    await send(env, { from, to: notify, reply_to: email, subject: `Call request — ${name} (${when})`, text: teamBody });
  } catch {
    return json({ ok: false, error: "send-failed" }, 502);
  }

  // The customer acknowledgement is best-effort. Don't fail the booking if it can't
  // send (e.g. Resend domain not yet verified for arbitrary recipients).
  try {
    await send(env, { from, to: email, subject: "We've got your request — Stark Wayne", text: ackBody });
  } catch {
    /* Simon already has the request; swallow. */
  }
  return json({ ok: true });
}

async function send(env, payload) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("resend " + res.status);
  return res;
}
