import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import { AuthModal } from "@/components/AuthModal";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { SessionProvider } from "@/components/SessionProvider";
import "./globals.css";

// next/font self-hosts the files and emits a `size-adjust` fallback, so the
// display face swapping in never shifts the hero. Each family is exposed as a
// CSS variable that tailwind.config.js maps onto font-display/body/mono.
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atlas Studio — a Dodo Payments reference app",
  description:
    "A small AI image studio demonstrating every Dodo Payments billing model: one-time packs, subscriptions, usage-based metering, seats, on-demand top-ups and license keys.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen flex flex-col bg-ink-50 font-body text-ink-900 antialiased">
        <SessionProvider>
          <Navbar />
          <div className="flex-1 flex flex-col">{children}</div>
          <Footer />
          <AuthModal />
        </SessionProvider>
      </body>
    </html>
  );
}
