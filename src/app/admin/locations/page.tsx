import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { LocationQr } from "@/components/location-qr";

export default async function AdminLocationsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "admin") {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-6">
        <p className="text-muted-foreground">Admins only.</p>
        <Link href="/dashboard" className="underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name")
    .order("name");

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Locations &amp; QR codes</h1>
        <Link href="/dashboard" className="text-sm underline">
          &larr; Dashboard
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Print a QR and place it on-site. Scanning it opens the public intake form for
        that location.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {(locations ?? []).map((l) => (
          <LocationQr key={l.id} locationId={l.id} locationName={l.name} />
        ))}
      </div>
    </main>
  );
}
