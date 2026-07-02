import { supabaseServer } from "@/lib/supabase/server";
import { IntakeForm } from "@/components/intake-form";

export default async function IntakePage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;
  const supabase = await supabaseServer();
  const { data: location } = await supabase
    .from("locations")
    .select("name")
    .eq("id", locationId)
    .single();

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      {location ? (
        <IntakeForm locationId={locationId} locationName={location.name} />
      ) : (
        <div className="text-center">
          <h1 className="text-xl font-semibold">Invalid QR code</h1>
          <p className="text-muted-foreground">
            This location was not found. Please scan a valid code.
          </p>
        </div>
      )}
    </main>
  );
}
