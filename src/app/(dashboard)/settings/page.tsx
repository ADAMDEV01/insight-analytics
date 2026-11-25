import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsPanel } from "@/components/settings-panel";
import { getRequiredSession } from "@/lib/session";
export const metadata: Metadata = { title: "Settings" };
export default async function SettingsPage() { const session=await getRequiredSession(); if(!session) redirect("/sign-in"); return <SettingsPanel account={{name:session.user.name||"Member",email:session.user.email}}/>; }
