# FixFlow — QR service-request intake

FixFlow is a small, real app that shows how to build a **secure multi-tenant workflow on
Supabase**. A customer scans a QR code at a location, describes a problem (optionally with
a photo), and a ticket is created. Staff triage those tickets behind authentication, and
**Row Level Security (RLS) enforces who can see and change what** — anonymous users can
only create, técnicos see only their assigned tickets, admins see everything.

It was built to demonstrate, end to end: **Supabase Auth, 3-tier RLS, Storage, and an Edge
Function**, with the security rules covered by an integration test suite.

## Live demo

- **App:** _(add your Vercel URL here)_
- **Read-only demo admin:** `admin@fixflow.test` / `Password123!`
- **Try intake without logging in:** open `/intake/11111111-1111-1111-1111-111111111111`
  and submit a request.

## The loop (architecture)

```
Customer                      Supabase                         Staff
────────                      ────────                         ─────
scan QR ─▶ /intake/[loc] ──▶  tickets INSERT (anon, RLS)
                              │
                              ├─▶ Database Webhook ─▶ Edge Function ─▶ Resend ─▶ email
                              │
login ◀───────────────────── Auth ──────────────────────────▶ /dashboard (RLS-filtered)
                              tickets SELECT/UPDATE (RLS by role)
```

The Next.js frontend talks to Supabase directly with the anon key. There is no custom
backend — **RLS is the security layer**. The anon key is safe to ship precisely because
every table denies by default and only the policies below open specific doors.

## Security: how RLS enforces 3 tiers

Every table has RLS enabled and denies by default. The interesting policies live on
`public.tickets`:

| Actor        | INSERT | SELECT                     | UPDATE                        | DELETE |
| ------------ | :----: | -------------------------- | ----------------------------- | :----: |
| Anonymous    |   ✅   | ❌ (can create, not read)  | ❌                            |   ❌   |
| Técnico      |   ✅   | only `assigned_to = me`    | only rows assigned to them    |   ❌   |
| Admin        |   ✅   | all rows                   | all rows + reassign           |   ✅   |

Admin checks go through a `security definer` helper, `public.is_admin()`, which reads the
caller's role from `profiles` without tripping over that table's own RLS. The full policy
set is in [`supabase/migrations/0002_rls.sql`](supabase/migrations/0002_rls.sql).

These rules are not just asserted — they are **tested** in
[`tests/rls.test.ts`](tests/rls.test.ts): an anonymous client inserts a ticket then gets an
empty read; a técnico sees only their own tickets and cannot update someone else's; an
admin's row count matches the service-role count.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Auth,
Postgres + RLS, Storage, Edge Functions/Deno) · Resend · Vitest · Supabase CLI + Docker.

## Local setup

Prereqs: Node 20+, Docker running, and pnpm (via `corepack enable pnpm`).

```bash
pnpm install

# 1. start the local Supabase stack (Postgres, Auth, Storage, Studio)
npx supabase start

# 2. copy the printed API URL + keys into your env
cp .env.local.example .env.local
#   set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#       SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL

# 3. apply migrations (schema, RLS, storage)
npx supabase migration up

# 4. seed data — ORDER MATTERS:
#    auth users can't be created via SQL, so run the user script,
#    then the SQL seed (locations + tickets keyed off those users)
node scripts/seed-users.mjs
npx supabase db reset          # re-applies migrations + seed.sql (wipes auth users)
node scripts/seed-users.mjs    # re-create users AFTER reset

# 5. run the app
pnpm dev                       # http://localhost:3000
```

> Seed order note: `supabase db reset` wipes `auth.users`, so always run
> `scripts/seed-users.mjs` **after** a reset.

Seeded logins (all `Password123!`): `admin@fixflow.test`, `tech1@fixflow.test`,
`tech2@fixflow.test`.

## Testing

The RLS suite is the point of the project:

```bash
pnpm exec vitest run           # or: ./node_modules/.bin/vitest run
```

- `tests/rls.test.ts` — the 3-tier RLS guarantees (anonymous / técnico / admin).
- `tests/intake.smoke.test.ts` — anonymous intake happy path (insert allowed, read denied).

Tests talk to the local Supabase stack over HTTP, so `supabase start` + seed must have run
first.

## Deployment

- **Backend:** `npx supabase link --project-ref <ref>` → `npx supabase db push` →
  `npx supabase functions deploy notify-ticket`.
- **Email:** set `RESEND_API_KEY` + `STAFF_NOTIFY_EMAIL` as function secrets and wire the
  Database Webhook — see [`docs/webhook-setup.md`](docs/webhook-setup.md).
- **Frontend:** deploy to Vercel, setting `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL`.

## Screenshots

_(add screenshots of: intake form, staff dashboard, ticket detail, admin QR page)_
