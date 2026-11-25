import type { Metadata } from "next";
import { FunnelBuilder } from "@/components/funnel-builder";
export const metadata: Metadata = { title: "Funnels" };
export default function FunnelsPage() { return <FunnelBuilder />; }
