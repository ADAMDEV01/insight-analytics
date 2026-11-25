import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "INSIGHT — Product Analytics", template: "%s | INSIGHT" },
  description: "Understand your product with clear, actionable analytics.",
  applicationName: "INSIGHT",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>;
}
