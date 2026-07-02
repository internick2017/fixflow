import { describe, it, expect } from "vitest";
import { anonClient, serviceClient } from "./helpers";

describe("intake happy path", () => {
  it("anon creates a ticket for a real location", async () => {
    const svc = serviceClient();
    const { data: loc } = await svc.from("locations").select("id").limit(1).single();
    const anon = anonClient();
    // anon has INSERT but no SELECT, so do NOT chain .select() here
    const { error } = await anon.from("tickets").insert({
      location_id: loc!.id,
      description: "smoke test problem",
    });
    expect(error).toBeNull();
    // verify via service role that the row exists
    const { data: check } = await svc
      .from("tickets")
      .select("id")
      .eq("description", "smoke test problem");
    expect(check!.length).toBeGreaterThan(0);
  });
});
