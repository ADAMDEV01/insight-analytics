"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const result = isSignUp
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: "/overview" })
        : await authClient.signIn.email({ email: email.trim(), password, callbackURL: "/overview" });
      if (result.error) {
        setError(result.error.message || "Authentication failed. Please review your details.");
        return;
      }
      router.replace("/overview");
      router.refresh();
    } catch {
      setError("We could not complete the request. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-white shadow-lg shadow-violet-500/20"><Sparkles size={21} /></div>
        <div><p className="text-lg font-bold tracking-tight">INSIGHT</p><p className="text-xs text-muted">Product analytics, made clear.</p></div>
      </div>
      <div className="surface rounded-3xl p-7 shadow-2xl shadow-black/10 sm:p-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-accent">Your workspace</p>
        <h1 className="text-2xl font-semibold tracking-tight">{isSignUp ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-2 text-sm text-muted">{isSignUp ? "Start understanding what your users do." : "Sign in to continue to your analytics."}</p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          {isSignUp && <label className="block space-y-2"><span className="text-xs font-medium text-muted">Full name</span><input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="surface-raised h-11 w-full rounded-xl px-3 text-sm outline-none focus:border-accent" placeholder="Alex Morgan" /></label>}
          <label className="block space-y-2"><span className="text-xs font-medium text-muted">Email address</span><span className="surface-raised flex h-11 items-center gap-3 rounded-xl px-3"><Mail size={16} className="text-muted" /><input autoComplete="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="you@company.com" /></span></label>
          <label className="block space-y-2"><span className="text-xs font-medium text-muted">Password</span><span className="surface-raised flex h-11 items-center gap-3 rounded-xl px-3"><LockKeyhole size={16} className="text-muted" /><input autoComplete={isSignUp ? "new-password" : "current-password"} type="password" required minLength={10} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="At least 10 characters" /></span></label>
          {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
          <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? <LoaderCircle size={17} className="animate-spin" /> : null}{isSignUp ? "Create account" : "Sign in"}<ArrowRight size={16} /></Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">{isSignUp ? "Already have an account? " : "New to INSIGHT? "}<Link className="font-semibold text-foreground hover:text-accent" href={isSignUp ? "/sign-in" : "/sign-up"}>{isSignUp ? "Sign in" : "Create account"}</Link></p>
      </div>
      <p className="mt-5 text-center text-xs leading-5 text-muted">By continuing, you agree to use this workspace responsibly. Do not upload sensitive personal data without an approved privacy and retention policy.</p>
    </div>
  );
}
