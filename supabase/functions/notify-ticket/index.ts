// deno-lint-ignore-file no-explicit-any
Deno.serve(async (req) => {
  const payload = await req.json();
  const ticket = payload.record; // Database Webhook sends { type, record, ... }
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("STAFF_NOTIFY_EMAIL");
  if (!RESEND_API_KEY || !to) return new Response("missing secrets", { status: 500 });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "FixFlow <onboarding@resend.dev>",
      to: [to],
      subject: `New ticket: ${ticket.description?.slice(0, 60) ?? "service request"}`,
      html: `<p>New service request received.</p>
             <p><b>Description:</b> ${ticket.description ?? ""}</p>
             <p><b>Status:</b> ${ticket.status}</p>`,
    }),
  });
  // best-effort: never block ticket creation
  return new Response(JSON.stringify({ emailed: res.ok }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
