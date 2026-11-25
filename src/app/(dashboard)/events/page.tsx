import type { Metadata } from "next";
import { EventsExplorer } from "@/components/events-explorer";
export const metadata: Metadata = { title: "Events explorer" };
export default function EventsPage() { return <EventsExplorer />; }
