import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const anonClient = () => createClient(url, anon);
export const serviceClient = () =>
  createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

// sign in as an existing seeded user and return an authed client
export async function signedInClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}
