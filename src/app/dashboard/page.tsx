import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/sign-out-button";
import type { TicketStatus } from "@/lib/types";

const STATUS_LABEL: Record<TicketStatus, string> = {
  received: "Received",
  in_progress: "In progress",
  resolved: "Resolved",
};

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user!.id)
    .single();
  // RLS returns all tickets for admins and only assigned tickets for técnicos.
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, description, status, created_at, location_id, assigned_to")
    .order("created_at", { ascending: false });

  const isAdmin = profile?.role === "admin";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tickets</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.full_name} · {isAdmin ? "Admin" : "Técnico"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link href="/admin/locations" className="text-sm underline">
              Locations &amp; QR
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(tickets ?? []).map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <Link href={`/tickets/${t.id}`} className="underline">
                  {t.description}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {STATUS_LABEL[t.status as TicketStatus]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(t.created_at).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
          {(!tickets || tickets.length === 0) && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                No tickets to show yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
