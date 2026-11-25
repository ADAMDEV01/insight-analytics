import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
export const metadata: Metadata = { title: "Sign in" };
export default function SignInPage() { return <main className="grid min-h-screen place-items-center bg-background px-5 py-12"><AuthForm mode="sign-in" /><Link href="/" className="fixed bottom-5 text-xs text-muted hover:text-foreground">← Back to INSIGHT</Link></main>; }
