# FixFlow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a QR-based service-request intake app that demonstrates Supabase Auth, 3-tier RLS, Storage, and an Edge Function.

**Architecture:** Next.js (App Router) frontend talks to Supabase directly using the anon key; RLS is the security layer (Enfoque 1). Anonymous customers create tickets via a public QR form; staff (admin/técnico) manage them behind auth. A Database Webhook fires an Edge Function that emails staff on each new ticket.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Auth, Postgres+RLS, Storage, Edge Functions/Deno) · Resend · Vitest (RLS + smoke tests) · Supabase CLI + Docker (local dev).

## Global Constraints

- Node 20+; package manager: npm.
- Supabase local dev via Supabase CLI + Docker (`supabase start`). All schema changes are SQL migrations in `supabase/migrations/`.
- RLS enabled on every table; deny-by-default. No table is reachable without an explicit policy.
- Secrets: `RESEND_API_KEY` lives ONLY as a Supabase Edge Function secret, never in frontend code or committed files. Frontend only uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Ticket status enum values (verbatim): `received`, `in_progress`, `resolved`. Role enum values: `admin`, `tecnico`.
- Photo is OPTIONAL on intake; description is required.
- Frontend prose/UI copy in English (portfolio-facing). Spec/plan docs in Spanish.

## File Structure

```
fixflow/
├── src/
│   ├── app/
│   │   ├── page.tsx                     # landing
│   │   ├── login/page.tsx               # staff login
│   │   ├── intake/[locationId]/page.tsx # public intake form (QR target)
│   │   ├── dashboard/page.tsx           # staff ticket list (RLS-filtered)
│   │   ├── tickets/[id]/page.tsx        # ticket detail (status/assign)
│   │   └── admin/locations/page.tsx     # admin: locations + QR
│   ├── components/                      # shadcn/ui + feature components
│   ├── lib/supabase/
│   │   ├── client.ts                    # browser client
│   │   ├── server.ts                    # server client (SSR)
│   │   └── middleware.ts                # session refresh helper
│   ├── lib/types.ts                     # DB row types
│   └── middleware.ts                    # route protection
├── supabase/
│   ├── migrations/                      # SQL migrations (schema, RLS)
│   ├── functions/notify-ticket/index.ts # Edge Function (Resend email)
│   └── seed.sql                         # seed data
├── tests/
│   ├── rls.test.ts                      # RLS 3-tier integration tests (the star)
│   └── intake.smoke.test.ts             # intake happy-path smoke test
├── .env.local.example
└── README.md
```

---

### Task 0: Project scaffold + Supabase local + Vitest

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind` config, `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `supabase/config.toml` (via CLI), `.env.local.example`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: a running Next.js app on `localhost:3000`; a local Supabase stack on `localhost:54321`; `npm test` runs Vitest.

- [ ] **Step 1: Scaffold Next.js app**

Run:
```bash
cd /e/dev/01-web-apps/nextjs-supabase--fixflow
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
Expected: files created in the existing repo (accept overwrite of the empty dir; keep the existing `.gitignore` and `docs/`).

- [ ] **Step 2: Add dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr qrcode
npm install -D vitest @vitejs/plugin-react dotenv @types/qrcode
npx shadcn@latest init -d
npx shadcn@latest add button input textarea card badge table select label sonner
```
Expected: deps installed, `components.json` created, shadcn components under `src/components/ui/`.

- [ ] **Step 3: Init Supabase local**

Run:
```bash
npx supabase init
npx supabase start
```
Expected: prints `API URL: http://localhost:54321`, `anon key`, `service_role key`. Save these for the next step.

- [ ] **Step 4: Create env example + local env**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
# server-only (tests): never expose to the browser
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
```
Then `cp .env.local.example .env.local` and fill with the values from Step 3.

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: [],
    testTimeout: 20000,
  },
});
```

- [ ] **Step 6: Verify app + Supabase run**

