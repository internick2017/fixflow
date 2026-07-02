"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { TicketStatus } from "@/lib/types";

const STATUS_LABEL: Record<TicketStatus, string> = {
  received: "Received",
  in_progress: "In progress",
  resolved: "Resolved",
};

const STATUSES = Object.keys(STATUS_LABEL) as TicketStatus[];

export function TicketStatusForm({
  ticketId,
  current,
}: {
  ticketId: string;
  current: TicketStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TicketStatus>(current);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    // .select() lets us detect a no-op caused by RLS (0 rows returned).
    const { data, error } = await supabaseBrowser()
      .from("tickets")
      .update({ status })
      .eq("id", ticketId)
      .select();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error("You don't have permission to update this ticket.");
      return;
    }
    toast.success("Status updated");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Label>Status</Label>
      <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)}>
        <SelectTrigger className="w-48">{STATUS_LABEL[status]}</SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={save} disabled={saving || status === current} size="sm">
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
