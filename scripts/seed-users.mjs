import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

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

const profileIds = {};

for (const u of users) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: "Password123!",
    email_confirm: true,
  });
  if (error && !error.message.includes("already")) throw error;
  let id = data?.user?.id;
  // if the user already existed, look up their id
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers();
    id = list?.users?.find((x) => x.email === u.email)?.id;
  }
  if (id) {
    await admin
      .from("profiles")
      .upsert({ id, full_name: u.full_name, role: u.role });
    profileIds[u.full_name] = id;
  }
}

// Locations (idempotent). On hosted these are NOT seeded by supabase/seed.sql, because
// `supabase db push` only applies migrations (not the seed), so seed them here too.
const LOCATIONS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Sucursal Centro" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Sucursal Norte" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Sucursal Sur" },
];
{
  const { error } = await admin
    .from("locations")
    .upsert(LOCATIONS, { onConflict: "id" });
  if (error) throw error;
}

// Demo tickets, assigned across técnicos. Auth users (hence profiles) don't exist
// when supabase/seed.sql runs, so tickets are seeded here where the ids are known.
// Idempotent: clear the demo rows by description first, then re-insert.
const DEMO = [
  {
    location_id: "11111111-1111-1111-1111-111111111111",
    description: "Leaking faucet",
    status: "received",
    tech: "Tech One",
  },
  {
    location_id: "22222222-2222-2222-2222-222222222222",
    description: "Broken AC",
    status: "in_progress",
    tech: "Tech Two",
  },
];

await admin
  .from("tickets")
  .delete()
  .in(
    "description",
    DEMO.map((d) => d.description)
  );

for (const d of DEMO) {
  const assigned_to = profileIds[d.tech];
  if (assigned_to) {
    const { error } = await admin.from("tickets").insert({
      location_id: d.location_id,
      description: d.description,
      status: d.status,
      assigned_to,
    });
    if (error) throw error;
  }
}

console.log("seeded users + demo tickets");