Run: `npm run dev` (in one shell) and confirm `http://localhost:3000` loads. Run: `npx supabase status` and confirm the stack is up.
Expected: both up.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Tailwind + shadcn + Supabase local + Vitest"
```

---

### Task 1: Database schema migration (enums + 3 tables)

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

**Interfaces:**
- Produces: tables `public.profiles`, `public.locations`, `public.tickets`; enums `user_role`, `ticket_status`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_schema.sql`:
```sql
-- enums
create type public.user_role as enum ('admin', 'tecnico');
create type public.ticket_status as enum ('received', 'in_progress', 'resolved');

-- profiles: one row per staff user, linked to auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'tecnico',
  created_at timestamptz not null default now()
);

-- locations: each site has its own QR
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- tickets: service requests
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete restrict,
  description text not null,
  photo_path text,
  customer_contact text,
  status public.ticket_status not null default 'received',
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tickets_assigned_to_idx on public.tickets (assigned_to);
create index tickets_location_id_idx on public.tickets (location_id);
create index tickets_status_idx on public.tickets (status);
```

- [ ] **Step 2: Apply and verify**

Run:
```bash
npx supabase migration up
npx supabase db diff --schema public
```
Expected: migration applies with no errors; `db diff` reports no unexpected drift.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_schema.sql
git commit -m "feat(db): add profiles, locations, tickets schema"
```

---

### Task 2: RLS policies + a helper, with 3-tier RLS tests (the star)

**Files:**
- Create: `supabase/migrations/0002_rls.sql`
- Create: `tests/rls.test.ts`
- Create: `tests/helpers.ts`

**Interfaces:**
- Consumes: tables from Task 1.
- Produces: RLS enabled + policies on all tables; SQL helper `public.is_admin()`; passing RLS test suite.

- [ ] **Step 1: Write the RLS migration**

Create `supabase/migrations/0002_rls.sql`:
```sql
-- helper: is the current user an admin? (security definer bypasses RLS to read profiles)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.tickets   enable row level security;

-- profiles: authenticated staff can read; users update their own row
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- locations: anyone can read (intake shows the location name); only admin writes
create policy "locations_select_all" on public.locations
  for select to anon, authenticated using (true);
create policy "locations_admin_write" on public.locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- tickets: anonymous intake can INSERT
create policy "tickets_insert_anyone" on public.tickets
  for insert to anon, authenticated with check (true);

-- tickets SELECT: admin sees all, tecnico sees only assigned
create policy "tickets_select_admin" on public.tickets
  for select to authenticated using (public.is_admin());
create policy "tickets_select_assigned" on public.tickets
  for select to authenticated using (assigned_to = auth.uid());

-- tickets UPDATE: admin updates anything; tecnico updates only own rows
create policy "tickets_update_admin" on public.tickets
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "tickets_update_assigned" on public.tickets
  for update to authenticated using (assigned_to = auth.uid()) with check (assigned_to = auth.uid());

-- tickets DELETE: admin only
create policy "tickets_delete_admin" on public.tickets
  for delete to authenticated using (public.is_admin());
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase migration up`
Expected: applies clean.

- [ ] **Step 3: Write test helpers**

Create `tests/helpers.ts`:
```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const anonClient = () => createClient(url, anon);
export const serviceClient = () => createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// sign in as an existing seeded user and return an authed client
export async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}
```

- [ ] **Step 4: Write the failing RLS tests**

Create `tests/rls.test.ts` (assumes seed from Task 3; run seed before tests):
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { anonClient, signedInClient, serviceClient } from "./helpers";

const ADMIN = { email: "admin@fixflow.test", password: "Password123!" };
const TECH1 = { email: "tech1@fixflow.test", password: "Password123!" };
const TECH2 = { email: "tech2@fixflow.test", password: "Password123!" };

describe("RLS: anonymous", () => {
  it("can insert a ticket but cannot read tickets", async () => {
    const svc = serviceClient();
    const { data: loc } = await svc.from("locations").select("id").limit(1).single();
    const anon = anonClient();
    const { error: insErr } = await anon.from("tickets").insert({
      location_id: loc!.id, description: "anon test ticket",
    });
    expect(insErr).toBeNull();
    const { data: rows } = await anon.from("tickets").select("*");
    expect(rows).toEqual([]); // RLS hides all rows from anon
  });
});

describe("RLS: tecnico", () => {
  it("sees only tickets assigned to them", async () => {
    const tech1 = await signedInClient(TECH1.email, TECH1.password);
    const { data } = await tech1.from("tickets").select("assigned_to");
    const { data: { user } } = await tech1.auth.getUser();
    expect(data!.every((t) => t.assigned_to === user!.id)).toBe(true);
    expect(data!.length).toBeGreaterThan(0); // seed assigns at least one to tech1
  });

  it("cannot update a ticket assigned to someone else", async () => {
    const svc = serviceClient();
    const { data: tech2Profile } = await svc.from("profiles")
      .select("id").eq("full_name", "Tech Two").single();
    const { data: otherTicket } = await svc.from("tickets")
      .select("id").eq("assigned_to", tech2Profile!.id).limit(1).single();
    const tech1 = await signedInClient(TECH1.email, TECH1.password);
    const { data: updated } = await tech1.from("tickets")
      .update({ status: "resolved" }).eq("id", otherTicket!.id).select();
    expect(updated).toEqual([]); // no row matched under RLS -> no-op
  });
});

describe("RLS: admin", () => {
  it("sees all tickets", async () => {
    const admin = await signedInClient(ADMIN.email, ADMIN.password);
    const { data } = await admin.from("tickets").select("id");
    const svc = serviceClient();
    const { count } = await svc.from("tickets").select("id", { count: "exact", head: true });
    expect(data!.length).toBe(count);
  });
});
```

