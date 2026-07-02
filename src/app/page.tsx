import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight">FixFlow</h1>
      <p className="text-lg text-muted-foreground">
        QR-based service-request intake. Customers scan a location code and report a
        problem in seconds; staff triage the tickets behind role-based access control.
      </p>
      <p className="text-sm text-muted-foreground">
        A demo of Supabase Auth, 3-tier Row Level Security, Storage, and an Edge Function.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/login" className={buttonVariants()}>
          Staff login
        </Link>
        <Link
          href="/intake/11111111-1111-1111-1111-111111111111"
          className={buttonVariants({ variant: "outline" })}
        >
          Try the demo intake
        </Link>
      </div>
    </main>
  );
}
