import type { Metadata } from "next";
import { ReportsManager } from "@/components/reports-manager";
export const metadata: Metadata = { title: "Saved reports" };
export default function ReportsPage() { return <ReportsManager />; }