- [ ] **Step 5: Run tests to verify they fail (no seed yet)**

Run: `npm test -- tests/rls.test.ts`
Expected: FAIL (no seeded users/tickets). This confirms tests are wired. Seed comes in Task 3, then they pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0002_rls.sql tests/rls.test.ts tests/helpers.ts
git commit -m "feat(db): add RLS policies + is_admin helper + failing RLS tests"
```

---

### Task 3: Seed data (locations, staff users, tickets) → RLS tests pass

**Files:**
- Create: `supabase/seed.sql`
- Create: `scripts/seed-users.mjs`

**Interfaces:**
- Consumes: schema + RLS.
- Produces: 3 locations, 3 staff users (admin, tech1, tech2) with profiles, tickets assigned across techs. RLS tests from Task 2 pass.

- [ ] **Step 1: Create the auth users (service role) script**

Auth users can't be inserted via plain SQL, so create `scripts/seed-users.mjs`:
```javascript
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const users = [
  { email: "admin@fixflow.test", full_name: "Admin User", role: "admin" },
  { email: "tech1@fixflow.test", full_name: "Tech One", role: "tecnico" },
  { email: "tech2@fixflow.test", full_name: "Tech Two", role: "tecnico" },
];

for (const u of users) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email, password: "Password123!", email_confirm: true,
  });
  if (error && !error.message.includes("already")) throw error;
  const id = data?.user?.id;
  if (id) {
    await admin.from("profiles").upsert({ id, full_name: u.full_name, role: u.role });
  }
}
console.log("seeded users");
```

- [ ] **Step 2: Create `supabase/seed.sql` for locations + tickets**

```sql
insert into public.locations (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Sucursal Centro'),
  ('22222222-2222-2222-2222-222222222222', 'Sucursal Norte'),
  ('33333333-3333-3333-3333-333333333333', 'Sucursal Sur')
on conflict (id) do nothing;

-- tickets assigned to techs by full_name lookup
insert into public.tickets (location_id, description, status, assigned_to)
select '11111111-1111-1111-1111-111111111111', 'Leaking faucet', 'received',
       (select id from public.profiles where full_name = 'Tech One')
where exists (select 1 from public.profiles where full_name = 'Tech One');

insert into public.tickets (location_id, description, status, assigned_to)
select '22222222-2222-2222-2222-222222222222', 'Broken AC', 'in_progress',
       (select id from public.profiles where full_name = 'Tech Two')
where exists (select 1 from public.profiles where full_name = 'Tech Two');
```

- [ ] **Step 3: Run seed (users first, then SQL)**

Run:
```bash
node scripts/seed-users.mjs
npx supabase db reset   # re-applies migrations + seed.sql; then re-run users
node scripts/seed-users.mjs
```
Note: `db reset` wipes auth users, so run the user script AFTER reset. Document this order in README.

- [ ] **Step 4: Run RLS tests to verify they pass**

Run: `npm test -- tests/rls.test.ts`
Expected: PASS (all 3 describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql scripts/seed-users.mjs
git commit -m "feat(db): seed locations, staff users and tickets; RLS tests pass"
```

---

### Task 4: Supabase clients + staff auth (login, sign-out, route protection)

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `src/middleware.ts`
- Create: `src/lib/types.ts`
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Produces: `createBrowserClient()`, `createServerClient()`; `middleware` protecting `/dashboard`, `/tickets`, `/admin`; a working login page.

- [ ] **Step 1: DB row types**

Create `src/lib/types.ts`:
```typescript
export type UserRole = "admin" | "tecnico";
export type TicketStatus = "received" | "in_progress" | "resolved";

export interface Profile { id: string; full_name: string; role: UserRole; created_at: string; }
export interface Location { id: string; name: string; created_at: string; }
export interface Ticket {
  id: string; location_id: string; description: string; photo_path: string | null;
  customer_contact: string | null; status: TicketStatus; assigned_to: string | null; created_at: string;
}
```

- [ ] **Step 2: Browser + server clients (@supabase/ssr)**

Create `src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";
export const supabaseBrowser = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
```

Create `src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}
```

- [ ] **Step 3: Middleware session refresh + route protection**

Create `src/lib/supabase/middleware.ts` (standard @supabase/ssr `updateSession` helper — copy from Supabase Next.js docs) and `src/middleware.ts`:
```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
export async function middleware(request: NextRequest) { return updateSession(request); }
export const config = { matcher: ["/dashboard/:path*", "/tickets/:path*", "/admin/:path*"] };
```
In `updateSession`, if there is no user and the path starts with a protected prefix, redirect to `/login`.

- [ ] **Step 4: Login page**

Create `src/app/login/page.tsx`: a client component with email + password inputs (shadcn `Input`, `Button`), calling `supabaseBrowser().auth.signInWithPassword(...)`, then `router.push("/dashboard")` on success; show error via `sonner` toast.

- [ ] **Step 5: Manual verify**

Run `npm run dev`, go to `/login`, sign in as `admin@fixflow.test / Password123!`, confirm redirect to `/dashboard` (empty for now). Visiting `/dashboard` while logged out redirects to `/login`.

- [ ] **Step 6: Commit**

```bash
git add src/lib src/middleware.ts src/app/login
git commit -m "feat(auth): supabase clients, session middleware, staff login"
```

---

### Task 5: Public intake page (QR target) + photo upload + create ticket

**Files:**
- Create: `src/app/intake/[locationId]/page.tsx`
- Create: `src/components/intake-form.tsx`
- Create: `supabase/migrations/0003_storage.sql`
- Create: `tests/intake.smoke.test.ts`

**Interfaces:**
- Consumes: `tickets` insert policy (anon), `locations` read (anon).
- Produces: a public form that creates a ticket (+ optional photo in `ticket-photos`).

- [ ] **Step 1: Storage bucket + policies migration**

Create `supabase/migrations/0003_storage.sql`:
```sql
insert into storage.buckets (id, name, public) values ('ticket-photos', 'ticket-photos', false)
on conflict (id) do nothing;

create policy "ticket_photos_anon_upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'ticket-photos');
create policy "ticket_photos_staff_read" on storage.objects
  for select to authenticated using (bucket_id = 'ticket-photos');
```
Run `npx supabase migration up`.

- [ ] **Step 2: Write intake smoke test (failing)**

Create `tests/intake.smoke.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { anonClient, serviceClient } from "./helpers";

describe("intake happy path", () => {
  it("anon creates a ticket for a real location", async () => {
    const svc = serviceClient();
    const { data: loc } = await svc.from("locations").select("id").limit(1).single();
    const anon = anonClient();
    const { data, error } = await anon.from("tickets")
      .insert({ location_id: loc!.id, description: "smoke test problem" }).select().single();
    // anon cannot SELECT back its own insert (RLS), so expect insert ok, data null-ish
    expect(error).toBeNull();
    // verify via service role that the row exists
    const { data: check } = await svc.from("tickets").select("id").eq("description", "smoke test problem");
    expect(check!.length).toBeGreaterThan(0);
  });
});
```
Note: because anon has no SELECT, `.select().single()` after insert may error; if so, drop `.select().single()` and assert only `error` is null, then verify with service role. Adjust in Step 3.

- [ ] **Step 3: Build the intake form component**

Create `src/components/intake-form.tsx` (client): props `{ locationId: string; locationName: string }`. Fields: `description` (required, `Textarea`), `customer_contact` (optional `Input`), `photo` (optional `input type=file`). On submit:
1. If photo present: `supabaseBrowser().storage.from("ticket-photos").upload(path, file)`, where `path = ${crypto.randomUUID()}-${file.name}`.
2. `supabaseBrowser().from("tickets").insert({ location_id, description, customer_contact, photo_path })` (do NOT chain `.select()` — anon can't read back).
3. Show success screen ("Thanks, your request was received"); handle errors with a toast.

- [ ] **Step 4: Build the page (server component)**

Create `src/app/intake/[locationId]/page.tsx`: read `locationId` from params, fetch the location name with `supabaseServer().from("locations").select("name").eq("id", locationId).single()`; if not found, render a friendly "invalid QR" message; else render `<IntakeForm locationId={locationId} locationName={name} />`.

- [ ] **Step 5: Run smoke test + manual check**

Run: `npm test -- tests/intake.smoke.test.ts` (adjust per Step 2 note until PASS). Manually open `/intake/11111111-1111-1111-1111-111111111111`, submit a request, confirm success screen; verify the row via `npx supabase studio`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0003_storage.sql src/app/intake src/components/intake-form.tsx tests/intake.smoke.test.ts
git commit -m "feat(intake): public QR intake form with optional photo upload"
```

---

### Task 6: Staff dashboard + ticket detail (status update, admin assign)

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/tickets/[id]/page.tsx`
- Create: `src/components/ticket-status-form.tsx`, `src/components/assign-form.tsx`

**Interfaces:**
- Consumes: RLS SELECT/UPDATE policies; `Ticket`, `Profile` types.
- Produces: RLS-filtered ticket list; detail view with status update (all staff on own/all per role) and assignment (admin only).

- [ ] **Step 1: Dashboard (server component)**

Create `src/app/dashboard/page.tsx`: `const supabase = await supabaseServer();` then `supabase.from("tickets").select("id, description, status, created_at, location_id, assigned_to").order("created_at", { ascending: false })`. Because of RLS, admins get all rows and técnicos get only theirs automatically. Render a shadcn `Table` with a status `Badge` and a link to `/tickets/[id]`. Also fetch the current user's role from `profiles` to show an "Admin" indicator.

- [ ] **Step 2: Ticket detail (server component)**

Create `src/app/tickets/[id]/page.tsx`: fetch the ticket by id (RLS returns it only if allowed); if null, render "Not found or no access". Show description, location name, status, photo (signed URL via `supabase.storage.from("ticket-photos").createSignedUrl(photo_path, 60)` if present). Render `<TicketStatusForm />` and, if the user is admin, `<AssignForm />` with the list of técnicos.

- [ ] **Step 3: Status + assign client components**

Create `src/components/ticket-status-form.tsx`: a `Select` of the 3 statuses + a Save button calling `supabaseBrowser().from("tickets").update({ status }).eq("id", id)`. RLS ensures a técnico can only update their own; surface a toast on error/empty result.
Create `src/components/assign-form.tsx`: a `Select` of técnicos (`profiles` where role = 'tecnico') + Save calling `.update({ assigned_to })`. Only rendered for admins.

- [ ] **Step 4: Manual verify (role behavior)**

Sign in as `tech1@fixflow.test`: dashboard shows only tech1's tickets; opening a tech2 ticket URL shows "Not found or no access". Sign in as `admin@fixflow.test`: sees all, can reassign.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard src/app/tickets src/components/ticket-status-form.tsx src/components/assign-form.tsx
git commit -m "feat(staff): RLS-filtered dashboard + ticket detail with status/assign"
```

---

### Task 7: Admin locations page + QR generation

**Files:**
- Create: `src/app/admin/locations/page.tsx`
- Create: `src/components/location-qr.tsx`

**Interfaces:**
- Consumes: `locations` (admin), `qrcode` lib, `NEXT_PUBLIC_SITE_URL`.
- Produces: an admin-only page listing locations with a downloadable QR pointing to `/intake/[id]`.

- [ ] **Step 1: Add site URL env**

Append to `.env.local.example` and `.env.local`: `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.

- [ ] **Step 2: QR component**

Create `src/components/location-qr.tsx` (client): props `{ locationId, locationName }`. On mount, `QRCode.toDataURL(`${process.env.NEXT_PUBLIC_SITE_URL}/intake/${locationId}`)` and render the image + a "Download" link. Use `qrcode`.

- [ ] **Step 3: Admin page (server component, admin-guarded)**

Create `src/app/admin/locations/page.tsx`: fetch the user's role; if not admin, render "Admins only". Else fetch `locations` and render each with `<LocationQr />`.

- [ ] **Step 4: Manual verify**

As admin, `/admin/locations` shows QR codes; scanning one (or opening the encoded URL) lands on the correct intake form. As técnico, the page shows "Admins only".

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/locations src/components/location-qr.tsx
git commit -m "feat(admin): locations page with per-location QR codes"
```

---

### Task 8: Edge Function (email via Resend) + Database Webhook

**Files:**
- Create: `supabase/functions/notify-ticket/index.ts`
- Create: `docs/webhook-setup.md`

**Interfaces:**
- Consumes: a new row in `tickets`; secrets `RESEND_API_KEY`, `STAFF_NOTIFY_EMAIL`.
- Produces: an email to staff on each new ticket.

- [ ] **Step 1: Write the Edge Function**

Create `supabase/functions/notify-ticket/index.ts`:
```typescript
// deno-lint-ignore-file no-explicit-any
Deno.serve(async (req) => {
  const payload = await req.json();
  const ticket = payload.record; // Database Webhook sends { type, record, ... }
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("STAFF_NOTIFY_EMAIL");
  if (!RESEND_API_KEY || !to) return new Response("missing secrets", { status: 500 });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" }, status: 200,
  });
});
```

- [ ] **Step 2: Set secrets + serve locally**

Run:
```bash
npx supabase secrets set RESEND_API_KEY=... STAFF_NOTIFY_EMAIL=you@example.com
npx supabase functions serve notify-ticket --no-verify-jwt
```
Test with a curl POST simulating a webhook payload `{ "record": { "description": "test", "status": "received" } }`; expect `{ "emailed": true }` (or false if Resend key not set locally).

- [ ] **Step 3: Document the webhook wiring**

Create `docs/webhook-setup.md`: in the hosted Supabase dashboard, Database → Webhooks → create a webhook on `public.tickets` INSERT that POSTs to the deployed `notify-ticket` function URL. (Local dev can trigger manually via curl.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/notify-ticket/index.ts docs/webhook-setup.md
git commit -m "feat(edge): notify-ticket Edge Function emails staff via Resend"
```

