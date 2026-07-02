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

const UNASSIGNED = "unassigned";

export function AssignForm({
  ticketId,
  current,
  technicians,
}: {
  ticketId: string;
  current: string | null;
  technicians: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [assigned, setAssigned] = useState<string>(current ?? UNASSIGNED);
  const [saving, setSaving] = useState(false);

  const currentLabel =
    assigned === UNASSIGNED
      ? "Unassigned"
      : technicians.find((t) => t.id === assigned)?.full_name ?? "Unassigned";

  async function save() {
    setSaving(true);
    const value = assigned === UNASSIGNED ? null : assigned;
    const { error } = await supabaseBrowser()
      .from("tickets")
      .update({ assigned_to: value })
      .eq("id", ticketId)
      .select();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assignment updated");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Label>Assigned to</Label>
      <Select
        value={assigned}
        onValueChange={(v) => setAssigned(v ?? UNASSIGNED)}
      >
        <SelectTrigger className="w-48">{currentLabel}</SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {technicians.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={save} disabled={saving} size="sm">
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
