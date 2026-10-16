import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./design-system.css";
import "./dark-theme.css";
import "./focus.css";
import { Shell } from "@/components/shell";

export const metadata: Metadata = {
  title: "Rolodex · Collins Creative",
  icons: { icon: "/rolodex-icon.svg", apple: "/rolodex-logo.png" },
  appleWebApp: { capable: true, title: "Rolodex", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f7f8fa" }, { media: "(prefers-color-scheme: dark)", color: "#0D141F" }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('rx-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}})()` }} /></head><body><Shell>{children}</Shell></body></html>;
}
