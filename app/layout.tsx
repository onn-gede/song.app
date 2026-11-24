import { ConnectionStatus } from "@/components/ConnectionStatus";
import { AuditPrintTracker } from "@/components/AuditPrintTracker";
import type { Metadata, Viewport } from "next";
import "./styles/index.css";
import { InitialAppLoader } from "@/components/InitialAppLoader";

export const metadata: Metadata = {
  title: "SongApp BCBgiroc",
  description: "Cântări, programe și wishlisturi pentru întâlnirile bisericii",
  applicationName: "SongApp BCBgiroc",
  appleWebApp: { capable: true, title: "SongApp", statusBarStyle: "default" },
  icons: { apple: [{ url: "/icons/songapp-apple-180.png", sizes: "180x180", type: "image/png" }] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#245b40",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" style={{ backgroundColor: "#f5f7f1" }}>
      <body style={{ backgroundColor: "#f5f7f1" }}>
        <InitialAppLoader />
        <ConnectionStatus />
        {children}
        <AuditPrintTracker />
      </body>
    </html>
  );
}
