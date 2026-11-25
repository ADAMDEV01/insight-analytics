import type { Metadata } from "next";
import { ProjectManager } from "@/components/project-manager";
export const metadata: Metadata = { title: "Projects and keys" };
export default function ProjectsPage() { return <ProjectManager />; }
