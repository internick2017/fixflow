# Wiring the `notify-ticket` webhook

The `notify-ticket` Edge Function emails staff whenever a new ticket is created. It is
triggered by a **Database Webhook** on `INSERT` into `public.tickets`.

## Hosted Supabase (production)

1. Deploy the function:
   ```bash
   npx supabase functions deploy notify-ticket
   npx supabase secrets set RESEND_API_KEY=... STAFF_NOTIFY_EMAIL=you@example.com
   ```
2. In the Supabase dashboard: **Database → Webhooks → Create a new hook**.
   - Table: `public.tickets`
   - Events: `INSERT`
   - Type: **Supabase Edge Functions**
   - Edge Function: `notify-ticket`
   - HTTP method: `POST`
3. Save. Each new ticket now POSTs `{ type, table, record, ... }` to the function, which
   forwards a summary email through Resend.

## Local dev

Database Webhooks are a hosted feature, so locally you trigger the function by hand:

```bash
npx supabase functions serve notify-ticket --no-verify-jwt
# in another shell:
curl -i -X POST http://localhost:54321/functions/v1/notify-ticket \
  -H "Content-Type: application/json" \
  -d '{ "record": { "description": "test", "status": "received" } }'
```

Expect `{ "emailed": true }` when `RESEND_API_KEY` + `STAFF_NOTIFY_EMAIL` are set as
function secrets, or `{ "emailed": false }` / `500 missing secrets` otherwise. The
function is best-effort by design and never blocks ticket creation.
