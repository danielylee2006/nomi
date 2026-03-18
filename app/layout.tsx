import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Nomi",
  description: "Discover Asian snacks, save favorites, and share reviews.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-cream font-sans text-ink antialiased">
        <div className="min-h-screen bg-grain">
          <SiteHeader />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
