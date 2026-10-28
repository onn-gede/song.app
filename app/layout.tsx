import { AuditPrintTracker } from "@/components/AuditPrintTracker";
import type { Metadata } from "next";
import "./globals.css";
import "./redesign.css";
import "./compact.css";

export const metadata: Metadata = {
  title: "SongApp BCBgiroc",
  description: "Cântări, programe și playlisturi pentru întâlnirile bisericii"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">

      <body>{children}<AuditPrintTracker/></body>
    </html>
  );
}
