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
const esc = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

  // NOTIFY_EMAIL may be a comma-separated list; Resend accepts an array of recipients.
  const notify = (env.NOTIFY_EMAIL || "hello@starkwayne.co.uk").split(",").map((s) => s.trim()).filter(Boolean);
  const from = env.SENDER_EMAIL || "Stark Wayne <onboarding@resend.dev>";
  // Point image URLs at whatever domain served the form, so nothing hardcodes a domain that can rot.
  const origin = new URL(request.url).origin;

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
  const whenPhrase = when === "Within the hour" ? "within the hour" : "at " + when;

  const ackText =
`Hi ${first},

Thanks — we've got your request. Simon will call you ${whenPhrase}, on ${phone}. If anything comes up and he can't make that, he'll be in touch to rearrange. Wrong number, or need to change something? Just reply — this inbox is watched.

Thanks again — speak soon,
Stark Wayne
hello@starkwayne.co.uk · 01785 50 80 60`;

  const ackHtml = ackEmailHtml({ first: esc(first), whenPhrase: esc(whenPhrase), phone: esc(phone), origin });

  // The team notification is critical — if this fails, the booking failed.
  try {
    await send(env, { from, to: notify, reply_to: email, subject: `Call request — ${name} (${when})`, text: teamBody });
  } catch {
    return json({ ok: false, error: "send-failed" }, 502);
  }

  // The customer acknowledgement is best-effort. Don't fail the booking if it can't
  // send (e.g. Resend domain not yet verified for arbitrary recipients).
  try {
    await send(env, { from, to: email, subject: "We've got your request — Stark Wayne", text: ackText, html: ackHtml });
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

/**
 * Branded HTML for the customer acknowledgement. Brand system: ../brand/guidelines.md —
 * Paper/White surfaces, Ink header band, Mist hairlines, Brass used sparingly, Cormorant
 * (Georgia fallback) headline / Inter (system-sans fallback) body. Table layout + inline
 * styles for email-client support; images derive from `origin` so no domain is hardcoded.
 */
function ackEmailHtml({ first, whenPhrase, phone, origin }) {
  const PAPER = "#FAFAF7", WHITE = "#FFFFFF", INK = "#1A1A1D", ONYX = "#0B0B0C";
  const GRAPHITE = "#6B6B70", MIST = "#E4E3DE", BRASS = "#9C7C4E", BRASS_TINT = "#F5EFE6";
  const serif = "'Cormorant', Georgia, 'Times New Roman', serif";
  const sans = "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif";
  const logo = origin + "/assets/sw-logo-combined-inverted.png";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<title>We've got your request</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant:wght@600&family=Inter:wght@400;600&display=swap');
  body { margin: 0; padding: 0; background: ${PAPER}; }
  a { color: ${BRASS}; }
</style>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Simon will call you ${whenPhrase} — request received.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${WHITE};border:1px solid ${MIST};border-collapse:separate;">
          <!-- Header band -->
          <tr>
            <td align="center" style="background:${INK};padding:32px 40px;">
              <img src="${logo}" width="190" alt="Stark Wayne" style="display:block;width:190px;max-width:60%;height:auto;border:0;">
            </td>
          </tr>
          <tr><td style="background:${BRASS};font-size:0;line-height:0;height:3px;">&nbsp;</td></tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 0;">
              <p style="margin:0 0 14px;font-family:${sans};font-size:12px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${BRASS};">Request received</p>
              <h1 style="margin:0 0 20px;font-family:${serif};font-weight:600;font-size:34px;line-height:1.1;color:${ONYX};">Thanks, ${first}.</h1>
              <p style="margin:0;font-family:${sans};font-size:16px;line-height:1.6;color:${ONYX};">We've got your request — it's with Simon now.</p>
            </td>
          </tr>

          <!-- Callback note (Brass left-rule + faint tint) -->
          <tr>
            <td style="padding:28px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td width="3" style="background:${BRASS};font-size:0;line-height:0;">&nbsp;</td>
                  <td style="background:${BRASS_TINT};padding:18px 22px;">
                    <p style="margin:0 0 6px;font-family:${sans};font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${BRASS};">Your call</p>
                    <p style="margin:0;font-family:${sans};font-size:17px;font-weight:600;line-height:1.4;color:${ONYX};">Simon will call you ${whenPhrase}, on ${phone}.</p>
                    <p style="margin:6px 0 0;font-family:${sans};font-size:14px;line-height:1.5;color:${GRAPHITE};">A real person, on an actual phone.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Reassurance + sign-off -->
          <tr>
            <td style="padding:28px 40px 40px;">
              <p style="margin:0 0 24px;font-family:${sans};font-size:16px;line-height:1.6;color:${ONYX};">If anything comes up and he can't make that, he'll be in touch to rearrange. Wrong number, or need to change something? Just reply — this inbox is watched.</p>
              <p style="margin:0;font-family:${sans};font-size:16px;line-height:1.6;color:${ONYX};">Thanks again — speak soon,<br><span style="font-family:${serif};font-size:20px;color:${ONYX};">Stark Wayne</span></p>
            </td>
          </tr>

          <!-- Footer -->
          <tr><td style="border-top:1px solid ${MIST};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:24px 40px 32px;">
              <p style="margin:0 0 10px;font-family:${sans};font-size:14px;line-height:1.5;color:${GRAPHITE};">
                <a href="mailto:hello@starkwayne.co.uk" style="color:${BRASS};text-decoration:none;">hello@starkwayne.co.uk</a>
                &nbsp;·&nbsp; 01785 50 80 60
              </p>
              <p style="margin:0;font-family:${sans};font-size:11px;line-height:1.6;color:${GRAPHITE};">Stark Wayne Ltd · Registered in England and Wales, company no. 09495737 · Woodland Lodge, Dunston Business Village, Stafford Road, Penkridge, Staffordshire, ST18 9AB</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
