import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { TicketStatusForm } from "@/components/ticket-status-form";
import { AssignForm } from "@/components/assign-form";
import type { TicketStatus } from "@/lib/types";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();
  const isAdmin = profile?.role === "admin";

  // RLS returns this row only if the user is admin or it's assigned to them.
  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, description, status, photo_path, customer_contact, location_id, assigned_to, created_at"
    )
    .eq("id", id)
    .single();

  if (!ticket) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-6">
        <p className="text-muted-foreground">Not found or no access.</p>
        <Link href="/dashboard" className="underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const { data: location } = await supabase
    .from("locations")
    .select("name")
    .eq("id", ticket.location_id)
    .single();

  let photoUrl: string | null = null;
  if (ticket.photo_path) {
    const { data: signed } = await supabase.storage
      .from("ticket-photos")
      .createSignedUrl(ticket.photo_path, 60);
    photoUrl = signed?.signedUrl ?? null;
  }

  const technicians = isAdmin
    ? (
        await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "tecnico")
      ).data ?? []
    : [];

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <Link href="/dashboard" className="text-sm underline">
        &larr; Back
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{ticket.description}</h1>
        <p className="text-sm text-muted-foreground">
          {location?.name} · {new Date(ticket.created_at).toLocaleString()}
        </p>
      </div>
      {ticket.customer_contact && (
        <p className="text-sm">Contact: {ticket.customer_contact}</p>
      )}
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt="Ticket attachment"
          className="max-h-80 rounded-md border"
        />
      )}
      <div className="flex flex-wrap gap-8">
        <TicketStatusForm
          ticketId={ticket.id}
          current={ticket.status as TicketStatus}
        />
        {isAdmin && (
          <AssignForm
            ticketId={ticket.id}
            current={ticket.assigned_to}
            technicians={technicians}
          />
        )}
      </div>
    </main>
  );
}
