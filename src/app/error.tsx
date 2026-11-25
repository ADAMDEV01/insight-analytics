"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("INSIGHT route error", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-12 text-foreground">
      <section className="surface w-full max-w-md rounded-3xl p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-400"><AlertTriangle size={21} /></span>
        <h1 className="mt-5 text-xl font-semibold">This view hit a snag</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Your workspace data is safe. Retry the view, or return to the overview.</p>
        {error.digest && <p className="mt-3 text-[10px] text-muted">Reference: {error.digest}</p>}
        <button onClick={() => reset()} className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white"><RefreshCw size={15} />Try again</button>
      </section>
    </main>
  );
}
