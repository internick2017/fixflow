import { describe, it, expect } from "vitest";
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
      location_id: loc!.id,
      description: "anon test ticket",
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
    const {
      data: { user },
    } = await tech1.auth.getUser();
    expect(data!.every((t) => t.assigned_to === user!.id)).toBe(true);
    expect(data!.length).toBeGreaterThan(0); // seed assigns at least one to tech1
  });

  it("cannot update a ticket assigned to someone else", async () => {
    const svc = serviceClient();
    const { data: tech2Profile } = await svc
      .from("profiles")
      .select("id")
      .eq("full_name", "Tech Two")
      .single();
    const { data: otherTicket } = await svc
      .from("tickets")
      .select("id")
      .eq("assigned_to", tech2Profile!.id)
      .limit(1)
      .single();
    const tech1 = await signedInClient(TECH1.email, TECH1.password);
    const { data: updated } = await tech1
      .from("tickets")
      .update({ status: "resolved" })
      .eq("id", otherTicket!.id)
      .select();
    expect(updated).toEqual([]); // no row matched under RLS -> no-op
  });
});

describe("RLS: admin", () => {
  it("sees all tickets", async () => {
    const admin = await signedInClient(ADMIN.email, ADMIN.password);
    const { data } = await admin.from("tickets").select("id");
    const svc = serviceClient();
    const { count } = await svc
      .from("tickets")
      .select("id", { count: "exact", head: true });
    expect(data!.length).toBe(count);
  });
});