---

### Task 9: README case study + deployment

**Files:**
- Create/Modify: `README.md`

**Interfaces:**
- Produces: a portfolio-facing README (English) and deploy notes.

- [ ] **Step 1: Write the README (English, case-study style)**

Sections: What it is (1 paragraph) · Live demo + login credentials for a read-only demo admin · Architecture diagram (the loop) · **Security: how RLS enforces 3 tiers** (this is the headline for the target role) · Tech stack · Local setup (supabase start, migrate, seed order, env) · Testing (how to run RLS tests) · Screenshots.

- [ ] **Step 2: Deploy backend + frontend**

Run:
```bash
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase functions deploy notify-ticket
```
Deploy frontend to Vercel (import repo, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`). Wire the Database Webhook per `docs/webhook-setup.md`.

- [ ] **Step 3: Final verify (production smoke)**

Scan/open a live location QR → submit a request → confirm the staff email arrives → log in as demo admin → see the ticket. Confirm console is clean.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: portfolio README case study + deploy notes"
```

---

## Self-Review

**Spec coverage:** Every spec section maps to a task — schema (T1), Auth+roles (T4), RLS 3-tier (T2), Edge Function+webhook+secrets (T8), Storage/photos (T3-storage in T5, T5), screens (T4-T7), error handling (T5/T6 friendly states), testing (T2 RLS + T5 smoke), deploy+README (T9), growth roadmap (documented in spec, out of v1 scope). No uncovered requirement.

**Placeholder scan:** SQL, RLS, tests, Edge Function have complete code. Frontend component tasks (T4 login, T5 form, T6/T7 pages) describe exact files, props, calls, and the specific Supabase methods to use; a couple reference standard @supabase/ssr boilerplate (`updateSession`) that is copied from official docs during execution — acceptable, not a logic placeholder.

**Type consistency:** enum values (`received`/`in_progress`/`resolved`, `admin`/`tecnico`), table/column names, and `Ticket`/`Profile`/`Location` types are consistent across schema (T1), types (T4), tests (T2/T5), and UI (T5-T7). `is_admin()` defined in T2 and used in T2/T6/T7.
